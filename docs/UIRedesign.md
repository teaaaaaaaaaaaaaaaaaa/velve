# Velve Mobile — UI/UX Redesign Tracker

> Samo neuradjene i polovično uradjene stavke. Uradjene su izbrisane.

---
---



## 3. LOŠA LOGIKA / TOKOVI

### 3.1 Tab: Trades placeholder ⚠️ PARTIAL
Tab je sakriven (`href: null`) ali fajl `trades.tsx` još uvek postoji sa "Trade Desk je privremeno isključen" porukom.

**Fix:** Ukloniti trades.tsx ili potpuno preusmeriti na chat Trades tab kad/ako se tab vrati.

---

### 3.2 Propozal bez sopstvenih artikala — dead end ❌ NOT DONE xxx
Korisnik otvori trade modal, tip je odabran, ali lista artikala je prazna. Nema CTA koji vodi na upload.

**Fix:** "Dodaj artikal" dugme u praznom stanju trade modala → `router.push('/upload-flow')` sa `dismissAll`.

---

### 3.3 VTO bez body scana — redirect loop rizik ⚠️ PARTIAL
Hub radi redirect na `/vto/body-scan` ako body scan ne postoji. Ako korisnik preskoči, može opet biti redirectovan sa Huba.

**Fix:** Lokalni session flag da se ne redirect-uje ponovo ako je korisnik već preskočio. Na Hubu prikazati info karticu sa opcijom, ne force-redirect.

---

### 3.4 Item detalj — "Označi kao prodato" bez follow-up ❌ NOT DONE
Korisnik označi artikal kao prodat, samo potvrda postoji. Nema pitanje "Da li je ovo bilo putem Velve razmene?"

**Fix:** Follow-up Alert sa "Da li je ovo bilo putem Velve razmene?" — ako jeste, ažuriraj trade archive.

---

### 3.5 Onboarding opcioni koraci — vizuelno nejasno ⚠️ PARTIAL
`photo.tsx` i `scan.tsx` imaju Skip. Ali nema vizuelnog jezika koji komunicira koji koraci su opcioni a koji obavezni.

**Fix:** Opcioni koraci → "Preskoči" link u corner-u. Obavezni → bez skip opcije. Dodati suptilni label "Opcionalno".

---

## 4. STANDARDIZACIJA

### 4.1 Loading states — nedosledni ⚠️ PARTIAL
Skeleton loaderi za Feed, Profile, Chat postoje. Ali Item detalj, Closet, VTO Hub još koriste spinner.

**Standard:**
- Skeleton → listovi i grid-ovi
- BrandedLoader → full-page hard loadinzi (transformacije, renderovanje)
- ActivityIndicator → samo inline unutar dugmadi

---

### 4.2 Error handling — Alert vs inline vs tiho ⚠️ PARTIAL
Alerts za destruktivne akcije postoje. Toast notifikacije i granularno rukovanje tipovima grešaka nije konzistentno.

**Standard:**

| Tip greške | Pattern |
|---|---|
| Destruktivna akcija (brisanje, blokiranje) | Alert.alert() sa potvrdom |
| Mutacija podataka (edit, status promena) | Toast notifikacija (2s) |
| Form validacija | Inline greška ispod fielda |
| Network/API greška | Inline na ekranu sa Retry dugmetom |
| Kritična greška (auth) | Full-page error sa logout opcijom |

---

### 4.3 Confirmations — nedosledni ⚠️ PARTIAL
**Ima potvrde:** Accept trade, Reject trade, Delete draft, Cancel trade, Complete trade, Logout, Block user, Report item  
**Nema potvrde:** Remove from wishlist, Delete chat, Publish item

**Fix:** Sve destruktivne ili nepovratne akcije treba da imaju potvrdu.

---

### 4.4 Disabled stanja — različite opacity vrednosti ❌ NOT DONE
`opacity-35`, `opacity-45`, `opacity-50` se koriste naizmenično.

**Fix:** Standardizovati na `opacity-40` za sve disabled elemente.

---

### 4.5 Tipografija i razmaci — nema sistema ⚠️ PARTIAL
Screen naslovi ponekad `text-4xl`, ponekad `text-3xl`. Section headings nedosledni.

**Standard:**
- `text-2xl font-bold` — screen title
- `text-lg font-semibold` — section heading
- `text-base` — body text
- `text-sm text-ink-dark/60` — secondary/meta text

---

## 5. NOVE IDEJE — BOLJI DIZAJN

### 5.1 Feed kartica — Quick swap dugme ❌ NOT DONE
- Swipe levo → "Sačuvaj" (wishlist)
- Swipe desno → "Ponudi razmenu" (otvori trade modal direktno)

---

### 5.2 "Style Match" score na artiklima ❌ NOT DONE
Mali badge "95% match" na feed kartici baziran na style preferencama iz onboardinga.

---

### 5.3 Closet — 2D Outfit builder ❌ NOT DONE
Jednostavan flat-lay builder (za razliku od VTO koji zahteva body scan):
- Slaganje digitizovanih artikala u kombinacije
- "Objavi outfit" → share na feedu

---

### 5.4 "Velve Drop" — Limitirani listing format ❌ NOT DONE
Artikal dostupan samo 24/48h. Countdown timer na kartici. Specijalni badge u feed-u.

---

### 5.5 Size match filter u feed-u ❌ NOT DONE
"Samo moja veličina" toggle u feed header-u ako korisnik ima postavljenu veličinu.

---

### 5.6 Chat — Inline item share ⚠️ PARTIAL
Trade/buy proposal kartice postoje. Ali nema slanja generičkog artikla iz closeta kao klikabilne kartice u chat.

---

### 5.9 "Slično što tražiš" — Trade matching ❌ NOT DONE
Ako korisnik navede "tražim: vintage jakna", feed sugeriše artikle koji odgovaraju. Nema trade discovery-ja.

---



## 6. PRIORITIZOVANE AKCIJE

### Hitno (blokiraju core UX)
1. Cancel za AI generation overlay + vidljiv progress/timeout
2. CTA u praznom trade modalu ("Dodaj artikal" → upload flow)
3. VTO redirect loop fix (session flag za skip)

### Srednji prioritet
4. Search istorija + trending tagovi
5. Item not available ekran sa sličnim artiklima
6. VTO Hub empty state onboarding card
7. Mark as sold follow-up ("via Velve?")
8. Standardizacija opacity za disabled stanja

### Standardizacija (tehnički dug)
9. Loading states (skeleton vs spinner)
10. Error handling (Toast za mutacije)
11. Confirmations za wishlist remove, delete chat, publish item
12. Tipografija sistem

### Dugoročno (novi features)
13. Swipe geste na feed-u (wishlist/trade)
14. Size match filter
15. 2D Outfit builder (flat-lay)
16. Inline item share u chatu
17. Style Match score badge
18. Velve Drop (limitirani listing)
19. Onboarding gamification
20. Trade matching ("tražim: X")
21. Rich push notification preview
