# dental-platform

Internal codename. Dental education and clinical reference: Next.js web client + Supabase backend shared with future mobile clients.

## Layout

```
apps/web                 Next.js 15 (App Router, TypeScript, Tailwind v4)
packages/config          shared tsconfig
packages/db-types        generated DB types + enum mirrors
packages/i18n            ar/en message catalogs, number/date formatting (Western digits)
packages/design-tokens   neutral placeholder tokens (light; dark defined, not enabled)
packages/content-schema  block/question/case schemas, rich text, validation (Zod)
packages/api-client      typed Supabase API, bundle parsing, error model
supabase/migrations      SQL source of truth (12 migrations)
supabase/seed.sql        Endodontics + 5 empty topic shells, no clinical content
supabase/seed/           manual one-off scripts (Alpha staff bootstrap)
supabase/tests           pgTAP tests (113)
supabase/harness         plain-Postgres harness used when Supabase CLI isn't available
docs/db-review.md        guide to reviewing the database layer
docs/step3-review.md     shared packages review
docs/block-examples.md   generated examples for all 11 block types
docs/step4-review.md     responsive shell + localization review
```

## Getting started

```bash
pnpm install
pnpm db:start            # Supabase local stack (Docker)
pnpm db:reset            # apply migrations + seed
pnpm db:test             # run pgTAP tests
pnpm db:types            # regenerate packages/db-types/src/database.ts (official)
pnpm db:types:local      # same, by introspection (no Docker): DATABASE_URL=... required
pnpm test                # unit tests; set DATABASE_URL to include the DB round-trip
cp .env.example apps/web/.env.local   # fill anon key from `supabase status`
pnpm dev
```

After the Alpha account signs up, run `supabase/seed/bootstrap_alpha_staff.sql` once (edit the email first).

## Checks

`pnpm check` runs typecheck, lint, `check:logical` (rejects physical-direction Tailwind classes such as `ml-4`, `text-left`; use `ms-4`, `text-start`) and `check:i18n` (ar/en key parity). CI also runs `supabase test db`.

## Rules that the database enforces

- Editorial status changes only through `transition_content()`, by a signed-in staff user with the right role. Service role and background jobs cannot publish.
- Non-draft versions, their blocks, claim links, and the claims/sources/media they use are immutable. Editing published content = `create_topic_draft()`.
- Publishing needs every claim linked to a verified passage from an active source, and every locale listed in the `required_publish_locales` policy.
