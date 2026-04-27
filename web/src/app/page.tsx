"use client";

import { motion } from "motion/react";

/**
 * Landing until the Vite map/admin UI is ported here.
 * API routes under /api/* are the Supabase-backed backend.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="max-w-lg text-center space-y-4"
      >
        <h1 className="text-2xl font-semibold tracking-tight">PING</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Next.js + Supabase + Vercel stack is wired. Run the SQL migration in
          Supabase, set env vars on Vercel, then point the React app at{" "}
          <code className="text-emerald-400/90">/api</code> or finish porting
          pages into this app.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2 text-sm">
          <a
            className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
            href="/api/health"
          >
            Health
          </a>
          <a
            className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            Supabase dashboard
          </a>
        </div>
      </motion.div>
    </div>
  );
}
