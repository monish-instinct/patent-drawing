// Lays figures out on letter-size sheets, places reference numerals with lead lines,
// draws the front page and writes each sheet as a standalone SVG.
import { bbox, smoothPath, wrap, esc, f } from "./geometry.mjs";
import { deviceFigure } from "./device.mjs";
import { flowFigure, blockFigure } from "./diagrams.mjs";

export const PAGE = { w: 850, h: 1100 };
const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

export function renderDocument(spec) {
  const doc = normalize(spec);
  const figures = doc.figures.map((fig) => ({ fig, out: buildFigure(fig) }));
  // Figures share a sheet when they name the same `sheet`; otherwise one per sheet.
  const groups = [];
  for (const F of figures) {
    const key = F.fig.sheet;
    const g = key != null && groups.find((x) => x.key === key);
    if (g) g.figs.push(F); else groups.push({ key, figs: [F] });
  }
  const total = groups.length + (doc.frontPage ? 1 : 0);
  const sheets = [];
  const names = new Map();
  for (const { out } of figures) for (const it of out.labels) if (it.n != null && it.name && !names.has(String(it.n))) names.set(String(it.n), it.name);
  for (const fg of doc.figures) for (const n of [...(fg.steps ?? []), ...(fg.blocks ?? []), ...(fg.groups ?? [])])
    if (n.n != null && !names.has(String(n.n))) names.set(String(n.n), n.name ?? n.text);
  for (const [n, name] of Object.entries(doc.numerals ?? {})) names.set(String(n), name);

  if (doc.frontPage) sheets.push(frontPage(doc, figures, names, total));
  groups.forEach((g, i) => sheets.push(drawingSheet(doc, g.figs, sheets.length + 1, total, names)));
  return { doc, sheets, numerals: [...names].sort((a, b) => numSort(a[0], b[0])) };
}

const numSort = (a, b) => (parseFloat(a) - parseFloat(b)) || String(a).localeCompare(String(b));

function normalize(spec) {
  if (!spec.title) throw new Error("spec.title is required");
  if (!spec.figures?.length) throw new Error("spec.figures needs at least one figure");
  const figures = spec.figures.map((fg, i) => ({ id: fg.id ?? i + 1, ...fg }));
  return { theme: "classic", frontPage: true, date: new Date().toISOString().slice(0, 10), ...spec, figures,
    inventors: [spec.inventors ?? spec.inventor ?? []].flat().filter(Boolean) };
}

function buildFigure(fig) {
  if (fig.type === "flow" || fig.type === "flowchart") return { kind: "diagram", ...flowFigure(fig) };
  if (fig.type === "blocks" || fig.type === "block") return { kind: "diagram", ...blockFigure(fig) };
  if (fig.type === "svg") return { kind: "raw", items: [], labels: (fig.labels ?? []).map((l) => ({ ...l, anchor: l.at })), fig };
  return { kind: "device", ...deviceFigure(fig) };
}

const fmtDate = (d) => { const [y, m, day] = d.split("-").map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };

// ---------- drawing sheets ----------

function drawingSheet(doc, figs, num, total, names) {
  const body = [];
  const top = 110, bottom = PAGE.h - 60, left = 60, right = PAGE.w - 60;
  const slot = (bottom - top) / figs.length;
  figs.forEach(({ fig, out }, i) => {
    const region = { x: left, y: top + i * slot, w: right - left, h: slot };
    body.push(placeFigure(fig, out, region, `s${num}f${i}`, names));
  });
  return wrapSheet(doc, `${header(doc, num, total)}${body.join("")}`, num, figs.map((x) => x.fig.id));
}

function header(doc, num, total) {
  const y = 62;
  return `<g class="header">
    <text class="serif" x="60" y="${y}" font-size="13" letter-spacing="1">${esc(doc.header ?? "Patent Drawing")}</text>
    <text class="serif" x="${PAGE.w / 2}" y="${y}" font-size="13" text-anchor="middle">${esc(fmtDate(doc.date))}</text>
    <text class="serif" x="${PAGE.w - 60}" y="${y}" font-size="13" text-anchor="end">Sheet ${num} of ${total}</text>
    <text class="serif" x="${PAGE.w - 60}" y="${y + 18}" font-size="11" text-anchor="end" font-style="italic">${esc(shortTitle(doc.title))}</text>
  </g>`;
}

const shortTitle = (t) => (t.length > 48 ? t.slice(0, 46) + "…" : t);

function placeFigure(fig, out, region, idp, names) {
  const hasLabels = out.labels.length > 0;
  const M = hasLabels ? 64 : 20, figLabel = 64;
  const avail = { w: region.w - 2 * M, h: region.h - 2 * M - figLabel };
  let T, s, drawn;

  if (out.kind === "raw") {
    const bb = { x0: 0, y0: 0, w: fig.width, h: fig.height, cx: fig.width / 2, cy: fig.height / 2 };
    s = Math.min(avail.w / bb.w, avail.h / bb.h, fig.maxScale ?? 4);
    const cx = region.x + region.w / 2, cy = region.y + M + avail.h / 2;
    T = (p) => [(p[0] - bb.cx) * s + cx, (p[1] - bb.cy) * s + cy];
    const o = T([0, 0]);
    drawn = `<g class="raw" transform="translate(${f(o[0])} ${f(o[1])}) scale(${f(s)})">${fig.svg}</g>`;
  } else {
    const items = out.kind === "device" ? out.units.flatMap((u) => u.items) : out.items;
    const pts = items.flatMap((it) => it.k === "tube" ? it.pts.flatMap(([x, y]) => [[x - it.r, y - it.r], [x + it.r, y + it.r]]) : it.k === "text" ? textBox(it) : it.pts);
    const bb = bbox(pts);
    s = Math.min(avail.w / Math.max(bb.w, 1), avail.h / Math.max(bb.h, 1), fig.maxScale ?? (out.kind === "diagram" ? 1 : 40));
    const cx = region.x + region.w / 2, cy = region.y + M + avail.h / 2;
    T = (p) => [(p[0] - bb.cx) * s + cx, (p[1] - bb.cy) * s + cy];
    drawn = out.kind === "device"
      ? out.units.map((u) => group(u.n, u.items.map((it) => emit(it, T, s, idp)).join(""))).join("")
      : out.items.map((it) => group(it.n, emit(it, T, s, idp))).join("");
  }

  // Bounds of what was drawn, in sheet units.
  const items = out.kind === "device" ? out.units.flatMap((u) => u.items) : out.items ?? [];
  const drawnPts = out.kind === "raw" ? [T([0, 0]), T([fig.width, fig.height])] : items.flatMap((it) => it.k === "text" ? textBox(it) : it.pts).map(T);
  const db = bbox(drawnPts);
  const labelSvg = hasLabels ? placeLabels(out.labels.map((l) => ({ ...l, at: T(l.anchor) })), db, region, names) : { svg: "", box: db };
  const lb = labelSvg.box;
  const figY = Math.min(region.y + region.h - 14, lb.y1 + 54);
  const figX = fig.labelAt === "right" ? Math.min(region.x + region.w - 70, lb.x1 + 60) : db.cx;
  const caption = `<text class="figlabel" x="${f(figX)}" y="${f(figY)}" text-anchor="middle">FIG. ${esc(fig.id)}</text>`;
  return `<g class="figure" data-fig="${esc(fig.id)}">${drawn}${labelSvg.svg}${caption}</g>`;
}

const group = (n, inner) => (n != null ? `<g data-n="${esc(n)}">${inner}</g>` : inner);

function textBox(it) {
  const w = Math.max(...it.lines.map((l) => l.length)) * it.size * 0.6, h = it.lines.length * (it.lh ?? it.size * 1.2);
  const x = it.anchor === "start" ? it.at[0] : it.anchor === "end" ? it.at[0] - w : it.at[0] - w / 2;
  return [[x, it.at[1] - it.size], [x + w, it.at[1] + h - it.size]];
}

// ---------- labels ----------

function placeLabels(labels, db, region, names) {
  const PADX = 38, PADY = 34;
  const box = { x0: db.x0 - PADX, y0: db.y0 - PADY, x1: db.x1 + PADX, y1: db.y1 + PADY };
  const c = [db.cx, db.cy];
  const L = labels.map((l) => {
    if (l.place) return { ...l, side: "fixed", p: [l.at[0] + l.place[0], l.at[1] + l.place[1]] };
    // Patent numerals sit left and right of the drawing with near-level lead lines; a very wide
    // drawing puts them above and below instead. `side` on a label forces one.
    const wide = db.w > db.h * 1.7;
    const side = l.side ?? (wide ? (l.at[1] < c[1] ? "top" : "bottom") : l.at[0] < c[0] ? "left" : "right");
    const p = side === "left" ? [box.x0, l.at[1]] : side === "right" ? [box.x1, l.at[1]]
      : side === "top" ? [l.at[0], box.y0] : [l.at[0], box.y1];
    return { ...l, side, p };
  });
  // Space out numerals along each side.
  for (const side of ["left", "right", "top", "bottom"]) {
    const S = L.filter((l) => l.side === side);
    const axis = side === "left" || side === "right" ? 1 : 0, gap = axis === 1 ? 27 : 44;
    S.sort((a, b) => a.p[axis] - b.p[axis]);
    for (let pass = 0; pass < 30; pass++) {
      let moved = false;
      for (let i = 1; i < S.length; i++) {
        const over = gap - (S[i].p[axis] - S[i - 1].p[axis]);
        if (over > 0) { S[i - 1].p[axis] -= over / 2; S[i].p[axis] += over / 2; moved = true; }
      }
      if (!moved) break;
    }
    const lo = axis === 1 ? region.y + 14 : region.x + 20, hi = axis === 1 ? region.y + region.h - 70 : region.x + region.w - 20;
    for (const l of S) l.p[axis] = Math.max(lo, Math.min(hi, l.p[axis]));
  }
  let svg = "";
  const pts = [];
  L.forEach((l, i) => {
    const txt = String(l.n), w = txt.length * 9 + 4;
    const anchor = l.side === "left" ? "end" : l.side === "right" ? "start" : "middle";
    const tx = l.p[0], ty = l.p[1] + 5.5;
    // The lead starts at the numeral's edge nearest the part and bows slightly.
    const start = l.side === "left" ? [tx + 4, l.p[1]] : l.side === "right" ? [tx - 4, l.p[1]] : l.side === "top" ? [tx, l.p[1] + 9] : [tx, l.p[1] - 14];
    const dx = l.at[0] - start[0], dy = l.at[1] - start[1], dist = Math.hypot(dx, dy) || 1;
    const bow = (i % 2 ? 1 : -1) * Math.min(14, dist * 0.12);
    const ctrl = [(start[0] + l.at[0]) / 2 - (dy / dist) * bow, (start[1] + l.at[1]) / 2 + (dx / dist) * bow];
    const name = l.name ?? names.get(txt);
    svg += `<g class="label" data-n="${esc(l.n)}"${name ? ` data-name="${esc(name)}"` : ""}>` +
      `<path class="s none lead${l.whole ? " whole" : ""}" d="M${f(start[0])} ${f(start[1])} Q${f(ctrl[0])} ${f(ctrl[1])} ${f(l.at[0])} ${f(l.at[1])}"/>` +
      (l.whole ? arrowHead(ctrl, l.at, 9) : "") +
      `<text class="num" x="${f(tx)}" y="${f(ty)}" text-anchor="${anchor}">${esc(txt)}</text></g>`;
    const x0 = anchor === "end" ? tx - w : anchor === "start" ? tx : tx - w / 2;
    pts.push([x0, ty - 15], [x0 + w, ty + 4]);
  });
  const b = bbox([...pts, [db.x0, db.y0], [db.x1, db.y1]]);
  return { svg, box: b };
}

function arrowHead(from, to, size) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const p1 = [to[0] - size * Math.cos(a - 0.3), to[1] - size * Math.sin(a - 0.3)];
  const p2 = [to[0] - size * Math.cos(a + 0.3), to[1] - size * Math.sin(a + 0.3)];
  return `<path class="ink" d="M${f(to[0])} ${f(to[1])} L${f(p1[0])} ${f(p1[1])} L${f(p2[0])} ${f(p2[1])}Z"/>`;
}

// ---------- items → SVG ----------

let clipCount = 0;
function emit(it, T, s, idp) {
  const W = { thin: " thin", shade: " shade", line: "" }[it.w ?? "line"] ?? "";
  const dash = it.dash === "centerline" ? ' stroke-dasharray="26 5 5 5"' : it.dash === "dash" ? ' stroke-dasharray="9 6"' : it.dash ? ` stroke-dasharray="${it.dash}"` : "";
  if (it.k === "poly") {
    const P = it.pts.map(T);
    const d = it.smooth ? smoothPath(P, true) : "M" + P.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L") + "Z";
    let out = it.fill !== "none" ? `<path class="${it.fill === "ink" ? "ink" : "paper"}" d="${d}"/>` : "";
    if (it.hatch) out += hatch(P, d, it.hatch, `${idp}c${clipCount++}`);
    if (it.stroke !== false) out += `<path class="s none${W}" d="${d}"${dash}/>`;
    return out;
  }
  if (it.k === "line" || it.k === "leader") {
    const P = it.pts.map(T);
    if (it.k === "leader") {
      const [a, b] = P, m = [(a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 + 6];
      return `<path class="s none lead" d="M${f(a[0])} ${f(a[1])} Q${f(m[0])} ${f(m[1])} ${f(b[0])} ${f(b[1])}"/>`;
    }
    const d = it.smooth ? smoothPath(P) : "M" + P.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L");
    return `<path class="s none${W}" d="${d}"${dash}/>`;
  }
  if (it.k === "tube") {
    const d = smoothPath(it.pts.map(T)), w = it.r * 2 * s;
    return `<path class="tube-o" d="${d}" stroke-width="${f(w + 3)}"/><path class="tube-i" d="${d}" stroke-width="${f(Math.max(0.5, w - 0.2))}"/>`;
  }
  if (it.k === "arrow") {
    const P = it.pts.map(T);
    const d = it.smooth ? smoothPath(P) : "M" + P.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L");
    let out = `<path class="s none" d="${d}"${dash}/>`;
    if (!it.none) out += arrowHead(P.at(-2), P.at(-1), 11);
    if (it.both) out += arrowHead(P[1], P[0], 11);
    return out;
  }
  if (it.k === "text") {
    const [x, y] = T(it.at), size = it.size * Math.min(1, s), lh = (it.lh ?? it.size * 1.2) * Math.min(1, s);
    const tspans = it.lines.map((l, i) => `<tspan x="${f(x)}" dy="${i ? f(lh) : 0}">${esc(l)}</tspan>`).join("");
    return `<text class="${it.family === "serif" ? "serif" : "sans"}" x="${f(x)}" y="${f(y)}" font-size="${f(size)}" text-anchor="${it.anchor ?? "middle"}">${tspans}</text>`;
  }
  return "";
}

function hatch(P, d, h, id) {
  const b = bbox(P), a = (h.angle * Math.PI) / 180, dir = [Math.cos(a), Math.sin(a)], nrm = [-dir[1], dir[0]];
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map((p) => p[0] * nrm[0] + p[1] * nrm[1]);
  const lo = Math.min(...corners), hi = Math.max(...corners), L = b.w + b.h;
  let lines = "";
  for (let t = lo + h.gap / 2; t < hi; t += h.gap) {
    const c = [nrm[0] * t, nrm[1] * t];
    // A crescent keeps the shading to the far side of a hole.
    const ctr = [c[0] + dir[0] * ((b.cx * dir[0] + b.cy * dir[1])), c[1] + dir[1] * ((b.cx * dir[0] + b.cy * dir[1]))];
    if (h.crescent && ctr[0] > b.x0 + b.w * 0.42) continue;
    lines += `M${f(ctr[0] - dir[0] * L)} ${f(ctr[1] - dir[1] * L)} L${f(ctr[0] + dir[0] * L)} ${f(ctr[1] + dir[1] * L)}`;
  }
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><path class="hatch" clip-path="url(#${id})" d="${lines}"/>`;
}

// ---------- front page ----------

function frontPage(doc, figures, names, total) {
  const L = 60, R = PAGE.w - 60, mid = 405;
  let y = 70;
  let s = `<text class="serif" x="${L}" y="${y}" font-size="13">(12) <tspan font-size="24" font-weight="bold" dx="6">${esc(doc.kind ?? "Patent Drawing")}</tspan></text>`;
  s += `<text class="serif" x="${R}" y="${y - 6}" font-size="13" text-anchor="end">(45) Date: <tspan font-weight="bold">${esc(fmtDate(doc.date))}</tspan></text>`;
  if (doc.ref) s += `<text class="serif" x="${R}" y="${y + 14}" font-size="13" text-anchor="end">(10) Ref.: <tspan font-weight="bold">${esc(doc.ref)}</tspan></text>`;
  y += 26;
  if (doc.inventors.length) s += `<text class="serif" x="${L + 30}" y="${y}" font-size="15">${esc(surname(doc.inventors[0]))}${doc.inventors.length > 1 ? " et al." : ""}</text>`;
  y += 16;
  s += `<path class="s none" d="M${L} ${y} H${R}"/><path class="s none thin" d="M${L} ${y + 4} H${R}"/>`;
  y += 34;

  // Left column: bibliographic data and the reference list. Right column: abstract and FIG. 1.
  let ly = y;
  const field = (code, label, value, bold) => {
    const lines = wrap(value, bold ? 30 : 38);
    let out = `<text class="serif" x="${L}" y="${ly}" font-size="13">(${code})</text><text class="serif" x="${L + 34}" y="${ly}" font-size="13">${esc(label)}</text>`;
    ly += 18;
    out += `<text class="serif" x="${L + 34}" y="${ly}" font-size="${bold ? 15 : 13}" ${bold ? 'font-weight="bold"' : ""}>${lines.map((l, i) => `<tspan x="${L + 34}" dy="${i ? (bold ? 19 : 16) : 0}">${esc(l)}</tspan>`).join("")}</text>`;
    ly += lines.length * (bold ? 19 : 16) + 14;
    return out;
  };
  s += field(54, "Title:", doc.title.toUpperCase(), true);
  if (doc.inventors.length) s += field(72, doc.inventors.length > 1 ? "Inventors:" : "Inventor:", doc.inventors.join("; "));
  if (doc.assignee) s += field(73, "Assignee:", doc.assignee);
  if (doc.field) s += field(51, "Field:", doc.field);
  if (doc.filed) s += field(22, "Conceived:", doc.filed);
  s += field(58, "Drawings:", `${figures.length} figure${figures.length > 1 ? "s" : ""} on ${total - 1} sheet${total > 2 ? "s" : ""}`);

  const nums = [...names].sort((a, b) => numSort(a[0], b[0]));
  if (nums.length) {
    ly += 6;
    s += `<text class="serif" x="${L}" y="${ly}" font-size="13" letter-spacing="1.5">REFERENCE NUMERALS</text>`;
    ly += 8;
    s += `<path class="s none thin" d="M${L} ${ly} H${mid - 30}"/>`;
    ly += 20;
    const rowH = 17.5, maxRows = Math.floor((PAGE.h - 90 - ly) / rowH);
    const cols = nums.length > maxRows ? 2 : 1, perCol = Math.ceil(nums.length / cols);
    nums.slice(0, maxRows * cols).forEach(([n, name], i) => {
      const col = Math.floor(i / perCol), row = i % perCol;
      const x = L + col * 168, yy = ly + row * rowH;
      const maxChars = cols === 2 ? 17 : 38;
      s += `<g class="ref" data-n="${esc(n)}"><text class="num" x="${x + 26}" y="${yy}" text-anchor="end" font-size="12.5">${esc(n)}</text><text class="serif" x="${x + 36}" y="${yy}" font-size="12.5">${esc(name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name)}</text></g>`;
    });
  }

  let ry = y;
  s += `<text class="serif" x="${mid + 20}" y="${ry}" font-size="13">(57)</text><text class="serif" x="${(mid + 20 + R) / 2 + 12}" y="${ry}" font-size="14" text-anchor="middle" letter-spacing="2">ABSTRACT</text>`;
  ry += 26;
  const abs = wrap(doc.abstract ?? "", 52);
  s += `<text class="serif abstract" x="${mid + 20}" y="${ry}" font-size="13.2">${abs.map((l, i) => `<tspan x="${mid + 20}" dy="${i ? 18 : 0}">${esc(l)}</tspan>`).join("")}</text>`;
  ry += abs.length * 18 + 20;

  // The representative figure fills what's left of the right column.
  const rep = figures.find((F) => F.fig.id === (doc.representative ?? figures[0].fig.id)) ?? figures[0];
  const region = { x: mid + 10, y: ry, w: R - mid - 10, h: PAGE.h - 80 - ry };
  if (region.h > 220) s += placeFigure({ ...rep.fig, maxScale: rep.fig.maxScale }, rep.out, region, "fp", names);

  s += `<text class="serif" x="${PAGE.w / 2}" y="${PAGE.h - 34}" font-size="10.5" text-anchor="middle" font-style="italic" opacity=".75">${esc(doc.footer ?? "Drawn with patent-drawing, a Claude skill. Not a filed or issued patent.")}</text>`;
  return wrapSheet(doc, s, 1, []);
}

const surname = (name) => String(name).trim().split(/\s+/).at(-1);

// ---------- sheet wrapper and themes ----------

export const SHEET_CSS = `
.pd{--paper:#fffefb;--ink:#141414;--hl:#d2401d}
.pd.vintage{--paper:#efe2c4;--ink:#2d2216;--hl:#b3261e}
.pd.blueprint{--paper:#1c4a86;--ink:#eef5ff;--hl:#ffd44d}
.pd .bg{fill:var(--paper)}
.pd .paper{fill:var(--paper)} .pd .ink{fill:var(--ink)} .pd .none{fill:none}
.pd .s{stroke:var(--ink);stroke-width:1.55;stroke-linejoin:round;stroke-linecap:round}
.pd .s.thin{stroke-width:.85} .pd .s.shade{stroke-width:.8} .pd .s.lead{stroke-width:.9}
.pd .hatch{stroke:var(--ink);stroke-width:.65;fill:none}
.pd .tube-o{stroke:var(--ink);fill:none;stroke-linecap:round;stroke-linejoin:round}
.pd .tube-i{stroke:var(--paper);fill:none;stroke-linecap:round;stroke-linejoin:round}
.pd .raw *{vector-effect:non-scaling-stroke;stroke:var(--ink);stroke-width:1.5}
.pd .raw .paper{fill:var(--paper)} .pd .raw [fill="none"]{fill:none}
.pd text{fill:var(--ink)}
.pd .serif{font-family:"Times New Roman",Times,"Liberation Serif",serif}
.pd .sans,.pd .num{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
.pd .num{font-size:15.5px}
.pd .figlabel{font-family:"Times New Roman",Times,serif;font-style:italic;font-weight:bold;font-size:31px;letter-spacing:1px}
.pd .grain,.pd .grid,.pd .vignette{display:none}
.pd.vintage .grain,.pd.vintage .vignette{display:inline}
.pd.blueprint .grid{display:inline}
.pd .hl .s,.pd .hl .tube-o,.pd .hl .lead{stroke:var(--hl)} .pd .hl text{fill:var(--hl)}
.pd .hl .hatch{stroke:var(--hl)}
`;

function wrapSheet(doc, inner, num, figIds) {
  const id = `sh${num}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="pd ${esc(doc.theme)}" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="${PAGE.w}" height="${PAGE.h}" data-sheet="${num}" data-figs="${figIds.join(",")}">
<style>${SHEET_CSS}</style>
<defs>
  <filter id="${id}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${num * 7}"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .25  0 0 0 0 .12  0 0 0 .55 -.18"/></filter>
  <radialGradient id="${id}v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#7a5a2a" stop-opacity="0"/><stop offset="1" stop-color="#7a5a2a" stop-opacity=".22"/></radialGradient>
  <pattern id="${id}p" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="1"/></pattern>
</defs>
<rect class="bg" width="${PAGE.w}" height="${PAGE.h}"/>
<rect class="grid" width="${PAGE.w}" height="${PAGE.h}" fill="url(#${id}p)"/>
${inner}
<rect class="vignette" width="${PAGE.w}" height="${PAGE.h}" fill="url(#${id}v)" pointer-events="none"/>
<rect class="grain" width="${PAGE.w}" height="${PAGE.h}" filter="url(#${id}g)" opacity=".5" pointer-events="none"/>
</svg>`;
}
