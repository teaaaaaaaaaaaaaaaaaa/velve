# Velve Mobile — Svi ekrani

---

## 1. AUTH

### Login (`/(auth)/login`)
- Google Sign-In dugme
- Email input + Password input
- Toggle switch za email/Google login
- "Sign In" dugme
- Link ka registraciji
- Prikazuje greške mreže, pogrešnih kredencijala

### Register (`/(auth)/register`)
- Email input
- Password input (min 8 karaktera)
- "Register" dugme
- "Nazad na login" dugme
- Validacija email-a, duplikat naloga

---

## 2. ONBOARDING (5 koraka)

### Terms (`/onboarding/terms`)
- Checkbox za prihvatanje uslova
- Klikabilni linkovi: Terms of Use, Privacy Policy
- "Prihvatam i nastavljam" dugme (disabled dok checkbox nije čekiran)

### Welcome (`/onboarding/welcome`)
- Brand wordmark
- "Počni" dugme — ide na sledeći korak

### Style (`/onboarding/style`)
- 8 style kartica: Casual, Street, Vintage, Luxury, Sportswear, Minimal, Boho, Grunge
- Multi-select (min 1)
- Progress bar + brojač odabranih (npr. 3/8)
- "Nastavi" dugme

### Categories (`/onboarding/categories`)
- 8 kategorija: Tops, Dresses, Trousers, Skirts, Outerwear, Knitwear, Sneakers, Bags
- Multi-select
- Progress bar (60%)
- "Nastavi" dugme

### Brands (`/onboarding/brands`)
- Text input za dodavanje custom brenda
- Lista predloženih brendova (Nike, Adidas, Zara, Mango, Reserved...)
- Odabrani brendovi prikazani sa X (ukloni)
- Progress bar (80%)
- "Nastavi" dugme

### About (`/onboarding/about`)
- Veličina odeće: dugmad XS / S / M / L / XL / XXL
- Veličina obuće: numerički input (36–47)
- Auto-detekcija grada (traži dozvolu za lokaciju)
- Manuelni picker: 20 srpskih gradova (fallback)
- "Završi" dugme → ide na body scan ili feed

### Scan (`/onboarding/scan`)
- Ikonica skenera
- Uputstvo za pripremu
- "Pokreni skener" dugme
- "Preskoči za sada" dugme → direktno na feed

---

## 3. TABOVI (Glavna navigacija)

### Feed (`/(tabs)/feed`)
- Full-screen immersive kartice — scroll gore/dole (paginated)
- Toggle "For You" / "Following"
- Search bar overlay (debounce)
- Na svakoj kartici: Like, Wishlist, Swap ikone
- Long-press ili dugme sa 3 tačke → modal sa: Sakrij, Prijavi, Vidi profil, Blokiraj
- Beskonačni scroll sa cursor-based paginacijom
- Optimistički UI za like/wishlist

### Chat — Lista (`/(tabs)/chat`)
- Dva taba: **Messages** i **Trades**
- Messages: lista četova (avatar, ime, poslednja poruka, timestamp, unread badge)
- Long-press na čet → opcija brisanja
- Trades: kartice aktivnih/čekajućih razmena sa dugmadima Accept / Reject / Cancel / Complete

### Chat — Detalj (`/(tabs)/chat/[id]`)
- Lista poruka (sender, timestamp, status isporuke)
- Inline kartice trade/buy propozala sa Accept/Reject
- Text input + dugme za slanje
- Typing indicator
- Real-time via Socket.io
- Optimistički prikaz (pending → sent / failed)
- Mark as read automatski

### Profile (`/(tabs)/profile`)
- Avatar (tap → upload nove slike) sa inicijali fallback
- Ime, bio, lokacija
- Stats: Followers / Following / Aktivni items / Swapovi
- Trust badges: rejting, broj swapova, response %
- Dugmad: Edit, Closet, Saved, Settings
- % kompletiranosti profila
- Dva taba: **Posts** (sopstveni items) i **Saved** (wishlist)
- Grid galerija sa navigacijom na item detalj

### Closet (`/(tabs)/closet`)
- 3 taba: **Live** / **Drafts** / **Archive** (sa brojevima)
- Kartice artikala: slika, status badge, brend/veličina
- Dugmad po artiklu: Otvori, Objavi/Pauziraj/Vrati, Digitizuj (Clean Cut), Obriši
- "Dodaj novi listing" CTA
- "Magic Try-On" dugme (aktivno ako postoje digitizovani artikli)

### Wishlist (`/(tabs)/wishlist`)
- 2-kolona grid sačuvanih artikala
- X dugme po artilku → ukloni iz wishlist-a
- Empty state sa "Nazad na feed" dugmetom
- Pull-to-refresh

---

## 4. UPLOAD FLOW (Clean Cut — 4 koraka)

### Start (`/upload-flow`)
- "Digitalizuj artikal" sekcija
- "Odaberi iz galerije" dugme
- "Snimi kamerom" dugme
- Traži dozvolu za galeriju/kameru

### Preview (`/upload-flow/preview`)
- Prikaz odabrane slike (contain fit)
- "Nastavi" dugme
- "Odaberi drugu sliku" dugme
- Nazad dugme

### Analyze (`/upload-flow/analyze`)
- Slika sa animiranom scanning linijom
- 3 quality check-a: Lighting / Framing / Contrast (OK ili Adjust badge)
- AI feedback poruka
- "Generiši digitalni artikal" dugme (aktivno kad sve prođe)
- Loading state sa cycling statusima

### Transform (`/upload-flow/transform`)
- Animirani brand wordmark (pulsira)
- Cycling statusni tekst (priprema → uklanjanje pozadine → digitizacija → upload → embedding → finalizacija)
- Automatski prelazi na review kad završi (120s timeout)

### Review (`/upload-flow/review`)
- Side-by-side: Originalna slika (levo) | Clean Cut slika (desno)
- Tap na sliku → fullscreen modal
- Info napomena o Clean Cut
- "Savršeno, nastavi" dugme
- "Pokušaj ponovo" dugme → briše draft i vraća na start

### Category (`/upload-flow/category`)
- 6 kategorija: Majice / Haljine / Pantalone / Jakne / Obuća / Dodaci
- 4 stanja: New / Like New / Good / Fair (radio)
- Progress bar (50%)
- "Nastavi" dugme

### Listing (`/upload-flow/listing`)
- 3 tipa listinga: Rent/Trade / Sell / Oboje
- Cena input u EUR (prikazuje se samo za Sell/Oboje)
- "Šta tražiš u zamenu?" textarea (prikazuje se za Trade)
- Horizontalni scroll brendova + custom input
- Size selector (XS–3XL + custom)
- Progress bar (75%)
- "Nastavi" dugme

### Description (`/upload-flow/description`)
- "Generiši AI opis" kartica (sparkles ikona, badge "Generated" kad završi)
- Refresh AI dugme
- Title input
- Description textarea
- Summary chips: kategorija, brend, veličina, tip listinga
- "Objavi" dugme → status available
- "Sačuvaj kao draft" dugme
- Loading overlay dok AI generiše

---

## 5. VIRTUAL TRY-ON (VTO)

### Hub (`/vto/hub`)
- Prikaz trenutnog VTO rendera (560px)
- Share dugme (aktivno samo kad postoji render)
- "Odaberi artikal" dugme
- Lista 3 poslednje sačuvane kombinacije
- Watermark overlay na renderu

### Select (`/vto/select`)
- Search input (debounce)
- Filter tabovi: Sve / Tops / Bottoms
- 2-kolona grid digitizovanih artikala
- Radio indikator na odabranom artilku
- "Dalje" dugme (aktivno kad je nešto odabrano)

### Render (`/vto/render`)
- Veliki VTO render (560px)
- Kartica sa detaljima artikla
- "Sačuvaj kao fit" sekcija sa name input (pre-filled "Misty Night Out")
- "Sačuvaj u kolekciju" dugme
- "Otvori hub" dugme

### Body Scan Intro (`/vto/body-scan`)
- Uputstvo: stoj uspravno, celo telo, čista pozadina
- "Pokreni skener" dugme

### Body Scan Kamera (`/vto/body-scan-camera`)
- Live kamera feed
- Tamni overlay sa ellipsom za pozicioniranje
- Real-time feedback tekst (osvetljenje, silueta)
- Border boja: crvena → zelena po spremnosti
- "Snimi" dugme (aktivno kad `ready && stableReadyCount >= 2`)
- Polling frame analize svakih 1.7s

### Body Scan Gotov (`/vto/body-scan-ready`)
- Poruka "Tvoj digitalni duplikat je spreman"
- "Uđi u Velve arhivu" dugme

### Archive (`/vto/archive`)
- Info napomena o digitalno-only artiklima
- 2-kolona grid digitizovanih artikala
- "Sačuvani fitovi" sekcija (3 poslednje kombinacije u redovima)
- "Magic Try-On" dugme dole (disabled ako nema digitizovanih artikala)
- Pull-to-refresh

---

## 6. ITEM DETALJ (`/items/[id]`)

- Full-height hero slika
- Nazad dugme + meni sa 3 tačke (Sakrij, Prijavi, Blokiraj)
- Overlay kartica: naziv, kategorija, brend, veličina, stanje, cena, tip
- Strana dugmad: Like, Swap count, Wishlist, Try-On, Digitizuj (samo sopstveni), Edit (samo sopstveni), Obriši (samo sopstveni)
- Info pills: Kategorija, Veličina, Stanje, Brend
- Opis artilka
- "Tražim u zamenu" panel (ako je trade listing)
- Seller signal panel: lokacija, rejting, završeni trades
- "Pošalji propozal" dugme → modal za odabir sopstvenog artikla ili cene
- Karusel sličnih artikala
- Edit modal: menjanje svih detalja artilka
- "Označi kao prodato" opcija

---

## 7. USER PROFIL (`/users/[id]`)

- Avatar + inicijali fallback
- Ime, lokacija, datum registracije, bio
- Stats: Aktivni items, Followers, Following, Swapovi
- Follow/Unfollow dugme
- "Pošalji poruku" dugme → otvara čet
- Grid aktivnih artikala → navigacija na item detalj
- Trust badges: lokacija, rejting, response rate
- Prijavi / Blokiraj opcije
- Ako gledaš sopstveni profil → redirect na `/profile` tab

---

## 8. SEARCH (`/search`)

- Text input (auto-fokus)
- Immersive feed rezultata (isti format kao glavni feed)
- Brojač rezultata
- Nazad dugme
- Empty state
- Like / Wishlist dostupni na rezultatima
- Debounce, cursor paginacija

---

## 9. SETTINGS (`/settings`)

- Language selector: SR / EN / RU dugmad
- "Odjavi se" dugme (crveni stil)

---

## 10. TRADE ARCHIVE (`/trade-archive`)

- Lista završenih / odbijenih / otkazanih / isteklih razmena
- Kartica: avatar, ime, slike ponuđenih/traženih artikala, status badge
- Empty state
- Pull-to-refresh
- Navigacija na item ili user profil iz kartice
