# 🚀 Pre-Launch Checklist for PING

## ✅ CRITICAL - Must Fix Before Launch

### 1. 🔴 Remove Test Private Key from README
**File:** `README.md` line 322
**Issue:** Test private key exposed in README
**Action:** Delete line 322 immediately

### 2. 🔴 Update Default Security Values
**File:** `server/src/index.ts` lines 32, 35
**Issue:** Weak default values for JWT_SECRET and ENCRYPTION_KEY

**Current:**
```ts
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
```

**Fix:** Add validation to fail startup if not set properly:
```ts
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret-change-in-production") {
  throw new Error('JWT_SECRET must be set in production environment');
}
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.startsWith('0000')) {
  throw new Error('ENCRYPTION_KEY must be set in production environment');
}
```

### 3. 🔴 Database Schema Comment is Incorrect
**File:** `server/prisma/schema.prisma` line 37
**Issue:** Comment says `0 = active` but system uses 1-based indexing

**Fix:**
```prisma
queuePosition Int @default(0) // 1 = active, 2+ = queued
```

---

## ⚠️ HIGH PRIORITY - Security & Performance

### 4. 🟡 Rate Limiting Too Permissive
**File:** `server/src/index.ts` lines 75-81
**Issue:** Login allows 10 attempts per 5 minutes

**Recommendation:** Tighten to 5 attempts per 15 minutes:
```ts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: "Too many login attempts, please try again later" }
});
```

### 5. 🟡 Add Rate Limiting to Claim Endpoint
**File:** `server/src/index.ts`
**Issue:** No rate limiting on `/api/hotspots/:id/claim`

**Add:**
```ts
const claimLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 claims per minute per IP
  message: { error: "Too many claim attempts, please wait" }
});

app.post("/api/hotspots/:id/claim", claimLimiter, async (req, res) => {
```

### 6. 🟡 CORS Too Open for Production
**File:** `server/src/index.ts` lines 23-28
**Issue:** `origin: '*'` allows any domain

**Fix:**
```ts
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://solping.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
```

### 7. 🟡 Missing Helmet.js for Security Headers
**Action:** Install and configure helmet

```bash
cd server && npm install helmet
```

```ts
import helmet from 'helmet';
app.use(helmet());
```

---

## 📋 Pre-Launch Tasks

### Environment Variables

**Railway (Backend):**
- [ ] `JWT_SECRET` - Strong random value
- [ ] `ENCRYPTION_KEY` - 32-byte hex
- [ ] `DATABASE_URL` - Auto-set by Railway
- [ ] `FRONTEND_URL` - Your Netlify domain

**Netlify (Frontend):**
- [ ] `VITE_API_URL` - Your Railway backend URL
- [ ] `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API key
- [ ] `VITE_GOOGLE_GEOCODING_API_KEY` - Geocoding API key
- [ ] `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` - Add geocoding key

### Security Audit
- [ ] Change default admin password
- [ ] Review all API endpoints for authorization
- [ ] Test rate limiting
- [ ] Review CORS settings
- [ ] Verify private keys are encrypted

### Testing
- [ ] Full claim flow (discover → claim → approve)
- [ ] Queue system (create, delete, claim)
- [ ] Mobile devices (iOS Safari, Android Chrome)
- [ ] Load test with 100+ concurrent users

---

**Last Updated:** October 20, 2025
**Status:** Pre-Launch Review Complete ✅

