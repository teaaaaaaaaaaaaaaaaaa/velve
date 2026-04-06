# Phase 3.1 - 4.3 Execution Todo

## Trade status model
- [x] Add `cancelled`
- [x] Add `expired`
- [x] Expose clearer pending / active / history lifecycle in mobile product

## Trade backend coverage
- [x] Keep create / list / accept / reject / complete / rate / history
- [x] Extend lifecycle serialization for dedicated trade inbox UI
- [x] Sync item availability when trades move between pending / active / complete / cancel

## Trade product UI
- [x] Dedicated trade desk with pending / active / history buckets
- [x] Completed / declined / cancelled / expired history UI
- [x] Clear action surfaces for accept / reject / cancel / complete / rate
- [x] Keep chat trade cards and add lifecycle update messages

## My closet management
- [x] Add drafts support end-to-end
- [x] Add archived / unavailable / swapped distinctions
- [x] Add reorder actions
- [x] Add bulk actions
- [x] Add dedicated closet management screen

## Push notifications
- [x] Fix mobile hook flow for TypeScript-safe runtime usage
- [x] Route trade notifications into lifecycle-aware screens
- [ ] Validate production physical-device launch behavior

## Trust layer
- [x] Add joined date
- [x] Add response rate
- [x] Add visible rating / successful swaps / profile completeness modules
- [x] Surface trust on own profile and public profile

## Recommended modules / recently viewed
- [x] Add recently viewed module from item view history
- [x] Add recommendation module from discovery signals
- [x] Surface both modules on profile
