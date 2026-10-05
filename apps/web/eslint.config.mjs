import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "cloudflare-env.d.ts", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Pages and components must use the shared api-client, not raw Supabase calls (enforced from step 3).
      "no-restricted-imports": ["error", { patterns: ["@supabase/supabase-js/dist/*"] }],
    },
  },
];
