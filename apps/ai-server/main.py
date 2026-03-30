from fastapi import FastAPI
import os

app = FastAPI(title="Velve AI Server")


@app.get("/ping")
def ping():
    return {"status": "ok", "message": "Velve AI server running"}


# TODO: Nedelja 2 — dodati sledeće endpointe:
# POST /generate-description  → Ollama + Qwen2.5 7B
# POST /embed                 → CLIP embedding (512-dim vektor)
# POST /similar               → FAISS similarity search


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
