// Shim for legacy Vite client code being reused in Next.js.
// Allows `import.meta.env.*` references to type-check during migration.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_GEOCODING_API_KEY?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

