# azulejeria

Tin-glazed tiles painted by rule.

A seed grows a design in one square, symmetric across its diagonal. Lay
it as a quarter of a tile and the tile carries the whole motif. Lay it as
a whole tile and the motif only completes where four tiles meet, mirrored
or turned, so the wall reads at a scale no single tile has. Every line is
a polyline with a slow wobble along its normal, the way a loaded brush
drifts. Washes are laid thin twice so the glaze pools. Each tile gets its
own mottled glaze, a slight turn, a slight shift, and a few of them craze.

This package is the engine. You bring the motifs, the palettes and the
presets, and, if the tile is not glazed, a material. Three walls built on
it: [Azulejería](https://stepinto.dev/art/azulejeria.html) (Talavera
rosettes and Mudéjar strapwork), [Jerez](https://stepinto.dev/art/jerez.html)
(vines, horses and sherry) and [Hidráulico](https://stepinto.dev/art/hidraulico.html)
(pigmented cement, pressed rather than painted). Underneath the wall is a
viewer, a canvas you paint any world into, with the drag, the pinch, the
wheel and the page chrome; [Alicatado](https://stepinto.dev/art/alicatado.html)
(cut tile set in lime) is the viewer with its own paint. The design is
written up [here](https://stepinto.dev/posts/tiles-painted-by-rule/) and
[here](https://stepinto.dev/posts/cut-tile-and-poured-cement/).

```
npm install azulejeria
```

No dependencies. ES module. Browser only (it paints on canvas).

## A wall in forty lines

```html
<link rel="stylesheet" href="node_modules/azulejeria/src/azulejeria.css">
<canvas id="c"></canvas>
<script type="module">
import { createWall, mountPanel, PAINTERS, arcPts, ink } from 'azulejeria';

const palettes = {
  // glaze: the tin white. tint: the mottle in it. ink: the trace line.
  // wash: the main fill. accents: other glazes. grout: between tiles.
  talavera: { glaze: '#f3f1ea', tint: '#e2e5de', ink: '#1b3a7e', wash: '#2b5cab', accents: [], grout: '#b6b0a2' },
};

const motifs = {
  // grows a list of elements from a seeded context; each element names
  // a painter and carries its parameters. Corner (0,0) is the main
  // corner, (1,1) the far one, the edge midpoints are shared with the
  // neighbouring tile.
  rosette({ rng, density, bands, bold, pick, role, dots }) {
    const els = [{ t: 'fan', n: 2 + Math.floor(rng() * 3), r: (0.3 + rng() * 0.1) * bold, ...role() }];
    if (bands) els.push({ t: 'band', kind: pick(['circle', 'diamond']), w: 0.04, ...role() });
    if (density >= 4) els.push({ t: 'ring', r: 0.5 * bold, lobes: 7 });
    if (density >= 5) els.push(dots(3, 4, 0.55, 0.4, 0.85));
    return els;
  },
};

const painters = {
  ...PAINTERS,                    // band, ring, lattice, dots
  fan(el, b) {                    // petals out from the main corner
    for (let k = 0; k < el.n; k++) b.petal(0, 0, (k + 0.5) * b.Q / el.n, 0.08, el.r, 0.7, b.col);
    ink(b.g, arcPts(0, 0, 0.06, 0, b.Q, b.amp, b.rng), b.lw, b.pal, b.rng, false);
  },
};

const presets = {
  talavera: { seed: 71, repeat: 'module', pal: 'talavera', motif: 'rosette', density: 4, hand: 0.5, brush: 1, scale: 120, bands: true, age: false },
};

const wall = createWall(document.getElementById('c'), { palettes, motifs, painters, presets });
mountPanel(wall, { fileName: 'wall', defaultPreset: 'talavera' });
</script>
```

`mountPanel` is optional. Without it, `createWall` still fills the canvas,
pans on drag, zooms on pinch or wheel, and paints a new design on a double
tap. Drive it from your own controls through `wall.state` and
`wall.rebuild(true)`.

## The parts

**`createWall(canvas, { palettes, motifs, painters, presets, material })`** returns
the wall. `wall.state` holds `seed`, `repeat` (`module`, `rotate`,
`single` or `checker`), `pal`, `motif`, `density` (1 to 5), `hand` (0 to
1, how far the brush drifts), `brush` (line weight), `scale` (pixels per
tile), `panX`, `panY`, `bands`, `grout` and `age`. After changing any of
them call `wall.rebuild(true)` to repaint the tiles, or `wall.rebuild(false)`
for things the wall draws itself (pan, grout, age). `wall.applyPreset(name)`,
`wall.newDesign()` and `wall.zoomAt(x, y, factor)` do what they say. Set
`wall.onChange(kind)` to be told about them.

**A material** changes what the tile is made of without touching what is
drawn on it. It is an object of optional hooks, and without one the tile
is tin-glazed. `ampOf(hand)` turns the hand slider into a wobble
amplitude (glaze: `0.012 * hand`). `shape(g, pts, col, b)`,
`line(g, pts, lw, close, b)` and `dot(g, x, y, r, col, alpha, b)` replace
the brush's strokes, so a cement tile can fill flat and bleed at the edge
where glaze would wash and ink. `surface(g, S, pal, rng)` lays the ground
after the glaze colour is filled (the blooms of tint, or grain).
`plain(g, S, pal, rng, o)` paints the tile a checker alternates with.
`lay` is `{ shift, turn }`, how far a tile strays from its cell at hand
one (glaze: `0.014` of a tile and `0.016` radians). `gapOf(S, state)` is
the grout in pixels. `age(ctx, t)` is drawn over each tile in its own
frame when age is on, with `t` carrying `i`, `j`, the tile's `rng`, its
drawn size `s`, the cell size `S`, `pal`, `state` and the tile's world
centre `cx`, `cy`, so wear can follow the line people walk. `finish(ctx,
W, H, state, pal)` is drawn over the whole wall last. None of the hooks
read the design's rng, so a material never moves a design.

**`mountPanel(wall, { fileName, defaultPreset })`** wires the standard
panel for a wall. It is `mountChrome` (below) with the wall's controls,
which are a handful of elements found by id: selects `repeat`,
`motif` and `palette`; ranges `density`, `hand`, `brush` and `zoom` with
`densityVal`, `handVal`, `brushVal` and `zoomVal` spans beside them;
checkboxes `bands`, `grout` and `age`; buttons `newDesign` and `save`;
a `mood` line for the seed; `.card[data-preset]` cards each holding a
canvas for a thumbnail; `.tab[data-tab]` buttons switching `presetsBody`
and `panelBody`; `panel` with `panelHead` and `panelToggle`; and a `title`
overlay that fades on first touch. Anything missing is skipped. It also
reads the query string, so `?preset=talavera` or
`?seed=4242&repeat=rotate&pal=talavera&motif=rosette&density=5&age=1` is a
shareable wall. Copy the markup from either of the two pages above.

**`createViewer(canvas, { paint, scale, minZoom, maxZoom, margin })`**
is what a wall is built on, and what any other world can be. `paint(g,
state, w, h, dpr, ox, oy)` paints the world into `g`, `w` by `h` css
pixels at `dpr`, with the world's origin at `(ox, oy)`. The viewer fills
the window, pans on drag, zooms on pinch or wheel, and calls
`onDoubleTap()` on a double tap. With a `margin` it paints into a buffer
that much larger than the window and only blits while you drag, which is
what a slow paint wants. `viewer.state` has `scale`, `panX` and `panY`;
add your own fields to it. Call `viewer.repaint()` when the world
changes and `viewer.moved()` when only the pan did.

**`mountChrome(viewer, spec)`** wires the same chrome around any viewer:
the panel, the tabs, the preset cards, the title that fades, the save
button, the query string. The spec names the presets, `applyPreset(name)`,
`thumb(ctx, settings)` to paint a card, and the `controls`: a list of
`{ id, key, q, kind, fmt, valId, keep, change }`, where `kind` is
`select`, `range` or `check`, `key` is the field of `viewer.state` (the
id by default), `q` its name in the query string (the key by default),
`fmt` renders a range's value beside it, `keep` leaves the preset marked
when the query string sets it, and `change(value)` is what to do after.
Then `newId` and `onNew` for the button that starts over, `mood(state)`
for the line under it, `query(q)` for anything else in the query string,
`fileName` and `suffix(state)` for the saved png, and `ready()` once
everything is applied. Alicatado is the worked example.

**`azulejeria.css`** styles that markup. Colour it with the custom
properties at the top of the file: `--az-bg`, `--az-title`,
`--az-whisper`, `--az-hint`, `--az-glow`, `--az-glow-far`, `--az-panel`,
`--az-card`, `--az-card-on`, `--az-field`, `--az-accent` and
`--az-accent-soft`.

**A motif** is `(ctx) => elements`. The context has `rng` (seeded, so the
same seed always grows the same design), `density`, `bands`, `bold`
(1.35 when the design fills a whole tile, so the motif can be drawn
larger), `pick(list)`, `role()` (wash, or one of the accents, as the
palette allows) and `dots(kMin, kSpan, x0, xSpan, yk)` for the scatter
that the highest density adds. Read the rng in the same order every time
and the design is reproducible.

**A painter** is `(el, b) => void`. `b` is the brush for the design:
`g` (a 2D context scaled to the unit square), `pal`, `lw`, `amp`, `rng`,
`col` (the element's role resolved to a colour), `Q` (a quarter turn),
`D` (the diagonal) with `dc` and `ds`, and the strokes `shape(pts, col)`
(wash then ink), `dot(x, y, r, col, alpha)`, `petal(cx, cy, ang, rIn, rOut, wd, col)`,
`kite(...)` (the same with straight sides), `lobes(cx, cy, r, a0, a1, n)`
and `altOf(el)` (the next accent along). The geometry helpers are
exported too: `arcPts`, `linePts`, `petalPts`, `kitePts`, `strapPts`,
`polyPts`, each taking the wobble amplitude and rng, and `trace`, `ink`,
`wash` to put them on the canvas.

**The four painters that ship** are `band` (a quarter circle or straight
edge across the far corner, which four tiles close into a ring or a
diamond), `ring` (a scalloped ring around the main corner), `lattice` (a
line edge to edge that mirrors into a lozenge net) and `dots`.

**The lower level** is there if you want it: `makeDesign(seed, density,
bands, bold, motif)`, `paintDesign(g, els, pal, hand, lw, seed, painters)`,
`makeTile(opts, size, pixelRatio, seed)`, `tileOpts(cfg, state)` and
`paintThumb(cfg, preset, g, size, pixelRatio)`.

## Licence

MIT.
