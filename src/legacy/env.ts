// Centralized, typed runtime config for the migrated app.
// Next.js only exposes env vars that start with NEXT_PUBLIC_ to the browser.

export const API_URL =
  // Prefer relative calls to the same Next.js deployment.
  // This keeps dev/prod consistent and avoids CORS issues.
  process.env.NEXT_PUBLIC_API_URL?.trim() || "/api";

