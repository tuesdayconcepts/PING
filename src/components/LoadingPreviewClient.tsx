"use client";

import LoadingPreview from "@/legacy/pages/LoadingPreview";

// Client-only wrapper: legacy preview uses DOM APIs.
export default function LoadingPreviewClient() {
  return <LoadingPreview />;
}

