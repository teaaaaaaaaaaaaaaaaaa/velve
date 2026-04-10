import modal

APP_NAME = "velve-fashn-vton"
REPO_URL = "https://github.com/fashn-AI/fashn-vton-1.5.git"
REPO_DIR = "/root/fashn-vton-1.5"
WEIGHTS_DIR = "/weights"

app = modal.App(APP_NAME)
weights_volume = modal.Volume.from_name("velve-fashn-vton-weights", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libglib2.0-0", "libgl1")
    .run_commands(f"git clone {REPO_URL} {REPO_DIR}")
    .run_commands(f"cd {REPO_DIR} && pip install -e .")
    .pip_install("requests", "Pillow", "pydantic", "fastapi[standard]")
)

pipeline = None


def fetch_pil_image(url: str):
    import io
    import requests
    from PIL import Image

    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content)).convert("RGB")


def ensure_pipeline():
    import os

    global pipeline
    if pipeline is None:
        from fashn_vton import TryOnPipeline

        if not os.path.exists(os.path.join(WEIGHTS_DIR, "model.safetensors")):
            os.system(f"cd {REPO_DIR} && python scripts/download_weights.py --weights-dir {WEIGHTS_DIR}")
            weights_volume.commit()

        pipeline = TryOnPipeline(weights_dir=WEIGHTS_DIR)
    return pipeline


@app.function(
    image=image,
    gpu="A10G",
    timeout=900,
    volumes={WEIGHTS_DIR: weights_volume},
    scaledown_window=300,
)
@modal.fastapi_endpoint(method="POST")
def try_on(payload: dict):
    import io
    import base64

    from pydantic import BaseModel

    class TryOnRequest(BaseModel):
        personImageUrl: str
        garmentImageUrl: str
        garmentCategory: str = "tops"
        prompt: str = ""

    req = TryOnRequest(**payload)
    runner = ensure_pipeline()
    person = fetch_pil_image(req.personImageUrl)
    garment = fetch_pil_image(req.garmentImageUrl)
    result = runner(
        person_image=person,
        garment_image=garment,
        category=req.garmentCategory or "tops",
    )

    output_buffer = io.BytesIO()
    result.images[0].save(output_buffer, format="PNG")
    image_bytes = output_buffer.getvalue()

    return {
        "imageBase64": base64.b64encode(image_bytes).decode("utf-8"),
        "model": "fashn-vton-1.5",
    }
