# 🗺️ PING - NFC Scavenger Hunt Game

An interactive location-based scavenger hunt game with NFC card support, social verification via Twitter, and Solana cryptocurrency prizes. Users tap NFC cards to discover hotspots, admins approve claims live on stream, and winners receive encrypted private keys for Solana wallets.

## ✅ Current deployment shape (revived)

This repository is being migrated from **Vite + Netlify (frontend)** + **Express + Railway (backend)** to a **single Next.js app** intended for **Vercel**, with **Supabase Postgres** as the database.

- **App**: Next.js App Router in `src/app/*`
- **UI**: migrated legacy UI lives in `src/legacy/*` (ported from `client/src/*`)
- **API**: legacy Express routes are mounted under `/api/*` via `src/app/api/[[...path]]/route.ts` + `src/server/legacy/*`
- **DB**: Prisma schema + migrations live in `prisma/*` (copied from `server/prisma/*`)
- **Supabase**: use Supabase’s **Postgres** connection string as `DATABASE_URL` (Prisma). Optional Supabase JS client helpers live in `src/server/supabase.ts` (set `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` when you add Auth/Storage).

### Supabase setup (database)

1. Create a project in [Supabase](https://supabase.com/).
2. **Settings → Database → Connection string** → copy the **URI** (use the pooler mode Vercel recommends, often “Transaction” for serverless).
3. Paste it into `DATABASE_URL` locally and in the Vercel project settings.
4. Run `npx prisma migrate deploy` once against that database to apply the schema.

### Local development

```bash
npm install
cp .env.example .env
# Set DATABASE_URL to your Supabase Postgres connection string

# Apply migrations + generate Prisma client
npx prisma migrate deploy
npx prisma generate

npm run dev
```

### Vercel environment variables

Use `.env.example` as the checklist. At minimum you’ll need:

- **`DATABASE_URL`**: Supabase Postgres URI
- **`JWT_SECRET`**, **`ENCRYPTION_KEY`**, **`TREASURY_PRIVATE_KEY`**, **`SOLANA_RPC_URL`** (if you use treasury funding)
- **`NEXT_PUBLIC_*`**: browser-visible keys (Google Maps + Solana RPC)

## 🚀 Features

### NFC Claim System
- **NFC Card Integration**: Tap NFC cards (URL: `yourapp.com/ping/{hotspotId}`) to open hotspot details
- **Geofencing**: 50-meter radius verification to confirm physical presence
- **Twitter Verification**: Auto-tweet with Web Intent to spread the game socially
- **Admin Approval**: Live stream approval workflow for claims
- **Encrypted Prizes**: Solana private keys encrypted in database, revealed only on approval
- **Queue System**: Only one active hotspot on map at a time, automatic queue promotion

### Public Map View
- Interactive map with pulsing star markers
- Frosted glass modals with hotspot details
- Real-time claim status (unclaimed → pending → claimed)
- Confetti animation on prize reveal
- Auto-center on active hunts or user's geolocation
- Fully responsive design for mobile and desktop

### Admin Dashboard
- Secure JWT-based authentication
- **Pending Claims Section**: Real-time claim notifications
- **One-Click Approval**: Approve claims and reveal private keys
- Create/edit hotspots with private key encryption
- Click-to-place markers on interactive map
- Queue position management
- Activity log tracking all admin actions
- Rate-limited login for security

### Backend API
- RESTful API with Express and TypeScript
- PostgreSQL database with Prisma ORM
- **AES-256-CBC Encryption** for Solana private keys
- **Haversine Geofencing** (50m radius verification)
- **Queue Management** (auto-promote next hotspot on claim)
- bcrypt password hashing & JWT authentication
- Input validation and sanitization
- Rate limiting on sensitive endpoints

## 📦 Tech Stack

**App (current):**
- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL (Supabase)

**Legacy reference (not used for new deploys):**
- `client/` (old Vite app)
- `server/` (old standalone Express app)

## 🏗️ Project Structure

```
PING/
├─ src/
│  ├─ app/                 # Next.js routes + API adapter
│  ├─ legacy/              # migrated UI (from client/src)
│  └─ server/legacy/       # migrated Express API (from server/src)
├─ prisma/                 # Prisma schema + migrations
├─ public/                 # static assets + service worker
├─ client/                 # legacy Vite app (reference)
├─ server/                 # legacy standalone server (reference)
├─ deploy-legacy/          # archived Netlify/Railway configs (not used)
└─ README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A Supabase Postgres database (recommended) or any Postgres compatible with Prisma
- npm

### Install + run

```bash
npm install
cp .env.example .env

# Apply migrations to your DATABASE_URL
npx prisma migrate deploy
npx prisma generate

npm run dev
```

## 🔐 Default Admin Credentials

If you still use the legacy seed flow, the old defaults were `admin` / `admin123` — **do not use defaults in production**.

## 📡 API Endpoints

The API is still the legacy Express surface, now served from the Next.js deployment at `/api/*`.

## 🌐 Deployment

Deploy on Vercel as a Next.js project (root directory = repo root). Configure env vars from `.env.example`.

## 🛠️ Development Commands

```bash
npm run dev        # Next.js dev server
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint (runs eslint directly)
```

## 🔒 Security Features

- **Password Hashing:** bcrypt with 10 salt rounds
- **JWT Authentication:** 7-day token expiry
- **Rate Limiting:** Login limited to 5 attempts per 15 minutes
- **Input Validation:** Coordinate ranges, date validation
- **XSS Protection:** HTML escaping on user input
- **CORS:** Configured for cross-origin requests

## 📝 Database Schema

See `prisma/schema.prisma`.

## 🎯 Roadmap / Stretch Goals

- [ ] User accounts and authentication
- [ ] "Claim prize" functionality
- [ ] Hotspot categories and filtering
- [ ] Search functionality
- [ ] Real-time updates via WebSockets
- [ ] Map clustering for many hotspots
- [ ] Image upload to cloud storage
- [ ] Gamification (points, leaderboard, badges)
- [ ] Mobile app (React Native)

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

Built with ❤️ using Next.js, Prisma, and modern web standards.