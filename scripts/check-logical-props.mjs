// Fails if Tailwind physical-direction utilities appear in app code.
// RTL support depends on logical utilities only: ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e/rounded-s/rounded-e.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["apps/web/app", "apps/web/components"];
const EXT = new Set([".tsx", ".ts", ".jsx", ".js", ".css"]);
const BANNED = [
  /(?<![\w-])-?m[lr]-[\w\[\].\/]+/,
  /(?<![\w-])p[lr]-[\w\[\].\/]+/,
  /(?<![\w-])-?(?:left|right)-[\w\[\].\/]+/,
  /(?<![\w-])text-(?:left|right)(?![\w-])/,
  /(?<![\w-])border-[lr](?:-[\w\[\].\/]+)?(?![\w-])/,
  /(?<![\w-])rounded-[lr](?:-[\w\[\].\/]+)?(?![\w-])/,
  /(?<![\w-])rounded-[tb][lr](?:-[\w\[\].\/]+)?(?![\w-])/,
  /(?<![\w-])float-(?:left|right)(?![\w-])/,
  /(?<![\w-])scroll-[mp][lr]-[\w\[\].\/]+/,
];

function* walk(dir) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.has(extname(p))) yield p;
  }
}

let failures = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (line.includes("logical-ok")) return; // explicit escape hatch, e.g. a diagram that must not mirror
      for (const re of BANNED) {
        const m = line.match(re);
        if (m) { failures++; console.error(`${file}:${i + 1}  physical utility "${m[0]}" — use the logical equivalent`); }
      }
    });
  }
}
if (failures) { console.error(`\n${failures} physical-direction utilities found.`); process.exit(1); }
console.log("check:logical OK");
