# Spec format

A spec is an ES module whose default export is a function. It receives the kit helpers and returns the document:

```js
export default ({ roundRect, circle, regular, star, gear, bezier, arc3, range }) => ({
  title: "Self-stirring beverage vessel",
  figures: [ /* … */ ],
});
```

A plain `.json` file with the same object also works (no helpers then).

## Document

| Key | Meaning |
|---|---|
| `title` | Required. Written like a patent title: "System and method for…", "Apparatus for…". |
| `inventor` / `inventors` | One name or a list. The first surname goes in the front-page header. |
| `date` | `YYYY-MM-DD`. Defaults to today. |
| `abstract` | One paragraph with numerals in parentheses. |
| `field`, `assignee`, `filed` | Optional front-page fields (51), (73), (22). |
| `theme` | `classic` (default), `vintage` or `blueprint`. `--theme` on the command line overrides it. |
| `numerals` | `{ 24: "Temperature sensor" }`: names for numerals not named on a part. |
| `representative` | Which figure id appears on the front page (default: the first). |
| `header` | Text at the top left of drawing sheets (default "Patent Drawing"). |
| `ref` | A real patent or application number, only if the person has one. Never invent one. |
| `frontPage` | `false` to skip the front page. |
| `kind`, `footer` | Override the front-page heading and footer. Keep the footer's meaning: not a filed or issued patent. |

## Figures

Every figure has an `id` (its FIG. number, default: position). Figures with the same `sheet` value share a sheet (stacked); others get one sheet each. `maxScale` caps how large a figure is drawn. `labelAt: "right"` moves the FIG. label to the right.

### `device` (default type): 3D line art

```js
{ id: 1, view: { azimuth: 40, elevation: 28 }, parts: [ … ], labels: [ … ] }
```

The camera looks from `azimuth` degrees around z (0 = from +x, 90 = from +y) and `elevation` degrees up. The front of the drawing faces the viewer; screen-right is `[sin(az), −cos(az), 0]` and toward the viewer is `[cos(az), sin(az), 0]`. The mug example computes both, so handles and buttons end up where you want them.

Every part takes `n` (numeral), `name`, and optionally `anchor: [x, y, z]` (where the lead line lands), `side` / `place` (numeral position, see below), `whole: true` (the lead ends in an arrowhead: "the whole assembly") and `layer` (draw above parts with a lower layer).

| Type | Keys | Notes |
|---|---|---|
| `box` | `at` (bottom center), `size: [w, d, h]`, `panel` / `panels` | Shaded faces get hatching. |
| ↳ `panel` | `face: "+x" \| "-x" \| "+y" \| "-y" \| "+z"`, `inset` (number or `[u, w]`), or `size: [w, h]` + `offset: [u, w]`, `round`, `glass: true` (reflection strokes), `hatch`, `lines` | A screen, window, plate or button on a box face. `lines` are polylines in the panel's own −1…1 space (u right, w up): text rows, a chart, an icon. |
| `cylinder` | `at` (base center), `r`, `h`, `axis: "x" \| "y" \| "z"` or a vector, `r2` (top radius → cone frustum), `hole` (hollow visible end, e.g. a mug), `rings: [r…]` (circles on the visible end), `capHatch`, `shade: false` | Shade lines pack toward the dark side automatically. |
| `prism` | `shape` (2D outline), `plane: "xz" \| "yz" \| "xy"`, `depth`, `at` | Any outline extruded. `xz` and `yz` are upright and centered on `at`; `xy` lies flat and rises from `at.z`. Shapes with more than 12 points are treated as curved (no facet edges). |
| `sphere` | `at` (center), `r` | |
| `tube` | `points` (3D), `r` | Handles, cables, hoses, pipes. Use `bezier()` or `arc3()` for the points. |
| `poly` | `points` (3D, flat), `fill: "paper" \| "ink"`, `hatch` (true or an angle), `gap` | Stickers, slots, buttons drawn flat on a surface. |
| `line` | `points`, `weight: "line" \| "thin" \| "shade"`, `dash`, `smooth` | Seams, grooves, edges. |
| `centerline` | `from`, `to` | Dash-dot axis for exploded views and rotation. |
| `arrow` | `from`, `to`, or `points`, `via`, `both` | Motion: drawn on top. `arc3()` makes a rotation arrow. |

`labels: [{ n, name, at: [x, y, z] }]` points a numeral at any spot without a part, like a screen region or a surface.

### `flow`: method flowchart

```js
{ id: 3, type: "flow", steps: [
  { kind: "start", text: "Start" },
  { n: 302, text: "Detect vessel placed on base" },
  { n: 308, kind: "decision", text: "Sugar dissolved?", no: 306 },
  { kind: "end", text: "End" },
  { n: 312, text: "Remove card", next: 314 },
] }
```

Steps run top to bottom. `kind`: `start`, `end`, `step` (default), `decision`, `io` (parallelogram). A decision continues down on YES (or jumps to `yes: n`) and loops to `no: n` along the right. A step after `end` can rejoin with `next: n`. Text is set in capitals automatically.

### `blocks`: system block diagram

```js
{ id: 4, type: "blocks",
  blocks: [{ id: "mcu", n: 402, text: "Controller", row: 0, col: 1, span: 1, kind: "store" }],
  groups: [{ id: "base", n: 20, text: "Powered base", contains: ["mcu", …], dashed: false }],
  links:  [{ from: "temp", to: "mcu", both: false, dashed: false, plain: false, text: "wireless" }] }
```

Blocks sit on a grid (`row`, `col`, `span` columns wide). `kind: "store"` draws a data-store cylinder. A group draws a box around its blocks with its name and numeral. Links route straight when blocks line up, as an elbow otherwise, and around any block in the way. Links can point at groups too.

### `svg`: anything else

```js
{ id: 5, type: "svg", width: 400, height: 300, svg: "<path d='…' fill='none'/>", labels: [{ n: 50, at: [120, 80] }] }
```

Raw SVG drawn in the ink style (strokes stay 1.5 wide however it's scaled). Use `class="paper"` for white fills. Label `at` is in the SVG's own units.

## Placing numerals

Numerals go left or right of the drawing (above and below for very wide figures), level with their part, spaced at least 27 units apart. Override per part or label:

- `anchor: [x, y, z]` changes where the lead lands.
- `side: "left" | "right" | "top" | "bottom"` forces a side.
- `place: [dx, dy]` puts the numeral at an exact offset from the anchor, in sheet units (the sheet is 850 × 1100).

## Helpers

| Helper | Returns |
|---|---|
| `roundRect(w, h, r)` | 2D rounded rectangle centered on 0 |
| `circle(r, n, cx, cy)` | 2D circle as n points |
| `regular(n, r, rot)` | 2D regular polygon |
| `star(n, r1, r2)` | 2D star |
| `gear(teeth, r, depth)` | 2D spur-gear outline |
| `bezier(p0, p1, p2, p3, n)` | 3D cubic Bézier points (handles, cables) |
| `arc3(c, r, a, b, fromDeg, toDeg, n)` | 3D arc around `c` in the plane of unit vectors `a`, `b` |
| `range(n)` | `[0 … n−1]` |
