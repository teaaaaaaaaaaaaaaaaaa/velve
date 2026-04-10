# Velve Test Guide — Clean Cut + VTO

## Pre-uslovi (sve vec podeseno)

- [x] MongoDB Atlas — konekcija radi
- [x] Cloudflare R2 — bucket + kredencijali
- [x] Firebase — auth podesena
- [x] Ollama — trci lokalno (qwen2.5-coder modeli)
- [x] Modal.com — nalog kreiran, FASHN VTON deployed
- [x] MODAL_ENDPOINT_URL upisan u ai-server .env
- [x] MONGODB_URI upisan u ai-server .env
- [x] Mobile LAN IP azuriran u mobile .env

## Pokretanje (3 terminala)

```bash
# Terminal 1 — AI Server
cd apps/ai-server
.venv\Scripts\activate
python main.py
# ocekuj: Uvicorn running on http://0.0.0.0:8000

# Terminal 2 — API Server
cd apps/api
npm run dev
# ocekuj: Server running on port 3000

# Terminal 3 — Mobile (Expo)
cd apps/mobile
npx expo start
# skeniraj QR sa Expo Go ili pokreni na emulatoru
```

## Test 1: Osnovna navigacija

1. Otvori app, uloguj se (Google Sign-In)
2. Proveri da li se feed ucitava (tab "Feed")
3. Proveri Closet tab — lista tvojih artikala
4. Proveri Chat tab
5. Proveri Profile tab

## Test 2: Upload artikla (postojeci flow)

1. Idi na Upload tab
2. Izaberi sliku iz galerije (ili slikaj kamerom)
3. Popuni detalje (naziv, kategorija, velicina)
4. Submituj — artikal se pojavljuje u Closet-u
5. Proveri da je slika uploadovana na R2 (vidljiva u app-u)

## Test 3: Clean Cut — Digitalizacija

1. Otvori artikal iz Closet-a (tap na karticu)
2. Nadji dugme "Digitalizuj" / "Clean Cut" na item detail ekranu
3. Pokreni digitalizaciju — API poziva ai-server /remove-background
4. Sacekaj 2-5s (rembg procesira na CPU)
5. Proveri rezultat: artikal na cistoj beloj pozadini
6. Potvrdi ("Savrseno, arhiviraj") ili probaj ponovo

**Ocekivano:**
- imageClean URL se upisuje u MongoDB
- isDigitized postaje true
- U Closet-u se prikazuje clean verzija slike

**Ako ne radi:**
- Proveri da AI server radi (http://localhost:8000/docs)
- Proveri API konzolu za error logove
- Prvi poziv moze trajati duze (~10s) jer rembg skida birefnet model

## Test 4: Body Scan (VTO preduslov)

1. Iz Closet/Archive ekrana, tap "Magicno Isprobaj (VTO)"
2. Ako nemas body scan — otvara se onboarding flow
3. Slikaj se na cistoj pozadini (full body)
4. Slika se uploaduje na R2, bodyScanUrl se cuva na user dokumentu
5. Proveri u MongoDB: user dokument ima bodyScanUrl

**Ocekivano:**
- Body scan se cuva jednom, ne trazi se ponovo

## Test 5: Virtual Try-On (VTO)

**PREDUSLOV:** Imas bar 1 digitalizovan artikal + body scan

1. Iz VTO Hub-a (Probna Soba), tap dugme za selekciju artikala
2. Izaberi jedan ili vise digitalizovanih artikala
3. Tap "Isprobaj"
4. Sacekaj ~10-30s (prvi poziv je spor — Modal cold start)
5. Rezultat: tvoja slika sa renderovanom odecom

**Ocekivano:**
- AI server prosledjuje request na Modal endpoint
- Modal vraca base64 sliku
- Rezultat se prikazuje na ekranu

**Ako ne radi:**
- Proveri Modal dashboard: https://modal.com/apps/contact-tradey/main/deployed/velve-fashn-vton
- Proveri da MODAL_ENDPOINT_URL u ai-server .env odgovara deployed URL-u
- Proveri AI server logove za error poruke
- Ako je "cold start timeout" — probaj ponovo, drugi put ce biti brze

## Test 6: Sacuvaj Outfit

1. Nakon uspesnog VTO renderovanja
2. Tap ikonu za snimanje (dole na Hub ekranu)
3. Unesi ime outfita (npr. "Misty Night Out")
4. Tap "Sacuvaj u Kolekciju"
5. Proveri da outfit postoji u GET /vto/outfits

## Brzi health-check endpointi

```bash
# AI Server
curl http://localhost:8000/docs          # Swagger UI
curl http://localhost:8000/health        # health check

# API Server
curl http://localhost:3000/              # root
curl http://localhost:3000/items         # lista itema (treba auth)

# Modal VTO (direktno)
# Ne pozivaj direktno — ide kroz AI server
```

## Poznati problemi

- **Prvi rembg poziv:** ~10s jer skida birefnet-general model (~170MB), posle je ~1.5s
- **Prvi VTO poziv:** ~30-60s jer Modal dize container + skida FASHN weights (~4GB u Volume)
- **LAN IP:** Ako se WiFi promeni, azuriraj EXPO_PUBLIC_API_URL u apps/mobile/.env
- **Ollama:** Mora da radi za AI opise artikala (feed enrichment), ali nije potreban za Clean Cut/VTO
- **Mobile lint warnings:** Postojeci formatting/import warnings — nisu blokeri
