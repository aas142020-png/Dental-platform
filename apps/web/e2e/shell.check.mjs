// Step 4 acceptance check: five nav areas in AR and EN at 375 / 820 / 1440 px, in a real browser.
// Usage: pnpm build && pnpm start -p 3100 &   CHROME_PATH=/path/to/chrome node e2e/shell.check.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = fileURLToPath(new URL("./screenshots/", import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const ar = (await import("../../../packages/i18n/messages/ar.json", { with: { type: "json" } })).default;
const en = (await import("../../../packages/i18n/messages/en.json", { with: { type: "json" } })).default;
const MSG = { ar, en };
const AREAS = ["home", "learn", "practice", "clinical", "profile"];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, shell: "bottom" },
  { name: "tablet", width: 820, height: 1180, shell: "rail" },
  { name: "desktop", width: 1440, height: 900, shell: "side" },
];

let pass = 0, fail = 0;
const check = (ok, label) => { ok ? pass++ : fail++; if (!ok) console.error("FAIL", label); };

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();

for (const locale of ["ar", "en"]) {
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    for (const area of AREAS) {
      const label = `${locale} ${vp.name} ${area}`;
      const res = await page.goto(`${BASE}/${locale}/${area}`, { waitUntil: "networkidle0" });
      check([200, 304].includes(res.status()), `${label}: HTTP 200 (304 = cached), got ${res.status()}`);
      const s = await page.evaluate((shellName) => {
        const html = document.documentElement;
        const visible = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
        const navs = [...document.querySelectorAll("[data-shell]")].filter(visible).map((n) => n.dataset.shell);
        const nav = document.querySelector(`[data-shell="${shellName}"]`);
        const r = nav?.getBoundingClientRect();
        return {
          lang: html.lang, dir: html.dir, navs,
          links: nav ? nav.querySelectorAll("a[data-nav]").length : 0,
          current: nav?.querySelector('a[aria-current="page"]')?.dataset.nav,
          h1: document.querySelector("h1")?.textContent,
          title: document.title,
          overflow: html.scrollWidth > window.innerWidth,
          back: !!document.querySelector("[data-back]"),
          topbarTitle: document.querySelector("[data-topbar-title]")?.textContent ?? "",
          // A wrapped or clipped label is taller than one line or truncated.
          wrapped: nav ? [...nav.querySelectorAll("[data-nav-label]")].filter((el) => {
            const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.5;
            return el.getBoundingClientRect().height > lh * 1.3 || el.scrollWidth > el.clientWidth + 1;
          }).map((el) => el.textContent) : [],
          left: r ? Math.round(r.left) : null, right: r ? Math.round(r.right) : null, vw: window.innerWidth,
        };
      }, vp.shell);
      check(s.lang === locale && s.dir === (locale === "ar" ? "rtl" : "ltr"), `${label}: lang/dir`);
      check(s.navs.length === 1 && s.navs[0] === vp.shell, `${label}: only ${vp.shell} nav visible (got ${s.navs})`);
      check(s.links === 5, `${label}: 5 nav links`);
      check(s.current === area, `${label}: aria-current on ${area} (got ${s.current})`);
      check(s.h1 === MSG[locale][area].title, `${label}: heading`);
      check(s.title.startsWith(MSG[locale][area].title), `${label}: document title`);
      check(!s.overflow, `${label}: no horizontal scroll`);
      check(!s.back, `${label}: no back button on a top-level area`);
      check(s.topbarTitle === "", `${label}: top bar does not repeat the page heading`);
      check(s.wrapped.length === 0, `${label}: nav labels fit on one line (wrapped: ${s.wrapped})`);
      if (vp.shell !== "bottom") {
        // Start edge: right in Arabic, left in English.
        check(locale === "ar" ? s.right === s.vw : s.left === 0, `${label}: nav on the start edge (l=${s.left} r=${s.right})`);
      }
      if (area === "learn") await page.screenshot({ path: `${SHOTS}${locale}-${vp.name}-learn.png` });
    }
  }
}

// Navigation by clicking (mobile bottom bar)
await page.setViewport({ width: 375, height: 812 });
await page.goto(`${BASE}/ar/home`, { waitUntil: "networkidle0" });
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('[data-shell="bottom"] a[data-nav="learn"]')]);
check(new URL(page.url()).pathname === "/ar/learn", "clicking Learn in the bottom bar navigates");

// Language switch keeps the page and is remembered
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("[data-locale-switch]")]);
check(new URL(page.url()).pathname === "/en/learn", `language switch keeps the page (got ${new URL(page.url()).pathname})`);
const cookie = (await browser.cookies?.() ?? await page.cookies()).find((c) => c.name === "NEXT_LOCALE");
check(cookie?.value === "en", "language choice stored in NEXT_LOCALE cookie");
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
check(new URL(page.url()).pathname === "/en/home", `remembered language used for / (got ${new URL(page.url()).pathname})`);

// First visit: Accept-Language, then Arabic default
const fresh = await browser.createBrowserContext();
const p2 = await fresh.newPage();
await p2.setExtraHTTPHeaders({ "Accept-Language": "fr-FR,fr;q=0.9" });
await p2.goto(`${BASE}/`, { waitUntil: "networkidle0" });
check(new URL(p2.url()).pathname === "/ar/home", `unsupported browser language falls back to Arabic (got ${new URL(p2.url()).pathname})`);
const fresh2 = await browser.createBrowserContext();
const p3 = await fresh2.newPage();
await p3.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
await p3.goto(`${BASE}/`, { waitUntil: "networkidle0" });
check(new URL(p3.url()).pathname === "/en/home", `English browser goes to /en (got ${new URL(p3.url()).pathname})`);

// Unknown path: localized 404
const r404 = await page.goto(`${BASE}/ar/no-such-page`, { waitUntil: "networkidle0" });
check(r404.status() === 404, `unknown path returns 404 (got ${r404.status()})`);
check((await page.$eval("h1", (h) => h.textContent)) === ar.notFound.title, "404 page is localized");

// Keyboard: skip link is the first focusable element and jumps to main
await page.goto(`${BASE}/en/home`, { waitUntil: "networkidle0" });
await page.keyboard.press("Tab");
check((await page.evaluate(() => document.activeElement?.getAttribute("href"))) === "#content", "first Tab focuses the skip link");

// PWA manifest
const m = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
check(m.display === "standalone" && m.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"), "manifest: standalone with maskable icon");
for (const i of m.icons) check((await fetch(`${BASE}${i.src}`)).ok, `manifest icon reachable: ${i.src}`);

await browser.close();
console.log(`shell check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
