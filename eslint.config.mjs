import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tseslint from "typescript-eslint";

/**
 * ESLint flat config for Next.js (App Router) + TypeScript.
 *
 * Notes:
 * - `next lint` is currently mis-detecting the project directory in this
 *   environment, so we run `eslint` directly.
 * - Keep rules minimal to match existing conventions and avoid churn during
 *   the migration.
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        // Avoid type-aware linting for now; we’re migrating a large codebase and
        // want linting to be fast and low-noise.
        project: false,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      import: importPlugin,
      "@typescript-eslint": tsPlugin,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // Prefer TS-aware unused checks (core `no-unused-vars` flags TS type params incorrectly).
      "no-unused-vars": "off",

      // Keep TS strictness but avoid noisy migration-era errors.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-floating-promises": "off",

      // The legacy UI predates newer React Compiler-style lint rules; keep these off
      // during migration to avoid churn unrelated to the hosting/backend migration.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",

      // Legacy UI uses plain anchors/images; migrating to `next/link` + `next/image` is a follow-up.
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
    },
  },
  {
    // The migrated Express server is vendored legacy code; keep lint noise low here.
    files: ["src/server/legacy/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    // Legacy UI copied from Vite; keep lint permissive during migration.
    files: ["src/legacy/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "/src/generated/**",
      "/client/**",
      "/server/**",
      "/prisma/migrations/**",
      "/public/**",
    ],
  },
];

