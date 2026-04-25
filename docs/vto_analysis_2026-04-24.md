# Velve VTO analiza

Datum: 2026-04-24

## Kratak zaključak

Trenutni Velve "Virtual Try-On" jeste stvaran feature, ali je u praksi još uvek više `single-garment 2D image try-on pipeline` nego kompletan virtual fitting room.

To znači:

- radi osnovni tok: `body scan photo + clean garment image + AI render + save result`
- ne radi kao pravi sistem za procenu veličine, pada, slojevitog outfita ili fizičkog fita
- ima nekoliko konkretnih tehničkih rupa i bar jednu verovatnu integracionu grešku u kategorijama
- UX i dokumentacija trenutno obećavaju malo više nego što kod zaista podržava

Najrealnija formulacija današnjeg stanja je:

> Velve trenutno ima osnovu za AI generisan prikaz kako bi jedan digitalizovan komad mogao da izgleda na korisnikovoj fotografiji, ali nema kompletan fit-aware, multi-item, production-grade VTO sistem.

## Šta trenutno postoji u kodu

### 1. Preduslov 1: Clean Cut / digitizovan artikal

VTO ne radi sa običnim slikama artikla. Potreban je:

- `item.isDigitized === true`
- `item.imageClean` URL

To se vidi u:

- `apps/api/src/routes/vto.js`
- `apps/api/src/models/Item.js`
- `apps/mobile/src/lib/itemImages.ts`

AI server dodatno brani da garment URL mora da bude `clean_*.png` asset:

- `apps/ai-server/main.py`
- funkcija `require_clean_garment_url`

To je dobro jer smanjuje haos u inputu, ali znači da VTO zavisi od prethodnog Clean Cut koraka.

### 2. Preduslov 2: Body scan

Korisnik mora da ima sačuvan `bodyScanUrl`.

Tok je:

1. mobile kamera u `apps/mobile/app/vto/body-scan-camera.tsx`
2. preview analiza preko `POST /api/ai/analyze-body-scan`
3. finalna fotografija se uploaduje kroz `POST /api/users/body-scan`
4. URL se upisuje u `User.bodyScanUrl`

To se vidi u:

- `apps/mobile/app/vto/body-scan-camera.tsx`
- `apps/mobile/src/lib/imageRequests.ts`
- `apps/api/src/routes/users.js`

Važno: ovaj "body scan" nije 3D body model, nije mesh, nije DensePose mapa, nije body measurement extraction. To je samo jedna sačuvana full-body fotografija korisnika.

### 3. Body scan validacija je heuristička, ne semantička

AI server radi lokalnu CV analizu slike kroz:

- `prepare_binary_mask`
- `build_body_scan_analysis`

u `apps/ai-server/main.py`.

Proverava:

- belinu/čistoću pozadine
- coverage kadra
- da li telo dodiruje ivice
- aspect ratio siluete
- center offset
- brightness

To znači da sistem proverava "da li osoba stoji dovoljno centrirano na relativno čistoj pozadini", ali ne proverava:

- da li je poza dobra za try-on
- da li su ruke zaklonile telo
- da li je garderoba na korisniku komplikovana za swap
- da li lice/telo ostaju konzistentni
- da li perspektiva odgovara garment slici

Drugim rečima: ovo je quality gate za fotku, ne body understanding pipeline.

### 4. Finalni VTO poziv

Glavni tok rendera je:

- mobile: `apps/mobile/app/vto/render.tsx`
- API: `apps/api/src/routes/vto.js`
- AI server: `apps/ai-server/main.py`
- Modal worker: `apps/ai-server/modal_vto.py`

Tok:

1. mobile pošalje `POST /api/vto/try-on` sa `itemId`
2. API proveri:
   - validan `itemId`
   - korisnik ima `bodyScanUrl`
   - item pripada tom korisniku
   - item je digitized i ima `imageClean`
3. API pošalje AI serveru:
   - `personImageUrl = req.dbUser.bodyScanUrl`
   - `garmentImageUrl = item.imageClean`
   - `garmentCategory = resolveGarmentCategory(item.category)`
4. AI server pozove Modal endpoint `MODAL_ENDPOINT_URL`
5. Modal worker koristi `fashn-vton-1.5`
6. rezultat se vrati kao `imageBase64`
7. API ga uploaduje na R2
8. mobile prikaže `vtoImageUrl`

### 5. Model koji se koristi

Po kodu je backend vezan za `fashn-vton-1.5`:

- `apps/ai-server/modal_vto.py`
- `REPO_URL = https://github.com/fashn-AI/fashn-vton-1.5.git`

To je realan open-source VTO model, nije placeholder.

Modal worker:

- klonira repo
- instalira model
- skida weights
- izvršava `TryOnPipeline`

Dakle VTO deo nije fake stub, nego stvarno zove eksterni AI render pipeline.

## Šta trenutno zaista radi

Po kodu danas radi sledeće:

- korisnik može da uradi body scan onboarding
- korisnik može da koristi samo svoje digitizovane komade
- može da odabere jedan komad
- može da dobije AI generisan 2D rezultat tog jednog komada na svojoj fotografiji
- može da sačuva rezultat kao outfit zapis
- može da vidi listu ranije sačuvanih VTO rezultata

## Šta trenutno ne radi ili je nepotpuno

### 1. Nije pravi "fit" sistem

Najveća funkcionalna rupa: sistem ne zna ništa o fizičkom fitu.

U bazi postoji samo:

- `user.sizes.clothing`
- `item.size`

ali to se nigde ne koristi u VTO render pipeline-u.

Ne postoje:

- garment measurements
- body measurements
- relative fit model
- size-aware deformation
- drape simulation
- fabric behavior

Praktično: korisnik dobija vizuelni preview, ali ne i pouzdan odgovor "da li će mi ovo stvarno stajati / biti široko / usko / kratko".

### 2. Samo jedan komad, ne outfit

Kod danas podržava samo `jedan item po renderu`.

Dokazi:

- mobile `select.tsx` bira samo `selectedItemId`
- `render.tsx` šalje samo jedan `itemId`
- `POST /api/vto/outfits` eksplicitno traži tačno jedan item:
  - `"v1 outfits require exactly one valid itemId"`

To znači:

- nema tops + bottoms kombinacije
- nema layering
- nema outfit composition
- nema "više artikala" iako `testGuide.md` to sugeriše

Ovo je važan mismatch između dokumentacije i realnog ponašanja.

### 3. VTO radi samo za sopstvene artikle

API route traži item ovako:

- `_id: itemId`
- `userId: req.dbUser._id`

u `apps/api/src/routes/vto.js`

Znači korisnik ne može da proba tuđi marketplace item direktno kroz ovaj API tok.

Za product sense ovo je ozbiljno ograničenje, jer prava vrednost VTO-a za peer-to-peer platformu je često "probaj tuđ komad pre trade odluke".

### 4. Body scan se ne validira na final upload koraku

Mobile radi preview analiziranje kadra pre capture-a, ali kada korisnik klikne save:

- finalna slika se samo uploaduje na `/api/users/body-scan`
- server je ne proverava ponovo kroz `/analyze-body-scan`

To znači da preview i final upload nisu strogo vezani.

Rizik:

- korisnik može sačuvati finalnu sliku koja nije ista kao ona koja je prošla preview uslove
- body scan quality može da bude lošija nego što UI sugeriše

### 5. Body scan nije anoniman u smislu proizvoda

UX copy kaže da je procedura anonimna, ali u implementaciji:

- fotografija se uploaduje na R2
- URL se trajno čuva u korisničkom dokumentu
- taj URL se kasnije šalje eksternom VTO provideru

To nije "anonimni body representation", već trajno čuvana korisnička full-body slika.

To ne znači nužno da je dizajn loš, ali znači da copy trenutno nije precizna.

### 6. Privatnost je slabije rešena nego što bi trebalo

Trenutni sistem ka eksternom VTO layer-u šalje URL-ove:

- `personImageUrl`
- `garmentImageUrl`

po kodu u `apps/api/src/routes/vto.js`.

Po FASHN dokumentaciji, URL-ovi ulaze u request history, čak i ako se sami input fajlovi ne čuvaju trajno.

Izvor:

- [FASHN Data Retention & Privacy](https://docs.fashn.ai/api-overview/data-retention-privacy)

Velve trenutno ne koristi:

- signed short-lived URLs
- base64 max-privacy putanju
- rotaciju body scan URL-ova

Za osetljiv feature kao što je body scan, to je realna rupa.

### 7. Verovatna greška u kategorijama za dress / one-piece

Ovo je jedan od najkonkretnijih nalaza.

Velve API mapira:

- dress/haljina -> `dresses`

u `resolveGarmentCategory()` u `apps/api/src/routes/vto.js`.

Ali FASHN open-source repo i aktuelna dokumentacija koriste:

- `tops`
- `bottoms`
- `one-pieces`

Izvori:

- [FASHN VTON v1.5 GitHub](https://github.com/fashn-AI/fashn-vton-1.5)
- [FASHN Try-On Parameters Guide](https://docs.fashn.ai/guides/tryon-parameters-guide)

To znači da je `dresses` vrlo verovatno pogrešna ili bar nekonzistentna kategorija za provider koji očekuje `one-pieces`.

Posledice:

- dress renderi mogu da fail-uju
- mogu da idu u fallback ponašanje
- mogu da daju lošije rezultate nego tops/bottoms

Ovo bih tretirao kao realan bug, ne samo teorijsku napomenu.

### 8. UI ne podržava eksplicitno one-pieces

`apps/mobile/app/vto/select.tsx` filteri su:

- `all`
- `tops`
- `bottoms`

Nema:

- `one-pieces`
- `dresses`

Dakle i na UI strani se vidi da one-piece support nije doteran do kraja.

### 9. Prompt postoji u backend tipu, ali se praktično ne koristi

U AI serveru `VirtualTryOnRequest` ima:

- `prompt: str = ""`

ali Velve ga ne koristi smisleno:

- API ne gradi prompt
- mobile nema prompt/options
- Modal worker ne prosleđuje nikakvu product/logical styling kontrolu osim kategorije

Znači sistem je minimalan i ne podržava:

- quality mode
- styling intent
- background handling choices
- segmentation-free toggle
- negative constraints

### 10. Nema async job modela

Tok je potpuno sinhron:

- mobile pošalje request
- čeka dok se sve završi

Nema:

- job creation
- polling
- retry strategy
- cancellation
- progress states sa backend-a
- webhook/status API

Za sporiji VTO to je krhko za produkciju.

### 11. Nema post-render evaluacije kvaliteta

Posle rendera nema:

- proveru da li je izlaz validan
- proveru deformacije lica/tela
- artifact detection
- garment preservation scoring
- auto rerender fallback

Sistem veruje prvom outputu.

### 12. Share flow je zapravo link share, ne media share

U `apps/mobile/app/vto/hub.tsx` deljenje radi:

- `Share.share({ message: "Velve Virtual Try-On\n" + url })`

To znači da ne deli sam image asset kao nativni media attachment, nego samo text sa URL-om.

To je dovoljno za debug/demo, ali nije polished consumer share flow.

### 13. Hub bez rendera prikazuje body scan kao glavni vizual

Ako nema rendera, `currentImage = params.vtoImageUrl || bodyScan.url`.

To znači da "Probna soba" inicijalno prikazuje body scan fotografiju kao hero image, što može delovati kao da je to već rezultat ili preview.

To nije tehnički bug, ali je UX semantički klimavo.

### 14. Nema lifecycle upravljanja za body scan i outfit podatke

Nisam našao:

- delete body scan endpoint
- rotate/update body scan history
- delete saved outfit endpoint
- versioning modela per render
- reproducibility metadata

Outfit čuva samo:

- `name`
- `itemIds`
- `vtoImageUrl`

Ne čuva:

- koji model je korišćen
- category poslat provideru
- body scan version
- provider response metadata
- seed / mode / quality

Za kasnije auditovanje ili re-render to je slabo.

## Šta je zapravo implementirano arhitektonski

## Mobile sloj

Glavni ekrani:

- `vto/archive.tsx`
- `vto/body-scan.tsx`
- `vto/body-scan-camera.tsx`
- `vto/body-scan-ready.tsx`
- `vto/hub.tsx`
- `vto/select.tsx`
- `vto/render.tsx`

Mobile radi:

- body scan capture
- pre-check sa AI analizom
- odabir digitalizovanog komada
- trigger rendera
- prikaz rezultata
- čuvanje outfit zapisa

## API sloj

Glavni endpointi:

- `POST /api/vto/try-on`
- `POST /api/vto/outfits`
- `GET /api/vto/outfits`
- `GET /api/users/body-scan`
- `POST /api/users/body-scan`
- `POST /api/ai/analyze-body-scan`

API radi:

- auth
- ownership check
- clean garment check
- poziv AI serveru
- upload rezultata na R2

## AI server sloj

Glavne stvari:

- body scan image heuristics
- garment image heuristics
- background removal endpoint
- VTO forwarding na Modal

AI server ne radi:

- sopstveni pose/body parser za finalni pipeline
- sopstvenu garment warping logiku u Velve kodu
- fit-aware reasoning

Sve to je delegirano eksternom VTO modelu.

## Šta bi moderan VTO sistem tipično trebalo da ima

Na osnovu trenutnih javnih izvora i modernih modela, dobar sistem danas obično ima bar deo sledećeg:

- podršku za `tops`, `bottoms`, `one-pieces`, a često i accessories
- robust pose/body understanding
- bolju obradu occlusion-a: kosa, ruke, torbe, slojevi
- async rendering ili bar jasne quality/performance modove
- privacy-safe upload strategiju
- jasnu razliku između `visual try-on` i `fit prediction`
- fit-aware ili size-aware layer odvojen od samog image generation-a
- kvalitetniji input normalization pipeline

### Relevantne reference

#### FASHN VTON v1.5

FASHN repo eksplicitno kaže:

- model je maskless
- radi direktno u pixel space
- koristi DWPose i human parser komponente
- podržava `tops`, `bottoms`, `one-pieces`

Izvori:

- [FASHN VTON v1.5 GitHub](https://github.com/fashn-AI/fashn-vton-1.5)
- [FASHN blog release](https://fashn.ai/blog/fashn-vton-1-5-open-source-release)

To znači da je Velve izabrao razuman model baseline, ali ga koristi u vrlo tankom wrapper sloju.

#### DWPose i DensePose / body understanding reference

Modern VTO sistemi se često oslanjaju na kvalitetno razumevanje tela i poze.

Izvori:

- [DWPose official GitHub](https://github.com/IDEA-Research/DWPose)
- [DensePose paper](https://arxiv.org/abs/1802.00434)

Velve sam po sebi ovo ne računa u svom kodu za finalni pipeline; oslanja se da to provider/model već radi interno.

#### Fit-aware research pravac

Dva važna signala iz novijih radova:

- većina VTO sistema i dalje ne rešava pravi fit
- novo istraživanje pokušava da uvede body + garment measurements i size-aware ponašanje

Izvori:

- [FIT: A Large-Scale Dataset for Fit-Aware Virtual Try-On](https://arxiv.org/abs/2604.08526)
- [Size-Variable Virtual Try-On with Physical Clothes Size](https://arxiv.org/abs/2412.06201)

Ovo je bitno jer potvrđuje da je Velve-ov današnji sistem tipičan za "vizuelni try-on", ali ne i za "fit-aware try-on".

## Realna ocena po oblastima

### Kvalitet osnove: 7/10

Razlog:

- postoji pravi model
- postoji end-to-end tok
- postoji storage i UI

Ali:

- feature je uzak
- osetljiv je na input kvalitet
- nema production-hardening

### Vizuelni try-on: 6/10

Radi za osnovni single-item scenario, ali:

- nema layering
- nema multi-item
- nema fine kontrole
- dress support je verovatno bugovit

### Fit accuracy: 2/10

Skoro da ne postoji kao posebna sposobnost.

### Privacy/data discipline: 4/10

Radi, ali za body scan feature bih očekivao više:

- signed URLs
- kraći retention
- jasniji consent/copy
- delete/rotate opcije

### Product readiness: 5/10

Dobar demo / foundation.
Još nije dovoljno zategnuto za ozbiljno oslanjanje korisnika na outcome.

## Najvažnije rupe koje treba prvo rešiti

## P0

1. Ispraviti category mapping:
   - `dresses` -> `one-pieces` ili `auto`, u skladu sa provider/model očekivanjem

2. Razdvojiti marketing copy od realnosti:
   - jasno reći da je ovo vizuelni preview, ne tačna procena veličine/fita

3. Dodati server-side final validation za body scan pre čuvanja

4. Uvesti privacy-safe input strategiju:
   - signed URLs ili base64 za person image

## P1

5. Uvesti async job model za render

6. Dodati delete/update tok za body scan i saved outfits

7. Sačuvati metadata uz outfit:
   - model
   - category
   - createdAt
   - source item
   - body scan version

8. Podržati `one-pieces` u UI filterima i toku

## P2

9. Multi-item outfit support

10. Kvalitetniji share/export

11. Post-render quality checks i retry heuristika

12. Tek posle toga razmišljati o fit-aware layer-u

## Kako bi "trebalo" da radi ako želiš ozbiljan VTO

Ako cilj nije samo demo nego stvarno koristan product feature, preporučeni smer bi bio:

### Faza 1: Stabilan visual try-on

- jedan ili više jasnih modela/render modova
- async jobs
- category auto ili tačne kategorije
- robust input validation
- signed URLs / privacy cleanup
- bolji UX oko čekanja, grešaka i ponavljanja

### Faza 2: Product-grade outfit try-on

- tops + bottoms + one-pieces
- layering rules
- accessories kasnije
- reproducible renders

### Faza 3: Fit-aware sistem

- body measurements extraction ili structured user measurements
- garment measurements i pattern metadata
- fit reasoning sloj odvojen od samog image generation-a
- jasan disclaimer kad je rezultat samo vizuelan, a kad je fit procena verovatnija

Bez ove treće faze, VTO ostaje pre svega "confidence/engagement" feature, ne "fit truth" feature.

## Konačna realna rečenica

Velve danas ima funkcionalan ali uzak `single-item image-based virtual try-on` MVP, oslonjen na FASHN VTON 1.5 preko Modala, sa body-scan fotografijom i Clean Cut garment inputom. To je solidna osnova za demo i za iteraciju, ali još nije kompletan, fit-aware, privacy-hardened, multi-item virtual fitting room.

## Glavni korišćeni izvori sa veba

- [FASHN VTON v1.5 GitHub](https://github.com/fashn-AI/fashn-vton-1.5)
- [FASHN open-source release blog](https://fashn.ai/blog/fashn-vton-1-5-open-source-release)
- [FASHN Try-On Parameters Guide](https://docs.fashn.ai/guides/tryon-parameters-guide)
- [FASHN Data Retention & Privacy](https://docs.fashn.ai/api-overview/data-retention-privacy)
- [FASHN Try-On v1.6 docs](https://docs.fashn.ai/api-reference/tryon-v1-6)
- [FASHN Try-On Max docs](https://docs.fashn.ai/api-reference/tryon-max)
- [DWPose official GitHub](https://github.com/IDEA-Research/DWPose)
- [DensePose paper](https://arxiv.org/abs/1802.00434)
- [FIT: A Large-Scale Dataset for Fit-Aware Virtual Try-On](https://arxiv.org/abs/2604.08526)
- [Size-Variable Virtual Try-On with Physical Clothes Size](https://arxiv.org/abs/2412.06201)
