# PING

Full-stack TypeScript application with Express backend (Railway) and React frontend (Netlify).

## 🏗️ Project Structure

```
PING/
├─ client/        # React + Vite frontend (Netlify)
├─ server/        # Express + TypeScript API (Railway)
├─ .github/workflows/deploy.yml
```

## 🚀 Local Development

### Prerequisites
- Node.js 20+
- npm or yarn

### Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your local settings
npm run dev  # Runs on http://localhost:8080
```

### Frontend Setup

```bash
cd client
npm install
cp .env.example .env
# Edit VITE_API_URL to point to your backend (default: http://localhost:8080)
npm run dev  # Runs on http://localhost:5173
```

## 🌍 Environment Variables

### Backend (Railway)
- `PORT` - Server port (Railway sets this automatically)
- `DATABASE_URL` - PostgreSQL connection string (set in Railway dashboard)

### Frontend (Netlify)
- `VITE_API_URL` - Backend API URL (set in Netlify dashboard)

### GitHub Actions
Store these secrets in GitHub Settings → Secrets and variables → Actions:
- `RAILWAY_TOKEN` - Railway API token
- `NETLIFY_AUTH_TOKEN` - Netlify authentication token
- `NETLIFY_SITE_ID` - Netlify site ID

## 📦 Deployment

### Railway (Backend)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and initialize
railway login
cd server
railway init

# Deploy
railway up

# Add PostgreSQL plugin in Railway dashboard if needed
```

### Netlify (Frontend)

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login and initialize
netlify login
cd client
netlify init

# Set VITE_API_URL in Netlify dashboard to your Railway URL
# Deploy
netlify deploy --build --prod
```

### CI/CD
Push to `main` branch triggers automatic deployment via GitHub Actions:
1. Backend deploys to Railway
2. Frontend deploys to Netlify

## 🔗 Links

- **GitHub Repository**: https://github.com/tuesdayconcepts/PING
- **Backend API**: (Set after Railway deployment)
- **Frontend**: (Set after Netlify deployment)

## 🛠️ Available Scripts

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

### Frontend
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## 📝 API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/v1/items` - Example items endpoint (replace with actual logic)

## 🗄️ Database

To add PostgreSQL:
1. Add the PostgreSQL plugin in Railway dashboard
2. Railway will automatically inject `DATABASE_URL`
3. Install Prisma or your preferred ORM
4. Run migrations before deploying

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Push and create a pull request

