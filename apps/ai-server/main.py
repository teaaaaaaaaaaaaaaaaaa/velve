import base64
import html
import io
import json
import os
import pickle
import string
import threading
import time
import uuid
from typing import Optional
from urllib.parse import urlparse

import cv2
import faiss
import ftfy
import numpy as np
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

load_dotenv()

app = FastAPI(title="Velve AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://velveapp.com", "https://www.velveapp.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    faiss.omp_set_num_threads(1)
except Exception:
    pass

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "").strip()
MODAL_ENDPOINT_URL = os.getenv("MODAL_ENDPOINT_URL", "")
MODAL_API_KEY = os.getenv("MODAL_API_KEY", "")
MODAL_VTO_MAX_ATTEMPTS = max(1, int(os.getenv("MODAL_VTO_MAX_ATTEMPTS", "2")))
MODAL_VTO_RETRY_DELAY_SECONDS = max(
    0.0, float(os.getenv("MODAL_VTO_RETRY_DELAY_SECONDS", "2"))
)
VALID_VTO_GARMENT_CATEGORIES = {"tops", "bottoms", "one-pieces"}
IMAGE_FETCH_HEADERS = {
    "User-Agent": "VelveAI/1.0 (+https://velve.app)",
    "Accept": "image/*,*/*;q=0.8",
}

FAISS_INDEX_PATH = "data/faiss_index.bin"
FAISS_IDS_PATH = "data/faiss_ids.pkl"
# Marqo/marqo-fashionSigLIP is ViT-B-16-SigLIP (webli) -> 768-dim normalized embeddings
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "Marqo/marqo-fashionSigLIP")
FAISS_DIM_DEFAULT = int(os.getenv("EMBEDDING_DIM", "768"))
EMBEDDING_DEVICE = os.getenv("EMBEDDING_DEVICE", "").strip()

clip_model = None
clip_processor = None
clip_lock = threading.Lock()

rembg_session = None
rembg_remove = None
rembg_lock = threading.Lock()

ollama_model_name = None
ollama_lock = threading.Lock()

faiss_index = None
faiss_ids: list[str] = []
faiss_id_to_pos: dict[str, int] = {}
faiss_lock = threading.Lock()


def _basic_clean(text: str) -> str:
    text = ftfy.fix_text(text)
    text = html.unescape(html.unescape(text))
    return text.strip()


def _canonicalize_text(text: str) -> str:
    translation_table = str.maketrans("", "", string.punctuation)
    text = text.replace("_", " ")
    text = text.translate(translation_table)
    text = text.lower()
    return " ".join(text.split()).strip()


def _clean_embedding_text(text: str) -> str:
    return _canonicalize_text(_basic_clean(text))


def _pick_ollama_model_from_tags() -> str:
    preferred_models = []
    if OLLAMA_MODEL:
        preferred_models.append(OLLAMA_MODEL)
    preferred_models.extend(
        [
            "qwen2.5:7b",
            "qwen2.5-coder:7b",
            "qwen2.5-coder:14b",
            "qwen3-coder:30b",
        ]
    )

    response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
    response.raise_for_status()
    models = response.json().get("models", [])
    available = [model.get("name", "") for model in models if model.get("name")]

    for preferred in preferred_models:
        if preferred in available:
            return preferred

    for available_name in available:
        if available_name.startswith("qwen"):
            return available_name

    if available:
        return available[0]

    raise RuntimeError("Ollama returned no installed models")


def get_ollama_model() -> str:
    global ollama_model_name
    if ollama_model_name:
        return ollama_model_name

    with ollama_lock:
        if ollama_model_name:
            return ollama_model_name

        if OLLAMA_MODEL:
            ollama_model_name = OLLAMA_MODEL
            return ollama_model_name

        try:
            ollama_model_name = _pick_ollama_model_from_tags()
            print(f"[Ollama] Using model {ollama_model_name}")
        except Exception as error:
            ollama_model_name = "qwen2.5:7b"
            print(f"[Ollama] Model auto-detect failed ({error}); falling back to {ollama_model_name}")

        return ollama_model_name


def _fallback_translate_query(text: str) -> str:
    token_map = {
        "haljin": "dress",
        "majic": "top",
        "majica": "top",
        "kosulj": "shirt",
        "pantal": "pants",
        "farmerk": "jeans",
        "suknj": "skirt",
        "jakn": "jacket",
        "kaput": "coat",
        "dzemper": "sweater",
        "dzemper": "sweater",
        "dukser": "hoodie",
        "patik": "sneakers",
        "cipe": "shoes",
        "sand": "sandals",
        "cizm": "boots",
        "crven": "red",
        "plav": "blue",
        "zelen": "green",
        "bel": "white",
        "bijel": "white",
        "crn": "black",
        "roze": "pink",
        "pink": "pink",
        "ljubic": "purple",
        "zut": "yellow",
        "narand": "orange",
        "bez": "beige",
        "braon": "brown",
        "siv": "gray",
        "cvet": "floral",
        "cvetn": "floral",
        "karir": "plaid",
        "prug": "striped",
        "tack": "polka dot",
        "eleg": "elegant",
        "sport": "sporty",
        "vint": "vintage",
        "casual": "casual",
    }

    normalized = _canonicalize_text(text)
    translated = []
    for token in normalized.split():
        mapped = None
        for stem, english in token_map.items():
            if token.startswith(stem):
                mapped = english
                break
        translated.append(mapped or token)

    deduped = []
    for token in translated:
        if not deduped or deduped[-1] != token:
            deduped.append(token)
    return " ".join(deduped).strip() or text


class FashionSiglipProcessor:
    """Minimal local replacement for Marqo's trust_remote_code processor."""

    def __init__(self, image_processor, tokenizer):
        self.image_processor = image_processor
        self.tokenizer = tokenizer

    def __call__(
        self,
        text=None,
        images=None,
        padding=False,
        truncation=None,
        max_length=None,
        return_tensors="pt",
    ):
        if text is None and images is None:
            raise ValueError("You have to specify either text or images.")

        encoding = None
        if text is not None:
            if isinstance(text, str):
                text = [text]
            text = [_clean_embedding_text(raw_text) for raw_text in text]
            encoding = self.tokenizer(
                text,
                return_tensors=return_tensors,
                padding=padding,
                truncation=truncation,
                max_length=max_length,
            )

        if images is not None:
            if isinstance(images, list):
                normalized_images = []
                for image in images:
                    normalized_images.append(image.convert("RGB") if hasattr(image, "convert") else image)
                images = normalized_images
            elif hasattr(images, "convert"):
                images = images.convert("RGB")

            image_features = self.image_processor(images=images, return_tensors=return_tensors)
            if encoding is None:
                return image_features

            encoding["pixel_values"] = image_features["pixel_values"]

        return encoding


class FashionSiglipModel:
    """Adapter that preserves the get_*_features API used by the rest of the server."""

    def __init__(self, model, device: str):
        self.model = model
        self.device = device

    def eval(self):
        self.model.eval()
        return self

    def get_image_features(self, pixel_values, normalize: bool = False):
        import torch

        with torch.inference_mode():
            return self.model.encode_image(pixel_values.to(self.device), normalize=normalize).cpu()

    def get_text_features(self, input_ids, normalize: bool = False):
        import torch

        with torch.inference_mode():
            return self.model.encode_text(input_ids.to(self.device), normalize=normalize).cpu()


def get_clip():
    """Lazy-load fashion embedding model.

    We bypass Marqo's transformers AutoModel wrapper because recent
    transformers/open_clip combinations can instantiate it on the meta device
    and crash while moving weights. open_clip can load the exact same weights
    directly from hf-hub, so we keep the same API with a thin local adapter.
    """
    global clip_model, clip_processor
    if clip_model is None:
        with clip_lock:
            if clip_model is None:
                import torch
                from open_clip import create_model
                from transformers import SiglipImageProcessor, T5TokenizerFast

                device = EMBEDDING_DEVICE or ("cuda" if torch.cuda.is_available() else "cpu")

                print(f"[Embedding] Loading model {EMBEDDING_MODEL_NAME} on {device}...")
                image_processor = SiglipImageProcessor.from_pretrained(EMBEDDING_MODEL_NAME)
                tokenizer = T5TokenizerFast.from_pretrained(EMBEDDING_MODEL_NAME)
                open_clip_model = create_model(
                    f"hf-hub:{EMBEDDING_MODEL_NAME}",
                    output_dict=True,
                    device=device,
                )
                clip_processor = FashionSiglipProcessor(image_processor, tokenizer)
                clip_model = FashionSiglipModel(open_clip_model, device)
                clip_model.eval()
                print(f"[Embedding] Model {EMBEDDING_MODEL_NAME} ready")
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


def _rebuild_id_to_pos_locked():
    global faiss_id_to_pos
    faiss_id_to_pos = {item_id: pos for pos, item_id in enumerate(faiss_ids)}


def _delete_faiss_files():
    for path in (FAISS_INDEX_PATH, FAISS_IDS_PATH):
        try:
            if os.path.exists(path):
                os.remove(path)
                print(f"[FAISS] Deleted stale file {path}")
        except Exception as error:
            print(f"[FAISS] Failed to delete {path}: {error}")


def load_faiss_index():
    global faiss_index, faiss_ids
    try:
        if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_IDS_PATH):
            with faiss_lock:
                loaded_index = faiss.read_index(FAISS_INDEX_PATH)
                if loaded_index.d != FAISS_DIM_DEFAULT:
                    print(
                        f"[FAISS] Dimension mismatch on disk: index dim={loaded_index.d} "
                        f"but model dim={FAISS_DIM_DEFAULT}. Discarding stale index."
                    )
                    faiss_index = None
                    faiss_ids = []
                    _rebuild_id_to_pos_locked()
                    _delete_faiss_files()
                    return
                faiss_index = loaded_index
                with open(FAISS_IDS_PATH, "rb") as handle:
                    faiss_ids = pickle.load(handle)
                _rebuild_id_to_pos_locked()
            print(f"[FAISS] Loaded index with {len(faiss_ids)} items (dim={FAISS_DIM_DEFAULT}) from disk")
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
        print(
            "[VTO][AI] Non-clean garment URL received; continuing for direct render diagnostics",
            {
                "garmentImageUrl": garment_image_url,
                "basename": basename,
            },
        )


def normalize_vto_garment_category(category: str | None, request_id: str = "") -> str:
    normalized = (category or "").strip().lower()

    if normalized in VALID_VTO_GARMENT_CATEGORIES:
        return normalized

    if (
        "dress" in normalized
        or "halj" in normalized
        or "jumpsuit" in normalized
        or "jump suit" in normalized
        or "one-piece" in normalized
        or "one piece" in normalized
        or "romper" in normalized
    ):
        return "one-pieces"

    if (
        "pantal" in normalized
        or "bottom" in normalized
        or "suk" in normalized
        or "skirt" in normalized
        or "short" in normalized
        or "jean" in normalized
        or "denim" in normalized
    ):
        return "bottoms"

    if request_id:
        print(
            f"[VTO][AI][{request_id}] Unknown garment category '{category}', defaulting to tops"
        )
    else:
        print(f"[VTO][AI] Unknown garment category '{category}', defaulting to tops")

    return "tops"


def build_vto_request_id(candidate: str | None = None) -> str:
    normalized = (candidate or "").strip()
    if normalized:
        return normalized[:80]

    return f"vto-ai-{uuid.uuid4().hex[:12]}"


def call_modal_try_on(payload: dict, request_id: str) -> dict:
    if not MODAL_ENDPOINT_URL:
        print(f"[VTO][AI][{request_id}] Modal endpoint missing")
        raise HTTPException(
            status_code=503,
            detail="Try-on temporarily unavailable. Modal endpoint nije konfigurisan.",
        )

    headers = {"Content-Type": "application/json"}
    if MODAL_API_KEY:
        headers["Authorization"] = f"Bearer {MODAL_API_KEY}"

    response = None
    last_error = None
    for attempt in range(1, MODAL_VTO_MAX_ATTEMPTS + 1):
        try:
            print(
                f"[VTO][AI][{request_id}] Calling Modal",
                {
                    "endpoint": MODAL_ENDPOINT_URL,
                    "garmentCategory": payload.get("garmentCategory"),
                    "attempt": attempt,
                    "maxAttempts": MODAL_VTO_MAX_ATTEMPTS,
                },
            )
            response = requests.post(
                MODAL_ENDPOINT_URL,
                json=payload,
                headers=headers,
                timeout=180,
            )
            if response.status_code >= 500 and attempt < MODAL_VTO_MAX_ATTEMPTS:
                print(
                    f"[VTO][AI][{request_id}] Modal returned transient {response.status_code}, retrying"
                )
                time.sleep(MODAL_VTO_RETRY_DELAY_SECONDS)
                continue

            response.raise_for_status()
            print(
                f"[VTO][AI][{request_id}] Modal response received",
                {
                    "status": response.status_code,
                    "attempt": attempt,
                },
            )
            break
        except requests.RequestException as error:
            last_error = error
            print(
                f"[VTO][AI][{request_id}] Modal request failed on attempt {attempt}: {error}"
            )
            if attempt < MODAL_VTO_MAX_ATTEMPTS:
                time.sleep(MODAL_VTO_RETRY_DELAY_SECONDS)
                continue
            raise HTTPException(
                status_code=502,
                detail="Try-on temporarily unavailable. Render servis trenutno ne odgovara.",
            ) from error

    if response is None:
        raise HTTPException(
            status_code=502,
            detail="Try-on temporarily unavailable. Render servis trenutno ne odgovara.",
        ) from last_error

    try:
        data = response.json()
    except ValueError as error:
        print(f"[VTO][AI][{request_id}] Modal returned invalid JSON: {error}")
        raise HTTPException(
            status_code=502,
            detail="Try-on temporarily unavailable. Render servis je vratio neispravan odgovor.",
        )

    if not data.get("imageUrl") and not data.get("imageBase64"):
        print(f"[VTO][AI][{request_id}] Modal response missing image payload")
        raise HTTPException(
            status_code=502,
            detail="Try-on temporarily unavailable. Render odgovor ne sadrzi sliku.",
        )

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
    "new": "deluje potpuno novo",
    "like_new": "deluje kao novo",
    "good": "u dobrom je stanju",
    "fair": "u korektnom je stanju",
}
COLOR_LABELS_SR = {
    "black": "crnoj",
    "white": "beloj",
    "red": "crvenoj",
    "blue": "plavoj",
    "green": "zelenoj",
    "yellow": "zutoj",
    "pink": "roze",
    "purple": "ljubicastoj",
    "brown": "braon",
    "gray": "sivoj",
    "beige": "bez",
    "navy": "teget",
    "cream": "krem",
    "olive": "maslinastoj",
    "burgundy": "bordo",
    "teal": "petrol",
    "orange": "narandzastoj",
    "gold": "zlatnoj",
    "silver": "srebrnoj",
    "khaki": "kaki",
}
PATTERN_LABELS_SR = {
    "striped": "prugastim dezenom",
    "plaid": "kariranim dezenom",
    "floral": "cvetnim dezenom",
    "polka dot": "tufnastim dezenom",
    "animal print": "animal print dezenom",
    "geometric": "geometrijskim dezenom",
    "tie dye": "tie-dye efektom",
    "camo": "maskirnim dezenom",
}
STYLE_LABELS_SR = {
    "casual": "za svakodnevno nosenje",
    "formal": "formalnijeg izgleda",
    "sporty": "sportskijeg izgleda",
    "elegant": "elegantnijeg izgleda",
    "vintage": "retro utiska",
    "bohemian": "boho utiska",
    "minimalist": "ciste i jednostavne siluete",
    "streetwear": "urbanijeg izgleda",
    "preppy": "urednijeg i klasicnijeg izgleda",
}


def clip_classify(image_pil, labels: list[str], prompt_template: str = "a {} piece of clothing"):
    import torch

    model, processor = get_clip()
    prompts = [prompt_template.format(label) for label in labels]

    # SigLIP processor requires padding='max_length'; outputs are pre-normalized when normalize=True
    image_inputs = processor(images=image_pil, return_tensors="pt")
    text_inputs = processor(text=prompts, return_tensors="pt", padding="max_length")

    with torch.no_grad():
        image_features = model.get_image_features(image_inputs["pixel_values"], normalize=True)
        text_features = model.get_text_features(text_inputs["input_ids"], normalize=True)
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

    if language == "sr":
        base = category.strip() or "Komad garderobe"
        if brand:
            base = f"{brand} {base.lower()}"

        sentence_parts = [base[:1].upper() + base[1:]]

        color_label = COLOR_LABELS_SR.get(color, color)
        if color_label:
            sentence_parts.append(f"u {color_label} boji")

        pattern_label = PATTERN_LABELS_SR.get(pattern, "") if pattern and pattern != "solid" else ""
        if pattern_label:
            sentence_parts.append(f"sa {pattern_label}")

        description = " ".join(sentence_parts).strip() + "."

        detail_parts = []
        style_label = STYLE_LABELS_SR.get(style, "") if style else ""
        if style_label:
            detail_parts.append(f"Komad deluje {style_label}.")
        if size:
            detail_parts.append(f"Velicina je {size}.")
        condition_label = CONDITION_LABELS_SR.get(condition, "")
        if condition_label:
            detail_parts.append(f"Po fotografiji {condition_label}.")

        if detail_parts:
            description = f"{description} {' '.join(detail_parts[:2])}".strip()

        return {"title": "", "description": description}

    base = f"{brand} {category}".strip()
    description = f"{base}."
    if size:
        description += f" Size {size}."
    if condition:
        description += f" Condition: {condition}."
    return {"title": "", "description": description.strip()}


def extract_description_from_ollama(raw_text: str) -> str:
    cleaned = _basic_clean(raw_text or "")
    if not cleaned:
        return ""

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            payload = json.loads(cleaned[start:end + 1])
            description = _basic_clean(str(payload.get("description", "")))
            if description:
                return " ".join(description.split())
        except Exception:
            pass

    lowered = cleaned.lower()
    if lowered.startswith("description:"):
        cleaned = cleaned.split(":", 1)[1].strip()

    return " ".join(cleaned.split())


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
            "Ti si asistent koji za Velve pise kratke i tacne opise garderobe. "
            "Pisi iskljucivo normalnim srpskim jezikom, latinicom. "
            "Ne smisljaj naslov. Ne izmisljaj materijal, brend, kroj, priliku ili detalje koji nisu dati ili jasno vidljivi. "
            "Ne koristi engleske modne fraze ako postoji prirodan srpski izraz. "
            "Opis neka bude 2 do 3 kratke recenice i neka zvuci prirodno, kao opis stvarnog komada iz oglasa. "
            f"Poznati podaci o komadu: {details_str}. "
            "Vrati iskljucivo validan JSON bez markdowna i bez dodatnog teksta, u formatu: "
            '{"description":"..."}'
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
            json={"model": get_ollama_model(), "prompt": prompt, "stream": False},
            timeout=60,
        )
        response.raise_for_status()
        text = response.json().get("response", "")

        description = extract_description_from_ollama(text)
        if description:
            return {"title": "", "description": description, "raw": text, "source": "ollama"}
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
        embedding = model.get_image_features(inputs["pixel_values"], normalize=True)

    vector = embedding.squeeze().tolist()
    return {"embedding": vector, "dimensions": len(vector), "model": EMBEDDING_MODEL_NAME}


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
            _rebuild_id_to_pos_locked()
        _delete_faiss_files()
        return {"ok": True, "indexed": 0, "model": EMBEDDING_MODEL_NAME}

    dim = len(req.items[0].embedding)
    if dim != FAISS_DIM_DEFAULT:
        raise HTTPException(
            status_code=400,
            detail=f"Embedding dim {dim} does not match expected {FAISS_DIM_DEFAULT} for model {EMBEDDING_MODEL_NAME}",
        )

    vectors = np.array([item.embedding for item in req.items], dtype=np.float32)
    ids = [item.item_id for item in req.items]

    index = faiss.IndexFlatIP(dim)
    index.add(vectors)

    with faiss_lock:
        faiss_index = index
        faiss_ids = ids
        _rebuild_id_to_pos_locked()

    save_faiss_index()

    return {"ok": True, "indexed": len(ids), "dim": dim, "model": EMBEDDING_MODEL_NAME}


@app.post("/reset-index")
def reset_index():
    """Wipe in-memory FAISS state AND on-disk files. Use after model swap."""
    global faiss_index, faiss_ids
    with faiss_lock:
        faiss_index = None
        faiss_ids = []
        _rebuild_id_to_pos_locked()
    _delete_faiss_files()
    return {"ok": True, "message": "FAISS index reset", "model": EMBEDDING_MODEL_NAME, "expected_dim": FAISS_DIM_DEFAULT}


@app.post("/index-add")
def index_add(req: IndexRequest):
    """Append vectors to existing index without full rebuild.

    If index does not yet exist it is created from this batch.
    Items whose item_id is already present are skipped (next /index call replaces them).
    """
    global faiss_index, faiss_ids

    if not req.items:
        return {"ok": True, "added": 0, "skipped": 0}

    new_items = []
    skipped = 0
    with faiss_lock:
        for item in req.items:
            if not item.embedding:
                skipped += 1
                continue
            if item.item_id in faiss_id_to_pos:
                skipped += 1
                continue
            new_items.append(item)

        if not new_items:
            return {"ok": True, "added": 0, "skipped": skipped}

        dim = len(new_items[0].embedding)
        if dim != FAISS_DIM_DEFAULT:
            raise HTTPException(
                status_code=400,
                detail=f"Embedding dim {dim} does not match expected {FAISS_DIM_DEFAULT} for model {EMBEDDING_MODEL_NAME}",
            )

        vectors = np.array([item.embedding for item in new_items], dtype=np.float32)

        if faiss_index is None:
            faiss_index = faiss.IndexFlatIP(dim)
        elif faiss_index.d != dim:
            raise HTTPException(
                status_code=400,
                detail=f"Index dim mismatch: existing {faiss_index.d} vs new {dim}. Call /reset-index first.",
            )

        start_pos = len(faiss_ids)
        faiss_index.add(vectors)
        for offset, item in enumerate(new_items):
            faiss_ids.append(item.item_id)
            faiss_id_to_pos[item.item_id] = start_pos + offset

    save_faiss_index()
    return {"ok": True, "added": len(new_items), "skipped": skipped, "total": len(faiss_ids)}


def looks_like_english(text: str) -> bool:
    """Cheap heuristic: ASCII-only + no Cyrillic/diacritics -> assume English and skip Ollama."""
    if not text:
        return True
    try:
        text.encode("ascii")
    except UnicodeEncodeError:
        return False
    lowered = text.lower()
    common_non_english = (
        "haljin", "kosulj", "pantal", "patik", "suknja", "dzemper", "jakna",
        "crven", "plav", "zelen", "beli", "crn", "zut",
        "cvet", "prug", "karir",
    )
    return not any(token in lowered for token in common_non_english)


def translate_to_english(text: str, timeout_s: int = 8) -> str:
    """Best-effort translation via Ollama qwen2.5. Falls back to original on failure."""
    if looks_like_english(text):
        return text

    prompt = (
        "Translate the following clothing search query to short, lowercase English. "
        "Keep it natural and concise (2-6 words). Output ONLY the translation, no labels, no quotes.\n\n"
        f"Query: {text}\nTranslation:"
    )
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": get_ollama_model(), "prompt": prompt, "stream": False},
            timeout=timeout_s,
        )
        response.raise_for_status()
        translated = response.json().get("response", "").strip()
        first_line = translated.splitlines()[0] if translated else ""
        cleaned = first_line.strip(" .\"'`\n\r\t").lower()
        return cleaned or text
    except Exception as error:
        fallback = _fallback_translate_query(text)
        print(f"[text-search] Ollama translation failed ({error}), using fallback '{fallback}'")
        return fallback


def embed_text(query: str):
    import torch

    model, processor = get_clip()
    text_inputs = processor(text=[query], return_tensors="pt", padding="max_length")
    with torch.no_grad():
        features = model.get_text_features(text_inputs["input_ids"], normalize=True)
    return features.squeeze().cpu().numpy().astype(np.float32)


class TextSearchRequest(BaseModel):
    query: str
    top_k: int = 20
    translate: bool = True
    exclude_id: str = ""


@app.post("/text-search")
def text_search(req: TextSearchRequest):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")
    if faiss_index is None or faiss_index.ntotal == 0:
        return {"results": [], "query": req.query, "translated": "", "model": EMBEDDING_MODEL_NAME}

    translated = translate_to_english(req.query.strip()) if req.translate else req.query.strip()
    vector = embed_text(translated)

    query_arr = np.array([vector], dtype=np.float32)
    k = min(req.top_k + 5, faiss_index.ntotal)
    distances, indices = faiss_index.search(query_arr, k)

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

    return {
        "results": results,
        "query": req.query,
        "translated": translated,
        "model": EMBEDDING_MODEL_NAME,
    }


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
    requestId: str = Field(default="")


@app.post("/virtual-try-on")
def virtual_try_on(req: VirtualTryOnRequest):
    request_id = build_vto_request_id(req.requestId)
    garment_category = normalize_vto_garment_category(req.garmentCategory, request_id)

    try:
        print(
            f"[VTO][AI][{request_id}] Request received",
            {
                "personImageUrl": req.personImageUrl,
                "garmentImageUrl": req.garmentImageUrl,
                "garmentCategory": garment_category,
            },
        )
        require_clean_garment_url(req.garmentImageUrl)
        print(f"[VTO][AI][{request_id}] Garment URL validated")

        payload = {
            "personImageUrl": req.personImageUrl,
            "garmentImageUrl": req.garmentImageUrl,
            "garmentCategory": garment_category,
            "prompt": req.prompt,
            "requestId": request_id,
        }
        modal_response = call_modal_try_on(payload, request_id=request_id)
        print(
            f"[VTO][AI][{request_id}] Returning render response",
            {
                "hasImageUrl": bool(modal_response.get("imageUrl")),
                "hasImageBase64": bool(modal_response.get("imageBase64")),
                "model": modal_response.get("model", "fashn-vton-1.5"),
            },
        )
        return {
            "ok": True,
            "imageUrl": modal_response.get("imageUrl"),
            "imageBase64": modal_response.get("imageBase64"),
            "provider": "modal",
            "model": modal_response.get("model", "fashn-vton-1.5"),
        }
    except HTTPException as error:
        print(f"[VTO][AI][{request_id}] Request failed: {error.detail}")
        raise
    except Exception as error:
        print(f"[VTO][AI][{request_id}] Unexpected error: {error}")
        raise


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
