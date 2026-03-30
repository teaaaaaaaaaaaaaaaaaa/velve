# Velve — Product Requirements Document (PRD)
**Verzija:** v1.2  
**Datum:** Mart 2026  
**Tim:** Vukašin, Teodora  
**Status:** U razvoju — rok 1 mesec

---

## 1. Pregled platforme

Velve je AI-powered platforma za razmenu garderobe (clothing trading). Korisnici mogu da postavljaju svoju garderobu, otkrivaju tuđu putem vizuelnog feed-a i dogovaraju direktnu razmenu. Platforma je dizajnirana sa fokusom na engagement, vizuelno otkrivanje i community-driven trading.

**Misija:** Napraviti najprijatnije i najinteligentnijie mesto za razmenu garderobe na Balkanu i šire.

**Inicijalni launch:** Beograd → Zagreb → šire.

---

## 2. Ciljano tržište i korisnici

- **Primarna ciljna grupa:** Mladi od 16–30 godina zainteresovani za modu i održivost
- **Geografija faza 1:** Beograd
- **Geografija faza 2:** Zagreb
- **Podržani jezici:** Srpski (latinica), Engleski, Ruski
- **Platforma:** Android i iOS (React Native), Web (React)

---

## 3. Funkcionalnosti koje već postoje

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
- EAS Build: iOS i Android buildovi u cloudu
- Expo Go app: instant testiranje na fizičkom uređaju skeniranjem QR koda
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

**Push notifikacije:** Expo Push Notifications (besplatno, wrapper oko FCM i APNs)

---

### Prioritet 5 — Swipe/Feed UI

Feed je dizajniran po uzoru na **TikTok + Instagram**: vertikalni infinite scroll, fullscreen kartice garderobe.

**Feed algoritam — hibridni pristup:**

**Faza 1 — Cold start (0–2k korisnika):**
- Feed sortiran po kombinaciji: freshness + engagement score (likes + trade requests)
- Vizuelna sličnost (CLIP/FAISS): korisnik vidi iteme slične onima sa kojima je interagovao
- Novi korisnik: kratki onboarding gde bira kategorije → odmah filtrira feed

**Faza 2 — Personalizacija (2k+ korisnika):**
- Engagement signali se akumuliraju: view, like, save, trade request, hide
- Feed ranking uzima u obzir: vizuelnu sličnost + korisnikovu istoriju interakcija

**Korisničke interakcije u feed-u:**
- 👍 Like
- 🔖 Save (čuva u kolekciju)
- 💬 Request trade (otvara chat)
- 👁 Hide (ne prikazuj više ovaj item/korisnika)

---

## 5. Trade sistem

1. Korisnik A vidi item korisnika B u feed-u
2. Šalje "trade request" — poruka + ponuda sopstvenog itema
3. Korisnik B prihvata ili odbija
4. Ako prihvate: dogovaraju detalje putem chata
5. Fizička razmena/slanje se dogovara van platforme (faza 1)

---

## 6. Moderacija i sigurnost

- Report dugme na svakom itemu i profilu
- Admin panel (planiran): pregled prijavljenih itema, mogućnost uklanjanja
- Rate limiting na svim endpointima (zaštita od botova)
- Firebase Auth: zaštita od neautorizovanog pristupa

---

## 7. Monetizacija

Monetizacija se uvodi **tek kada platforma dostigne 10,000 aktivnih korisnika**.

**Planirani modeli monetizacije (budućnost):**
- **Native fashion ads**: Brendovi promovišu garderobu kao item u feed-u (označeno kao "promoted")
- **Promoted listings**: Korisnici plaćaju za veću vidljivost svojih itema
- **Brand collaborations**

**Aplikacija ostaje 100% besplatna za download. Nema premium subscription plana.**

---

## 8. Tehnološki stack — kompletan pregled

### Frontend (Web)
| Tehnologija | Svrha |
|---|---|
| React | Web aplikacija |
| Cloudflare Pages | Hosting (besplatno) |

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

## 9. Server infrastruktura (Self-hosted)

### 9.1 Hardware specifikacije

Server je uspešno upaljen i spreman za konfiguraciju.

| Komponenta | Specifikacija |
|---|---|
| CPU | Intel Xeon E3-1270 |
| RAM | 16GB ECC DDR4 |
| Storage | 2× 2TB SAS diskovi |

**Napomena o CPU:** Xeon E3-1270 nema integrisanu grafiku i nema GPU — AI stack (Ollama + CLIP) je biran upravo da radi na CPU-only, što ovaj server podržava.

---

### 9.2 RAID konfiguracija — odluka

#### Kontekst

Server hostuje: Node.js API, Python AI server (Ollama, CLIP, FAISS), OS i zavisnosti.

Kritični podaci su **van servera**:
- Slike korisnika → Cloudflare R2
- Baza podataka → MongoDB Atlas Flex
- Kod → GitHub

#### Analiza opcija

| RAID tip | Kapacitet | Zaštita | Preporuka |
|---|---|---|---|
| **RAID 1 (Mirror)** | 2TB | ✅ Jedan disk može crknuti, server nastavlja | ✅ **Preporučeno** |
| No RAID (JBOD) | 2× 2TB odvojeno | ❌ Nema zaštite | ⚠️ Rizično |
| RAID 0 (Stripe) | 4TB | ❌ Jedan disk crkne = sve izgubljeno | ❌ Nije za produkciju |

#### Odluka: RAID 1 (Mirror)

**Razlog:** Server je kritična infrastruktura — ako disk crkne bez RAID zaštite, Velve je kompletno down dok se ne reinstalira OS, Node.js, Python, Ollama modeli i sve AI zavisnosti (~4–8 sati downtime-a). Sa RAID 1, server nastavlja da radi bez prekida dok se disk mirno zameni.

**Zašto ne RAID 0:** Brži write je relevantan za storage-heavy workloade, ali ovaj server primarno čita modele i procesira API requeste. 4TB kapaciteta nije potrebno — Qwen2.5 7B (~5GB) + CLIP (~1GB) + OS + kod ostaju daleko ispod 2TB.

**Zašto ne No RAID:** Nema jasne prednosti. Slike su na R2, baza na Atlas — jedino što se gubi su sati reinstalacije.

#### Kapacitet pri RAID 1

| Stavka | Veličina |
|---|---|
| Ubuntu Server OS | ~5GB |
| Node.js + zavisnosti | ~1GB |
| Python + zavisnosti (CLIP, FAISS) | ~3GB |
| Ollama + Qwen2.5 7B model | ~5GB |
| CLIP model | ~1GB |
| FAISS indeks (50k itema) | ~100MB |
| Logs + temp fajlovi | ~10GB |
| **Ukupno (procena)** | **~25GB** |
| **Slobodno od 2TB** | **~1.975TB** |

2TB je više nego dovoljno za sve planirane workloade u fazi 1 i fazi 2.

---

## 10. Arhitektura sistema

```
Korisnik (Mobile/Web)
        │
        ▼
Firebase Auth (Google / Email)
        │
        ▼
Node.js API Server
Ubuntu · Xeon E3-1270 · 16GB ECC · RAID 1
Cloudflare Tunnel (HTTPS)
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

---

## 11. Timeline — 1 mesec

| Nedelja | Cilj |
|---|---|
| 1 | Google login integracija, MongoDB migracija na Flex, RAID 1 konfiguracija + Ubuntu setup |
| 2 | AI server setup (Ollama + CLIP + FAISS) |
| 3 | React Native + Expo setup, prvi Android build putem EAS |
| 4 | Swipe/feed UI, iOS build putem EAS, testiranje |

---

## 12. Šta se ne radi (scope out)

- ❌ SMS OTP login — uklonjen, preskup
- ❌ Apple login — nema iOS fokusa u fazi 1
- ❌ Credit/coin sistem — nije u planu
- ❌ In-app plaćanje — nije u planu za fazu 1
- ❌ Admin panel — planiran ali nije u prvih mesec dana
- ❌ GPU server — AI stack je biran specifično da radi bez GPU-a
- ❌ RAID 0 / No RAID — odbačeno, rizik od gubitka podataka neprihvatljiv

---

## 13. Ključni rizici

| Rizik | Verovatnoća | Mitigacija |
|---|---|---|
| Server downtime (lokalni računar) | Srednja | RAID 1 štiti od disk failure, Cloudflare Tunnel cache, PM2 auto-restart, monitoring |
| Disk failure (SAS) | Srednja | RAID 1 — server nastavlja sa jednim diskom, zamena diska bez downtime-a |
| EAS Build iOS zahteva Apple Developer ($99/god) | Visoka — obavezno | Planirati u budžet od početka |
| CLIP sporiji bez GPU-a | Srednja | Embeddingi se generišu jednom pri uploadu, ne real-time |
| MongoDB Flex cena raste sa volumenom | Niska do 10k | Cap je $30/mes |
| Bot abuse na trade requestovima | Niska | Rate limiting, Firebase Auth zaštita |