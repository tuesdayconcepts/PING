import { NextResponse } from "next/server";

// Health check (used by Vercel / probes)
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "scavenger-hunt-server",
    version: "1.0.0",
    stack: "next",
    timestamp: new Date().toISOString(),
  });
}
