import base64
import io
import os
import pickle
import threading
from typing import Optional
from urllib.parse import urlparse

import cv2
import faiss
import numpy as np
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

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
MODAL_ENDPOINT_URL = os.getenv("MODAL_ENDPOINT_URL", "")
MODAL_API_KEY = os.getenv("MODAL_API_KEY", "")
IMAGE_FETCH_HEADERS = {
    "User-Agent": "VelveAI/1.0 (+https://velve.app)",
    "Accept": "image/*,*/*;q=0.8",
}

FAISS_INDEX_PATH = "data/faiss_index.bin"
FAISS_IDS_PATH = "data/faiss_ids.pkl"

clip_model = None
clip_processor = None
clip_lock = threading.Lock()

rembg_session = None
rembg_remove = None
rembg_lock = threading.Lock()

faiss_index = None
faiss_ids = []
faiss_lock = threading.Lock()


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


def get_rembg():
    global rembg_session, rembg_remove
    if rembg_session is None or rembg_remove is None:
        with rembg_lock:
            if rembg_session is None or rembg_remove is None:
                from rembg import new_session, remove

                rembg_remove = remove
                rembg_session = new_session("birefnet-general")
    return rembg_session, rembg_remove


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


def fetch_image_bytes(image_url: str) -> bytes:
    try:
        response = requests.get(image_url, timeout=20, headers=IMAGE_FETCH_HEADERS)
        response.raise_for_status()
        return response.content
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Cannot fetch image: {str(error)}")


def decode_base64_image(image_base64: str) -> bytes:
    try:
        payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        return base64.b64decode(payload)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Invalid image_base64 payload: {str(error)}")


def bytes_to_pil(image_bytes: bytes, mode: Optional[str] = None) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
        return image.convert(mode) if mode else image
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {str(error)}")


async def load_image_payload(
    file: UploadFile | None = None,
    image_url: str | None = None,
    image_base64: str | None = None,
    mode: str = "RGB",
) -> tuple[Image.Image, bytes]:
    if file is not None:
        image_bytes = await file.read()
    elif image_url:
        image_bytes = fetch_image_bytes(image_url)
    elif image_base64:
        image_bytes = decode_base64_image(image_base64)
    else:
        raise HTTPException(status_code=400, detail="Provide file, image_url, or image_base64")

    return bytes_to_pil(image_bytes, mode=mode), image_bytes


def pil_to_cv_rgb(image: Image.Image) -> np.ndarray:
    return np.array(image.convert("RGB"), dtype=np.uint8)


def encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def prepare_binary_mask(image: Image.Image) -> tuple[np.ndarray, dict]:
    rgb = pil_to_cv_rgb(image)
    height, width = rgb.shape[:2]
    total_pixels = float(max(height * width, 1))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 80, 160)

    border_strip = max(4, min(width, height) // 18)
    border_pixels = np.concatenate(
        [
            rgb[:border_strip, :, :].reshape(-1, 3),
            rgb[-border_strip:, :, :].reshape(-1, 3),
            rgb[:, :border_strip, :].reshape(-1, 3),
            rgb[:, -border_strip:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    bg_color = np.median(border_pixels, axis=0).astype(np.uint8)
    bg_distance = np.linalg.norm(rgb.astype(np.float32) - bg_color.astype(np.float32), axis=2)

    _, otsu_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    edge_mask = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=1)
    distance_mask = (bg_distance > max(26.0, float(bg_distance.std()) + 10.0)).astype(np.uint8) * 255
    combined = cv2.bitwise_or(otsu_mask, edge_mask)
    combined = cv2.bitwise_or(combined, distance_mask)

    kernel = np.ones((5, 5), np.uint8)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined = cv2.medianBlur(combined, 5)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(combined, connectivity=8)
    if num_labels <= 1:
        bbox = (0, 0, width, height)
        coverage = 0.0
        touches_edge = False
        edges_touched = 0
        touches_left = False
        touches_top = False
        touches_right = False
        touches_bottom = False
        aspect_ratio = width / max(height, 1)
        center_offset = 1.0
        subject_mask = combined
    else:
        best_index = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        x = int(stats[best_index, cv2.CC_STAT_LEFT])
        y = int(stats[best_index, cv2.CC_STAT_TOP])
        w = int(stats[best_index, cv2.CC_STAT_WIDTH])
        h = int(stats[best_index, cv2.CC_STAT_HEIGHT])
        subject_mask = np.where(labels == best_index, 255, 0).astype(np.uint8)
        coverage = float(np.count_nonzero(subject_mask)) / total_pixels
        touches_left = x <= 3
        touches_top = y <= 3
        touches_right = (x + w) >= (width - 3)
        touches_bottom = (y + h) >= (height - 3)
        edges_touched = int(touches_left) + int(touches_top) + int(touches_right) + int(touches_bottom)
        touches_edge = edges_touched > 0
        subject_center_x = x + (w / 2.0)
        center_offset = abs(subject_center_x - (width / 2.0)) / max(width / 2.0, 1.0)
        aspect_ratio = w / max(h, 1)
        bbox = (x, y, w, h)

    border_whiteness = float(np.mean(border_pixels))
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    color_distance = float(np.mean(bg_distance[subject_mask > 0])) if np.count_nonzero(subject_mask) else 0.0
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    return subject_mask, {
        "bbox": bbox,
        "coverage": round(coverage, 4),
        "touchesEdge": touches_edge,
        "touchesLeft": touches_left,
        "touchesTop": touches_top,
        "touchesRight": touches_right,
        "touchesBottom": touches_bottom,
        "edgesTouched": edges_touched,
        "aspectRatio": round(float(aspect_ratio), 4),
        "centerOffset": round(float(center_offset), 4),
        "brightness": round(brightness / 255.0, 4),
        "contrast": round(contrast / 255.0, 4),
        "borderWhiteness": round(border_whiteness / 255.0, 4),
        "backgroundDistance": round(color_distance / 255.0, 4),
        "sharpness": round(sharpness, 2),
        "bboxWidthRatio": round(float(bbox[2] / max(width, 1)), 4),
        "bboxHeightRatio": round(float(bbox[3] / max(height, 1)), 4),
        "width": width,
        "height": height,
    }


def build_garment_analysis(image: Image.Image) -> dict:
    _, metrics = prepare_binary_mask(image)

    brightness = metrics["brightness"]
    coverage = metrics["coverage"]
    contrast = metrics["contrast"]
    bg_distance = metrics["backgroundDistance"]
    center_offset = metrics["centerOffset"]
    edges_touched = metrics.get("edgesTouched", 0)
    touches_left = metrics.get("touchesLeft", False)
    touches_top = metrics.get("touchesTop", False)
    touches_right = metrics.get("touchesRight", False)
    touches_bottom = metrics.get("touchesBottom", False)
    sharpness = metrics.get("sharpness", 100.0)
    bbox_width_ratio = metrics.get("bboxWidthRatio", 1.0)
    bbox_height_ratio = metrics.get("bboxHeightRatio", 1.0)

    too_dark = brightness < 0.22
    too_bright = brightness > 0.97
    lighting_ok = not too_dark and not too_bright

    subject_missing = coverage < 0.05
    detection_failed = coverage > 0.97 and edges_touched >= 4
    slim_full_length_garment = (
        touches_top
        and touches_bottom
        and not (touches_left and touches_right)
        and bbox_height_ratio >= 0.94
        and bbox_width_ratio <= 0.72
        and center_offset <= 0.24
    )
    too_cropped = (
        (not detection_failed)
        and coverage > 0.88
        and edges_touched >= 3
        and not slim_full_length_garment
    )
    way_off_center = (not detection_failed) and coverage < 0.85 and center_offset > 0.6
    framing_ok = not subject_missing and not too_cropped and not way_off_center

    blended_bg = bg_distance < 0.05
    low_contrast = contrast < 0.10
    too_blurry = sharpness < 35.0
    contrast_ok = not blended_bg and not low_contrast and not too_blurry

    ready = lighting_ok and framing_ok and contrast_ok

    messages = []
    if too_dark:
        messages.append("Slika je pretamna — pomeri se blize prozoru ili pojacaj svetlo.")
    elif too_bright:
        messages.append("Previse svetla — detalji se gube, odmakni od direktnog izvora.")

    if subject_missing:
        messages.append("Ne vidimo artikal jasno — primakni telefon i stavi artikal u sredinu.")
    elif too_cropped:
        messages.append("Artikal je isecen — odmakni telefon da stane ceo u kadar.")
    elif way_off_center:
        messages.append("Centriraj artikal u kadru.")

    if too_blurry:
        messages.append("Slika je mutna — drzi telefon stabilno i pokusaj ponovo.")
    elif blended_bg or low_contrast:
        messages.append("Pozadina se stapa sa artiklom — probaj drugu, jednobojnu podlogu.")

    return {
        "ready": ready,
        "checks": {
            "lighting": {"ok": lighting_ok},
            "framing": {"ok": framing_ok},
            "contrast": {"ok": contrast_ok},
        },
        "messages": messages,
        "metrics": metrics,
    }


def build_body_scan_analysis(image: Image.Image) -> dict:
    _, metrics = prepare_binary_mask(image)

    background_ok = metrics["borderWhiteness"] >= 0.78 and metrics["backgroundDistance"] >= 0.06
    framing_ok = 0.18 <= metrics["coverage"] <= 0.65 and not metrics["touchesEdge"]
    silhouette_ok = 0.2 <= metrics["aspectRatio"] <= 0.85 and metrics["centerOffset"] <= 0.22
    lighting_ok = metrics["brightness"] >= 0.34
    ready = background_ok and framing_ok and silhouette_ok and lighting_ok

    state = "ready" if ready else "needs_adjustment"
    message = (
        "Savrseno. Zadrzi poziciju za AI generaciju."
        if ready
        else "Nisi u silueti ili pozadina nije cista bela."
    )

    return {
        "ready": ready,
        "state": state,
        "message": message,
        "checks": {
            "background": {"ok": background_ok},
            "framing": {"ok": framing_ok},
            "silhouette": {"ok": silhouette_ok},
            "lighting": {"ok": lighting_ok},
        },
        "metrics": metrics,
    }


def normalize_clean_cut_output(image_bytes: bytes) -> bytes:
    raw_output = None
    try:
        session, remove_fn = get_rembg()
        raw_output = remove_fn(image_bytes, session=session)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {str(error)}")

    cutout = bytes_to_pil(raw_output, mode="RGBA")
    white_bg = Image.new("RGBA", cutout.size, (255, 255, 255, 255))
    composited = Image.alpha_composite(white_bg, cutout).convert("RGB")
    return encode_png(composited)


def require_clean_garment_url(garment_image_url: str):
    path = urlparse(garment_image_url).path
    basename = os.path.basename(path or "")
    if not basename.startswith("clean_") or not basename.lower().endswith(".png"):
        raise HTTPException(
            status_code=400,
            detail="garmentImageUrl must point to a clean_*.png asset generated by Clean Cut",
        )


def call_modal_try_on(payload: dict) -> dict:
    if not MODAL_ENDPOINT_URL:
        raise HTTPException(status_code=503, detail="MODAL_ENDPOINT_URL is not configured")

    headers = {"Content-Type": "application/json"}
    if MODAL_API_KEY:
        headers["Authorization"] = f"Bearer {MODAL_API_KEY}"

    try:
        response = requests.post(
            MODAL_ENDPOINT_URL,
            json=payload,
            headers=headers,
            timeout=180,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail=f"Modal VTO request failed: {str(error)}")

    try:
        data = response.json()
    except ValueError as error:
        raise HTTPException(status_code=502, detail=f"Modal VTO returned invalid JSON: {str(error)}")

    if not data.get("imageUrl") and not data.get("imageBase64"):
        raise HTTPException(status_code=502, detail="Modal VTO response did not include imageUrl or imageBase64")

    return data


@app.on_event("startup")
def startup_event():
    print("[AI Server] Starting up...")
    print("[AI Server] Garment analysis version: 2026-04-11-v2 (relaxed framing + sharpness)")
    load_faiss_index()
    try:
        get_rembg()
        print("[AI Server] rembg birefnet-general session loaded")
    except Exception as error:
        print(f"[AI Server] rembg session failed to load: {error}")
    print("[AI Server] Ready")


@app.get("/ping")
def ping():
    return {"status": "ok", "message": "Velve AI server running"}


CLIP_COLORS = [
    "black", "white", "red", "blue", "green", "yellow", "pink", "purple",
    "brown", "gray", "beige", "navy", "cream", "olive", "burgundy", "teal",
    "orange", "gold", "silver", "khaki",
]
CLIP_PATTERNS = [
    "solid", "striped", "plaid", "floral", "polka dot",
    "animal print", "geometric", "tie dye", "camo",
]
CLIP_STYLES = [
    "casual", "formal", "sporty", "elegant", "vintage",
    "bohemian", "minimalist", "streetwear", "preppy",
]
CONDITION_LABELS_SR = {
    "new": "potpuno novo",
    "like_new": "kao novo",
    "good": "dobrom stanju",
    "fair": "prihvatljivom stanju",
}


def clip_classify(image_pil, labels: list[str], prompt_template: str = "a {} piece of clothing"):
    import torch

    model, processor = get_clip()
    prompts = [prompt_template.format(label) for label in labels]

    image_inputs = processor(images=image_pil, return_tensors="pt")
    text_inputs = processor(text=prompts, return_tensors="pt", padding=True)

    with torch.no_grad():
        image_features = model.get_image_features(**image_inputs)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        similarities = (image_features @ text_features.T).squeeze(0)
        idx = similarities.argmax().item()

    return labels[idx], float(similarities[idx])


def detect_garment_attributes(image_url: str) -> dict:
    try:
        image_bytes = fetch_image_bytes(image_url)
        image = bytes_to_pil(image_bytes, mode="RGB")

        color, _ = clip_classify(image, CLIP_COLORS, "a {} colored piece of clothing")
        pattern, _ = clip_classify(image, CLIP_PATTERNS, "a {} pattern piece of clothing")
        style, _ = clip_classify(image, CLIP_STYLES, "a {} style piece of clothing")

        print(f"[generate-description] CLIP detected: color={color}, pattern={pattern}, style={style}")
        return {"color": color, "pattern": pattern, "style": style}
    except Exception as error:
        print(f"[generate-description] CLIP detection failed: {error}")
        return {}


def build_template_description(category: str, attrs: dict, brand: str = "", size: str = "", condition: str = "", language: str = "sr") -> dict:
    color = attrs.get("color", "")
    pattern = attrs.get("pattern", "")
    style = attrs.get("style", "")
    cond_sr = CONDITION_LABELS_SR.get(condition, condition)

    if language == "sr":
        title_parts = []
        if brand:
            title_parts.append(brand)
        if color:
            title_parts.append(color.capitalize())
        title_parts.append(category)
        if style and style not in ("casual",):
            title_parts.append(f"- {style}")
        title = " ".join(title_parts)

        desc_parts = []
        base = f"{color.capitalize()} {category.lower()}" if color else category
        if brand:
            base = f"{brand} {base}"
        desc_parts.append(f"{base} u {cond_sr}." if cond_sr else f"{base}.")
        if pattern and pattern != "solid":
            desc_parts.append(f"{pattern.capitalize()} dezen.")
        if size:
            desc_parts.append(f"Velicina {size}.")
        desc_parts.append("Savrseno za svakodnevno nosenje ili razmenu.")
        description = " ".join(desc_parts)
    else:
        title_parts = []
        if brand:
            title_parts.append(brand)
        if color:
            title_parts.append(color.capitalize())
        title_parts.append(category)
        title = " ".join(title_parts)

        desc_parts = []
        base = f"{color.capitalize()} {category.lower()}" if color else category
        if brand:
            base = f"{brand} {base}"
        desc_parts.append(f"{base} in {condition} condition." if condition else f"{base}.")
        if pattern and pattern != "solid":
            desc_parts.append(f"{pattern.capitalize()} pattern.")
        if size:
            desc_parts.append(f"Size {size}.")
        description = " ".join(desc_parts)

    return {"title": title, "description": description}


class DescriptionRequest(BaseModel):
    category: str
    size: str = ""
    brand: str = ""
    condition: str = ""
    color: str = ""
    language: str = "sr"
    image_url: str = ""


@app.post("/generate-description")
def generate_description(req: DescriptionRequest):
    detected = {}
    if req.image_url:
        detected = detect_garment_attributes(req.image_url)

    effective_color = req.color or detected.get("color", "")

    details = []
    if req.brand:
        details.append(f"Brand: {req.brand}")
    if req.size:
        details.append(f"Size: {req.size}")
    if req.condition:
        details.append(f"Condition: {req.condition}")
    if effective_color:
        details.append(f"Color: {effective_color}")
    pattern = detected.get("pattern", "")
    if pattern and pattern != "solid":
        details.append(f"Pattern: {pattern}")
    style = detected.get("style", "")
    if style:
        details.append(f"Style: {style}")
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
            "Ty copywriter dlya prilozheniya po obmenu odezhdoy. "
            f"Naprishi korotkiy zagolovok (maksimum 8 slov) i opisanie (maksimum 2 predlozheniya) dlya etogo predmeta: {details_str}. "
            "Otvet tolko v formate:\nTitle: ...\nDescription: ..."
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

        title = ""
        description = ""
        for line in text.strip().split("\n"):
            line = line.strip()
            if line.lower().startswith("title:"):
                title = line.split(":", 1)[1].strip()
            elif line.lower().startswith("description:"):
                description = line.split(":", 1)[1].strip()

        return {"title": title, "description": description, "raw": text, "source": "ollama"}
    except requests.RequestException as error:
        print(f"[generate-description] Ollama unavailable ({error}), using CLIP template fallback")

    fallback = build_template_description(
        category=req.category,
        attrs={"color": effective_color, **detected},
        brand=req.brand,
        size=req.size,
        condition=req.condition,
        language=req.language,
    )
    return {"title": fallback["title"], "description": fallback["description"], "source": "clip_template"}


class EmbedRequest(BaseModel):
    image_url: str


@app.post("/embed")
def embed_image(req: EmbedRequest):
    import torch

    image_bytes = fetch_image_bytes(req.image_url)
    image = bytes_to_pil(image_bytes, mode="RGB")
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


@app.post("/remove-background")
async def remove_background(
    file: UploadFile | None = File(default=None),
    image_url: str | None = Form(default=None),
    image_base64: str | None = Form(default=None),
):
    _, image_bytes = await load_image_payload(
        file=file,
        image_url=image_url,
        image_base64=image_base64,
        mode="RGBA",
    )
    output_bytes = normalize_clean_cut_output(image_bytes)
    return Response(content=output_bytes, media_type="image/png")


@app.post("/analyze-garment-photo")
async def analyze_garment_photo(
    file: UploadFile | None = File(default=None),
    image_url: str | None = Form(default=None),
    image_base64: str | None = Form(default=None),
):
    image, _ = await load_image_payload(
        file=file,
        image_url=image_url,
        image_base64=image_base64,
        mode="RGB",
    )
    result = build_garment_analysis(image)
    print(f"[analyze-garment-photo] ready={result['ready']} checks={result['checks']} metrics={result['metrics']}")
    return result


@app.post("/analyze-body-scan")
async def analyze_body_scan(
    file: UploadFile | None = File(default=None),
    image_url: str | None = Form(default=None),
    image_base64: str | None = Form(default=None),
):
    image, _ = await load_image_payload(
        file=file,
        image_url=image_url,
        image_base64=image_base64,
        mode="RGB",
    )
    return build_body_scan_analysis(image)


class VirtualTryOnRequest(BaseModel):
    personImageUrl: str
    garmentImageUrl: str
    garmentCategory: str = Field(default="tops")
    prompt: str = Field(default="")


@app.post("/virtual-try-on")
def virtual_try_on(req: VirtualTryOnRequest):
    require_clean_garment_url(req.garmentImageUrl)
    payload = {
        "personImageUrl": req.personImageUrl,
        "garmentImageUrl": req.garmentImageUrl,
        "garmentCategory": req.garmentCategory,
        "prompt": req.prompt,
    }
    modal_response = call_modal_try_on(payload)
    return {
        "ok": True,
        "imageUrl": modal_response.get("imageUrl"),
        "imageBase64": modal_response.get("imageBase64"),
        "provider": "modal",
        "model": modal_response.get("model", "fashn-vton-1.5"),
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
