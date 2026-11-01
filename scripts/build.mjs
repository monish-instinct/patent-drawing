#!/usr/bin/env node
// Renders an invention spec into patent-style sheets.
// Usage: node build.mjs <spec.mjs|spec.json> [--out patent-out] [--theme classic|vintage|blueprint]
// Writes <out>/patent.html (viewer, prints to PDF) and <out>/sheets/sheet-N.svg.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { renderDocument } from "../kit/sheet.mjs";
import * as kit from "../kit/index.mjs";
import { grainDataUri } from "../kit/grain.mjs";

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf("--" + k); return i < 0 ? undefined : argv[i + 1]; };
const specPath = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!specPath) { console.error("Usage: node build.mjs <spec.mjs|spec.json> [--out dir] [--theme name]"); process.exit(1); }
const outDir = path.resolve(opt("out") ?? "patent-out");

let spec;
const abs = path.resolve(specPath);
if (abs.endsWith(".json")) spec = JSON.parse(fs.readFileSync(abs, "utf8"));
else {
  const mod = await import(pathToFileURL(abs).href + `?t=${Date.now()}`);
  spec = typeof mod.default === "function" ? await mod.default(kit) : mod.default;
}
if (opt("theme")) spec.theme = opt("theme");

let result;
try { result = renderDocument(spec); }
catch (e) { console.error(`Could not draw ${specPath}: ${e.message}`); process.exit(1); }

const here = path.dirname(fileURLToPath(import.meta.url));
const viewer = fs.readFileSync(path.join(here, "..", "template", "viewer.html"), "utf8");
const page = viewer
  .replace("/*__GRAIN__*/", () => grainDataUri())
  .replaceAll("<!--TITLE-->", () => escapeHtml(result.doc.title))
  .replace("<!--SHEETS-->", () => result.sheets.map((s, i) => `<section class="sheet" id="sheet-${i + 1}">${s}</section>`).join("\n"))
  .replace("/*__META__*/null", () => JSON.stringify({ title: result.doc.title, theme: result.doc.theme, numerals: result.numerals }).replace(/</g, "\\u003c"));

fs.mkdirSync(path.join(outDir, "sheets"), { recursive: true });
for (const old of fs.readdirSync(path.join(outDir, "sheets"))) if (/^sheet-\d+\.svg$/.test(old)) fs.rmSync(path.join(outDir, "sheets", old));
result.sheets.forEach((svg, i) => fs.writeFileSync(path.join(outDir, "sheets", `sheet-${i + 1}.svg`), svg));
fs.writeFileSync(path.join(outDir, "patent.html"), page);
console.log(`Wrote ${path.join(outDir, "patent.html")} (${result.sheets.length} sheets, ${result.doc.figures.length} figures, ${result.numerals.length} reference numerals, theme ${result.doc.theme})`);

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
