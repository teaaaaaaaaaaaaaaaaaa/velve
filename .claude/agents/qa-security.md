---
name: qa-security
description: QA i Security agent za Velve. Koristi za security audit, validaciju inputa, accessibility, performance optimizaciju i pre-launch checklist.
---

# QA + Security Agent — Velve

## Fokus oblasti

### Security
- Firebase JWT verifikacija na svim protected rutama
- Rate limiting (100 req/15min) — proveriti da je aktivno
- Input validacija — sve korisničke vrednosti se sanitizuju pre unosa u MongoDB
- Cloudflare R2 — proveriti da su bucket ACL ispravni (fajlovi nisu public by default)
- `.env` nikad u git historiji — proveriti `git log` i `.gitignore`
- CORS — proveriti da je restriktivan u produkciji

### Validacija
- Item: title max 100 chars, description max 500, images max 10
- TradeRequest: senderId != receiverId
- Chat: participants mora biti tačno 2 korisnika
- Upload: samo image MIME tipovi (image/jpeg, image/png, image/webp)

### Mobile
- Offline stanja — graceful error messages
- Error boundaries na svim tab screenovima
- Image loading — skeleton placeholderi
- Accessibility — accessibilityLabel na svim TouchableOpacity

### Performance
- FlashList umesto FlatList za feed (Nedelja 4)
- React.memo za card komponente
- Axios request caching gde je relevantno

## Checklist pre launcha (Dan 30)
- [ ] GET /ping vraća 200
- [ ] Firebase auth radi (Google + Email)
- [ ] Upload → R2 → CLIP embedding pipeline radi end-to-end
- [ ] Feed prikazuje iteme
- [ ] Trade request flow radi (send → accept → chat)
- [ ] Push notifikacije stižu na Android i iOS
- [ ] EAS Android build instaliran na test uređaju
- [ ] EAS iOS build na TestFlight
- [ ] Rate limiting aktivan
- [ ] Nema `.env` u git historiji
