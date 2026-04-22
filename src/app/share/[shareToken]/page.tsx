"use client";

import { LegacyMapApp } from "@/components/LegacyMapApp";
import { useParams, useRouter } from "next/navigation";

export default function ShareTokenPage() {
  const params = useParams<{ shareToken: string }>();
  const router = useRouter();

  return (
    <LegacyMapApp
      route={{ kind: "share", shareToken: params.shareToken }}
      onNavigate={(href) => router.push(href)}
    />
  );
}

