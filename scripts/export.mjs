#!/usr/bin/env node
// Exports patent.html to a print-ready PDF and one PNG per sheet, using headless Chrome.
// Usage: node export.mjs [--dir patent-out] [--theme classic|vintage|blueprint] [--scale 2] [--no-pdf] [--no-png]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const dir = path.resolve(opt("dir", "patent-out"));
const html = path.join(dir, "patent.html");
const theme = opt("theme");
const scale = +opt("scale", 2);
if (!fs.existsSync(html)) { console.error(`Missing ${html}. Run build.mjs first.`); process.exit(1); }
const chrome = findChrome();
if (!chrome) { console.error("Chrome or Chromium not found. Set CHROME=/path/to/chrome."); process.exit(1); }

const sheets = fs.readdirSync(path.join(dir, "sheets")).filter((f) => /^sheet-\d+\.svg$/.test(f)).length;
const base = pathToFileURL(html).href;
const suffix = theme ? `-${theme}` : "";
const common = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--virtual-time-budget=2000", "--run-all-compositor-stages-before-draw"];

if (!argv.includes("--no-pdf")) {
  const pdf = path.join(dir, `patent${suffix}.pdf`);
  run([...common, "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, `${base}#${theme ? "theme=" + theme : ""}`]);
  console.log(`Saved ${pdf}`);
}
if (!argv.includes("--no-png")) {
  const pngDir = path.join(dir, "png");
  fs.mkdirSync(pngDir, { recursive: true });
  for (let n = 1; n <= sheets; n++) {
    const file = path.join(pngDir, `sheet-${n}${suffix}.png`);
    run([...common, `--force-device-scale-factor=${scale}`, "--window-size=850,1100", `--screenshot=${file}`, `${base}#export&sheet=${n}${theme ? "&theme=" + theme : ""}`]);
  }
  console.log(`Saved ${sheets} PNGs (${850 * scale}×${1100 * scale}) to ${pngDir}`);
}

function run(a) { execFileSync(chrome, a, { stdio: ["ignore", "pipe", "pipe"] }); }
function findChrome() {
  const c = [process.env.CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
  for (const p of c) if (fs.existsSync(p)) return p;
  for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) { try { return execFileSync("which", [n], { encoding: "utf8" }).trim(); } catch {} }
  return null;
}
