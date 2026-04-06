# Velve — Implementacioni plan: Clean Cut + Virtual Try-On (VTO)

**Verzija:** v1.0  
**Datum:** April 2026  
**Status:** Spreman za implementaciju  
**Scope:** Mobile only (React Native + Expo)

---

## Tehnološke odluke

### Background removal (Clean Cut)
- **Library:** `rembg` sa `birefnet-general` modelom
- **Gde radi:** Self-hosted, direktno u postojećem `apps/ai-server/` FastAPI serveru
- **Cena:** $0 — potpuno besplatno, MIT licenca
- **CPU viable:** Da — 1.4s/slika na CPU, bez GPU-a
- **Kvalitet:** Odličan za odeću (čiste ivice, nema hair complexity)

### Virtual Try-On
- **Model:** FASHN VTON v1.5 (open-source, Apache-2.0)
- **Hosting:** Modal.com — serverless GPU (A10G, 24GB VRAM)
- **Cena:** ~$0.002–0.003/try-on (plaća se samo vreme izvršavanja)
- **Free tier:** $30 kredita/mesec ≈ 10,000 besplatnih proba za beta
- **Latency:** ~7–10s/slika na GPU
- **Licenca:** Apache-2.0 — komercijalna upotreba dozvoljena

| Scenario | Cena |
|---|---|
| Beta (do 10k proba/mes) | $0 (Modal free tier) |
| 50k proba/mes | ~$100–150 |
| FASHN.ai API ekvivalent (50k) | $3,750 |

---

## Feature 1: "Clean Cut" — Digitalizacija artikala

### Faza 1.1 — AI Server (`apps/ai-server/`)

- Dodati `rembg[cpu]` u `requirements.txt`
- Inicijalizovati `birefnet-general` sesiju jednom pri startu servera, zajedno sa postojećom CLIP/FAISS inicijalizacijom (session reuse — bez per-request loading)
- Novi endpoint: `POST /remove-background`
  - Prima: sliku (multipart upload ili URL)
  - Obrađuje: `rembg` uklanja pozadinu, rezultat je PNG sa belom pozadinom
  - Vraća: čistu sliku

### Faza 1.2 — API Server (`apps/api/`)

- Novi endpoint: `POST /items/:id/digitize`
  - Uzima originalnu sliku sa Cloudflare R2
  - Šalje na AI server `POST /remove-background`
  - Upload clean verzije na R2 pod novim ključem: `items/{id}/clean_{filename}`
  - Upisuje `imageClean` URL i `isDigitized: true` u MongoDB dokument itema
- Novi endpoint: `GET /items/:id/images`
  - Vraća i `imageOriginal` i `imageClean`

### Faza 1.3 — MongoDB schema (item dokument)

Dodati polja u postojeći item dokument:

```
imageClean     // URL čiste verzije na Cloudflare R2 (null dok nije digitalizovano)
isDigitized    // boolean, default: false
digitizedAt    // timestamp
```

Obe verzije slike se čuvaju na R2 — originalna kao fallback ako clean verzija nije dobra.

### Faza 1.4 — Mobile UI — 4 ekrana

**Ekran 1: "Unos Artikla"**

- Estetika: Čist `base-canvas` ekran
- Veliki, meki kvadrat sa isprekidanom linijom za unos slike
- Dugmad: bira iz galerije ili slika direktno kamerom
- Velve Hint (`font-sans`, suptilno): "Za najbolji digitalni duplikat, postavi artikal na ravnu površinu pod dobrim svetlom."

---

**Ekran 2: "AI Analiza" (Real-time Feedback)**

- Čim korisnik ubaci sliku, AI server analizira frejm
- Vizuelni efekat: Horizontalni "skener" u boji `brand-accent-light` sa blagim haze efektom prelazi preko slike
- Sistem provere 3 pravila:
  - **Pravilo 1 — Svetlo:** Ako je mračno → meki prozirni modul: "Treba nam malo više svetla za jasnu teksturu."
  - **Pravilo 2 — Kadar:** Ako je artikal zgužvan ili isečen → "Raširi artikal da vidimo njegov pun oblik."
  - **Pravilo 3 — Kontrast:** Ako je bela majica na beloj podlozi → "Dodaj malo kontrasta u pozadini da AI lakše prepozna ivice."
- Kada su sva 3 pravila OK: pojavljuje se dugme "Generiši Digitalni Artikal"

---

**Ekran 3: "Magična Transformacija" (The Clean Cut)**

- Korisnik klikne dugme, API poziv se šalje
- Animacija: originalna fotografija se polako "topi" i pretvara u čistu verziju na beloj pozadini
- Loading state tokom procesiranja na AI serveru
- Granulisan glow efekat tokom transformacije
- Rezultat: artikal izgleda profesionalno, bez senki i pozadine

---

**Ekran 4: "Potvrda Arhiviranja" (Final Review)**

- Layout: Dva `squircle` modula side-by-side — levo originalna fotka, desno AI clean verzija
- Naslov (`font-display`): "Izgleda li ovo kao tvoj komad?"
- Dugme `brand-accent-deep`: "Savršeno, arhiviraj" → `isDigitized = true`, oba URL-a upisana u MongoDB
- Transparentno dugme: "Probaj ponovo" → vraća na Ekran 1

---

## Feature 2: Virtual Try-On (VTO)

### Faza 2.1 — Modal.com deployment (FASHN VTON v1.5)

- Klonirati FASHN VTON v1.5 repozitorijum
- Kreirati Modal.com nalog i instalirati Modal CLI
- Napisati Modal deployment fajl koji:
  - Definiše A10G GPU zahtev
  - Inicijalizuje `TryOnPipeline` jednom pri container startu (warm instance)
  - Expose-uje HTTP endpoint za pozive iz API servera
- `MODAL_API_KEY` i `MODAL_ENDPOINT_URL` u `.env` fajlu API servera
- Dodati `MODAL_API_KEY=` i `MODAL_ENDPOINT_URL=` u `.env.example`

### Faza 2.2 — AI Server (`apps/ai-server/`)

- Novi endpoint: `POST /virtual-try-on`
  - Prima: `personImageUrl` (body scan korisnika sa R2) + `garmentImageUrl` (mora biti clean verzija, `isDigitized: true`)
  - Prosleđuje Modal.com endpointu
  - Vraća: URL generisane slike (osoba sa odevenim predmetom)
- Validacija: odbija request ako `garmentImageUrl` nije clean verzija

### Faza 2.3 — API Server (`apps/api/`)

**User schema — dodati polja:**

```
bodyScanUrl        // URL slike korisnika za VTO (Cloudflare R2)
bodyScanCreatedAt  // timestamp
```

**Nova MongoDB kolekcija `outfits`:**

```
outfit {
  id
  userId
  name           // "Misty Night Out"
  itemIds[]      // reference na items kolekciju
  vtoImageUrl    // screenshot generisanog try-on rezultata (R2)
  createdAt
}
```

**Novi endpointi:**

- `POST /users/body-scan` — prima sliku, upload na R2, čuva `bodyScanUrl` na user dokumentu
- `GET /users/body-scan` — vraća da li postoji body scan (`exists: true/false`, URL)
- `POST /vto/try-on` — prima `itemIds[]`, poziva AI server za svaki artikal, vraća generisane slike
- `POST /vto/outfits` — sačuvaj outfit (naziv + lista itemIds + VTO screenshot URL)
- `GET /vto/outfits` — lista sačuvanih outfita korisnika

### Faza 2.4 — Mobile UI — 10 ekrana

---

**Ekran 1: "Tvoj Arhiv" (Moj Ormar)**

- Masonry grid (nepravilni grid) sa karticama artikala koje je korisnik sačuvao
- Kartice u "Soft Card" formatu sa mekom senkom, prikazuju clean verziju artikla
- Header `font-logo` wordmark: "Tvoj Arhiv"
- Plutajući "Glass" taster na dnu (`font-display` serif): "Magično Isprobaj (VTO)"
- **Logika:** Taster siv ako korisnik nema nijedan `isDigitized: true` artikal. Aktivan ako ima.

---

**Ekran 2: "Ritual Skenera" (Onboarding — prikazuje se samo prvi put, pre nego što postoji body scan)**

- Full-screen `base-canvas` pozadina
- Grafika: suptilna apstraktna animacija siluete osobe koja se pretvara u čistu modnu ilustraciju
- Naslov (`font-display`): "Da bi isprobala/o arhiv, potrebno je da stvorimo tvoj digitalni duplikat."
- Podtekst (`font-sans`): "Pronađi čistu, belu pozadinu sa dobrim svetlom. Procedura je anonimna i sigurna."
- Dugme (`brand-accent-deep`): "Započni Skener" → trigeruje sistemski dialog za kameru

---

**Ekran 3: "Silueta u Magli" (Kalibracija kamere)**

- Full-screen prikaz prednje kamere
- Prikaz nije oštar — ima suptilnu granulaciju i meke ivice (hazy filter)
- Overlay: prozirna, ultra-tanka grafička silueta osobe
- Oko siluete lebdi suptilna granulacija koja se ponaša kao senzor
- **Crvena silueta:** "Nisi u silueti ili pozadina nije čista bela." (sistem detektuje prepreke)
- **Zelena silueta:** "Savršeno. Zadrži poziciju za AI generaciju."
- Visual-Feedback: kada je zeleno, granulacija oko siluete počinje brzo da se vrti — osećaj generisanja podataka

---

**Ekran 4: "Rođenje Duplikata" (Generisanje)**

- Slika se uploaduje na R2 i šalje FASHN VTON modelu
- Animacija: ekranska magla se povlači, soft-focus prikaz siluete koja se pretvara u čistu reprezentaciju korisnika
- Loading state tokom procesiranja
- Status (`font-sans`): "Tvoj digitalni duplikat je spreman."
- Dugme (`brand-accent-deep`): "Uđi u Velve Arhiv"

---

**Ekran 5: "Probna Soba" (VTO Hub — glavna tačka)**

- Full-screen prikaz korisnikove slike (body scan) na čistoj beloj pozadini
- Header (`font-logo`): "Probna Soba"
- Gornji bar: `font-display` naslov "Virtual Try On" + mala ikona korisnika u uglu
- Ikona za deljenje gore desno → vodi na Ekran 10
- Glass ikona za snimanje dole → vodi na Ekran 9
- Dugme za selekciju artikala → vodi na Ekran 6

---

**Ekran 6: "Selektor Artikala"**

- Gornji bar sa pretragom i filterima: All / Tops / Bottoms
- Grid Velve Soft Card kartica sa mekim radijusom
- Svaka kartica prikazuje artikal u izolaciji (clean background — obavezno `isDigitized: true`)
- Suptilni checklist krugovi u uglu svake kartice (`brand-accent-deep` kada štiklirano)
- Artikli koji nisu digitalizovani (`isDigitized: false`) nisu prikazani ili su greyed out
- Dugme "Isprobaj" aktivno tek kada je barem jedan artikal štikliran

---

**Ekran 7: "Digitalni Šnajder" (Primena Fita)**

- Prikaz korisnikovog duplikata sa odabranom odećom renderovanom na telu
- Tokom VTO renderovanja (poziv ka Modal.com → FASHN VTON v1.5):
  - Animacija: ivice odeće se "kroje" uz granulisan glow efekat
  - Loading state (~7–10s)
- Subheader: "Clothes (N items)"
- Dugme za detalje fita → vodi na Ekran 8

---

**Ekran 8: "Arhivirani Artikli" (Detalji Fita)**

- Bottom Soft Card koji se diže (bottom sheet)
- Lista primenjenih artikala sa izolovane slike (clean verzija)
- Toggle prekidač pored svakog artikla ("Uključi/Isključi" posamezni komad)
- Toggle odmah re-trigguje novi VTO render bez vraćanja na prethodni ekran
- Cilj: brzo mešanje kombinacija

---

**Ekran 9: "Sačuvaj Fit" (Kao Outfit)**

- Plutajući Glass taster u obliku ikone za snimanje na glavnom VTO ekranu (Ekran 5, dole)
- Tap trigeruje Bottom Soft Card koji se diže
- Input polje (`font-sans`): ime outfita (placeholder: "Misty Night Out")
- Dugme (`brand-accent-deep`): "Sačuvaj u Kolekciju"
- Rezultat: outfit se čuva u `outfits` kolekciji sa VTO screenshotom i listom itemIds

---

**Ekran 10: "Podeli Arhiv" (Export)**

- Mala ikona za deljenje na Ekranu 5 gore desno
- Tap trigeruje Bottom Share Sheet
- **Opcija 1:** "Sačuvaj Sliku" — čuva u galeriju telefona sa `logo6.svg` vodenim žigom
- **Opcija 2:** "Podeli na Instagram/TikTok" — generiše pre-formatted story sa tagovanim brendovima
- **Opcija 3:** "Pošalji u Chat" — koristi Velve interni chat za slanje outfit slike

---

## Redosled implementacije

| Korak | Šta se radi | Zavisi od |
|---|---|---|
| 1 | `rembg` integracija u AI server, `/remove-background` endpoint | — |
| 2 | MongoDB schema update (item: `imageClean`, `isDigitized`; nova kolekcija `outfits`) | — |
| 3 | API endpointi za Clean Cut (`POST /items/:id/digitize`, `GET /items/:id/images`) | Koraci 1, 2 |
| 4 | Mobile UI: 4 Clean Cut ekrana | Korak 3 |
| 5 | FASHN VTON v1.5 deployment na Modal.com | — |
| 6 | `POST /virtual-try-on` endpoint na AI serveru (poziva Modal) | Korak 5 |
| 7 | User schema update (`bodyScanUrl`), API endpointi za body-scan i VTO | Koraci 2, 6 |
| 8 | Mobile UI: Ekrani 1–4 (body scan flow) | Korak 7 |
| 9 | Mobile UI: Ekrani 5–10 (VTO hub, try-on, save, share) | Koraci 4, 8 |

---

## Design sistem (podsetnik)

- `brand-accent-deep`: #431A43
- `brand-accent-light`: #9DD3E4
- `brand-highlight`: #CBDA63
- `base-canvas`: #F6F8ED
- `ink-dark`: #2B2A2B
- `font-logo`: Ballet
- `font-display`: Alte Haas Grotesk
- `font-sans`: Inter
- Stilizacija isključivo NativeWind v4 klase — nikad hardcoded hex vrednosti u JSX

---

## Napomene

- **VTO prima samo digitalizovane artikle** (`isDigitized: true`) — "Clean Cut" proces je obavezan preduslov za VTO
- **Body scan se čuva jednom** — korisnik ne mora da ponavlja skeniranje; prikazuje se onboarding (Ekrani 2–4) samo ako `bodyScanUrl` ne postoji
- **Modal.com cold start** (~3–5s prvi request u sesiji) — pri topoj instanci latency je ~7–10s
- **Obe verzije slike na R2** — originalna (`imageOriginal`) i clean (`imageClean`) — originalna služi kao fallback
