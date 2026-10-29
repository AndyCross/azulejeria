// pieces — the cutter, for azulejeria.
//
// A wall of cut tile is a plane of small polygons bedded in mortar. The
// polygons come from somewhere (Alicatado's star geometry, Trencadís's
// cracks), and this module is what happens to them afterwards: each one
// is moved and turned by the fraction a hand allows, its corners land a
// touch off the drawing, its long edges bow, and then it is inset from
// the joint by a mitred offset so the mortar between two pieces is the
// same width along a long edge as at a point. There is a Voronoi here
// too, for pieces that are broken rather than cut, and the relief that
// lights one edge of a standing piece and shades the other.
//
// Nothing here paints a glaze. The piece's fill, its mottle and its
// shine belong to the page; this module is the geometry of the hammer
// and the trowel.

import { mulberry32 } from './azulejeria.js';

// ------------------------------------------------------------- polygons ---
// Polygons are arrays of [x, y]. The cutter wants them counter-clockwise.

export function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function ensureCCW(poly) {
  return signedArea(poly) < 0 ? poly.slice().reverse() : poly;
}

export function regularPoly(cx, cy, n, r, a0) {
  const p = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + k * 2 * Math.PI / n;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}

export function pathPoly(g, poly) {
  g.beginPath();
  g.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
  g.closePath();
}

// a CCW polygon inset by d: each vertex moves along the bisector of
// its two inward normals, by d over the cosine of the half angle, and
// never further than half the shorter edge, so a sharp point stays a point
export function offsetPoly(poly, d) {
  const n = poly.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = poly[(i + n - 1) % n], v = poly[i], q = poly[(i + 1) % n];
    let e1x = v[0] - p[0], e1y = v[1] - p[1], l1 = Math.hypot(e1x, e1y) || 1;
    let e2x = q[0] - v[0], e2y = q[1] - v[1], l2 = Math.hypot(e2x, e2y) || 1;
    e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
    // inward normals, polygon is CCW
    const n1x = -e1y, n1y = e1x, n2x = -e2y, n2y = e2x;
    let bx = n1x + n2x, by = n1y + n2y, bl = Math.hypot(bx, by);
    if (bl < 1e-6) { bx = n1x; by = n1y; bl = 1; }
    bx /= bl; by /= bl;
    const cosHalf = bx * n1x + by * n1y;
    const m = Math.min(d / Math.max(cosHalf, 0.2), Math.min(l1, l2) * 0.49);
    out.push([v[0] + bx * m, v[1] + by * m]);
  }
  return out;
}

// --------------------------------------------------------------- cutter ---
// cutPiece({ poly, area }, { cut, mortar }, rng) turns a face into a
// piece: shifted and turned a little, its corners nicked, its long
// edges bowed, then inset by half the mortar. `cut` (0..1) is how far
// the piece strays from its drawing, `mortar` the joint width in the
// polygon's units. Returns { outer, inner, c }: the piece as laid, the
// glazed face inside the joint, and the centre it was turned about.
// The rng is drawn from in a fixed order, so a page that seeds it per
// piece gets the same piece every time.
export function cutPiece(pc, st, rng) {
  const c = centroid(pc.poly);
  const cut = st.cut;
  // the whole piece strays: a shift and a turn
  const dx = (rng() - 0.5) * 0.02 * cut, dy = (rng() - 0.5) * 0.02 * cut;
  const ang = (rng() - 0.5) * 0.03 * cut, ca = Math.cos(ang), sa = Math.sin(ang);
  const poly = pc.poly.map(p => {
    const x = p[0] - c[0], y = p[1] - c[1];
    // each corner lands a touch off the drawing
    const jx = (rng() - 0.5) * 0.016 * cut, jy = (rng() - 0.5) * 0.016 * cut;
    return [c[0] + dx + x * ca - y * sa + jx, c[1] + dy + x * sa + y * ca + jy];
  });
  // long edges on a hand-cut piece bow very slightly
  const bowed = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    bowed.push(a);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.5) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      const bow = (rng() - 0.5) * 0.012 * cut;
      bowed.push([mx + nx * bow, my + ny * bow]);
    }
  }
  const area = pc.area === undefined ? Math.abs(signedArea(pc.poly)) : pc.area;
  const half = st.mortar * (0.5 + (rng() - 0.5) * 0.3 * cut);
  const inset = offsetPoly(bowed, Math.min(half, 0.3 * Math.sqrt(area)));
  return { outer: bowed, inner: inset, c };
}

// --------------------------------------------------------------- relief ---
// A piece stands proud of the mortar, so each edge of its face is lit
// or shaded by where it faces. (Lx, Ly) is the unit vector towards the
// light, `w` the stroke width; `lit` and `shade` are the colours at
// full strength, as `rgba(r, g, b, ` prefixes.
export function relief(g, poly, Lx, Ly, w, lit, shade) {
  lit = lit || 'rgba(255, 250, 235, ';
  shade = shade || 'rgba(30, 20, 10, ';
  g.lineCap = 'butt';
  g.lineWidth = w;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1;
    const nx = ey / el, ny = -ex / el;               // outward, polygon is CCW
    const f = nx * Lx + ny * Ly;
    g.strokeStyle = f > 0 ? lit + (0.45 * f) + ')' : shade + (0.4 * -f) + ')';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
}

// ---------------------------------------------------------------- grain ---
// a small tile of speckle to pattern mortar with, dark and light flecks
let grainCache = new Map();
export function grain(seed, size, dots) {
  seed = seed === undefined ? 99 : seed;
  const s = size || 96, n = dots || 900, k = seed + '|' + s + '|' + n;
  let c = grainCache.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s, rad = 0.4 + r() * 1.1;
    g.fillStyle = r() < 0.55 ? `rgba(60, 45, 25, ${0.05 + r() * 0.12})` : `rgba(255, 250, 235, ${0.08 + r() * 0.16})`;
    g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
  }
  grainCache.set(k, c);
  return c;
}

// -------------------------------------------------------------- voronoi ---
// Pieces that are broken rather than cut. voronoi(sites, reach) takes a
// list of [x, y] and returns one convex CCW cell per site, clipped from
// a square of half-width `reach` around it by the bisector with every
// site that could touch it. Sites are bucketed on a grid of `reach`, so
// it is fast when the sites are roughly evenly spread; cells at the
// edge of the set are closed by the square. `reach` should be larger
// than any gap between neighbouring sites.
export function voronoi(sites, reach) {
  const cellOf = p => Math.floor(p[0] / reach) + ',' + Math.floor(p[1] / reach);
  const buckets = new Map();
  sites.forEach((p, i) => {
    const k = cellOf(p);
    let b = buckets.get(k);
    if (!b) { b = []; buckets.set(k, b); }
    b.push(i);
  });
  const cells = [];
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const bx = Math.floor(s[0] / reach), by = Math.floor(s[1] / reach);
    let poly = [[s[0] - reach, s[1] - reach], [s[0] + reach, s[1] - reach], [s[0] + reach, s[1] + reach], [s[0] - reach, s[1] + reach]];
    // the neighbours, nearest first, so most clips are early and the
    // rest can stop once the cell is already inside the next bisector
    const near = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = buckets.get((bx + a) + ',' + (by + b));
      if (list) for (const j of list) if (j !== i) near.push(j);
    }
    near.sort((a, b) => dist2(s, sites[a]) - dist2(s, sites[b]));
    for (const j of near) {
      const q = sites[j];
      const d = Math.sqrt(dist2(s, q));
      // the cell lies within its own farthest vertex: a site more than
      // twice that away cannot cut it
      let far = 0;
      for (const p of poly) far = Math.max(far, dist2(s, p));
      if (d * d > 4 * far) break;
      poly = clipHalf(poly, s, q);
      if (poly.length < 3) break;
    }
    cells.push(poly);
  }
  return cells;
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

// keep the side of the bisector of s and q that holds s
function clipHalf(poly, s, q) {
  const mx = (s[0] + q[0]) / 2, my = (s[1] + q[1]) / 2;
  const nx = s[0] - q[0], ny = s[1] - q[1];
  const inside = p => (p[0] - mx) * nx + (p[1] - my) * ny >= 0;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny;
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
