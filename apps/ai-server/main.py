import io
import os
import pickle
import threading

import faiss
import numpy as np
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

load_dotenv()

app = FastAPI(title="Velve AI Server")

try:
    faiss.omp_set_num_threads(1)
except Exception:
    pass

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
IMAGE_FETCH_HEADERS = {
    "User-Agent": "VelveAI/1.0 (+https://velve.app)",
    "Accept": "image/*,*/*;q=0.8",
}

FAISS_INDEX_PATH = "data/faiss_index.bin"
FAISS_IDS_PATH = "data/faiss_ids.pkl"

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


faiss_index = None
faiss_ids = []
faiss_lock = threading.Lock()


def load_faiss_index():
    global faiss_index, faiss_ids
    try:
        if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_IDS_PATH):
            with faiss_lock:
                faiss_index = faiss.read_index(FAISS_INDEX_PATH)
                with open(FAISS_IDS_PATH, "rb") as handle:
                    faiss_ids = pickle.load(handle)
            print(f"[FAISS] Loaded index with {len(faiss_ids)} items from disk")
        else:
            print("[FAISS] No persisted index found, starting fresh")
    except Exception as error:
        print(f"[FAISS] Failed to load index from disk: {error}")


def save_faiss_index():
    try:
        os.makedirs("data", exist_ok=True)
        with faiss_lock:
            if faiss_index is not None:
                faiss.write_index(faiss_index, FAISS_INDEX_PATH)
                with open(FAISS_IDS_PATH, "wb") as handle:
                    pickle.dump(faiss_ids, handle)
        print(f"[FAISS] Saved index with {len(faiss_ids)} items to disk")
    except Exception as error:
        print(f"[FAISS] Failed to save index to disk: {error}")


@app.on_event("startup")
def startup_event():
    print("[AI Server] Starting up...")
    load_faiss_index()
    print("[AI Server] Ready")


@app.get("/ping")
def ping():
    return {"status": "ok", "message": "Velve AI server running"}


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
            "Ti si copywriter za aplikaciju za razmenu garderobe. "
            f"Napravi kratak naslov (max 8 reci) i opis (max 2 recenice) za ovaj predmet: {details_str}. "
            "Odgovori SAMO u formatu:\nTitle: ...\nDescription: ..."
        )
    elif req.language == "ru":
        prompt = (
            "Ты copywriter для приложения по обмену одеждой. "
            f"Напиши короткий заголовок (максимум 8 слов) и описание (максимум 2 предложения) для этого предмета: {details_str}. "
            "Ответь ТОЛЬКО в формате:\nTitle: ...\nDescription: ..."
        )
    else:
        prompt = (
            "You are a copywriter for a clothing exchange app. "
            f"Write a short title (max 8 words) and description (max 2 sentences) for this item: {details_str}. "
            "Reply ONLY in this format:\nTitle: ...\nDescription: ..."
        )

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": "qwen2.5:7b", "prompt": prompt, "stream": False},
            timeout=60,
        )
        response.raise_for_status()
        text = response.json().get("response", "")
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail=f"Ollama error: {str(error)}")

    title = ""
    description = ""
    for line in text.strip().split("\n"):
        line = line.strip()
        if line.lower().startswith("title:"):
            title = line.split(":", 1)[1].strip()
        elif line.lower().startswith("description:"):
            description = line.split(":", 1)[1].strip()

    return {"title": title, "description": description, "raw": text}


class EmbedRequest(BaseModel):
    image_url: str


@app.post("/embed")
def embed_image(req: EmbedRequest):
    import torch
    from PIL import Image

    try:
        response = requests.get(req.image_url, timeout=15, headers=IMAGE_FETCH_HEADERS)
        response.raise_for_status()
        image = Image.open(io.BytesIO(response.content)).convert("RGB")
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Cannot fetch image: {str(error)}")

    model, processor = get_clip()
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embedding = model.get_image_features(**inputs)

    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    vector = embedding.squeeze().tolist()

    return {"embedding": vector, "dimensions": len(vector)}


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

    index = faiss.IndexFlatIP(dim)
    index.add(vectors)

    with faiss_lock:
        faiss_index = index
        faiss_ids = ids

    save_faiss_index()

    return {"ok": True, "indexed": len(ids)}


class SimilarRequest(BaseModel):
    embedding: list[float]
    top_k: int = 10
    exclude_id: str = ""


@app.post("/similar")
def find_similar(req: SimilarRequest):
    if faiss_index is None or faiss_index.ntotal == 0:
        return {"results": []}

    query = np.array([req.embedding], dtype=np.float32)
    k = min(req.top_k + 5, faiss_index.ntotal)
    distances, indices = faiss_index.search(query, k)

    results = []
    for distance, index in zip(distances[0], indices[0]):
        if index < 0 or index >= len(faiss_ids):
            continue
        item_id = faiss_ids[index]
        if item_id == req.exclude_id:
            continue
        results.append({"item_id": item_id, "score": float(distance)})
        if len(results) >= req.top_k:
            break

    return {"results": results}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
