# Velve — Plan implementacije za Teodoru
**Uloga:** Mobile aplikacija, Web, Dizajn
**Period:** 30 dana (April 2026)
**Alati:** VS Code, Expo Go (na telefonu), EAS CLI

---

## Nedelja 1 — Navigacija i autentikacija (Dani 1–7)

### Expo setup
- Instaliraj Node.js, Expo CLI i EAS CLI na Windows računaru
- Instaliraj Expo Go aplikaciju na Android telefon (ili iPhone)
- U terminalu: `cd apps/mobile && npm install && npx expo start`
- Skeniraj QR kod Expo Go aplikacijom — vidiš placeholder ekrane

### Firebase konfiguracija
- U Firebase konzoli: napravi web app konfiguraciju
- Kopiraj API ključeve u `apps/mobile/.env` fajl
- Dodaj SHA-1 fingerprint Android uređaja da Google Sign-In radi (Vukašin ima pristup Firebase konzoli)

### Google Sign-In (primarni login)
- Napravi OAuth 2.0 credentials u Google Cloud Console
- Konfiguriši `expo-auth-session` sa web client ID-em
- Implementiraj `signInWithGoogle()` funkciju u `src/hooks/useAuth.ts`
- Testiraj: klik na "Nastavi sa Google" → Google prozor → uspešan login → redirect na Feed

### Email/Password login (sekundarni)
- Dodaj input polja u `RegisterScreen` i `LoginScreen`
- Validacija: email format, lozinka min 8 karaktera
- Implementiraj `signInWithEmail()` i `createUserWithEmailAndPassword()` iz Firebase

### Dizajn autentikacionih ekrana
- Boje: pozadina `bg-base-canvas` (#F6F8ED), primary button `bg-brand-accent-deep` (#431A43)
- Logo "Velve" na vrhu u `font-logo` (Ballet font)
- Google dugme: puno dugme sa ikonom, pill shape
- Email dugme: outline (border) stil
- Nikad ne koristiti hardcoded hex u JSX — uvek NativeWind klase

### Web app (Cloudflare Pages)
- `cd apps/web && npm install && npm run build`
- Poveži GitHub repo sa Cloudflare Pages (besplatno)
- Postavi automatski deploy na svaki push na `main` granu
- Web app prikazuje "Velve — Coming Soon" stranicu u brand bojama

### Milestone nedelje 1
- Expo Go na telefonu prikazuje app sa ekranima
- Google Sign-In radi i vraća korisnika na Feed ekran
- Web app je živa na Cloudflare Pages domenu

---

## Nedelja 2 — Osnovne funkcionalnosti (Dani 8–14)

### Upload ekran
- Forma za dodavanje predmeta:
  - Kamera ili galerija (koristiti `expo-image-picker`)
  - Polja: kategorija (dropdown), veličina, brend, stanje, boja
  - Dugme "Objavi" — šalje podatke na API
- Nakon submitovanja:
  - Šalje sliku na backend (`POST /api/upload`)
  - Čeka AI opis (od Vukašinovog AI servera)
  - Prikazuje generisani naslov i opis, dozvoljava izmenu
  - Čuva predmet

### Feed ekran
- Beskonačni scroll lista predmeta (`FlashList` iz `@shopify/flash-list`)
- Svaka kartica prikazuje: sliku, naslov, veličinu, brend
- Klik na karticu → detalji predmeta
- Pull-to-refresh za osvežavanje
- Loading skeleton dok se podaci učitavaju

### Detalji predmeta
- Fullscreen prikaz slike
- Naslov, opis, veličina, brend, stanje
- Dugme "Predloži razmenu" — otvara trade request flow

### Profil ekran
- Avatar (slika), ime, bio
- Grid prikaz korisnikovih predmeta
- Broj pratilaca / praćenih (samo prikaz za sada)
- Dugme "Izmeni profil" (placeholder)

### Milestone nedelje 2
- Korisnik može da objavi predmet sa slikom
- Feed prikazuje predmete iz baze
- Profil ekran prikazuje korisnikove predmete

---

## Nedelja 3 — Komunikacija (Dani 15–21)

### Trade request UI
- Sa ekrana detalja predmeta: dugme "Predloži razmenu"
- Otvara modal: izbor sopstvenog predmeta koji nudiš
- Kratka poruka (opcionalno)
- Potvrda → šalje trade request na backend

### Chat lista
- Lista aktivnih razgovora korisnika
- Svaki red: avatar suprotne strane, poslednja poruka, vreme
- Nepročitane poruke označene

### Chat ekran
- Real-time poruke putem WebSocket-a (Socket.io)
- Slanje poruka dodirom na Send
- Scroll do najnovije poruke automatski
- Poruke grupisane po datumu

### Like animacije
- Dupli tap na karticu u feed-u → like sa animacijom srca (Reanimated 3)
- Like dugme na kartici sa brojem lajkova

### Push notifikacije (mobile deo)
- Registruj uređaj za push notifikacije (`expo-notifications`)
- Čuvaj Expo push token na serveru
- Prikaži notifikaciju kada stigne trade request ili nova poruka

### Milestone nedelje 3
- Trade request flow radi (pošalji → suprotna strana vidi → prihvati → chat se otvara)
- Chat radi real-time
- Push notifikacije stižu na telefon

---

## Nedelja 4 — Poliranje i buildovi (Dani 22–30)

### Performance
- Proveri da feed ne rerenduje nepotrebno (React.memo za kartice)
- Slike sa lazy loading i placeholder
- Offline stanje: prikaži lepu poruku kada nema interneta umesto crash-a

### Error handling
- Ako API ne odgovara: prikaži grešku, ne prazan ekran
- Ako upload ne uspe: obavesti korisnika
- Error boundary na svakom tab ekranu

### Accessibility
- `accessibilityLabel` na svim dugmadima
- Tekst dovoljno velik i sa dobrim kontrastom (bijeli na tamnoj pozadini)
- Screen reader podrška za ključne akcije

### EAS Android build
- `cd apps/mobile && eas build --platform android`
- Build se izvršava u Expo cloudu (ne potreban Android Studio)
- Preuzmi `.apk` fajl i instaliraj na test uređaj
- Podeli `.apk` sa test korisnicima putem Google Play Internal Testing

### EAS iOS build
- Obavezan Apple Developer Program ($99/god) — mora biti aktivan
- `eas build --platform ios`
- Build se izvršava u Expo cloudu (ne potreban Mac)
- Postavi na TestFlight za beta testere

### Finalni dizajn detalji
- Proveri da su sve boje semantičke (NativeWind klase, ne hardcoded)
- Glassmorphism tab bar: proveri da blur efekat radi na oba OS-a
- Konzistentni rounded corners i spacing na svim ekranima

### Milestone nedelje 4 (Dan 30)
- Android build instaliran na fizičkim test uređajima
- iOS build dostupan na TestFlight
- 10–20 test korisnika mogu da koriste app
- Svi osnovni flow-ovi rade: registracija → upload → feed → trade → chat

---

## Tehnički podsetnik
- **Pokreni app:** `npx expo start` → skeniraj QR kod sa Expo Go
- **NativeWind klase:** uvek koristiti semantičke klase, nikad hardcoded hex
- **Fontovi:** Ballet (`font-logo`), Alte Haas Grotesk (`font-display`), Inter (`font-sans`)
- **API URL:** u `.env` fajlu kao `EXPO_PUBLIC_API_URL`
- **Koordinacija sa Vukašinom:** proveri da backend endpoint postoji pre nego što napraviš UI za njega
