// Helpers passed to a spec module: `export default (kit) => ({ ... })`.
// Shapes return 2D outlines for `prism` parts; paths return 3D points for `tube` parts.

export const roundRect = (w, h, r, seg = 6) => {
  const pts = [], rr = Math.min(r, w / 2, h / 2);
  const C = [[w / 2 - rr, h / 2 - rr, 0], [-w / 2 + rr, h / 2 - rr, 90], [-w / 2 + rr, -h / 2 + rr, 180], [w / 2 - rr, -h / 2 + rr, 270]];
  for (const [cx, cy, a0] of C) for (let k = 0; k <= seg; k++) { const a = ((a0 + (k * 90) / seg) * Math.PI) / 180; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return pts;
};

export const circle = (r, n = 48, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);

export const regular = (n, r, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; });

export const star = (n, r1, r2, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, i) => { const a = rot + (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r2 : r1; return [Math.cos(a) * r, Math.sin(a) * r]; });

// A spur gear outline: `teeth` trapezoid teeth between root radius r and tip radius r + depth.
export const gear = (teeth, r, depth = r * 0.14) => {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, t = (Math.PI * 2) / teeth;
    for (const [da, rr] of [[0, r], [t * 0.18, r + depth], [t * 0.48, r + depth], [t * 0.66, r]]) pts.push([Math.cos(a + da) * rr, Math.sin(a + da) * rr]);
  }
  return pts;
};

// Cubic Bézier in 3D, sampled: handy for handles, cables and hoses.
export const bezier = (p0, p1, p2, p3, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return p0.map((_, k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
});

// An arc of radius r around center c in the plane spanned by unit vectors a and b.
export const arc3 = (c, r, a, b, from, to, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = ((from + ((to - from) * i) / n) * Math.PI) / 180;
  return c.map((v, k) => v + r * (Math.cos(t) * a[k] + Math.sin(t) * b[k]));
});

export const range = (n) => Array.from({ length: n }, (_, i) => i);
