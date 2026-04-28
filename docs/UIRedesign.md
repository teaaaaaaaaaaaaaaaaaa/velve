# Velve Mobile — UI/UX Redesign Analiza

> Šta fali, šta je loše, šta standardizovati, nove ideje.

---

## 1. EKRANI KOJI FALE

### 1.1 Notifications ekran
Nema ga. Svaka event-driven aplikacija treba notification center. Korisnici ne znaju da je neko:
- Lajkovao njihov artikal
- Prihvatio/odbio razmenu
- Počeo da ih prati
- Odgovorio na poruku dok app nije bila otvorena
- Komentarisao (ako se uvede)

**Predlog:** `/notifications` ekran sa grupiranim notifikacijama (Today / Earlier), avatar + tekst + timestamp, tap → odgovarajući ekran. Badge na tab baru.

---

### 1.2 Onboarding — Slika profila
Tok: terms → welcome → style → categories → brands → about → scan  
Nema koraka za upload profilne slike. Korisnik završi onboarding bez ikakve slike, pa izgleda kao bot. Profil sa inicijalima nikome ne inspiriše poverenje na P2P platformi.

**Predlog:** Dodati korak između `about` i `scan` — jednostavan ekran: kamera ili galerija, mogućnost preskakanja.

---

### 1.3 Pregled propozala pre slanja
U item detalju korisnik šalje predlog direktno iz modala bez ikakve potvrde šta šalje. Nema ekrana "Evo šta šalješ" pre finalizacije.

**Predlog:** Confirmation screen ili bar review step u modalu — "Šalješ [artikal X] u zamenu za [artikal Y]".

---

### 1.4 Ocenjivanje posle razmene
Trade archive postoji ali nema mogućnosti ostavljanja ocene. Nema review sistema. Trust badges (rejting, swapovi) se verovatno ne ažuriraju nigde jer nema UI za to.

**Predlog:** Posle `trade → completed`, prikazati rating ekran: 1–5 zvezda + opcioni komentar. Ovo direktno gradi poverenje na platformi.

---

### 1.5 Item not available / Sold out ekran
Ako korisnik otvori link ka artilku koji je već prodat/arhiviran, item detail se ucitava ali prikazuje status. Nema redirect ni dedicated "Ovaj artikal više nije dostupan" ekrana sa predlogom sličnih stvari.

---

### 1.6 Podešavanja notifikacija
`/settings` ima samo jezik i logout. Nema kontrola nad push notifikacijama (korisnik ne može da ugasi notifikacije za like-ove a ostavi za poruke).

---

### 1.7 Upravljanje prationicima
Nema ekrana koji prikazuje listu tvojih followera i onih koje pratiš. Klik na "42 followers" ne radi ništa. Nema opcije da otpratiš nekog bez da ideš na njihov profil.

---

### 1.8 Blocked users / Privacy settings
Korisnik može da blokira nekoga ali nema ekran gde vidi koga je blokirao niti opciju da deblokirа.

---

## 2. EKRANI SA LOŠIM UX/UI

### 2.1 VTO Hub — Konfuzno inicijalno stanje
**Problem:** Korisnik dođe na Hub bez ijednog rendera. Vidi prazan prostor, watermark placeholder, i dugme "Odaberi artikal". Nije jasno šta treba da uradi ni zašto je ovde.

**Problem 2:** Nema opcije upravljanja sačuvanim fitovima — ne može se obrisati, preimenovati ni urediti kolekcija sa Huba.

**Predlog redesigna:**
- Ako nema rendera → prikazati onboarding card na hubu: "Stvori prvi outfit" sa jasnim koracima (1. odaberi artikal → 2. vidi kako stoji → 3. sačuvaj fit)
- Outfit kolekcija treba dugme za brisanje (swipe-to-delete ili long-press)
- Share dugme treba biti u overflow meniju, ne u header-u kad nema šta da se deli

---

### 2.2 Chat [id] — Failed poruke bez retry
**Problem:** Poruka ne može biti ponovo poslata. Korisnik vidi "Nije poslato" ali jedina opcija je da ponovo kuca. Na mobilnom ovo je frustrirajuće.

**Predlog:** Long-press na failed poruku → "Pokušaj ponovo" / "Obriši". Standardni pattern svih messaging app-ova.

---

### 2.3 Item Detail — Nestabilni side buttons
**Problem:** Dugmad na strani (Like, Wishlist, Try-On, Digitizuj, Edit, Obriši) se pojavljuju i nestaju tokom učitavanja jer zavise od sopstvenih/tuđih uslova. Item koji se otvori flash-uje layout.

**Predlog:** Rezervisati prostor za sve dugmad od starta, disabled dok se ne učita, ne skakanje layouta.

---

### 2.4 Upload Flow — AI overlay se ne može otkazati
**Problem:** Kada korisnik klikne "Generiši AI opis", pojavi se full-screen overlay koji blokira sve. Ako AI server kasni (može da traje do 60s), korisnik ne može ništa da uradi — ne može da odustane, ne može da nastavi bez opisa.

**Predlog:** 
- Overlay treba "X" dugme da otkaže
- Ako se otkaže, ostavi inputs prazne i fokusiraj title field
- Timeout treba biti vidljiv (progress bar ili countdown)

---

### 2.5 Profile — Nema upozorenja za nesnimljene izmene
**Problem:** Korisnik otvori edit modal, promeni ime, zatvori modal bez čuvanja. Promene se gube tiho. Nema "Imaš nesnimljene izmene, zatvori?" potvrde.

**Predlog:** `useRef` da prati da li je nešto promenjeno → pri pokušaju zatvaranja modala ako ima izmena, prikazati ActionSheet ili Alert.

---

### 2.6 Closet — Nema progress indikacije za digitizaciju
**Problem:** "Clean Cut digitalizuje komad..." footer poruka se prikazuje ali nema progress bara ni estimiranog vremena. Digitizacija može trajati 30–120 sekundi. Korisnik ne zna da li se nešto dešava.

**Predlog:** Animated progress bar ili step indikator (Upload → Uklanjanje pozadine → Finalizacija). Za dugačke operacije uvek treba dati oseĉaj napretka.

---

### 2.7 Trade actions bez potvrde (Chat lista i Chat thread)
**Problem:** Accept/Reject trade se dešava instantno na klik. Nema "Da li ste sigurni?" Greška je nepovratna jer menja status razmene.

**Predlog:** Alert potvrda za Accept ("Prihvataš razmenu? Ovo je obavezujuće.") i Reject ("Odbijaš ovu ponudu?"). Cancel i Complete već imaju Alert ali ne i ove dve.

---

### 2.8 Onboarding About — Detekcija grada
**Problem:** Detekcija lokacije se pokreće automatski na mount bez jasnog UI u kojim situacijama. Ako se dozvola odbije, nema vizuelnog indikatora zašto auto-detect nije radio. Korisnik vidi samo manuelni picker bez objašnjenja.

**Predlog:** Eksplicitan "Detektuj moju lokaciju" dugme koje korisnik sam tapne, sa jasnom porukom pre i posle. Ne auto-trigger na mount.

---

### 2.9 Wishlist — Nema kategorizacije
**Problem:** Wishlist je flat lista. Ako korisnik sačuva 50 artikala, nema nikakvog filtera ni organizacije — ni po kategoriji, ni po brendu, ni po ceni.

**Predlog:** Filter chips na vrhu (Sve / Tops / Dresses / Obuća...) koje filtriraju lokalno. Sortiranje po "Nedavno dodato" / "Cena".

---

### 2.10 Search — Nema istorije pretrage ni filtera
**Problem:** Search ekran nema istoriju prethodnih pretraga, nema popularnih tagova, nema filtera (kategorija, veličina, grad, cena raspon). Svaki put korisnik mora da kuca od nule.

**Predlog:**
- Pre unosa prikazati: "Prethodne pretrage" + "Trending tagovi"
- Posle unosa: filter sheet (dugme filtera u header-u) → kategorija, veličina, stanje, grad, cena od-do

---

## 3. LOŠA LOGIKA / TOKOVI

### 3.1 Tab: Trades je "privremeno isključen"
Trades tab postoji u navigaciji ali prikazuje samo "Trade Desk je privremeno isključen" poruku. Ovo je mrtva tačka — korisnik klikne na tab i dobije zid. Trades su premešteni u chat, ali tab je ostavljen kao placeholder.

**Fix:** Ukloniti Trades tab iz bottom navigacije dok nije spreman, ili preusmeriti direktno na chat Trades tab.

---

### 3.2 Upload tab — redirect koji zbunjuje
Upload tab nikada ne renderuje ništa — interceptuje tap i radi `router.push('/upload-flow')`. Problem je što tab vizuelno "flešuje" selektovano stanje pre redirecta.

**Fix:** Koristiti `listeners` na Tab.Screen da hvataju `tabPress` event i direktno navigiraju bez ikakve animacije na tab-u. Ili zameniti upload tab sa FAB dugmetom koje ne pripada tab baru.

---

### 3.3 Propozal bez sopstvenih artikala — dead end
Korisnik otvori tuđi artikal, klikne "Pošalji predlog", odabere Trade tip, a zatim vidi praznu listu — nema svojih artikala. Poruka kaže "Nemaš artikala" ali nema CTA koji vodi na upload flow iz tog modala.

**Fix:** Dugme "Dodaj artikal" unutar praznog stanja trade modala → `router.push('/upload-flow')` sa `dismissAll` pre.

---

### 3.4 VTO bez body scana — redirect loop rizik
Tok: Hub → proveri body scan → nema → redirect na `/vto/body-scan` → korisnik preskoči → gde ide? Scan ekran ima "Preskoči" koji vodi na feed, ali Hub dugme opet može voditi nazad na body-scan.

**Fix:** Ako korisnik preskoči body scan, staviti lokalni flag da se ne redirect-uje ponovo u istoj sesiji. Na Hubu prikazati "Body scan nije uradjen" info kartica sa opcijom da uradi, ali ne force-redirect.

---

### 3.5 Item detalj — "Označi kao prodato" bez follow-up
Korisnik označi artikal kao prodat ali nema pitanje "Da li je ovo bilo putem Velve razmene?" Ako jeste, trade archive se ne ažurira automatski. Ako nije, nema opcije da se zabeleži sa kim i kada.

---

### 3.6 Onboarding se može preskočiti na određenim koracima nekonzistentno
Scan ima "Preskoči", ali prethodni koraci (style, categories) nemaju skip opciju — što je dobro jer su obavezni za feed personalizaciju. Ali vizuelni jezik nije jasno komuniciran — korisnik ne zna koji koraci su opcioni.

**Fix:** Opcioni koraci treba imati "Preskoči" link u corner-u. Obavezni koraci ne treba da imaju skip.

---

## 4. STANDARDIZACIJA

### 4.1 Loading states — mix skeletal / spinner
| Ekran | Loading tip |
|---|---|
| Feed | FeedSkeleton ✓ |
| Profile | ProfileSkeleton ✓ |
| Chat lista | ChatSkeleton ✓ |
| Item detalj | BrandedLoader (spinner) |
| Closet | BrandedLoader (spinner) |
| VTO Hub | BrandedLoader (spinner) |
| Search | ActivityIndicator inline |

**Standard:** Skeleton loaderi za listove i grid-ove (korisnik vidi strukturu). BrandedLoader samo za full-page hard loadinge (transformacije, renderovanje). ActivityIndicator samo inline unutar dugmadi.

---

### 4.2 Error handling — Alert vs inline vs tiho
Trenutno stanje:
- Neke greške: `Alert.alert()` (modalni, blokiraju)
- Neke greške: tihe (čet brisanje, reportovanje)
- Neke greške: inline tekst ispod inputa (upload flow)
- Neke greške: nema ništa

**Standard koji treba uspostaviti:**

| Tip greške | Pattern |
|---|---|
| Destruktivna akcija (brisanje, blokiranje) | Alert.alert() sa potvrdom |
| Mutacija podataka (edit, status promena) | Toast notifikacija (2s) |
| Form validacija | Inline greška ispod fielda |
| Network/API greška | Inline na ekranu sa Retry dugmetom |
| Kritična greška (auth) | Full-page error sa logout opcijom |

---

### 4.3 Confirmations — nedosledni
**Ima potvrde:** Delete draft, Cancel trade, Complete trade, Logout, Block user, Report item  
**Nema potvrde:** Accept trade, Reject trade, Remove from wishlist, Delete chat, Publish item

**Standard:** Sve destruktivne ili nepovratne akcije treba da imaju potvrdu. Reverzibilne akcije (like, wishlist, follow) ne treba.

---

### 4.4 Prazna stanja — vizuelno nedosledna
Neka prazna stanja koriste `EditorialEmptyState` komponentu, neka samo `<Text>`. Svi prazni ekrani treba da imaju:
1. Ilustraciju ili ikonu
2. Naslov (šta nedostaje)
3. Podnaslov (zašto i šta da se uradi)
4. CTA dugme (akcija koja rešava prazan state)

---

### 4.5 Disabled stanja — različite opacity vrednosti
`opacity-35`, `opacity-45`, `opacity-50` se koriste naizmenično za disabled elemente. Treba fiksirati na jedan token: `opacity-40` za sve disabled stanje.

---

### 4.6 Tipografija i razmaci — nema sistema
Naslovi na različitim ekranima imaju različite `text-` klase za isti nivo hijerarhije. Treba definisati i konzistentno koristiti:
- `text-2xl font-bold` — screen title
- `text-lg font-semibold` — section heading  
- `text-base` — body text
- `text-sm text-ink-dark/60` — secondary/meta text

---

## 5. NOVE IDEJE — BOLJI DIZAJN

### 5.1 Feed kartica — Quick swap dugme
Umesto da korisnik mora da uđe u item detalj pa da tražipropo zal, dodati direktno na feed karticu:
- Swipe levo → "Sačuvaj" (wishlist)
- Swipe desno → "Ponudi razmenu" (otvori trade modal direktno)

Tinder-like gesture navigation je prirodna za fashion P2P.

---

### 5.2 "Style Match" score na artiklima
Kad se item prikazuje u feed-u, prikazati mali badge "95% match" baziran na korisnikovim style preferencama iz onboardinga. Korisnici vide zašto im se taj artikal prikazuje → povećava poverenje u algoritam.

---

### 5.3 Closet — Outfit builder
Umesto VTO koji zahteva body scan, jednostavan 2D outfit builder:
- Korisnik slaže svoje digitizovane artikle u kombinacije
- Vizualizacija flat-lay stila (artilak iznad, artilak ispod)
- "Objavi outfit" → share na feedu kao inspiracija

Mnogo niži barrier to entry od VTO koji zahteva ceo body scan flow.

---

### 5.4 "Velve Drop" — Limitirani listing format
Specijalni tip listinga gde korisnik može objaviti artikal koji je dostupan samo 24/48h. Countdown timer na kartici u feed-u. Urgentnost povećava engagement. Prikazuje se sa posebnim badge-om u feed-u.

---

### 5.5 Size match filter u feed-u
Ako korisnik postavi svoju veličinu u onboardingu, feed može automatski filterovati ili prioritizovati artikle koji su u njihovoj veličini. Mali toggle "Samo moja veličina" u feed header-u.

---

### 5.6 Chat — Inline item share
Korisnik tokom chat-a može da pošalje artikal iz svog closeta direktno u razgovor (klikabilna kartica sa slikom, imenom, cenom). Umesto da opisuje artikal tekstom.

---

### 5.7 Profile — "Velve Story" highlights
Kratki horizontalni highlights na profilu (slično Instagram Stories highlights):
- "Moj stil" — odabrane slike
- "Omiljeni brendovi"
- "Uspešne razmene"

Daje profilu karakter i povećava poverenje.

---

### 5.8 Onboarding gamification
Umesto progress bara "1/5" prikazati progress sa unlock animacijom — svaki završen korak "otključava" nešto (npr. personalizovani feed, wishlist, trade opcije). Korisnici završe onboarding jer osećaju progres ka nečemu konkretnom.

---

### 5.9 "Slično što tražiš" — Trade matching
Ako korisnik navede "tražim u zamenu: vintage jakna", sistem može automatski da mu sugeriše u feed-u artikle koje drugi nude a koji odgovaraju. Trenutno nema nikakvog trade discovery-ja — sve ide kroz slučajan feed.

---

### 5.10 Push notifikacija preview
Kad stigne poruka ili ponuda, notifikacija treba da prikazuje preview slike artikla o kome se radi. Npr. "Marija želi da zameni [slika jakne] za tvoj artikal". Bogatiji preview → viši CTR na notifikacije.

---

## 6. PRIORITIZOVANE AKCIJE

### Hitno (blokiraju core UX)
1. Retry za failed poruke u chatu
2. Potvrda za Accept/Reject trade
3. Upozorenje za nesnimljene izmene u edit modalu
4. Cancel za AI generation overlay
5. CTA u praznom trade modalu ("Dodaj artikal")

### Srednji prioritet (poboljšavaju iskustvo)
6. Notifications ekran
7. Search filteri (kategorija, veličina, grad, cena)
8. Wishlist filteri
9. Followers/Following lista
10. Rating ekran posle završene razmene

### Dugoročno (novi features)
11. Swipe geste na feed-u (wishlist/trade)
12. Size match filter
13. Outfit builder (2D flat-lay)
14. Inline item share u chatu
15. Style Match score badge na karticama
