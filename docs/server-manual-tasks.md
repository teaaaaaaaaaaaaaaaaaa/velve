
### 2. Cloudflare Tunnel
- [x] Instaliraj cloudflared: `curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg`
- [x] Kreiran Quick Tunnel (privremeni za dev)
- [x] Aktivan URL: `https://pepper-spreading-paris-trailers.trycloudflare.com`
- [x] Preusmeren na: `localhost:3000` (Backend API)
- [ ] TODO: Kreiraj perzistentan tunnel u Cloudflare Zero Trust dashboardu za produkciju

### 3. Ollama + Qwen2.5
- [x] Instaliraj Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
- [x] Preuzmi model: `ollama pull qwen2.5:7b` (~5GB)
- [x] Proveri: `curl http://localhost:11434/api/generate -d '{"model":"qwen2.5:7b","prompt":"test"}'`
- [x] Status: Operativan na portu 11434

### 4. Cloudflare R2
- [x] U Cloudflare dashboardu: R2 > velve-images > Settings > Public Access — uključi
- [x] Zapiši public URL u apps/api/.env kao R2_PUBLIC_URL
- [x] Status: Konfigurisan i operativan

### 5. MongoDB Atlas
- [x] Prebačeno na Flex tier
- [x] Uspešno povezan na port 3000
- [ ] TODO: Finalizuj Vector Search indeks na `items.embedding` polju (dimenzije: 512, putanja: embedding, similarity: cosine)

### 6. PM2 deployment
- [x] `pm2 start apps/api/src/index.js --name velve-api` — Process ID: 0 ✅
- [x] `pm2 start "cd apps/ai-server && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000" --name velve-ai` — Process ID: 1 ✅
- [x] `pm2 save && pm2 startup` ✅
- [x] Backend API: Operativan na `localhost:3000`
- [x] AI Server: Operativan na `localhost:8000`

### 7. Python venv na serveru
- [x] `cd apps/ai-server && python3 -m venv .venv`
- [x] `.venv/bin/pip install -r requirements.txt`
- [x] Instalirani: PyTorch, CLIP, FAISS, Transformers (~2GB)
- [x] Fix: Numpy degradiran na verziju < 2.0.0 (rešen FAISS ImportError)

---

## 📊 Status Summary (Dan 0 - ✅ Završeno)

### ✅ Operativno
- **Backend API**: `localhost:3000` (PM2: velve-api, ID 0)
- **AI Server**: `localhost:8000` (PM2: velve-ai, ID 1)
- **Ollama**: `localhost:11434` (Qwen2.5 7B)
- **Cloudflare Tunnel**: `https://pepper-spreading-paris-trailers.trycloudflare.com` → `localhost:3000`
- **MongoDB Atlas**: Flex Tier, uspešno povezan
- **Cloudflare R2**: Konfigurisan za image storage

### 🔧 Fixes Applied
1. Backend: Instaliran `nodemailer`, ispravljen typo u `verification.js`
2. AI Server: Numpy downgrade na < 2.0.0 za FAISS kompatibilnost
3. Mobile: Dodat `EXPO_ROUTER_APP_ROOT` u `metro.config.js` (fix za expo-router bundling)

### 📱 Sledeći Korak (Dan 1)
**Mobile App Setup:**
```bash
# U apps/mobile/.env zameni:
EXPO_PUBLIC_API_URL=https://pepper-spreading-paris-trailers.trycloudflare.com
```

Sada možeš testirati app sa Expo Go bez obzira na mrežu! 🎉
