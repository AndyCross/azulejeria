# azulejeria

Tin-glazed tiles painted by rule.

A seed grows a design in one square, symmetric across its diagonal. Lay
it as a quarter of a tile and the tile carries the whole motif. Lay it as
a whole tile and the motif only completes where four tiles meet, mirrored
or turned, so the wall reads at a scale no single tile has. Every line is
a polyline with a slow wobble along its normal, the way a loaded brush
drifts. Washes are laid thin twice so the glaze pools. Each tile gets its
own mottled glaze, a slight turn, a slight shift, and a few of them craze.

This package is the engine. It started as that one wall and is now a
small kit for pattern made by rule and painted to look like a material.
You bring the motifs, the palettes and the presets, and, if the tile is
not glazed, a material.

## What is in it

| Import | What it is | Section |
|---|---|---|
| `azulejeria` | The tile wall, the viewer it is built on, the panel and page chrome, the brush and its geometry, corner tiles for borders, one tile at print size | A wall in forty lines, The parts, Print |
| `azulejeria/pieces` | The cutter: a polygon inset, shifted, turned and bevelled, and a Voronoi for things that are broken | Pieces |
| `azulejeria/groups` | The seventeen wallpaper groups as a way to lay any tile | Groups |
| `azulejeria/friezes` | The seven frieze groups, for a border, and a frieze on squared paper | Friezes |
| `azulejeria/knots` | Interlace on a grid: over and under by parity, breaks, cuts and beasts | Knots |
| `azulejeria/draw` | A tile drawn by hand, one eighth of it, carried in a string | Draw |
| `azulejeria/shadow` | A sun that goes round and the shadows it casts | Shadow |
| `azulejeria/loom` | Weaving drafts, setts and the cloth they make | Loom |
| `azulejeria/knit` | Charted knitting: bands, Fair Isle's two rules, and every stitch as its V | Knit |
| `azulejeria/azulejeria.css` | The styles for the panel, the cards, the title and the pad | The parts |

Each module stands alone except `draw`, which paints with the wall's
brush. `knots`, `groups`, `friezes`, `pieces`, `shadow`, `loom` and `knit`
draw on any 2D context.

## Built on it

Tile walls (`createWall`):
[Azulejería](https://stepinto.dev/art/azulejeria.html) (Talavera rosettes and Mudéjar strapwork),
[Jerez](https://stepinto.dev/art/jerez.html) (vines, horses and sherry),
[Hidráulico](https://stepinto.dev/art/hidraulico.html) (pigmented cement, pressed and not painted),
[Delft](https://stepinto.dev/art/delft.html) (a figure in the middle of every tile),
[Fajalauza](https://stepinto.dev/art/fajalauza.html) (Granada's green and blue on cream),
[Rosa y Granada](https://stepinto.dev/art/rosaygranada.html) and
[Encaustic](https://stepinto.dev/art/encaustic.html) (clay inlaid in clay, medieval and Victorian),
[Papel Pintado](https://stepinto.dev/art/papelpintado.html) (block-printed paper laid by any of the seventeen groups) and
[Octavo](https://stepinto.dev/art/octavo.html) (you draw one eighth of the tile and the wall paints the rest).

Other worlds on the viewer (`createViewer`):
[Alicatado](https://stepinto.dev/art/alicatado.html) (cut tile set in lime, with the cutter),
[Trencadís](https://stepinto.dev/art/trencadis.html) (Azulejería's tiles broken and relaid),
[Sutton Hoo](https://stepinto.dev/art/suttonhoo.html) (garnet cells through the cutter, a buckle in knots),
[Knotwork](https://stepinto.dev/art/knotwork.html) (insular interlace on vellum),
[Sebka](https://stepinto.dev/art/sebka.html) (a brick lattice under a sun you can move),
[Rejería](https://stepinto.dev/art/rejeria.html) (wrought iron and its shadow on whitewash),
[Jali](https://stepinto.dev/art/jali.html) (a pierced stone screen and the light it lets onto the floor),
[Tartan](https://stepinto.dev/art/tartan.html) (type a sett, get the cloth),
[Fair Isle](https://stepinto.dev/art/fairisle.html) (stranded knitting, written as its bands from the top down),
[Hitomezashi](https://stepinto.dev/art/hitomezashi.html) (two words stitched as rows and columns),
[Azulejos de letras](https://stepinto.dev/art/letras.html) (a street-sign typeface, with borders that turn the corner),
[Mantón de Manila](https://stepinto.dev/art/manton.html) (embroidered silk),
[Hispania](https://stepinto.dev/art/hispania.html) (Roman pavements) and
[Leonor](https://stepinto.dev/art/leonor.html) (heraldry from a blazon).

The designs are written up in the
[Patterns by Rule](https://stepinto.dev/patterns/) posts, starting
[here](https://stepinto.dev/posts/tiles-painted-by-rule/) and
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

**`createWall(canvas, { palettes, motifs, painters, presets, material, variants })`** returns
the wall. `wall.state` holds `seed`, `repeat` (`module`, `rotate`,
`single`, `checker`, `whole` for a tile that is a picture, every one
laid the same way up, or any of the seventeen wallpaper groups by name,
`p1` to `p6m`, see Groups below; `variants` is how many paintings of the design
such a wall draws from, four by default), `pal`, `motif`, `density` (1 to 5), `hand` (0 to
1, how far the brush drifts), `brush` (line weight), `scale` (pixels per
tile), `panX`, `panY`, `bands`, `grout` and `age`. After changing any of
them call `wall.rebuild(true)` to repaint the tiles, or `wall.rebuild(false)`
for things the wall draws itself (pan, grout, age). `wall.applyPreset(name)`,
`wall.newDesign()` and `wall.zoomAt(x, y, factor)` do what they say. Set
`wall.onChange(kind)` to be told about them (`'preset'`, `'design'`,
`'zoom'`). **`REPEATS`** lists the five classic repeats by name.

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

**`mountPanel(wall, { fileName, defaultPreset, print, document })`** wires the standard
panel for a wall. It is `mountChrome` (below) with the wall's controls,
which are a handful of elements found by id: selects `repeat`,
`motif` and `palette`; ranges `density`, `hand`, `brush` and `zoom` with
`densityVal`, `handVal`, `brushVal` and `zoomVal` spans beside them;
checkboxes `bands`, `grout` and `age`; buttons `newDesign`, `save` and
`order` (one tile at print size, see Print; `print` is passed to it);
a `mood` line for the seed; `.card[data-preset]` cards each holding a
canvas for a thumbnail; `.tab[data-tab]` buttons switching `presetsBody`
and `panelBody`; `panel` with `panelHead` and `panelToggle`; and a `title`
overlay that fades on first touch. Anything missing is skipped. It also
reads the query string, so `?preset=talavera` or
`?seed=4242&repeat=rotate&pal=talavera&motif=rosette&density=5&age=1` is a
shareable wall. `document` is where to look for the elements, for a
panel that lives somewhere other than the page. Copy the markup from
any of the wall pages above.

**`createViewer(canvas, { paint, scale, minZoom, maxZoom, margin })`**
is what a wall is built on, and what any other world can be. `paint(g,
state, w, h, dpr, ox, oy)` paints the world into `g`, `w` by `h` css
pixels at `dpr`, with the world's origin at `(ox, oy)`. The viewer fills
the window, pans on drag, zooms on pinch or wheel, and calls
`onDoubleTap()` on a double tap. With a `margin` it paints into a buffer
that much larger than the window and only blits while you drag, which is
what a slow paint wants. `viewer.state` has `scale`, `panX` and `panY`;
add your own fields to it. Call `viewer.repaint()` when the world
changes and `viewer.moved()` when only the pan did. `viewer.zoomAt(x,
y, factor)` zooms about a point and `viewer.resize()` refits the
window. Set `onChange(kind)` to hear `'zoom'`, `onInteract()` for the
first touch and `onZoom()` for the end of a zoom. `viewer.margin` can
be changed while it runs: a page that animates sets it to 0 so each
frame paints the window alone.

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
`fileName` and `suffix(state)` for the saved png, `order(state)` (a
promise of a blob) for an `#order` button, `document` for where the
elements are, and `ready()` once everything is applied. It returns
`{ sync, dismissTitle, markPreset }`: call `sync()` after changing the
state yourself, and `markPreset('')` when something the chrome doesn't
know about (a text box, say) has left the preset behind. Alicatado is
the worked example; Tartan and Hitomezashi show a text input beside it.

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

**A border round a corner**: `bendCorner(strip, fill)` takes a square
tile painted as a run of border (outside along the top, inside along
the bottom, the design meeting itself left and right) and returns the
corner tile: the strip bent through a quarter turn about its inner
corner, so the vine or the scroll turns the corner and meets the strip
on both sides. `fill(g, size)`, if given, paints the outer corner the
bend does not reach. [Azulejos de letras](https://stepinto.dev/art/letras.html)
uses it for the frame of a street plaque. `mitreCorner(strip)` is the
square alternative: the strip cut on the diagonal and laid both ways,
as a run of border tiles is mitred at forty-five degrees.

**The small things** every page ends up wanting: `mulberry32(seed)`,
the seeded rng everything here draws from; `hash2(i, j)`, an integer
from a grid position, for seeding a tile or a stitch by where it is;
`wobble(rng)`, the brush's slow drift as a function of 0 to 1;
`hexA(hex, alpha)`, a hex colour as an rgba string; `colourOf(el, pal)`,
an element's role as a colour; and `ageTile(ctx, rng, s, pal)`, what
age does to one glazed tile, for a material that wants the default
under its own.

**The lower level** is there if you want it: `makeDesign(seed, density,
bands, bold, motif, state)`, `paintDesign(g, els, pal, hand, lw, seed, painters, material, brush)`,
`makeTile(opts, size, pixelRatio, seed)`, `tileOpts(cfg, state)` and
`paintThumb(cfg, preset, g, size, pixelRatio)`.

## Pieces

`azulejeria/pieces` is the cutter: what happens to a polygon between
the drawing and the wall. It is the geometry of the hammer and the
trowel, for [Alicatado](https://stepinto.dev/art/alicatado.html) (faces
of a star pattern) and [Trencadís](https://stepinto.dev/art/trencadis.html)
(shards of a broken tile); the glaze on a piece is the page's own.

```js
import { voronoi, cutPiece, relief, pathPoly } from 'azulejeria/pieces';

const cells = voronoi(sites, 0.75);                  // one convex cell per site
for (const poly of cells) {
  const { inner } = cutPiece({ poly }, { cut: 0.6, mortar: 0.02 }, rng);
  pathPoly(g, inner); g.fillStyle = glaze; g.fill();
  relief(g, inner, Lx, Ly, 0.007);                    // a lit edge and a shaded one
}
```

**`cutPiece({ poly, area }, { cut, mortar }, rng)`** takes a
counter-clockwise polygon and returns `{ outer, inner, c }`: the piece
shifted and turned by the fraction a hand allows, each corner landing
a touch off the drawing, long edges bowed; then `inner`, the same
inset by half the `mortar` with a mitred offset, so the joint is one
width along an edge and at a point. `cut` (0 to 1) is how far it
strays. The rng is drawn from in a fixed order, so seed it per piece
and the piece is stable. **`offsetPoly(poly, d)`** is the inset on its
own.

**`voronoi(sites, reach)`** returns one convex cell per `[x, y]`
site, clipped from a square of half-width `reach` by the bisectors
with its neighbours; `reach` should be more than any gap between
neighbouring sites. **`relief(g, poly, Lx, Ly, w)`** strokes each edge
lit or shaded by where it faces the light. **`grain(seed, size)`** is
a small speckle tile for mortar. `centroid`, `signedArea`,
`ensureCCW`, `regularPoly` and `pathPoly` are the small polygon maths
every page wanted.

## Groups

`azulejeria/groups` is the seventeen ways a wall can repeat: the
wallpaper groups, for [Papel Pintado](https://stepinto.dev/art/papelpintado.html)
and for any wall that sets `state.repeat` to one of their names. Every
repeating pattern in the plane has one of these symmetries, and each
is given here as a lattice (two vectors, in tiles), a domain (the part
of the tile that is drawn: the whole square, half of it cut on a
diagonal, or the 60° rhombus corner to corner and its thirds, sixths
and twelfths) and the copies, the isometries that lay the domain out
inside one cell. Every domain keeps the design's main corner, so what
gets repeated is the heart of the design.

```js
import { GROUPS, GROUP_NAMES, layGroup, drawTile } from 'azulejeria/groups';

GROUP_NAMES;                       // ['p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p4m', 'p4g', 'p3', 'p3m1', 'p31m', 'p6', 'p6m']
const g = GROUPS.p6m;              // { cell, domain, copies, lattice, note }
layGroup(ctx, g, S, gap, W, H, ox, oy, (c, t) => drawTile(c, img, S, gap));
```

**`layGroup(ctx, group, S, gap, W, H, ox, oy, draw)`** walks every
copy in every cell a window touches, with `S` the tile in pixels,
`gap` the grout and the world's origin at `(ox, oy)`, and calls
`draw(ctx, { i, j, k, grp, M })` with the context in design
coordinates (the unit square, main corner at the origin) and clipped
to the domain less half the gap. **`drawTile(ctx, img, S, gap)`** puts
a tile image there. The matrices are plain `[a, b, c, d, e, f]`
arrays with `mul`, `rotate(th, cx, cy)`, `reflect(ang, px, py)`,
`translate` and `apply` beside them, and `inset(poly, d)` moves a
convex polygon in by `d`. The wall's `createWall` uses all of this
when `repeat` names a group, and `paintThumb` lays a card with it.

## Knots

`azulejeria/knots` is interlace by rule, for the
[Knotwork](https://stepinto.dev/art/knotwork.html) page and anything
else that wants a strand to go over and under. It draws on any 2D
context and uses nothing from the wall.

```js
import { buildKnot, paintKnot, masks } from 'azulejeria/knots';
import { mulberry32 } from 'azulejeria';

const knot = buildKnot({ nx: 8, ny: 8, rng: mulberry32(698), breaks: 0.3, cuts: 0.05 });
paintKnot(g, knot, {
  place: (x, y) => [x / 2, y / 2],      // doubled grid point -> where to draw it
  ribbon: 0.34, inkWidth: 0.045, ink: '#2a1e14', ground: '#efe1c0',
  colour: s => ['#d9a62e', '#c8562e', '#4f8a5e'][Math.floor(s.pig * 3)],
  bends: 'corners', heads: true,
});
```

The knot lives on a grid of squares in doubled coordinates: corners
at (even, even), edge midpoints at (odd, even) and (even, odd). A
strand steps diagonally from midpoint to midpoint, so two cross at
every midpoint. A break is an edge the strand turns back off; the rim
of the region is all breaks, so every strand closes. A cut is a break
the strand ends at instead, and the two ends that meet at a cut become
a beast, one end a head biting the other. No two cuts sit side by
side, so the heads have room. Over and under come from
parity (a horizontal edge takes the rising strand over, a vertical one
the falling), which alternates round every strand without walking it.

**`buildKnot({ nx, ny, rng, breaks, runs, cuts, mask, symmetry })`**:
`breaks` is the chance an interior edge is a break, `runs` the chance
a break carries on along its line for another edge or two (which is
what gives a knot corners), `cuts` the chance a break is a cut.
They are chosen a whole orbit of the grid's mirrors at a time:
`symmetry` is `'d4'` (the default for a square grid), `'d2'` or
`'none'`. `mask(i, j)` says which squares are in the region, so a
knot can fill a cross or the field around one; `masks.plus`,
`masks.grow` and `masks.not` make the carpet-page shapes. It returns
`{ strands, beasts, edge, square }`; each strand has its `pts` (kind
`cross` with `over`, `wall`, `rim` or `end`), whether it is `open`,
and `pig`, a seeded number for choosing its colour.

**`paintKnot(g, knot, opts)`**: `place(x, y)` maps a grid point to
the context (add the hand's drift there), `ribbon` and `inkWidth` are
in the context's units, `colour(strand)` gives each core, `ground` is
the fill style for the gap cut either side of an over strand, `split`
puts a line down the middle of the ribbon, `bends` is `'round'`,
`'corners'` (pointed where a strand turns in a corner of the rim) or
`'pointed'` (every bounce off the rim), and `heads` draws the beasts.
**`curvedStrand(knot, strand, place, hug)`** is another strand for the
same knot, with no over and under: it goes round the squares it turns
in, as a line drawn round dots does, drawn in to `hug` of the way from
the middle of the square to the break (0.72). It comes back as cubics,
`[from, control, control, to]`, so a page can walk along it, and
`strandPath(knot, strand, null, 'curved', place, hug)` is the same thing
as a `Path2D`.
A beast's head is traced from a drawing of an Insular hound's head
(`src/head.js`): it turns off its strand on a narrower neck (`neck`,
0.55 of the ribbon) and lies along the cut facing the other end, which
hooks round under it and into its jaws. `eye` colours its eye.
`strandPath` and `ribbon` are exported for drawing a strand yourself.

## Draw

```js
import { drawnMotif, DRAW_PAINTERS, mountPad, encodeDrawing, decodeDrawing } from 'azulejeria/draw';

const wall = createWall(canvas, {
  palettes, presets,
  motifs: { drawn: drawnMotif() },
  painters: { ...PAINTERS, ...DRAW_PAINTERS },
});
mountPanel(wall, { fileName: 'mine' });
mountPad(wall, { onEdit: d => history.replaceState(null, '', '?d=' + d) });
```

A tile painted by hand, one eighth of it. Every design is symmetric
across the diagonal of its square, so a hand only has to draw the
triangle under that diagonal, from the main corner to the far one. The
wall is an ordinary wall: the drawing is its motif, so the repeats, the
groups, the palettes, the brush and any material apply to it.
[Octavo](https://stepinto.dev/art/octavo.html) is this and nothing else.

A drawing is a list of strokes `{ k, c, w, pts }`: the kind (`line`,
`shape` or `dot`), the colour (0 the wash, 1 to 3 an accent, 4 the ink),
the weight (1 to 8) and the points in design coordinates.
**`encodeDrawing(strokes)`** packs it into a short string, two bytes a
point, base64url; **`decodeDrawing(string)`** reads it back and gives an
empty drawing for anything it cannot read. The string lives in the
wall's state (`state.d` unless you name another key), so a preset can
carry a drawing and so can a query string or a stored value.

**`drawnMotif(key)`** is the motif that paints `state[key]`. A motif's
context now carries `state` for this. **`DRAW_PAINTERS`** has the one
painter it needs, `stroke`, which paints each stroke on its own side of
the diagonal and again reflected, with the same drift and the same
brush, so a petal drawn across the diagonal comes out whole. A shape is
washed and inked, an ink line is a line, a coloured line is a ribbon. A
material's `shape`, `line` and `dot` are used when it has them.

**`mountPad(wall, { key, onEdit })`** wires the pad. The page provides
`#pad` holding a canvas `#padCanvas`, buttons `.tool[data-tool]`
(`line`, `shape`, `dot`), an empty `#swatches`, a range `#weight` with
`#weightVal`, buttons `#undo` and `#clear`, and `#padHead` with
`#padToggle`; `azulejeria.css` styles them. The pad shows the square in
the wall's palette and material with the reflected half dimmed. A
stroke drawn on the dimmed side is reflected over. The wall repaints
while the pen moves. Cmd or Ctrl Z undoes. **`settle(stroke)`**,
**`simplify(pts, eps)`** and **`smooth(pts, closed, times)`** are what
the pad does to a raw stroke, exported for a page with its own input.
`KINDS` and `MAX_POINTS` (96, the most points a stroke keeps) are the
encoding's limits.

## Print

**`exportTile(wall, { cm, dpi, bleed })`** paints the wall's tile once
at print size and resolves to a PNG blob: 15 cm at 300 dpi with a 3 mm
bleed unless told otherwise (1842 pixels square). The bleed is the tile
mirrored out past each edge. The file carries its dpi (a `pHYs` chunk;
**`pngWithDpi(bytes, dpi)`** does that to any PNG), so it opens at the
right size. `mountPanel` wires it to a `#order` button when the page has
one (`opts.print` is passed on); with `mountChrome`, pass
`order: () => exportTile(wall)` in the spec.

## Shadow

`azulejeria/shadow` is a sun that goes round and the shadows it casts.
Nothing is drawn in shadow: a caster's shadow is its own outline, moved
along the sun's slant by how far it stands off the surface, with what
must stay lit cut back out, softened and multiplied on in the colour of
the sky.

```js
import { sunOf, castShadow, shadowLayer } from 'azulejeria/shadow';

const sun = sunOf(9.5);          // 6 to 20; the wall faces south
castShadow(g, {
  w, h, dpr, shade: sun.shade, alpha: 0.8, blur: 2,
  cast: lg => { lg.setTransform(...); drawGrille(lg, sun.slant[0] * d, sun.slant[1] * d); },
  cut: lg => drawGrille(lg, 0, 0),
});
```

**`sunOf(hour, { reach })`** gives `slant` (how far along the wall a
point one unit proud throws its shadow, x right and y down, never
longer than `reach`), `dir` (the unit vector toward the sun), `light`
(how squarely it strikes the face), `warm` (1 at the horizon, 0 at the
top of the day), `sunCol` and `shade` as `[r, g, b]`, and `az` and `e`
for a page with its own projection. **`castShadow(g, o)`** clears a
kept layer the size of the window, lets `o.cast(lg)` draw the caster
where its shadow falls (fill and stroke are already `o.shade`), draws
`o.cut(lg)` with destination-out if there is one, and multiplies the
layer onto `g` at `o.alpha`, blurred by `o.blur` device pixels.
`o.layer` picks which kept layer, for a page that casts more than once.
**`shadowLayer(n, pw, ph)`** is one of those layers, for a page's own
compositing.

## Loom

`azulejeria/loom` is cloth by rule. A draft is three lists: the shaft
each warp end is threaded through, the shafts each treadle lifts, and
the treadle pressed for each pick. Where an end's shaft is lifted the
warp is on top. A sett is a string of colours and thread counts, and
the cloth shows a thread's colour wherever that thread is on top.

```js
import { DRAFTS, parseSett, threadsOf, dyeOf, clothCanvas, threadTile } from 'azulejeria/loom';

const threads = threadsOf(parseSett('K4 R24 K24 Y4')).map(c => dyeOf(c, 'modern'));
const cloth = clothCanvas(400, 300, 0, 0, threads, threads, DRAFTS.twill);   // one pixel a crossing
```

**`DRAFTS`** has `plain`, `twill` (2/2), `drill` (3/1), `herringbone`,
`diamond` and `basket`; a draft is `{ threading, tieup, treadling }`,
so write your own. **`lifted(draft, i, j)`** is the rule and
**`drawdown(draft)`** one repeat of it. **`parseSett(text)`** reads
colour codes (K R G B Y W N P O T A M C, with L or D in front for light
and dark, or `#rrggbb`) and counts, slashes at the pivots allowed; the
sett turns back at both ends unless it has `...` in it.
**`DRAFT_NAMES`** lists the drafts. **`threadsOf(sett)`** is one repeat, a code per thread, and
**`writeSett(sett)`** writes it back as a threadcount.
**`dyeOf(code, dye)`** is the colour in a dye lot (**`DYES`**: `modern`,
`ancient`, `weathered`, or your own map). **`weavePixels(data, w, h,
i0, j0, warp, weft, draft, under)`** fills RGBA pixels, one a crossing,
from end `i0` and pick `j0`, and needs no document;
**`clothCanvas(...)`** is the same as a canvas to draw scaled up, and
**`threadTile(draft, t)`** is the threads' own shading, one repeat at
`t` pixels a thread, to lay over it.

## Friezes

`azulejeria/friezes` is the border's answer to the seventeen: a pattern
that repeats along a line and nowhere else has one of seven symmetry
groups. Each is how many domains long one repeat is, how many high the
strip is, and the copies that lay the domain out in one repeat.

```js
import { FRIEZES, layFrieze, friezeCells } from 'azulejeria/friezes';

const { copies, length, height } = layFrieze('p2mg', 3, 1);   // a domain 3 wide and 1 high
for (const M of copies) { g.save(); g.transform(...M); drawMotif(g); g.restore(); }   // one repeat, `length` long
```

**`FRIEZES`** has `p1`, `p11g`, `p1m1`, `p2`, `p2mg`, `p11m` and `p2mm`,
each with `period`, `rows`, a `note` and `step`, Conway's name for it
(hop, step, sidle, spinning hop, spinning sidle, jump, spinning jump).
The domain has its corner at (0, 0), x along the strip and y down.
**`friezeCells(name, w, h, on)`** is a frieze on squared paper: the
domain is `w` squares by `h`, `on(i, j)` says what is in each, and one
repeat comes back as `{ W, H, cells }`. It needs no document, and
`test/friezes.mjs` checks that every group covers its repeat once and
has the symmetries of its name and no others.

## Knit

`azulejeria/knit` is colourwork by rule. A chart is a list of strings,
a character a stitch: `.` is the ground, `X` the pattern, and any other
character a further colour. A band is a chart with its colours, and a
stack is bands from the top down. Fair Isle adds two rules, and the
module can check both: a row has two colours and no more, and the
colour not in use may not float more than about seven stitches.

```js
import { fairIsle, paintKnit, ROW } from 'azulejeria/knit';

const cloth = fairIsle('oxo13 zig star11 seed', 'madder', 1);   // bands from the top down
g.setTransform(12, 0, 0, 12, 0, 0);                             // a stitch is one unit wide, ROW high
paintKnit(g, cloth, 0, 0, 80, 60, 12);                          // 80 stitches by 60 rows, 12 px a stitch
```

**`chartOf(rows, gap)`** makes a chart, and **`byRule(n, fn)`** one
with the square's symmetries from `fn(a, b)`, the distance from the
middle each way. **`PEERIES`** are the small bands (`seed`, `dots`,
`check`, `zig`, `wave`, `cross`, `links`, `lozenge`, `hearts`, `bars`)
and **`BORDERS`** the large ones, each a function of the half-width
(`oxo`, `star`, `diamond`, `flake`, `tile`), filled in their corners
until **`floatsOf(chart)`** reports no float over seven.
**`ruleMotif(seed, n, limit)`** is a large band nobody charted.
**`FIGURES`** are the season's (`reindeer`, `tree`, `pudding`,
`snowman`, `gift`, `cane`, `bauble`, `heart`), in more colours than a
row should have: `X` is the band's own colour and `k w r g y b` are
inks the page names. **`textChart(text)`** knits a word in a
five-by-seven alphabet, and **`knittable(text)`** is what of it can be
knitted.

**`band(chart, colours, opts)`** gives a chart its colours, one for
each character, each a colour or a list with one for each row
(**`shadeRows(h, shades)`** makes the list that shades to the middle
row and back). `opts` are `repeat` (false knits it once), `scale`,
`phase` and `gap`. **`plain(rows, colour)`** is rows of nothing.
**`stackOf(bands, base, repeat)`** stacks them, and
**`stitchAt(stack, i, j)`** is the colour of one stitch.
**`fairIsle(text, wool, seed, opts)`** is the stack for a cloth
written as its bands, in one of the **`WOOLS`** (`shetland`, `madder`,
`sea`, `heather`, `yule`, `stepinto`) or your own; **`parseBands`**,
**`writeBands`** and **`randomBands(seed)`** read, write and invent the
text.

**`knitPixels(data, w, h, i0, j0, stack)`** fills RGBA pixels, one a
stitch, and needs no document. **`paintKnit(g, stack, i0, j0, nw, nh,
px)`** knits into the context's own transform, each stitch drawn as a
V so that a change of colour has a zigzag edge, with
**`stitchTile(px)`** laid over for the roundness of the yarn.
**`paintRib(g, colour, x, y, w, h, px)`** is ribbing for a welt or a
cuff, and **`fuzzTile(seed, size)`** the halo of the wool.

## Licence

MIT.
