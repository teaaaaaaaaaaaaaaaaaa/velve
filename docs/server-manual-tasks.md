# Velve — Ručni taskovi za server

## Pre deploymenta (uradi kad server bude spreman)

### 1. Ubuntu Server setup
- [ ] Instaliraj Ubuntu Server na Xeon E3-1270 mašini
- [ ] Konfiguriši RAID 1 na 2x 2TB SAS diskovima
- [ ] Instaliraj: Node.js 20+, Python 3.11+, Git, PM2 (`npm install -g pm2`)

### 2. Cloudflare Tunnel
- [ ] Instaliraj cloudflared: `curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg`
- [ ] Kreiraj tunnel u Cloudflare Zero Trust dashboardu
- [ ] Poveži tunnel sa domenom (npr. api.velve.app → localhost:3000)
- [ ] Pokreni: `cloudflared service install`

### 3. Ollama + Qwen2.5
- [ ] Instaliraj Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
- [ ] Preuzmi model: `ollama pull qwen2.5:7b` (~5GB)
- [ ] Proveri: `curl http://localhost:11434/api/generate -d '{"model":"qwen2.5:7b","prompt":"test"}'`

### 4. Cloudflare R2
- [ ] U Cloudflare dashboardu: R2 > velve-images > Settings > Public Access — uključi
- [ ] Zapiši public URL u apps/api/.env kao R2_PUBLIC_URL

### 5. MongoDB Atlas
- [ ] Prebaci sa M0 na Flex tier (~8$/mes) kad embedding vektori počnu da rastu
- [ ] Kreiraj Atlas Vector Search indeks na `items.embedding` polju

### 6. PM2 deployment
- [ ] `pm2 start apps/api/src/index.js --name velve-api`
- [ ] `pm2 start "cd apps/ai-server && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000" --name velve-ai`
- [ ] `pm2 save && pm2 startup`

### 7. Python venv na serveru
- [ ] `cd apps/ai-server && python3 -m venv .venv`
- [ ] `.venv/bin/pip install -r requirements.txt`
- [ ] Ovo će preuzeti ~2GB (PyTorch CPU, transformers, CLIP model)
