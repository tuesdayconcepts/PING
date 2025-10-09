/// <reference types="vite/client" />

// Declare Vite environment variables with proper types
interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

