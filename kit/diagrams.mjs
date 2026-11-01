// Method flowcharts and system block diagrams, laid out in sheet units (1 unit = 0.01 in).
import { wrap, bbox } from "./geometry.mjs";

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const pill = (x, y, w, h) => {
  const r = h / 2, pts = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI; pts.push([x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r]); }
  for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (i / 12) * Math.PI; pts.push([x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]); }
  return pts;
};

// Steps: { n, text, kind: "start" | "end" | "step" | "decision" | "io", yes, no }.
// A decision continues down on YES (or jumps to `yes`), and loops to `no` along the right side.
export function flowFigure(fig) {
  const items = [], W = fig.width ?? 330, GAP = 50, LH = 17, PAD = 15, FS = 13.5;
  const steps = fig.steps.map((s, i) => ({ kind: "step", ...s, key: s.n ?? s.id ?? `s${i}` }));
  const at = {};
  let y = 0;
  for (const s of steps) {
    const dec = s.kind === "decision";
    const lines = wrap(String(s.text).toUpperCase(), dec ? 18 : s.kind === "start" || s.kind === "end" ? 24 : 32);
    const h = dec ? Math.max(118, lines.length * LH + 66) : Math.max(s.kind === "start" || s.kind === "end" ? 44 : 52, lines.length * LH + PAD * 2);
    const w = dec ? W * 0.9 : s.kind === "start" || s.kind === "end" ? W * 0.7 : W;
    at[s.key] = { s, x: -w / 2, y, w, h, cy: y + h / 2, lines };
    y += h + GAP;
  }
  const edgeX = (b, yy) => b.s.kind === "decision" ? (b.w / 2) * (1 - Math.abs(yy - b.cy) / (b.h / 2)) : b.w / 2;

  steps.forEach((s, i) => {
    const b = at[s.key];
    const shape = s.kind === "decision" ? [[0, b.y], [b.w / 2, b.cy], [0, b.y + b.h], [-b.w / 2, b.cy]]
      : s.kind === "start" || s.kind === "end" ? pill(b.x, b.y, b.w, b.h)
      : s.kind === "io" ? [[b.x + 18, b.y], [b.x + b.w + 18, b.y], [b.x + b.w - 18, b.y + b.h], [b.x - 18, b.y + b.h]]
      : rect(b.x, b.y, b.w, b.h);
    items.push({ k: "poly", pts: shape, fill: "paper", n: s.n });
    items.push({ k: "text", at: [0, b.cy - ((b.lines.length - 1) * LH) / 2 + FS * 0.36], lines: b.lines, size: FS, lh: LH, family: "sans", n: s.n });
    if (s.n != null) {
      const ly = s.kind === "decision" ? b.cy - b.h * 0.22 : b.y + Math.min(b.h * 0.32, 26);
      const ex = edgeX(b, ly);
      items.push({ k: "leader", pts: [[W / 2 + 34, ly - 6], [ex + 2, ly + 4]] });
      items.push({ k: "text", at: [W / 2 + 40, ly - 2], lines: [String(s.n)], size: 15, family: "sans", anchor: "start" });
    }
    const next = steps[i + 1];
    if (s.kind === "end" || !next) return;
    const yesTo = s.yes != null ? at[s.yes] : at[next.key];
    if (s.kind === "decision" && s.yes != null && yesTo !== at[next.key]) route(items, b, yesTo, -1, "YES", edgeX);
    else {
      items.push({ k: "arrow", pts: [[0, b.y + b.h], [0, at[next.key].y]] });
      if (s.kind === "decision") items.push({ k: "text", at: [10, b.y + b.h + 20], lines: ["YES"], size: 12, family: "sans", anchor: "start" });
    }
  });
  let lane = 0;
  for (const s of steps) if (s.kind === "decision" && s.no != null && at[s.no]) route(items, at[s.key], at[s.no], 1, "NO", edgeX, lane++);
  for (const s of steps) if (s.next != null && s.kind !== "decision" && at[s.next]) route(items, at[s.key], at[s.next], -1, "", edgeX, lane++);
  return { items, labels: [] };

  function route(items, from, to, side, word, edgeX, k = 0) {
    const x0 = side * from.w / 2, xl = side * (W / 2 + 110 + k * 22), xt = side * (edgeX(to, to.cy) + 2);
    items.push({ k: "arrow", pts: [[x0, from.cy], [xl, from.cy], [xl, to.cy], [xt, to.cy]] });
    if (word) items.push({ k: "text", at: [x0 + side * 12, from.cy - 7], lines: [word], size: 12, family: "sans", anchor: side > 0 ? "start" : "end" });
  }
}

// Blocks: { id, n, text, row, col, span, h }. Groups: { id, n, text, contains: [ids] }.
// Links: { from, to, both, dashed, text }.
export function blockFigure(fig) {
  const items = [], CW = fig.cellWidth ?? 190, CH = fig.cellHeight ?? 84, GX = fig.gapX ?? 72, GY = fig.gapY ?? 76;
  const boxes = {};
  for (const b of fig.blocks) {
    const span = b.span ?? 1;
    const x = b.col * (CW + GX), y = b.row * (CH + GY), w = CW * span + GX * (span - 1), h = b.h ?? CH;
    boxes[b.id ?? b.n] = { x, y, w, h, b };
  }
  const groups = (fig.groups ?? []).map((g) => {
    const m = g.contains.map((id) => boxes[id]).filter(Boolean);
    const bb = bbox(m.flatMap((r) => [[r.x, r.y], [r.x + r.w, r.y + r.h]]));
    const r = { x: bb.x0 - 24, y: bb.y0 - 44, w: bb.w + 48, h: bb.h + 68, g };
    boxes[g.id ?? g.n] = r;
    return r;
  });
  for (const r of groups) {
    items.push({ k: "poly", pts: rect(r.x, r.y, r.w, r.h), fill: "none", dash: r.g.dashed ? "dash" : null, n: r.g.n });
    items.push({ k: "text", at: [r.x + 14, r.y + 24], lines: [`${String(r.g.text).toUpperCase()}${r.g.n != null ? "  " + r.g.n : ""}`], size: 13, family: "sans", anchor: "start", n: r.g.n });
  }
  for (const r of Object.values(boxes)) {
    if (!r.b) continue;
    const lines = wrap(String(r.b.text).toUpperCase(), Math.max(12, Math.floor(r.w / 9.2)));
    if (r.b.n != null) lines.push(String(r.b.n));
    items.push({ k: "poly", pts: r.b.kind === "store" ? cylinderish(r) : rect(r.x, r.y, r.w, r.h), fill: "paper", n: r.b.n });
    items.push({ k: "text", at: [r.x + r.w / 2, r.y + r.h / 2 - ((lines.length - 1) * 16) / 2 + 4.5], lines, size: 13, lh: 16, family: "sans", n: r.b.n });
  }
  for (const l of fig.links ?? []) {
    const A = boxes[l.from], B = boxes[l.to];
    if (!A || !B) throw new Error(`Link ${l.from} → ${l.to}: unknown block`);
    const pts = connect(A, B, Object.values(boxes).filter((r) => r.b && r !== A && r !== B), GX);
    items.push({ k: "arrow", pts, both: l.both, dash: l.dashed ? "dash" : null, none: l.plain });
    if (l.text) {
      const m = pts.length === 2 ? [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2] : pts[1];
      items.push({ k: "text", at: [m[0] + 8, m[1] - 6], lines: [String(l.text).toUpperCase()], size: 11, family: "sans", anchor: "start" });
    }
  }
  return { items, labels: [] };
}

function cylinderish(r) {
  // A data store: a box with curved top and bottom, the flowchart symbol for a database.
  const pts = [], e = Math.min(14, r.h * 0.18);
  for (let i = 0; i <= 16; i++) { const t = Math.PI - (i / 16) * Math.PI; pts.push([r.x + r.w / 2 + Math.cos(t) * r.w / 2, r.y + e - Math.sin(t) * e]); }
  for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI; pts.push([r.x + r.w / 2 + Math.cos(t) * r.w / 2, r.y + r.h - e + Math.sin(t) * e]); }
  return pts;
}

// Route a link; if the direct route crosses another block, go around it through the gap beside A.
function connect(A, B, others = [], gap = 70) {
  const direct = directRoute(A, B);
  if (!others.some((o) => hits(direct, o))) return direct;
  const right = B.x + B.w / 2 >= A.x + A.w / 2;
  const lane = right ? A.x + A.w + gap / 2 : A.x - gap / 2;
  const ay = A.y + A.h / 2, by = B.y + B.h / 2;
  const around = lane > B.x && lane < B.x + B.w
    ? [[right ? A.x + A.w : A.x, ay], [lane, ay], [lane, by > ay ? B.y : B.y + B.h]]
    : [[right ? A.x + A.w : A.x, ay], [lane, ay], [lane, by], [lane < B.x ? B.x : B.x + B.w, by]];
  if (!others.some((o) => hits(around, o))) return around;
  return direct;
}

function hits(pts, r) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (x1 > r.x + 1 && x0 < r.x + r.w - 1 && y1 > r.y + 1 && y0 < r.y + r.h - 1) return true;
  }
  return false;
}

function directRoute(A, B) {
  const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
  const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
  const inside = (P, Q) => P.x >= Q.x && P.y >= Q.y && P.x + P.w <= Q.x + Q.w && P.y + P.h <= Q.y + Q.h;
  if (inside(A, B) || inside(B, A)) {
    // A block linked to the group that contains it: drop straight down to the group's bottom edge.
    const [inner, outer] = inside(A, B) ? [A, B] : [B, A];
    const x = inner.x + inner.w / 2, pts = [[x, inner.y + inner.h], [x, outer.y + outer.h]];
    return inner === A ? pts : pts.reverse();
  }
  if (ox > 20) {
    const x = Math.max(A.x, B.x) + ox / 2;
    return B.y > A.y ? [[x, A.y + A.h], [x, B.y]] : [[x, A.y], [x, B.y + B.h]];
  }
  if (oy > 20) {
    const y = Math.max(A.y, B.y) + oy / 2;
    return B.x > A.x ? [[A.x + A.w, y], [B.x, y]] : [[A.x, y], [B.x + B.w, y]];
  }
  const down = B.y > A.y;
  const x0 = A.x + A.w / 2, y0 = down ? A.y + A.h : A.y, x1 = B.x + B.w / 2, y1 = down ? B.y : B.y + B.h;
  const my = (y0 + y1) / 2;
  return [[x0, y0], [x0, my], [x1, my], [x1, y1]];
}
