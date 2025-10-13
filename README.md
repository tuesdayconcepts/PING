# 🗺️ Scavenger Hunt Map

An interactive web application for creating and managing location-based scavenger hunts using OpenStreetMap and Leaflet. Users can discover active hunt locations on a map, while admins can create, edit, and manage hotspots through a secure dashboard.

## 🚀 Features

### Public Map View
- Interactive map with OpenStreetMap tiles
- Hotspot markers showing scavenger hunt locations
- Popup details with prize information and time remaining
- Auto-center on active hunts or user's geolocation
- Responsive design for mobile and desktop

### Admin Dashboard
- Secure JWT-based authentication
- Create, edit, and delete hotspots
- Click-to-place markers on interactive map
- Activity log tracking all admin actions
- Toggle hotspot active/inactive status
- Rate-limited login for security

### Backend API
- RESTful API with Express and TypeScript
- PostgreSQL database with Prisma ORM
- bcrypt password hashing
- JWT token authentication
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
```

3. **Setup database:**
```bash
# Run Prisma migrations
npm run prisma:migrate

# Seed database with admin user and sample data
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

## 🔐 Default Admin Credentials

After seeding the database:
- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Change these credentials in production!**

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login (rate-limited)

### Hotspots (Public)
- `GET /api/hotspots` - Get active hotspots
- `GET /api/hotspots/:id` - Get single hotspot

### Hotspots (Admin)
- `GET /api/hotspots?admin=true` - Get all hotspots (requires auth)
- `POST /api/hotspots` - Create hotspot (requires auth)
- `PUT /api/hotspots/:id` - Update hotspot (requires auth)
- `DELETE /api/hotspots/:id` - Delete hotspot (requires auth)

### Admin
- `GET /api/admin/logs` - Get admin activity logs (requires auth)

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

Built with ❤️ using React, Express, Prisma, and Leaflet
