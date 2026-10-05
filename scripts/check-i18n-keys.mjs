// Fails if ar.json and en.json do not have identical key sets.
import { readFileSync } from "node:fs";

const load = (l) => JSON.parse(readFileSync(`packages/i18n/messages/${l}.json`, "utf8"));
const keys = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);

const ar = new Set(keys(load("ar")));
const en = new Set(keys(load("en")));
const missingEn = [...ar].filter((k) => !en.has(k));
const missingAr = [...en].filter((k) => !ar.has(k));
missingEn.forEach((k) => console.error(`missing in en.json: ${k}`));
missingAr.forEach((k) => console.error(`missing in ar.json: ${k}`));
// Western digits in both locales, in every browser. ICU plurals ARE allowed (Arabic needs all six forms
// for correct grammar), but numbers must never be rendered by ICU: older browser ICU data and regional
// locales (ar-SA, ar-EG) render Arabic-Indic digits. So: select the form with a plural on `n`, and display
// a pre-formatted string param, e.g. "{n, plural, few {{count} مواضيع} other {{count} موضوع}}" with
// count = formatNumber(locale, n).  Forbidden: "#" and "{x, number}".
const icuNumberDisplay = /\{[^{}]*,\s*number\b[^{}]*\}|#/;
const strings = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? strings(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const icuHits = ["ar", "en"].flatMap((l) => strings(load(l)).filter(([, v]) => icuNumberDisplay.test(String(v))).map(([k]) => `${l}:${k}`));
icuHits.forEach((k) => console.error(`ICU-rendered number not allowed (pass formatNumber() output as a param): ${k}`));
if (missingEn.length || missingAr.length || icuHits.length) process.exit(1);
console.log(`check:i18n OK (${ar.size} keys)`);
