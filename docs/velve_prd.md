# Tradey — Product Requirements Document (PRD)
**Verzija:** v1.1  
**Datum:** Mart 2026  
**Tim:** Vukašin, Teodora  
**Status:** U razvoju — rok 1 mesec

---

## 1. Pregled platforme

Tradey je AI-powered platforma za razmenu garderobe (clothing trading). Korisnici mogu da postavljaju svoju garderobu, otkrivaju tuđu putem vizuelnog feed-a i dogovaraju direktnu razmenu. Platforma je dizajnirana sa fokusom na engagement, vizuelno otkrivanje i community-driven trading.

**Misija:** Napraviti najprijatnije i najinteligentnijie mesto za razmenu garderobe na Balkanu i šire.

**Inicijalni launch:** Beograd → Zagreb → šire.

---

## 2. Ciljano tržište i korisnici

- **Primarna ciljna grupa:** Mladi od 16–30 godina zainteresovani za modu i održivost
- **Geographija faza 1:** Beograd
- **Geografija faza 2:** Zagreb
- **Podržani jezici:** Srpski (latinica), Engleski, Ruski
- **Platforma:** Android i iOS (React Native), Web (React)

---

## 3. Funkcionalnosti koje već postoje

Sledeće funkcionalnosti su implementirane i rade:

| Funkcionalnost | Status |
|---|---|
| Firebase Auth (email/password) | ✅ Radi |
| Post CRUD (kreiranje, čitanje, izmena, brisanje) | ✅ Radi |
| Upload slika | ✅ Radi |
| Chat između korisnika | ✅ Radi |
| Like sistem | ✅ Radi |
| Follow sistem | ✅ Radi |
| React web frontend | ✅ Deploy na Vercel |

---

## 4. Funkcionalnosti u razvoju (roadmap)

### Prioritet 1 — Login sistem (refaktor)

Trenutni email/password login ostaje kao **sekundarna opcija**. Uvodi se:

- **Google Sign-In kao PRIMARY login** — jedan klik, bez forme, bez lozinke
- **Email/password ostaje kao SECONDARY opcija** — za korisnike koji ne žele Google
- **SMS OTP se potpuno uklanja** — previše skup ($0.06/SMS u Srbiji), bez free tiera za prave korisnike, rizik od bot-ova

**Zašto Google-first:**
- Google ima 61.54% tržišnog udela u social login prostoru
- Android dominira srpskim tržištem sa ~80% udelom — skoro svi korisnici već imaju Google nalog
- Povećava konverziju registracije za 20–35%
- Nulti trošak do 50,000 MAU (Firebase besplatan tier)
- Persistent session — korisnik se loguje jednom, ostaje ulogovan

---

### Prioritet 2 — Baza podataka (migracija)

Migracija na **MongoDB Atlas Flex Tier** (umesto M0 koji je premalen).

Razlozi:
- M0 (512MB) nije dovoljan za 10k korisnika + CLIP embeddingi (512 dim × 50k slika = stotine MB samo za vektore)
- Flex Tier: $8 base + usage, cap $30/mes
- Uključuje **Atlas Vector Search** koji može zameniti deo FAISS logike

Struktura dokumenta za item:
```
item {
  id
  userId
  title
  description
  category
  brand
  size
  condition
  images[]        // URL-ovi na Cloudflare R2
  embedding[]     // CLIP vektor (512 dim)
  createdAt
  updatedAt
}
```

---

### Prioritet 3 — AI server setup

AI sistem radi lokalno na self-hosted Ubuntu serveru (bez GPU-a). Dva komponenta:

**3a. Generisanje opisa proizvoda**

Model: **Ollama + Qwen2.5 7B**

- Radi bez GPU-a, idealan za lokalni server
- Odličan multilingual (srpski, engleski, ruski)
- Input: kategorija, veličina, brend, stanje, boja
- Output: title + kratak description

Primer outputa:
```
Title: Black oversized Nike hoodie
Description: Comfortable oversized Nike hoodie in excellent condition.
Perfect for casual streetwear outfits. Size L.
```

Endpoint: `POST /generate-description`

---

**3b. Vizuelne preporuke (AI similarity search)**

Stack: **CLIP + FAISS**

Proces:
1. Korisnik uploaduje sliku itema
2. CLIP generiše embedding (512-dim vektor)
3. Embedding se čuva u MongoDB
4. FAISS traži vizuelno slične iteme u bazi
5. Vraća preporuke korisniku

Buduća optimizacija: Kada se pređe na MongoDB Atlas Flex, **Atlas Vector Search** može preuzeti FAISS ulogu i eliminisati Python dependency.

---

### Prioritet 4 — Mobilna aplikacija

**Framework:** React Native + Expo

**Zašto Expo:**
- Jedan codebase za Android i iOS
- Nema potrebe za Mac-om za razvoj — sve se radi na Windows
- EAS Build: iOS i Android buildovi u cloudu (Expo server-i pokreću Xcode na macOS infrastrukturi)
- Expo Go app: instant testiranje na fizičkom uređaju skeniranjem QR koda — nema emulatora, nema čekanja
- OTA (Over-the-Air) updates: deploy JavaScript izmena bez ponovnog prolaska kroz App Store review

**Razvoj na Windows — toolset:**
- **VS Code** + React Native Tools extension
- **Expo Go** (Android + iPhone app) za live development
- **EAS CLI** za buildove: `eas build --platform android` / `eas build --platform ios`
- **Expo Orbit** desktop app — install buildova bez kablova
- **Android Studio** (opcionalno) — samo za Android emulator

**Deployment:**
- Android: Google Play Store ($25 jednokratno)
- iOS: Apple App Store ($99/god — Apple Developer Program obavezan za iOS distribuciju)
- Testiranje iOS bez Xcode-a: EAS Build generiše `.ipa`, testiranje putem TestFlight ili Expo Go

**Push notifikacije:** Expo Push Notifications (besplatno, wrapper oko FCM i APNs)

---

### Prioritet 5 — Swipe/Feed UI

Feed je dizajniran po uzoru na **TikTok + Instagram**: vertikalni infinite scroll, fullscreen kartice garderobe.

**Feed algoritam — preporučeni hibridni pristup (na osnovu industrijskih praksi):**

U ranoj fazi (0–1k korisnika) nema dovoljno podataka za pravu personalizaciju. Preporučen pristup:

**Faza 1 — Cold start (0–2k korisnika):**
- Feed sortiran po kombinaciji: freshness (novo = bolje) + engagement score (likes + trade requests)
- Vizuelna sličnost (CLIP/FAISS): korisnik vidi iteme slične onima sa kojima je interagovao
- Novi korisnik: kratki onboarding gde bira kategorije (Streetwear, Vintage, Sportswear...) — odmah filtrira feed

**Faza 2 — Personalizacija (2k+ korisnika):**
- Engagement signali se akumuliraju: view, like, save, trade request, hide
- Feed ranking uzima u obzir: vizuelnu sličnost + korisnikovu istoriju interakcija
- Korisnici koji lajkuju Nike dobijaju više Nike, korisnici koji skrivaju formalnu odeću dobijaju manje

**Zašto ovako:**
- TikTok i Instagram su godinama refinirali da je engagement-based ranking superioran od čistog chronological feed-a
- Vizuelna sličnost (CLIP) je Tradey-jev diferencijator — nema ga na Vinted ili Depop na isti način
- Cold start se rešava onboardingom kategorija, ne čekanjem na podatke

**Korisničke interakcije u feed-u:**
- 👍 Like
- 🔖 Save (čuva u kolekciju)
- 💬 Request trade (otvara chat)
- 👁 Hide (ne prikazuj više ovaj item/korisnika)

---

## 5. Trade sistem

Razmena funkcioniše kao direktan barter između korisnika:

1. Korisnik A vidi item korisnika B u feed-u
2. Šalje "trade request" — poruka + ponuda sopstvenog itema
3. Korisnik B prihvata ili odbija
4. Ako prihvate: dogovaraju detalje putem chata
5. Fizička razmena/slanje se dogovara van platforme (faza 1)

---

## 6. Moderacija i sigurnost

**Trenutni pristup:** Korisnici prijavljuju loš sadržaj, admin reaguje.

- Report dugme na svakom itemu i profilu
- Admin panel (planiran): pregled prijavljenih itema, mogućnost uklanjanja
- Rate limiting na svim endpointima (zaštita od botova)
- Firebase Auth: zaštita od neautorizovanog pristupa

---

## 7. Monetizacija

Monetizacija se uvodi **tek kada platforma dostigne 10,000 aktivnih korisnika**.

Pre tog broja:
- Reklame narušavaju UX
- Prihod bi bio zanemarljiv
- Fokus mora biti na rastu korisnika

**Planirani modeli monetizacije (budućnost):**
- **Native fashion ads**: Brendovi promovišu garderobu kao item u feed-u (označeno kao "promoted"). Primer: Nike promoted jacket, Zara promoted sneakers. Relevantniji od banner reklama, bolji CPM.
- **Promoted listings**: Korisnici plaćaju za veću vidljivost svojih itema
- **Brand collaborations**

**Aplikacija ostaje 100% besplatna za download. Nema premium subscription plana.**

---

## 8. Tehnološki stack — kompletan pregled

### Frontend (Web)
| Tehnologija | Svrha |
|---|---|
| React | Web aplikacija |
| Vercel / Cloudflare Pages | Hosting (CF Pages besplatno) |

### Mobile
| Tehnologija | Svrha |
|---|---|
| React Native | Cross-platform mobile framework |
| Expo + EAS | Build toolchain, OTA updates, push notifikacije |
| Expo Go | Development testiranje |
| EAS Build | Cloud buildovi za iOS i Android bez Mac-a |

### Backend
| Tehnologija | Svrha |
|---|---|
| Node.js | API server |
| Python | AI server (Ollama, CLIP, FAISS) |
| Ubuntu Server | Operativni sistem (self-hosted) |
| Cloudflare Tunnel | HTTPS bez static IP-a |

### AI
| Tehnologija | Svrha |
|---|---|
| Ollama + Qwen2.5 7B | Generisanje opisa (bez GPU-a) |
| CLIP | Image embeddings za vizuelnu pretragu |
| FAISS | Vektorska pretraga sličnih itema |

### Infrastruktura & Servisi
| Servis | Svrha | Cena |
|---|---|---|
| MongoDB Atlas Flex | Baza podataka + Vector Search | $8–$30/mes |
| Cloudflare R2 | Image storage + CDN | ~$2/mes |
| Cloudflare Tunnel | Secure tunnel do lokalne mreže | $0 |
| Firebase Auth | Google + Email/Password login | $0 |
| Expo Push Notifications | Push obaveštenja | $0 |
| Cloudflare Pages | Web hosting | $0 |
| Google Play | Android distribucija | $25 jednokratno |
| Apple Developer Program | iOS distribucija | $99/god |

---

## 9. Arhitektura sistema

```
Korisnik (Mobile/Web)
        │
        ▼
Firebase Auth (Google / Email)
        │
        ▼
Node.js API Server (Ubuntu, Cloudflare Tunnel)
   │                    │
   ▼                    ▼
MongoDB Atlas      Cloudflare R2
(data + vectors)   (slike)
   │
   ▼
Python AI Server (isti računar)
   ├── Ollama/Qwen2.5 7B → generate-description
   ├── CLIP → image embeddings
   └── FAISS → similarity search
```

Komunikacija između Node.js i Python servera: internal HTTP API (isti računar, bez mrežnog kašnjenja).

---

## 10. Timeline — 1 mesec

| Nedelja | Cilj |
|---|---|
| 1 | Google login integracija, MongoDB migracija na Flex |
| 2 | AI server setup (Ollama + CLIP + FAISS) |
| 3 | React Native + Expo setup, prvi Android build putem EAS |
| 4 | Swipe/feed UI, iOS build putem EAS, testiranje |

---

## 11. Šta se ne radi (scope out)

- ❌ SMS OTP login — uklonjen, preskup
- ❌ Apple login — nema iOS fokusa u fazi 1 (ali iOS app postoji)
- ❌ Credit/coin sistem — nije u planu
- ❌ In-app plaćanje — nije u planu za fazu 1
- ❌ Admin panel — planiran ali nije u prvih mesec dana
- ❌ GPU server — AI stack je biran specifično da radi bez GPU-a

---

## 12. Ključni rizici

| Rizik | Verovatnoća | Mitigacija |
|---|---|---|
| Server downtime (lokalni računar) | Srednja | Cloudflare Tunnel cache, monitoring |
| EAS Build iOS zahteva Apple Developer ($99/god) | Visoka — obavezno | Planirati u budžet od početka |
| CLIP sporiji bez GPU-a | Srednja | Embeddingi se generišu jednom pri uploadu, ne real-time |
| MongoDB Flex cena raste sa volumenom | Niska do 10k | Cap je $30/mes, M10 tek za 50k+ |
| Bot abuse na trade requestovima | Niska | Rate limiting, Firebase Auth zaštita |
