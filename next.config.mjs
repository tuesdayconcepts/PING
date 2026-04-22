/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma loads native engines + schema tooling; keep it external to avoid Turbopack tracing
  // the entire workspace via Prisma's generated client entrypoints.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;

