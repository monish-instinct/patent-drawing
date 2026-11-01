// Small vector, camera and 2D helpers shared by the figure renderers.

export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map((v) => v * k);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(...a);
export const norm = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
export const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const D2R = Math.PI / 180;

// Orthographic camera looking from (azimuth, elevation). Screen y points down.
export function camera(view = {}) {
  const az = (view.azimuth ?? 40) * D2R, el = (view.elevation ?? 28) * D2R;
  const v = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  const right = norm([Math.sin(az), -Math.cos(az), 0]);
  const up = norm(cross(right, v));
  // Patent convention: light falls from the upper left, slightly in front.
  const light = norm(add(add(mul(up, 1), mul(v, 0.7)), mul(right, -1)));
  return {
    v, right, up, light,
    // How far a surface turns toward the shadow side (right and down on screen), the
    // patent-drawing convention for where shade lines go.
    dark: (n) => dot(n, right) * 0.8 - dot(n, up) * 0.6,
    project: (p) => [dot(p, right), -dot(p, up)],
    depth: (p) => dot(p, v),
  };
}

export function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && crossZ(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && crossZ(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function bbox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}

// Catmull-Rom through the points, as an SVG path.
export function smoothPath(pts, closed = false) {
  if (pts.length < 3) return "M" + pts.map((p) => p.map(f).join(" ")).join(" L");
  const P = closed ? [pts.at(-1), ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts.at(-1)];
  let d = `M${f(P[1][0])} ${f(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

export const f = (x) => (Math.round(x * 100) / 100).toString();

export function wrap(text, max) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && (line + " " + word).length > max) { out.push(line); line = word; }
      else line = line ? line + " " + word : word;
    }
    out.push(line);
  }
  return out;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
