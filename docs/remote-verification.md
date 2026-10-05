# Remote verification — 2026-10-05

Project `zdczzhpxmobupboxiheq` (ap-south-1, Postgres 17).

- **Before:** empty. No migration history, no public objects.
- **Deployed:** the 12 current migrations, verbatim, via the Supabase connector. Each is recorded under its apply timestamp, and the local files were renamed to those versions; contents are unchanged.
- **Drift:** none. Columns and defaults, constraints, indexes, RLS flags, all 57 public policies, 47 function bodies, execute privileges, table privileges, 5 views, 31 triggers, 13 enums, and config rows are identical by digest. The only remote extras are the expected storage objects: 3 `content_media_*` policies and the private `content-media` bucket.
- **Types:** official generator output in `packages/db-types/src/database.ts`, with 84 relationships. Typed joins are proven by `api-client/test/typed-joins.typecheck.ts`.
- **Live API smoke test:** 12 probes through the Supabase gateway → PostgREST / Auth. Responses are saved in `api-client/test/fixtures/postgrest-live-2026-10-05.json`. The temporary user and `pg_net` were removed afterwards.

## Open items

1. **Security advisor: `function_search_path_mutable`** on 11 internal `private.*` functions. These are non-definer trigger and helper functions in an unexposed schema, so the risk is low. Proposed fix, as a new migration: `alter function private.<fn> set search_path = ''` for each one.
2. **Security advisor: `transition_content` is a SECURITY DEFINER function callable by `authenticated`.** This is intended: it is the workflow API, and it checks the session and roles itself. Accepted.
3. **`P0002` (`reason:not_found`) comes back as HTTP 500**, because PostgREST has no mapping for it. The client classifies it correctly from the hint, but monitoring will count it as a server error. Option: switch to PostgREST's `PT404` SQLSTATE in a new migration.
4. **No seed applied remotely**, including the Endodontics topic placeholders. Waiting for your decision.
