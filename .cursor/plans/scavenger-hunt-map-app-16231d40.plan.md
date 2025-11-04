<!-- 16231d40-c513-4bf1-8ee3-842358ec6fa9 d65311e2-6f62-4a95-8802-e0884cc80fe8 -->
# Proximity-Based Pings System

## Overview

Add a dual claim system: NFC-based (existing) and proximity-based (new). Admins choose claim type per hotspot. Proximity pings enable global drops without physical NFC cards. Includes anti-cheat measures and engaging UX.

## Database Changes

### 1. Add Claim Type Field

**File:** `server/prisma/schema.prisma`

Add to `Hotspot` model:

```prisma
claimType String @default("nfc") // "nfc" | "proximity"
proximityRadius Float? // In meters, default 50m for proximity pings
```

**Migration:** Create migration to add `claimType` and `proximityRadius` fields.

### 2. Add Proximity Claim Tracking

**File:** `server/prisma/schema.prisma`

Add to `Hotspot` model (optional, for anti-cheat):

```prisma
proximityCheckHistory Json? // Store recent location checks for pattern analysis
```

## Backend Changes

### 3. Update Claim Endpoint with Proximity Verification

**File:** `server/src/index.ts`

Modify `POST /api/hotspots/:id/claim`:

- Accept `userLat` and `userLng` from request body (required for proximity claims)
- Check `hotspot.claimType`:
  - If `"nfc"`: No geolocation check (existing flow)
  - If `"proximity"`: Verify user is within `proximityRadius` (default 5m) using Haversine formula
    - Use `lat`/`lng` for distance calculation (single coordinate system)
- Add anti-cheat validation:
  - Check for unrealistic movement (compare with previous check if available)
  - Validate coordinates are within reasonable bounds
  - Store proximity check in `proximityCheckHistory` for pattern analysis
- Return error if user is too far: `"You must be within X meters to claim this ping"`

### 4. Create Proximity Verification Utility

**File:** `server/src/utils/proximityVerify.ts`

Create new file with:

- `calculateDistance(lat1, lng1, lat2, lng2)`: Haversine formula implementation
- `validateProximityClaim(userLat, userLng, hotspot, history)`: Main validation function
  - Check distance
  - Check for suspicious patterns (teleportation, emulator flags)
  - Return validation result with details

### 5. Add Anti-Cheat Detection

**File:** `server/src/utils/proximityVerify.ts`

Implement detection for:

- **Unrealistic movement**: If user has previous location check, verify movement speed is physically possible (max ~200 km/h for vehicles)
- **Coordinate validation**: Ensure lat/lng are within valid ranges and not obviously fake
- **Rate limiting**: Track claim attempts per IP/wallet to prevent rapid-fire attempts
- **Pattern analysis**: Flag accounts that consistently claim from impossible locations

**Note**: For MVP, implement basic distance check + rate limiting. Advanced detection (sensor validation, emulator detection) requires native app capabilities.

### 6. Update Admin Create/Update Endpoints

**File:** `server/src/index.ts`

Modify `POST /api/hotspots` and `PUT /api/hotspots/:id`:

- Accept `claimType: "nfc" | "proximity"`
- Accept `proximityRadius: number` (optional, default 50)
- Validate `proximityRadius` is between 10-200 meters (configurable bounds)
- Store in database

## Frontend Changes

### 7. Add Claim Type Selection Modal

**File:** `client/src/pages/AdminPage.tsx`

**New Flow:**

1. User clicks "Add PING" button (existing `add-ping-card` button)
2. Modal appears with two large card options:

   - "Create NFC Ping" (card with NFC icon and description)
   - "Create Proximity Ping" (card with radar/proximity icon and description)

3. User selects type → modal closes, form opens with `claimType` pre-set and locked
4. `claimType` is immutable after creation (shown as read-only badge in edit form)

**Implementation:**

- Add state: `showClaimTypeModal: boolean`
- Add state: `selectedClaimType: 'nfc' | 'proximity' | null`
- Modify `handleOpenForm` to show type selection modal first (don't open form directly)
- Create `ClaimTypeSelectionModal` component:
  - Two large card buttons with icons (NFC icon vs radar icon)
  - Brief descriptions: "Physical NFC card" vs "Location-based discovery"
  - Styled to match existing modal design
  - On selection, set `selectedClaimType`, close modal, open form
- In create form, set `claimType` from `selectedClaimType` (read-only, cannot change)
- In edit form, show `claimType` as read-only badge/indicator (cannot change)

**Form State:**

```typescript
claimType: 'nfc' | 'proximity', // Set from selection modal, immutable after creation
proximityRadius: number, // default 5, only shown/editable for proximity pings
```

### 8. Visual Distinction in UI

**File:** `client/src/pages/MapPage.tsx` and `client/src/pages/AdminPage.tsx`

Add visual indicators:

- **Badge/Icon**: Show different icon or badge on map markers for proximity pings (e.g., radar icon vs NFC card icon)
- **Color coding**: Different marker color or border for proximity pings
- **Card styling**: Different card design in admin panel (subtle background or border)

**File:** `client/src/types.ts`

- Add `claimType: 'nfc' | 'proximity'` to `Hotspot` interface
- Add `proximityRadius?: number` to `Hotspot` interface

### 9. Proximity-Based Claim Flow

**File:** `client/src/pages/MapPage.tsx`

Modify claim flow:

- When user clicks proximity ping:
  - Request location permission (if not granted)
  - Show "Checking proximity..." loading state
  - Continuously track user location while modal is open
  - Show distance indicator: "X meters away" with visual indicator (red/yellow/green)
  - Enable "Claim" button only when within radius
  - Add pulsing animation when user is within range (Pokemon Go style)
- When user clicks "Claim":
  - Send current `userLat` and `userLng` to backend
  - Handle proximity validation errors gracefully

### 10. Pokemon Go-Style Engagement Features

**File:** `client/src/pages/MapPage.tsx`

Add engaging UX elements:

- **Distance indicator**: Real-time distance display with color coding
  - Red: > 50m away
  - Yellow: 20-50m away  
  - Green: < 20m away
- **Pulsing animation**: When within range, pulse the marker/card
- **Proximity ring**: Visual circle around map marker showing claim radius
- **Vibration**: Haptic feedback when entering claim radius (if supported)
- **Sound effect**: Optional sound when entering range (user preference)
- **Claim animation**: Confetti or particle effect when successfully claiming

### 11. Proximity Detection Component

**File:** `client/src/components/ProximityDetector.tsx`

Create new component:

- Tracks user location continuously
- Calculates distance to hotspot
- Provides visual feedback (distance indicator, color coding)
- Handles location permission requests
- Shows helpful error messages if location denied

### 12. Update Map Markers

**File:** `client/src/components/CustomMarker.tsx` or `client/src/pages/MapPage.tsx`

- Add conditional rendering based on `claimType`
- Show different icons/styles for proximity vs NFC pings
- Add proximity ring visualization when proximity ping is selected

## Anti-Cheat Strategy (MVP)

### 13. Basic Anti-Cheat Measures

**Backend:** `server/src/utils/proximityVerify.ts`

For MVP, implement:

1. **Distance verification**: Must be within `proximityRadius` (strict check)
2. **Rate limiting**: Max 1 claim per hotspot per IP/wallet per hour
3. **Coordinate validation**: Reject obviously invalid coordinates
4. **Movement validation**: If user has previous location check, verify movement is physically possible

**Note**: Advanced detection (sensor validation, emulator detection, root detection) requires native mobile app. For web MVP, focus on:

- Server-side validation
- Rate limiting
- Pattern analysis (track suspicious IPs/wallets)
- Admin review of proximity claims (similar to NFC claims)

### 14. Admin Review for Proximity Claims

**File:** `server/src/index.ts` and `client/src/pages/AdminPage.tsx`

- All proximity claims go to "pending" status (same as NFC)
- Admin can see claim type in pending claims list
- Admin can see user's claimed location coordinates
- Admin can reject suspicious claims before approval

## UX Considerations

### 15. Location Permission Handling

**File:** `client/src/pages/MapPage.tsx`

- Request location permission when user opens proximity ping modal
- Show clear explanation: "We need your location to verify you're at the ping location"
- Handle denied permission gracefully: Show message explaining why it's needed
- Provide "Try Again" button to re-request permission

### 16. Battery Optimization

**File:** `client/src/components/ProximityDetector.tsx`

- Use `watchPosition` with reasonable update interval (5-10 seconds)
- Stop tracking when modal is closed
- Use high accuracy only when needed (within 100m of ping)
- Show battery usage warning if needed

## Implementation Notes

- **Backward compatibility**: Existing NFC pings continue to work (default `claimType: "nfc"`)
- **Admin choice**: Admins can toggle claim type per hotspot
- **Radius flexibility**: Admins can set custom radius (10-200m) for different difficulty levels
- **Gradual rollout**: Start with proximity pings in low-value areas, monitor for abuse
- **Future enhancement**: Consider adding native app for stronger anti-cheat (sensor validation, emulator detection)

## Open Questions

1. **Default radius**: 50m seems reasonable, but should admins be able to set custom radius per ping?

   - **Recommendation**: Yes, allow 10-200m range for flexibility

2. **Visual distinction**: How obvious should the difference be?

   - **Recommendation**: Subtle but clear - different icon/badge, maybe different card border color

3. **Anti-cheat strictness**: How aggressive should detection be?

   - **Recommendation**: MVP = distance + rate limiting + admin review. Advanced detection requires native app.

4. **Proximity ring visibility**: Should users see the claim radius on map?

   - **Recommendation**: Yes, when proximity ping is selected, show radius circle

5. **Multiple proximity pings**: Can users see multiple proximity pings at once?

   - **Recommendation**: Yes, but only active one (queuePosition = 1) is claimable, same as NFC

### To-dos

- [ ] Add wallet/funding fields to Prisma `Hotspot`; add `TreasuryTransferLog`
- [ ] Create and verify Prisma migration for new fields and constraints
- [ ] Implement keypair gen, AES-GCM encrypt/decrypt, and treasury transfer
- [ ] Generate prize wallet on hotspot creation; set fundStatus pending
- [ ] Transfer funds on admin approval; record tx; set status
- [ ] Add prize (allow 0), statuses, tx link, retry to Admin UI