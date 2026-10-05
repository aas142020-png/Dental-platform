# Step 4 review: responsive shell + localization

Scope as approved in the Sprint 1 plan (step 4): locale routing, the responsive app shell with the five navigation areas, language switching, and an installable PWA manifest. No auth, data fetching, topic rendering or CMS yet (steps 5–7). No new product features.

## What exists

| Area | Implementation |
| --- | --- |
| Routing | `next-intl`, every path locale-prefixed (`/ar/...`, `/en/...`). Locale order: URL → `NEXT_LOCALE` cookie → `Accept-Language` → Arabic. Unknown locale or path → localized 404. Profile `preferred_locale` joins this order in Step 5. |
| Direction | `<html lang dir>` per request. Only logical CSS (`ms-`, `ps-`, `start-`, `border-e`), enforced by `check:logical`. |
| Shell | One nav list (`nav-config.ts`) drives three presentations: bottom tab bar under 768px, icon rail at 768–1279px, labelled sidebar from 1280px. Exactly one is visible at any width. Safe areas respected, skip link, `aria-current`. |
| Top bar | Language switch on every page. On sub-pages only: a back button (`DirectionalIcon`, mirrored in RTL) and the section name. Top-level pages don't repeat their heading. |
| Pages | Home, Learn, Practice, Clinical, Profile: localized headings and plain empty states. Practice and Clinical say "Coming soon". Profile says accounts are not available yet. |
| PWA | Manifest with standalone display and neutral 192/512/maskable/SVG icons. No offline caching (out of scope). |
| Tokens | Neutral placeholders only; dark values defined but not active. System font stacks (no permanent fonts chosen). |

## Decisions to note

1. **Arabic nav label for Profile is «حسابي».** «الملف الشخصي» wrapped to two lines in the mobile tab bar. The page heading stays «الملف الشخصي». English is unchanged ("Profile").
2. **Numbers and plurals.** ICU plurals are allowed, matching the approved strategy: all six Arabic forms work. ICU never renders the number itself (`#` and `{x, number}` are rejected by `check:i18n`). Messages receive `formatNumber()` output instead. This guarantees Western digits even in browsers or regional locales (ar-SA, ar-EG) whose defaults are Arabic-Indic. An earlier draft banned plurals entirely; that was narrowed because it would have broken Arabic grammar.
3. **The back button can't be seen in a browser yet.** No sub-pages exist until Step 6. Its logic (`parentPath`) is unit-tested, and the browser check confirms it is absent on top-level pages.

## Verification

- **Browser acceptance:** `e2e/shell.check.mjs`, 364 checks in Chromium against the production build. It covers:
  - AR and EN × 375 / 820 / 1440 px × all five areas.
  - HTTP 200, `lang`/`dir`, exactly one nav visible, five links, correct `aria-current`, heading and document title.
  - No horizontal scroll, nav on the start edge, nav labels on one line, no repeated heading, no back button on top-level pages.
  - Click navigation, language switch keeping the page and saving the cookie, and first-visit language negotiation.
  - Localized 404, skip link as the first Tab stop, manifest and icons reachable.
- **Unit tests:** `apps/web` 11 (nav config, back target); `packages/i18n` 11 (Arabic plural forms with Western digits, date and number formatting).
- **Performance:** about 114 KB first-load JS per page (budget 150 KB). Pages are pre-rendered per locale.

Screenshots: `apps/web/e2e/screenshots/` (Learn page, both locales, three widths).
