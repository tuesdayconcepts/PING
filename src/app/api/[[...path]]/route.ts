import { dispatchLegacyExpressRequest } from "@/server/legacy/nextAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catch-all adapter for the legacy Express API mounted at `/api/*`.
 *
 * Next.js requires `[[...path]]` (optional catch-all) instead of `[...path]` because some
 * routes are exactly `/api/...` with no trailing segment.
 */
export async function GET(req: Request) {
  return dispatchLegacyExpressRequest(req);
}

export async function POST(req: Request) {
  return dispatchLegacyExpressRequest(req);
}

export async function PUT(req: Request) {
  return dispatchLegacyExpressRequest(req);
}

export async function DELETE(req: Request) {
  return dispatchLegacyExpressRequest(req);
}

export async function OPTIONS(req: Request) {
  return dispatchLegacyExpressRequest(req);
}
