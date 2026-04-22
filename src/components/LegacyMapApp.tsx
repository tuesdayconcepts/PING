"use client";

import MapPage from "@/legacy/pages/MapPage";

// Client-only wrapper: the legacy map UI is fully client-side.
export type LegacyMapAppRoute =
  | { kind: "root" }
  | { kind: "ping"; id: string }
  | { kind: "share"; shareToken: string };

type NavigateFn = (href: string) => void;

export function LegacyMapApp(props: {
  route: LegacyMapAppRoute;
  // Optional navigation hook for Next.js routing (not used everywhere yet).
  onNavigate?: NavigateFn;
}) {
  return <MapPage route={props.route} onNavigate={props.onNavigate} />;
}

