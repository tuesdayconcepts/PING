# 🗺️ PING - NFC Scavenger Hunt Game

An interactive location-based scavenger hunt game with NFC card support, social verification via Twitter, and Solana cryptocurrency prizes. Users tap NFC cards to discover hotspots, admins approve claims live on stream, and winners receive encrypted private keys for Solana wallets.

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

**Frontend:**
- React 18 + TypeScript
- Vite for build tooling
- React Leaflet for maps
- React Router for navigation
- Deployed on Netlify

**Backend:**
- Node.js 20 + Express
- TypeScript
- Prisma ORM
- PostgreSQL database
- JWT authentication
- Deployed on Railway

## 🏗️ Project Structure

```
PING/
├─ client/              # React frontend
│  ├─ src/
│  │  ├─ pages/        # MapPage & AdminPage
│  │  ├─ utils/        # Helper functions
│  │  └─ types.ts      # TypeScript types
│  └─ package.json
├─ server/              # Express backend
│  ├─ src/
│  │  └─ index.ts      # API routes
│  ├─ prisma/
│  │  ├─ schema.prisma # Database schema
│  │  └─ seed.ts       # Seed data
│  └─ package.json
├─ netlify.toml
├─ railway.toml
└─ README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (or use Railway's managed database)
- npm or yarn

### Backend Setup

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Setup environment variables:**
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values:
# PORT=8080
# DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
# JWT_SECRET=your-secret-key-change-in-production
# ENCRYPTION_KEY=your-32-byte-hex-key-for-solana-private-keys

# Generate a secure 32-byte hex key for ENCRYPTION_KEY:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. **Setup database:**
```bash
# Run Prisma migrations
npm run prisma:migrate

# Seed database with sample data (no default admin user)
npm run prisma:seed
```

4. **Start development server:**
```bash
npm run dev
# Server runs on http://localhost:8080
```

### Frontend Setup

1. **Install dependencies:**
```bash
cd client
npm install
```

2. **Setup environment variables:**
```bash
# Create .env file
echo "VITE_API_URL=http://localhost:8080" > .env
```

3. **Start development server:**
```bash
npm run dev
# Client runs on http://localhost:5173
```

## 🔐 Admin User Setup

After seeding the database, you'll need to create your first admin user through the admin panel or by using the API endpoints. No default credentials are provided for security reasons.

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login (rate-limited)

### Hotspots (Public)
- `GET /api/hotspots` - Get active hotspots (queue position 0, not claimed)
- `GET /api/hotspots/:id` - Get single hotspot
- `POST /api/hotspots/:id/claim` - Claim a hotspot (geofence verification)

### Hotspots (Admin)
- `GET /api/hotspots?admin=true` - Get all hotspots (requires auth)
- `POST /api/hotspots` - Create hotspot with optional private key (requires auth)
- `PUT /api/hotspots/:id` - Update hotspot (requires auth)
- `DELETE /api/hotspots/:id` - Delete hotspot (requires auth)
- `POST /api/hotspots/:id/approve` - Approve claim & reveal private key (requires auth)

### Admin
- `GET /api/admin/logs` - Get admin activity logs (requires auth)
- `GET /api/admin/claims` - Get pending claims (requires auth)

## 🌐 Deployment

### Railway (Backend)

1. **Install Railway CLI:**
```bash
npm i -g @railway/cli
railway login
```

2. **Connect GitHub repo:**
- Go to Railway dashboard
- Create new project from GitHub repo
- Set **Root Directory** to `server` in Settings → Build

3. **Add PostgreSQL:**
- Add PostgreSQL plugin in Railway dashboard
- `DATABASE_URL` is automatically injected

4. **Set environment variables:**
- `JWT_SECRET` - Your secret key for JWT tokens
- `ENCRYPTION_KEY` - 32-byte hex key for encrypting Solana private keys (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `TREASURY_PRIVATE_KEY` - Base64-encoded Solana private key for treasury wallet
- `VAPID_PUBLIC_KEY` - VAPID public key for push notifications
- `VAPID_PRIVATE_KEY` - VAPID private key for push notifications
- `VAPID_SUBJECT` - VAPID subject (mailto: or https: URL, e.g., `mailto:admin@ping.com`)
- `LOW_BALANCE_THRESHOLD_SOL` - Threshold for low balance alerts (default: 1.0)
- `PORT` - Will be set automatically by Railway

5. **Deploy:**
```bash
cd server
railway up
```

6. **Generate domain:**
- Go to Settings → Networking
- Click "Generate Domain"
- Save this URL for frontend configuration

### Netlify (Frontend)

1. **Install Netlify CLI:**
```bash
npm i -g netlify-cli
netlify login
```

2. **Initialize site:**
```bash
cd client
netlify init
```

3. **Set environment variable:**
In Netlify dashboard:
- Go to Site configuration → Environment variables
- Add `VITE_API_URL` with your Railway backend URL

4. **Deploy:**
```bash
netlify deploy --prod
```

### GitHub Actions (Optional)

Add these secrets to your GitHub repo:
- `RAILWAY_TOKEN` - From `railway whoami --token`
- `NETLIFY_AUTH_TOKEN` - From `netlify login --print-token`
- `NETLIFY_SITE_ID` - From `netlify sites:list`

## 🛠️ Development Commands

### Backend
```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm start            # Run production build
npm run prisma:migrate  # Run database migrations
npm run prisma:seed     # Seed database
npm run prisma:generate # Generate Prisma client
```

### Frontend
```bash
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

## 🔒 Security Features

- **Password Hashing:** bcrypt with 10 salt rounds
- **JWT Authentication:** 7-day token expiry
- **Rate Limiting:** Login limited to 5 attempts per 15 minutes
- **Input Validation:** Coordinate ranges, date validation
- **XSS Protection:** HTML escaping on user input
- **CORS:** Configured for cross-origin requests

## 📝 Database Schema

### Admin
- `id` - UUID
- `username` - Unique string
- `password` - bcrypt hashed
- `createdAt` - Timestamp

### Hotspot
- `id` - UUID
- `title` - String
- `description` - String
- `lat` - Float (-90 to 90)
- `lng` - Float (-180 to 180)
- `prize` - Optional string
- `startDate` - DateTime
- `endDate` - DateTime
- `active` - Boolean
- `imageUrl` - Optional string
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

### AdminLog
- `id` - UUID
- `adminId` - String (references Admin)
- `action` - String (CREATE, UPDATE, DELETE)
- `entity` - String (Hotspot)
- `entityId` - String
- `details` - Optional string
- `timestamp` - Timestamp

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

---
TEST PK: sfw9874FG3X3oi85hwWKUy3Tqcy7KAi84gH2fXgjJRfCrv6LrfLbiB6k2HqTK11d5RHT8cceSe6m6wh8GGVX91S
Built with ❤️ using React, Express, Prisma, and Leaflet

FOR CONVERTING BASE58 to BASE64:
node -e "import('bs58').then(({default: bs58})=>{const s='YOUR_BASE58';const b=bs58.decode(s);console.log('base64:',Buffer.from(b).toString('base64'));console.log('json:',JSON.stringify(Array.from(b)));})"


vapid keys:

Public Key:
BN9buyiXVeVNRBWzRrnFhexj14_c-yMdkyX932rBB9Wa2G95ly8hI1LZ3TGKpVfE6-F2sIKR-XhI6w7mQxCmo2o

Private Key:
e8B2AR5OtrvU_httxHQ3HGDAZTK3ktcavVK3ewDTsYM
