import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy singleton for optional Supabase usage (auth, storage, Realtime).
 *
 * **Database access for this app** still goes through Prisma + `DATABASE_URL`
 * (Supabase Postgres connection string). This client is for Supabase features
 * beyond raw SQL, when you configure the env vars below.
 */
let serviceRoleClient: SupabaseClient | null | undefined;

/**
 * Returns a Supabase client using the **service role** key, or `null` if
 * `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are not set.
 *
 * Never import this module from client components — the service role key
 * must stay server-only.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  if (serviceRoleClient !== undefined) {
    return serviceRoleClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    serviceRoleClient = null;
    return serviceRoleClient;
  }

  serviceRoleClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceRoleClient;
}
