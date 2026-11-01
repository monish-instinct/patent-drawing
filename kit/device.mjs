// Turns 3D parts into patent-style line art: white-filled solids drawn back to front,
// shade lines on the dark side, glass reflections, tubes, centerlines and arrows.
// Output is a list of "units" (one per part) holding 2D items in projected world units.
import { add, sub, mul, dot, cross, norm, lerp, camera, hull, signedArea } from "./geometry.mjs";

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

export function deviceFigure(fig) {
  const cam = camera(fig.view);
  const units = [];
  const parts = (fig.parts ?? []).flat(Infinity).filter(Boolean);
  for (const part of parts) {
    const make = PRIMITIVES[part.type];
    if (!make) throw new Error(`Unknown part type "${part.type}" in FIG. ${fig.id}`);
    const unit = make(part, cam);
    unit.n = part.n; unit.name = part.name; unit.whole = part.whole; unit.side = part.side; unit.place = part.place;
    unit.layer = part.layer ?? 0;
    if (part.anchor) unit.anchor = cam.project(part.anchor);
    units.push(unit);
  }
  units.sort((a, b) => a.layer - b.layer || a.depth - b.depth);
  const extra = (fig.labels ?? []).map((l) => ({ n: l.n, name: l.name, whole: l.whole, side: l.side, place: l.place, anchor: cam.project(l.at), items: [] }));
  return { units, labels: [...units.filter((u) => u.n != null), ...extra] };
}

// Shade a flat face by how much it turns away from the light.
function faceShade(n, cam) {
  // Faces turned toward the viewer stay light even on the shadow side.
  const s = cam.dark(n) * Math.sqrt(Math.max(0, 1 - Math.max(0, dot(n, cam.v))));
  if (s < 0.12) return null;
  return { gap: s > 0.45 ? 4.2 : s > 0.26 ? 6.5 : 10 };
}

// The hatch runs along the face's most vertical edge on screen, so walls get vertical lines.
function hatchAngle(n, cam) {
  const t = Math.abs(n[2]) > 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 0, 1]);
  const a = cam.project(t), o = cam.project([0, 0, 0]);
  return Math.atan2(a[1] - o[1], a[0] - o[0]) * 180 / Math.PI;
}

function polyFaces(faces, cam, opt = {}) {
  const items = [];
  const visible = faces.filter((fc) => dot(fc.n, cam.v) > 1e-6)
    .map((fc) => ({ ...fc, d: cam.depth(fc.pts.reduce((s, p) => add(s, p), [0, 0, 0]).map((x) => x / fc.pts.length)) }))
    // A face marked `last` (a prism's near cap) can't be hidden by its own sides, so it goes on top.
    .sort((a, b) => (a.last ? 1 : 0) - (b.last ? 1 : 0) || a.d - b.d);
  for (const fc of visible) {
    const shade = opt.shade === false ? null : faceShade(fc.n, cam);
    items.push({ k: "poly", pts: fc.pts.map(cam.project), fill: opt.fill ?? "paper",
      hatch: shade && { angle: hatchAngle(fc.n, cam), gap: shade.gap } });
  }
  return { items, visible };
}

function boxFaces(at, size) {
  const [x, y, z] = at, [w, d, h] = size;
  const c = (dx, dy, dz) => [x + dx * w / 2, y + dy * d / 2, z + h / 2 + dz * h / 2];
  const F = (n, u, wv, hu, hw, center) => ({ n, u, w: wv, hu, hw, c: center });
  const faces = {
    "+x": F([1, 0, 0], [0, 1, 0], [0, 0, 1], d / 2, h / 2, c(1, 0, 0)),
    "-x": F([-1, 0, 0], [0, -1, 0], [0, 0, 1], d / 2, h / 2, c(-1, 0, 0)),
    "+y": F([0, 1, 0], [-1, 0, 0], [0, 0, 1], w / 2, h / 2, c(0, 1, 0)),
    "-y": F([0, -1, 0], [1, 0, 0], [0, 0, 1], w / 2, h / 2, c(0, -1, 0)),
    "+z": F([0, 0, 1], [1, 0, 0], [0, 1, 0], w / 2, d / 2, c(0, 0, 1)),
    "-z": F([0, 0, -1], [1, 0, 0], [0, -1, 0], w / 2, d / 2, c(0, 0, -1)),
  };
  for (const fc of Object.values(faces)) fc.pts = corners(fc, 1, 1);
  return faces;
}

const corners = (fc, su, sw) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
  add(add(fc.c, mul(fc.u, a * fc.hu * su)), mul(fc.w, b * fc.hw * sw)));

// A screen, window, label plate or button drawn on one face of a box.
function panel(fc, p, cam) {
  const items = [];
  if (dot(fc.n, cam.v) <= 1e-6) return items;
  const lift = mul(fc.n, 0.01);
  const insetU = Array.isArray(p.inset) ? p.inset[0] : p.inset ?? Math.min(fc.hu, fc.hw) * 0.12;
  const insetW = Array.isArray(p.inset) ? p.inset[1] : insetU;
  const off = p.offset ?? [0, 0];
  const su = p.size ? p.size[0] / 2 / fc.hu : (fc.hu - insetU) / fc.hu;
  const sw = p.size ? p.size[1] / 2 / fc.hw : (fc.hw - insetW) / fc.hw;
  const g = { ...fc, c: add(add(add(fc.c, lift), mul(fc.u, off[0])), mul(fc.w, off[1])) };
  // Orient u to screen-right and w to screen-up so reflections always lean the same way.
  const o = cam.project(g.c), pu = cam.project(add(g.c, g.u)), pw = cam.project(add(g.c, g.w));
  if (pu[0] < o[0]) g.u = mul(g.u, -1);
  if (pw[1] > o[1] && Math.abs(fc.n[2]) > 0.9) g.w = mul(g.w, -1);
  const shape = p.round ? roundedFace(g, su, sw, p.round) : corners(g, su, sw);
  items.push({ k: "poly", pts: shape.map(cam.project), fill: p.fill ?? "paper",
    hatch: p.hatch ? { angle: p.hatch === true ? 45 : p.hatch, gap: p.gap ?? 6 } : null });
  if (p.glass) {
    for (let i = 0; i < 3; i++) {
      const at = (u, w) => add(add(g.c, mul(g.u, u * g.hu * su)), mul(g.w, w * g.hw * sw));
      // Reflection strokes are sized by the panel's short side, so tall screens don't get long scratches.
      const m = Math.min(g.hu * su, g.hw * sw), ku = m / (g.hu * su), kw = m / (g.hw * sw);
      const L = i === 1 ? 0.62 : 0.4, u0 = -1 + ku * (0.3 + i * 0.2), w0 = 1 - kw * (0.95 + (i === 1 ? 0.1 : 0));
      items.push({ k: "line", pts: [at(u0, w0), at(u0 + L * 0.55 * ku, w0 + L * kw)].map(cam.project), w: "thin" });
    }
  }
  for (const line of p.lines ?? []) {
    // Content lines (text rows, a chart) in the panel's -1..1 space.
    const at = (u, w) => add(add(g.c, mul(g.u, u * g.hu * su)), mul(g.w, w * g.hw * sw));
    items.push({ k: "line", pts: line.map(([u, w]) => cam.project(at(u, w))), w: "thin" });
  }
  return items;
}

function roundedFace(g, su, sw, r) {
  const pts = [];
  const hu = g.hu * su, hw = g.hw * sw, rr = Math.min(r, hu, hw);
  const corner = [[hu - rr, hw - rr, 0], [-hu + rr, hw - rr, 90], [-hu + rr, -hw + rr, 180], [hu - rr, -hw + rr, 270]];
  for (const [cu, cw, a0] of corner) for (let k = 0; k <= 6; k++) {
    const a = (a0 + k * 15) * Math.PI / 180;
    pts.push(add(add(g.c, mul(g.u, cu + Math.cos(a) * rr)), mul(g.w, cw + Math.sin(a) * rr)));
  }
  return pts;
}

function axisBasis(axis) {
  const A = norm(typeof axis === "string" ? AXES[axis] : axis ?? AXES.z);
  const ref = Math.abs(A[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const P = norm(cross(A, ref)), Q = cross(A, P);
  return { A, P, Q };
}

const PRIMITIVES = {
  // A box sitting on `at` (center of its bottom face), size [w, d, h].
  box(p, cam) {
    const faces = boxFaces(p.at ?? [0, 0, 0], p.size);
    const { items } = polyFaces(Object.values(faces), cam, p);
    for (const pn of [p.panel, ...(p.panels ?? [])].filter(Boolean)) items.push(...panel(faces[pn.face ?? "-y"], pn, cam));
    const front = Object.values(faces).filter((fc) => dot(fc.n, cam.v) > 0).sort((a, b) => dot(b.n, cam.v) - dot(a.n, cam.v))[0];
    const center = add(p.at ?? [0, 0, 0], [0, 0, p.size[2] / 2]);
    // Anchor on the frame near one side of the front face, clear of any screen or panel.
    const edge = lerp(front.pts[1], front.pts[2], 0.5);
    return { items, depth: cam.depth(center), anchor: cam.project(lerp(front.c, edge, p.panel || p.panels ? 0.94 : 0.55)) };
  },

  // A 2D outline extruded into a solid. plane "xz" extrudes along y, "yz" along x (both centered),
  // "xy" lies flat and extrudes up from at.z.
  prism(p, cam) {
    const plane = p.plane ?? "xz", depth = p.depth ?? 10, at = p.at ?? [0, 0, 0];
    const B = { xz: [AXES.x, AXES.z, AXES.y], yz: [AXES.y, AXES.z, AXES.x], xy: [AXES.x, AXES.y, AXES.z] }[plane];
    const [U, W, N] = B;
    let shape = p.shape;
    if (signedArea(shape) < 0) shape = [...shape].reverse();
    const z0 = plane === "xy" ? 0 : -depth / 2, z1 = z0 + depth;
    const to3 = ([u, w], t) => add(add(add(at, mul(U, u)), mul(W, w)), mul(N, t));
    const front = shape.map((q) => to3(q, z0)), back = shape.map((q) => to3(q, z1));
    const faces = [{ n: mul(N, -1), pts: front, last: true }, { n: N, pts: back, last: true }];
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i], b = shape[(i + 1) % shape.length];
      const n2 = norm([b[1] - a[1], -(b[0] - a[0])]);
      faces.push({ n: norm(add(mul(U, n2[0]), mul(W, n2[1]))), pts: [front[i], front[(i + 1) % shape.length], back[(i + 1) % shape.length], back[i]] });
    }
    // Curved outlines are many thin faces; drawing each edge would look like a cage, so
    // silhouette-merge them: fill all visible faces, then outline only the caps and the hull.
    const smooth = shape.length > 12;
    const { items, visible } = polyFaces(faces, cam, { ...p, shade: smooth ? false : p.shade });
    if (smooth) {
      for (const it of items) it.stroke = false;
      items.push({ k: "poly", pts: hull([...front, ...back].map(cam.project)), fill: "none" });
      const cap = dot(N, cam.v) > 0 ? back : front;
      items.push({ k: "poly", pts: cap.map(cam.project), fill: "none" });
    }
    const mid = add(at, mul(N, (z0 + z1) / 2));
    const best = visible.sort((a, b) => dot(b.n, cam.v) - dot(a.n, cam.v))[0];
    const anchorPt = best ? best.pts.reduce((s, q) => add(s, q), [0, 0, 0]).map((x) => x / best.pts.length) : mid;
    return { items, depth: cam.depth(mid), anchor: cam.project(anchorPt) };
  },

  // A cylinder (or cone frustum with r2) standing on `at` along `axis`, height h. `hole` hollows the visible end.
  cylinder(p, cam) {
    const { A, P, Q } = axisBasis(p.axis);
    const at = p.at ?? [0, 0, 0], r1 = p.r, r2 = p.r2 ?? p.r, h = p.h;
    const c0 = at, c1 = add(at, mul(A, h));
    const N = 72;
    const ring = (c, r) => Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return add(c, add(mul(P, Math.cos(t) * r), mul(Q, Math.sin(t) * r))); });
    const R0 = ring(c0, r1), R1 = ring(c1, r2);
    const items = [{ k: "poly", pts: hull([...R0, ...R1].map(cam.project)), fill: p.fill ?? "paper" }];
    const facing = dot(A, cam.v);
    const capC = facing >= 0 ? c1 : c0, capR = facing >= 0 ? r2 : r1;
    if (Math.abs(facing) > 0.03) {
      items.push({ k: "poly", pts: (facing >= 0 ? R1 : R0).map(cam.project), fill: p.capFill ?? "paper",
        hatch: p.capHatch ? { angle: 45, gap: 6 } : null });
      if (p.hole) {
        const inner = ring(capC, p.hole).map(cam.project);
        items.push({ k: "poly", pts: inner, fill: "paper", hatch: p.holeShade === false ? null : { angle: 90, gap: 5, crescent: true } });
      }
      for (const rr of p.rings ?? []) items.push({ k: "poly", pts: ring(capC, rr).map(cam.project), fill: "none", w: "thin" });
    }
    // Shade lines run along the side, packed toward the dark silhouette.
    if (p.shade !== false) {
      const vis = [];
      for (let i = 0; i < 360; i++) {
        const t = (i * Math.PI) / 180, nrm = add(mul(P, Math.cos(t)), mul(Q, Math.sin(t)));
        if (dot(nrm, cam.v) > 0.02) vis.push({ t, b: -cam.dark(nrm) });
      }
      if (vis.length) {
        // Find the visible arc's two ends (it may wrap around 0).
        let start = 0;
        for (let i = 0; i < vis.length; i++) if (i > 0 && vis[i].t - vis[i - 1].t > 0.05) start = i;
        const arc = [...vis.slice(start), ...vis.slice(0, start)].map((x, i, a) => ({ ...x, t: i && x.t < a[0].t ? x.t + 2 * Math.PI : x.t }));
        const ta = arc[0].t, tb = arc.at(-1).t, darkEnd = arc[0].b < arc.at(-1).b ? 0 : 1;
        const span = tb - ta;
        for (let k = 1; k <= 11; k++) {
          const frac = 0.012 * Math.pow(k, 1.7);
          if (frac > 0.42) break;
          const t = darkEnd === 0 ? ta + span * frac : tb - span * frac;
          const at0 = add(c0, add(mul(P, Math.cos(t) * r1), mul(Q, Math.sin(t) * r1)));
          const at1 = add(c1, add(mul(P, Math.cos(t) * r2), mul(Q, Math.sin(t) * r2)));
          items.push({ k: "line", pts: [cam.project(at0), cam.project(at1)], w: "shade" });
        }
      }
    }
    // Anchor: the side point that faces the viewer most, at mid height.
    let best = 0, bt = 0;
    for (let i = 0; i < 72; i++) { const t = (i / 72) * Math.PI * 2, d = dot(add(mul(P, Math.cos(t)), mul(Q, Math.sin(t))), cam.v); if (d > best) { best = d; bt = t; } }
    // Point a little off the front center (toward the lit side), where buttons and labels rarely sit.
    const ta = bt + (cam.dark(add(mul(P, Math.cos(bt + 0.6)), mul(Q, Math.sin(bt + 0.6)))) < cam.dark(add(mul(P, Math.cos(bt - 0.6)), mul(Q, Math.sin(bt - 0.6)))) ? 0.6 : -0.6);
    const mid = add(lerp(c0, c1, 0.62), add(mul(P, Math.cos(ta) * (r1 + r2) / 2), mul(Q, Math.sin(ta) * (r1 + r2) / 2)));
    return { items, depth: cam.depth(lerp(c0, c1, 0.5)), anchor: cam.project(mid) };
  },

  sphere(p, cam) {
    const c = cam.project(p.at), r = p.r;
    const circle = Array.from({ length: 72 }, (_, i) => [c[0] + Math.cos(i * Math.PI / 36) * r, c[1] + Math.sin(i * Math.PI / 36) * r]);
    const items = [{ k: "poly", pts: circle, fill: "paper" }];
    if (p.shade !== false) for (let k = 1; k <= 4; k++) {
      const rr = r * (1 - k * 0.075), a0 = (5 + k * 6) * Math.PI / 180, a1 = (95 - k * 6) * Math.PI / 180;
      const arc = Array.from({ length: 16 }, (_, i) => { const a = a0 + (a1 - a0) * i / 15; return [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]; });
      items.push({ k: "line", pts: arc, w: "shade", smooth: true });
    }
    return { items, depth: cam.depth(p.at), anchor: [c[0] - r * 0.35, c[1] - r * 0.2] };
  },

  // A cable, pipe or handle of radius r through 3D points (smoothed).
  tube(p, cam) {
    const pts = p.points.map(cam.project);
    const mid = p.points[Math.floor(p.points.length / 2)];
    return { items: [{ k: "tube", pts, r: p.r }], depth: cam.depth(p.depthAt ?? mid), anchor: cam.project(mid) };
  },

  // A flat polygon in 3D: a button, a slot, a sticker.
  poly(p, cam) {
    const center = p.points.reduce((s, q) => add(s, q), [0, 0, 0]).map((x) => x / p.points.length);
    return { items: [{ k: "poly", pts: p.points.map(cam.project), fill: p.fill ?? "paper", hatch: p.hatch ? { angle: p.hatch === true ? 45 : p.hatch, gap: p.gap ?? 5 } : null, smooth: p.smooth }],
      depth: cam.depth(center) + (p.lift ?? 0.01), anchor: cam.project(center) };
  },

  line(p, cam) {
    const pts = p.points.map(cam.project);
    return { items: [{ k: "line", pts, w: p.weight ?? "line", dash: p.dash, smooth: p.smooth }], depth: cam.depth(p.points[0]) + 1e6 * (p.front ? 1 : 0), anchor: pts[Math.floor(pts.length / 2)] };
  },

  // Dash-dot axis line, the patent convention for exploded views and rotation axes.
  centerline(p, cam) {
    return { items: [{ k: "line", pts: [cam.project(p.from), cam.project(p.to)], w: "thin", dash: "centerline" }], depth: -1e9, anchor: cam.project(lerp(p.from, p.to, 0.5)) };
  },

  // Motion arrow. With `curve` it bends sideways (a rotation hint).
  arrow(p, cam) {
    let pts = p.points ?? [p.from, p.to];
    if (p.via) pts = [p.from, p.via, p.to];
    const pr = pts.map(cam.project);
    return { items: [{ k: "arrow", pts: pr, smooth: pts.length > 2, both: p.both }], depth: 1e9, anchor: pr[Math.floor(pr.length / 2)] };
  },
};

export const PART_TYPES = Object.keys(PRIMITIVES);
