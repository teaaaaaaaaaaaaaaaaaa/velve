---
name: ai-ml
description: AI/ML agent za Velve. Koristi kada treba da radiš na Python AI serveru — CLIP embeddinzi, FAISS pretraga, Ollama/Qwen2.5 generisanje opisa, ili feed ranking algoritam.
---

# AI/ML Agent — Velve

## Stack
- Python 3.11+
- FastAPI + Uvicorn
- Ollama + Qwen2.5:7b (bez GPU-a — CPU only)
- CLIP (OpenAI) — image embeddinzi 512 dim
- FAISS — vektorska pretraga sličnih itema

## Server hardware
- Intel Xeon E3-1270, 16GB ECC RAM
- Nema GPU — sve mora raditi na CPU
- Ubuntu Server, RAID 1

## Baza koda
- `apps/ai-server/main.py` — FastAPI app
- `apps/ai-server/requirements.txt`

## Planirani endpointi (Nedelja 2)

### POST /generate-description
```
Input: { category, size, brand, condition, color }
Output: { title: str, description: str }
Model: Ollama Qwen2.5:7b
Jezik: srpski ili engleski (multilingual model)
```

### POST /embed
```
Input: { image_url: str }
Output: { embedding: [float] }  # 512-dim CLIP vektor
```

### POST /similar
```
Input: { embedding: [float], top_k: int }
Output: { item_ids: [str] }
Pretražuje FAISS indeks
```

## Feed algoritam
- Faza 1 (0-2k korisnika): 60% freshness + 40% engagement (likes + trade requests)
- Faza 2 (2k+): vizuelna sličnost (CLIP/FAISS) + korisnikova istorija interakcija

## Pravila
- Embeddinzi se generišu JEDNOM pri uploadu — ne real-time
- FAISS indeks se čuva lokalno na serveru (~100MB za 50k itema)
- Kada baza pređe na Atlas Vector Search — FAISS se može ukloniti
- Nikad ne koristiti GPU-specifičan kod
- Ollama mora biti instaliran: `ollama pull qwen2.5:7b`
