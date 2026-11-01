---
name: patent-drawing
description: Turn any invention, product idea, gadget, app or system, real or ridiculous, into a set of vintage patent drawings. Produces black line-art sheets in the USPTO style, with shade lines, numbered reference callouts with lead lines, "FIG. 1" labels, exploded views, method flowcharts and system block diagrams, plus a front page with title, inventor, abstract and a reference-numeral list. Classic, vintage-paper and blueprint styles. Outputs an interactive HTML page, a print-ready PDF and PNG posters. Use when someone wants their idea "drawn as a patent", a patent-style illustration or poster, "patent art", a technical drawing of a product concept, a funny fake patent for a gift or a joke, or a visual explanation of how a system they built works, even if they never say "patent".
license: MIT
---

# Patent Drawing

The person describes a thing. You draw it the way a patent draftsperson in 1962 would have: white solids outlined in black ink, shade lines on the dark side, every part numbered with a curved lead line, figures labeled FIG. 1, FIG. 2, and a front page with an abstract written in deadpan legal prose. The same treatment works for a real product, a side project, a piece of software, or a self-stirring coffee mug.

`SKILL_DIR` is the folder this file is in. It needs Node 18+ and nothing else. Exporting the PDF and PNGs needs Chrome, Chromium, Edge or Brave.

## Workflow

### 1. Understand the invention (ask at most once)

You need: what it is, its main physical parts or software components, what it does step by step, and who the inventor is. If the request already gives you enough to draw something good, don't ask; make reasonable choices and mention them. If you only know a name ("a toaster that tweets"), invent sensible parts and say so.

### 2. Plan the figures

A good set is 3–5 figures. Pick from:

| Figure | When | Type |
|---|---|---|
| Perspective view of the whole thing | Anything physical. Always FIG. 1 | `device` |
| Exploded view | It has an interesting inside or assembles from parts | `device`, parts pulled apart along a `centerline` |
| A second view (from above, from behind, detail) | A key feature isn't visible in FIG. 1 | `device` with a different `view` |
| Method flowchart | It *does* something in steps | `flow` |
| System block diagram | It has electronics or software components | `blocks` |

Software with no physical form: draw the device it runs on (phone, laptop, server rack, watch) with its screen (`panel` with `lines` sketching the UI) as FIG. 1, then the system blocks and the method flow. This is exactly how real software patents look.

### 3. Number the parts like a patent

- The whole invention is `10` (or `100` in a system figure). Parts get even numbers in tens: 12, 14, 20, 22, 30…
- The same part keeps the same numeral in every figure.
- Flowchart steps are numbered by figure: FIG. 3 → 302, 304, 306. Blocks in FIG. 4 → 402, 404… unless the block *is* a part already numbered (then reuse it, e.g. the drive magnet stays 32).
- Give every numeral a `name`; the front page lists them and the viewer shows them on hover.

### 4. Write the spec

Write `patent-spec.mjs` in the person's working folder. It exports a function that receives the kit helpers and returns the document. The full format, with every part type and option, is in [`references/spec.md`](references/spec.md). Read it before writing your first spec. Two complete examples to copy from:

- [`examples/self-stirring-mug/spec.mjs`](examples/self-stirring-mug/spec.mjs): physical product. Cylinders, a tube handle, a button, an exploded view, a flowchart with a loop, a block diagram with a group.
- [`examples/code-wrapped/spec.mjs`](examples/code-wrapped/spec.mjs): software. A phone in a dock with a glass screen showing UI lines, a system diagram with data stores, a flowchart with two decisions.

Modeling rules that keep drawings clean:

- Millimetres, z up. Parts sit on their `at` point (bottom center).
- Build from a few honest solids. 6–15 parts per view is the sweet spot; patent drawings are simple.
- Parts are drawn far to near by their centers. Don't let solids intersect; put small parts *on* faces, not inside them. If a small part disappears, give it `layer: 1`.
- Use the default camera (azimuth 40°, elevation 28°) unless the key face would be hidden. For a screen, turn the camera toward it (the code-wrapped example uses azimuth 24°).
- Exploded view: same x and y, spread out along z with gaps, and a `centerline` through all of them.

### 5. Write the abstract

One paragraph, 80–150 words, present tense, plain and formal: "A beverage vessel (10) rests on a powered base (20). A magnet (32) in the base…". Put the numeral in parentheses after each part's first mention, and only use numerals that appear in the figures. No marketing words. For a funny invention, stay completely deadpan; the formal tone is the joke ("…and sound a short, triumphant chime").

### 6. Build, look, fix

```bash
node "$SKILL_DIR/scripts/build.mjs" patent-spec.mjs --out patent-out              # → patent-out/patent.html + sheets/*.svg
node "$SKILL_DIR/scripts/export.mjs" --dir patent-out --scale 1 --no-pdf          # quick PNGs to check
```

**Look at every sheet** (read the PNGs). Check:

- Each part reads as what it is. If something looks wrong, fix the geometry, not the renderer.
- No numeral or lead line sits on top of another, and each lead line lands on its own part. To fix one: `anchor: [x, y, z]` moves where it lands; `side: "left" | "right" | "top" | "bottom"` moves the numeral; `place: [dx, dy]` puts it at an exact offset (sheet units) from the anchor.
- Front-page text isn't cut off, and every numeral named in the abstract appears on a sheet.

Then export the finals in the style the person wants (`classic` is the USPTO look, `vintage` is aged paper for posters and gifts, `blueprint` is white on blue):

```bash
node "$SKILL_DIR/scripts/export.mjs" --dir patent-out --theme vintage   # → patent-vintage.pdf + png/sheet-N-vintage.png at 1700×2200
```

### 7. Hand it over

Say where `patent.html` (interactive: switch styles, hover a numeral to light up its part, print), the PDF and the PNGs are, which sheet makes the best poster (usually FIG. 1 in vintage), and mention one thing they might want to change.

## Honesty rules

- Never print "United States Patent", a USPTO seal, or a made-up patent or application number. The sheets say "Patent Drawing", and the footer says it's not a filed or issued patent. Keep that footer. If the person has a real patent or application number for this invention, they can put it in `ref`.
- If someone wants drawings to actually file, say plainly that these are illustrations: filing has formal drawing rules (37 CFR 1.84) and they should have a patent attorney or agent check them. The `classic` style is close to that look, not a guarantee of it.
- Don't draw a real company's product as if it were the person's invention, and don't put a real person's name on as inventor unless that's the person (or they said so).
