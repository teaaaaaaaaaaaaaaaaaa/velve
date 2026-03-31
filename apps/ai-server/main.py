from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import requests
import numpy as np
import faiss
import threading
import io
import pickle

load_dotenv()

app = FastAPI(title="Velve AI Server")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

# FAISS persistence paths
FAISS_INDEX_PATH = "data/faiss_index.bin"
FAISS_IDS_PATH = "data/faiss_ids.pkl"

# ---------------------------------------------------------------------------
# CLIP model (loaded lazily on first request)
# ---------------------------------------------------------------------------
clip_model = None
clip_processor = None
clip_lock = threading.Lock()


def get_clip():
    global clip_model, clip_processor
    if clip_model is None:
        with clip_lock:
            if clip_model is None:
                from transformers import CLIPModel, CLIPProcessor
                model_name = "openai/clip-vit-base-patch32"
                clip_processor = CLIPProcessor.from_pretrained(model_name)
                clip_model = CLIPModel.from_pretrained(model_name)
                clip_model.eval()
    return clip_model, clip_processor


# ---------------------------------------------------------------------------
# FAISS index (persisted to disk)
# ---------------------------------------------------------------------------
faiss_index = None
faiss_ids = []  # maps FAISS position -> item_id string
faiss_lock = threading.Lock()


def load_faiss_index():
    """Load FAISS index and IDs from disk if they exist"""
    global faiss_index, faiss_ids
    try:
        if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_IDS_PATH):
            with faiss_lock:
                faiss_index = faiss.read_index(FAISS_INDEX_PATH)
                with open(FAISS_IDS_PATH, "rb") as f:
                    faiss_ids = pickle.load(f)
            print(f"[FAISS] Loaded index with {len(faiss_ids)} items from disk")
        else:
            print("[FAISS] No persisted index found, starting fresh")
    except Exception as e:
        print(f"[FAISS] Failed to load index from disk: {e}")


def save_faiss_index():
    """Save FAISS index and IDs to disk"""
    try:
        os.makedirs("data", exist_ok=True)
        with faiss_lock:
            if faiss_index is not None:
                faiss.write_index(faiss_index, FAISS_INDEX_PATH)
                with open(FAISS_IDS_PATH, "wb") as f:
                    pickle.dump(faiss_ids, f)
        print(f"[FAISS] Saved index with {len(faiss_ids)} items to disk")
    except Exception as e:
        print(f"[FAISS] Failed to save index to disk: {e}")


# ---------------------------------------------------------------------------
# Startup event - load FAISS index from disk
# ---------------------------------------------------------------------------
@app.on_event("startup")
def startup_event():
    print("[AI Server] Starting up...")
    load_faiss_index()
    print("[AI Server] Ready")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/ping")
def ping():
    return {"status": "ok", "message": "Velve AI server running"}


# ---------------------------------------------------------------------------
# POST /generate-description — Ollama + Qwen2.5 7B
# ---------------------------------------------------------------------------
class DescriptionRequest(BaseModel):
    category: str
    size: str = ""
    brand: str = ""
    condition: str = ""
    color: str = ""
    language: str = "en"


@app.post("/generate-description")
def generate_description(req: DescriptionRequest):
    details = []
    if req.brand:
        details.append(f"Brand: {req.brand}")
    if req.size:
        details.append(f"Size: {req.size}")
    if req.condition:
        details.append(f"Condition: {req.condition}")
    if req.color:
        details.append(f"Color: {req.color}")
    details.append(f"Category: {req.category}")
    details_str = ", ".join(details)

    if req.language == "sr":
        prompt = (
            f"Ti si copywriter za aplikaciju za razmenu garderobe. "
            f"Napravi kratak naslov (max 8 reči) i opis (max 2 rečenice) za ovaj predmet: {details_str}. "
            f"Odgovori SAMO u formatu:\nTitle: ...\nDescription: ..."
        )
    else:
        prompt = (
            f"You are a copywriter for a clothing exchange app. "
            f"Write a short title (max 8 words) and description (max 2 sentences) for this item: {details_str}. "
            f"Reply ONLY in this format:\nTitle: ...\nDescription: ..."
        )

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": "qwen2.5:7b", "prompt": prompt, "stream": False},
            timeout=60,
        )
        resp.raise_for_status()
        text = resp.json().get("response", "")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Ollama error: {str(e)}")

    # Parse title and description from LLM output
    title = ""
    description = ""
    for line in text.strip().split("\n"):
        line = line.strip()
        if line.lower().startswith("title:"):
            title = line.split(":", 1)[1].strip()
        elif line.lower().startswith("description:"):
            description = line.split(":", 1)[1].strip()

    return {"title": title, "description": description, "raw": text}


# ---------------------------------------------------------------------------
# POST /embed — CLIP image embedding (512-dim)
# ---------------------------------------------------------------------------
class EmbedRequest(BaseModel):
    image_url: str


@app.post("/embed")
def embed_image(req: EmbedRequest):
    import torch
    from PIL import Image

    try:
        resp = requests.get(req.image_url, timeout=15)
        resp.raise_for_status()
        image = Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot fetch image: {str(e)}")

    model, processor = get_clip()
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embedding = model.get_image_features(**inputs)
    # Normalize and convert to list
    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    vector = embedding.squeeze().tolist()

    return {"embedding": vector, "dimensions": len(vector)}


# ---------------------------------------------------------------------------
# POST /index — rebuild FAISS index from provided embeddings
# ---------------------------------------------------------------------------
class IndexItem(BaseModel):
    item_id: str
    embedding: list[float]


class IndexRequest(BaseModel):
    items: list[IndexItem]


@app.post("/index")
def rebuild_index(req: IndexRequest):
    global faiss_index, faiss_ids

    if not req.items:
        with faiss_lock:
            faiss_index = None
            faiss_ids = []
        save_faiss_index()
        return {"ok": True, "indexed": 0}

    dim = len(req.items[0].embedding)
    vectors = np.array([item.embedding for item in req.items], dtype=np.float32)
    ids = [item.item_id for item in req.items]

    index = faiss.IndexFlatIP(dim)  # inner product (cosine on normalized vectors)
    index.add(vectors)

    with faiss_lock:
        faiss_index = index
        faiss_ids = ids

    # Persist to disk
    save_faiss_index()

    return {"ok": True, "indexed": len(ids)}


# ---------------------------------------------------------------------------
# POST /similar — find visually similar items via FAISS
# ---------------------------------------------------------------------------
class SimilarRequest(BaseModel):
    embedding: list[float]
    top_k: int = 10
    exclude_id: str = ""


@app.post("/similar")
def find_similar(req: SimilarRequest):
    if faiss_index is None or faiss_index.ntotal == 0:
        return {"results": []}

    query = np.array([req.embedding], dtype=np.float32)
    # Search for more than top_k in case we need to exclude
    k = min(req.top_k + 5, faiss_index.ntotal)
    distances, indices = faiss_index.search(query, k)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx < 0 or idx >= len(faiss_ids):
            continue
        item_id = faiss_ids[idx]
        if item_id == req.exclude_id:
            continue
        results.append({"item_id": item_id, "score": float(dist)})
        if len(results) >= req.top_k:
            break

    return {"results": results}


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
