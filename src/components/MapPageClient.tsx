"use client";

import { LegacyMapApp } from "@/components/LegacyMapApp";

// Client-only entrypoint for the map UI (Next.js App Router root page).
export default function MapPageClient() {
  return <LegacyMapApp route={{ kind: "root" }} />;
}

