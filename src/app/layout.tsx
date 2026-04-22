import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/legacy/Providers";

export const metadata: Metadata = {
  title: "PING",
  description: "NFC-powered crypto scavenger hunt game",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

