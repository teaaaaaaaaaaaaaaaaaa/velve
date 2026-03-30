# Velve — Plan implementacije za Vukašina
**Uloga:** Backend, AI server, Infrastruktura
**Period:** 30 dana (April 2026)

---

## Nedelja 1 — Temelji (Dani 1–7)

### Infrastruktura
- Instaliraj Ubuntu Server na self-hosted mašini (Xeon E3-1270, 16GB RAM)
- Konfiguriši RAID 1 na 2× 2TB SAS diskovima — garantuje preživljavanje kvara jednog diska bez downtime-a
- Instaliraj Node.js 20+, Python 3.11+, Git, PM2
- Postavi Cloudflare Tunnel — daje javni HTTPS URL bez statičke IP adrese

### Baza podataka
- Prebaci MongoDB Atlas sa M0 (512MB besplatno) na Flex Tier (~8-30$/mes)
- Razlog: M0 nije dovoljan za CLIP embedding vektore (512 dimenzija × 50k slika = stotine MB)
- Poveži Node.js API sa MongoDB Atlas Flex koristeći connection string iz `.env`
- Konfiguriši Atlas Vector Search indeks na `items.embedding` polju (priprema za Nedelju 2)

### Backend API
- Popuni sve placeholder rute sa pravom logikom:
  - `POST /api/items` — primanje podataka o predmetu, čuvanje u MongoDB
  - `GET /api/items` — lista predmeta sa paginacijom
  - `GET /api/items/:id` — detalji jednog predmeta
  - `PUT /api/items/:id` — izmena (samo vlasnik)
  - `DELETE /api/items/:id` — brisanje (samo vlasnik)
- Implementiraj `User` model — kreira se automatski pri prvom loginu putem Firebase UID-a
- Poveži Firebase Admin SDK sa pravim servisnim nalogom (preuzmi JSON iz Firebase konzole)
- Testiraj `GET /ping` sa `curl http://localhost:3000/ping`

### Milestone nedelje 1
- Server je online i dostupan putem Cloudflare Tunnel
- API prima zahteve i čuva podatke u MongoDB
- Firebase autentikacija radi (token se verifikuje na serveru)

---

## Nedelja 2 — AI server i upload pipeline (Dani 8–14)

### Ollama + Qwen2.5 7B
- Instaliraj Ollama na serveru: `curl -fsSL https://ollama.com/install.sh | sh`
- Preuzmi model: `ollama pull qwen2.5:7b` (~5GB, CPU-only)
- Implementiraj `POST /generate-description` endpoint u FastAPI:
  - Prima: kategorija, veličina, brend, stanje, boja
  - Šalje prompt Ollami
  - Vraća: title + description na engleskom (ili srpskom ako korisnik bira)

### CLIP embedding pipeline
- Instaliraj Python zavisnosti: PyTorch (CPU build), transformers, Pillow
- Implementiraj `POST /embed` endpoint:
  - Prima URL slike (R2 URL)
  - Preuzima sliku, prolazi kroz CLIP model
  - Vraća 512-dimenzionalni vektor
- Embeddinzi se generišu jednom pri uploadu — ne real-time, ne pri svakom pregledu

### FAISS similarity search
- Inicijalizuj FAISS flat index (L2 distanca)
- Implementiraj `POST /similar`:
  - Prima embedding vektor + `top_k`
  - Pretražuje FAISS indeks
  - Vraća ID-ove vizuelno sličnih predmeta
- FAISS indeks se čita iz memorije (reload pri restartu servera)

### Cloudflare R2 upload pipeline
- Konfiguracija R2 bucket-a u Cloudflare dashboardu
- Na Node.js API strani: `POST /api/upload` ruta
  - Prima multipart/form-data sa slikom
  - Uploaduje na R2 putem AWS S3-compatible API-ja
  - Vraća javni URL slike

### Integracija AI ↔ API
- Nakon što korisnik uploaduje sliku:
  1. Node.js API uploaduje sliku na R2
  2. Poziva Python AI server `POST /embed` sa R2 URL-om
  3. Čuva embedding u MongoDB `items.embedding` polju

### Milestone nedelje 2
- Korisnik može da doda predmet
- AI generiše opis automatski
- Slika je uploadovana na R2
- CLIP embedding je sačuvan u MongoDB
- Feed prikazuje predmete

---

## Nedelja 3 — Socijalni sloj (Dani 15–21)

### WebSocket chat
- Dodaj `socket.io` u Node.js API (`npm install socket.io`)
- Implementiraj real-time chat sobe:
  - Klijent se konektuje sa Firebase tokenом (verifikuj pri konektovanju)
  - Korisnik može da pošalje poruku u sobu
  - Sobe se kreiraju automatski uz trade request
- Čuvaj poruke u MongoDB `Chat` modelu

### Trade request sistem
- `POST /api/trades` — korisnik A šalje ponudu korisniku B
  - Kreira `TradeRequest` dokument
  - Kreira `Chat` sobu između korisnika
  - (Buduće) — šalje push notifikaciju korisniku B
- `PUT /api/trades/:id` — korisnik B prihvata ili odbija
  - Menja status na `accepted` ili `rejected`

### Like i Follow API
- `POST /api/items/:id/like` — lajk predmeta (upsert, idempotent)
- `DELETE /api/items/:id/like` — ukloni lajk
- `POST /api/users/:id/follow` — prati korisnika
- `DELETE /api/users/:id/follow` — prestani da pratiš

### Push notifikacije (backend deo)
- Integriši Expo Push Notifications API na backend strani
- Čuvaj Expo push token korisnika u `User` modelu
- Šalji notifikaciju kada:
  - Korisnik dobije trade request
  - Trade request je prihvaćen/odbijen
  - Nova poruka u chatu

### Milestone nedelje 3
- Trade request flow radi end-to-end (pošalji → prihvati → chat)
- Real-time chat funkcioniše
- Push notifikacije stižu

---

## Nedelja 4 — Poliranje i sigurnost (Dani 22–30)

### Feed algoritam
- Implementiraj feed ranking na `GET /api/feed`:
  - Faza 1: 60% freshness score (noviji predmeti imaju prednost) + 40% engagement score (likes + trade requests)
  - Filtriranje: sakriveni predmeti/korisnici se ne prikazuju
  - Paginacija kursorom umesto offset-a (performansije za beskonačni scroll)

### Security audit
- Prođi kroz sve rute i proveri:
  - Da li svaka write operacija ima `requireAuth`
  - Da li korisnik može da menja samo svoje podatke
  - Da li su svi korisnički inputi sanitizovani pre unosa u MongoDB
- Proveri da `.env` nije u git historiji: `git log --all -- '*.env'`

### PM2 monitoring
- Postavi PM2 za automatski restart Node.js i Python servera:
  ```
  pm2 start apps/api/src/index.js --name velve-api
  pm2 start "uvicorn main:app" --name velve-ai --cwd apps/ai-server
  pm2 save
  pm2 startup
  ```
- Postavi PM2 monitoring dashboard ili loger

### Rate limiting i anti-bot
- Stroži rate limit za auth rute: 10 req/15min za `/api/auth/*`
- Provjeri da Cloudflare Tunnel ne zaobilazi rate limit
- Dodaj input validaciju dužine stringova (title max 100 chars, description max 500)

### Milestone nedelje 4 (Dan 30)
- Server radi stabilno, PM2 automatski restartuje servise
- Feed algoritam rangira predmete po freshness + engagement
- Security audit završen, nema očiglednih rupa
- Google Play Internal Testing dostupan (koordinacija sa Teodorom)
- Mesečni cloud trošak: ~21$/mes (MongoDB Flex ~8$ + R2 ~2$ + ostalo $0)
