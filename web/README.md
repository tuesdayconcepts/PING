# PING — Next.js (App Router)

Backend parity with the legacy Express API, using **Supabase Postgres** via `pg` and **Vercel** for hosting.

## One-time: database

1. Open the [Supabase SQL Editor](https://supabase.com/dashboard) for your project.
2. Paste and run `../supabase/migrations/20260427120000_init_ping_schema.sql`.
3. Insert an admin (password is bcrypt hash; generate locally with Node):
   ```bash
   node -e "const b=require('bcrypt');b.hash('yourpassword',10).then(console.log)"
   ```
   ```sql
   insert into admins (username, password, role) values ('admin', '<bcrypt-hash>', 'admin');
   ```

## Local

```bash
cp .env.example .env
# Fill DATABASE_URL (Supabase), ENCRYPTION_KEY, JWT_SECRET
npm install
npm run dev
```

- App: http://localhost:3000  
- Health: http://localhost:3000/api/health  

## Vercel

- **Root directory:** `web`  
- Set env vars from `.env.example` (use the **pooled** connection string on port **6543** for serverless).

## Implemented API (legacy-compatible JSON)

- `GET /api/health`
- `POST /api/auth/login`
- `GET/POST /api/hotspots` (admin Bearer for POST)
- `GET/PUT/DELETE /api/hotspots/:id`
- `POST /api/hotspots/:id/claim`
- `POST /api/hotspots/:id/approve`
- `GET /api/admin/claims`
- `GET /api/admin/logs`
- `GET /api/admin/hotspots/claimed`
- `GET /api/admin/hotspots/:id/key`

Not yet ported: hints, Jupiter, push, share routes, and the full map UI (still in `../client`).

## Supabase vs “vanilla” Postgres

**Auth** still uses JWT + `admins` table (like the old app). You can add Supabase Auth later and map users to `admins` or replace the table. **RLS** is enabled with no public policies: only the Vercel server (using `DATABASE_URL` / service role) can read/write; the anon key is not used by these routes yet.
