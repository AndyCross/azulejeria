// groups: the seventeen ways a wall can repeat.
//
// Every repeating pattern in the plane has one of seventeen symmetry
// groups, the wallpaper groups. Each one here is a lattice (two
// vectors, in tiles), a domain (the part of the tile that is drawn,
// a polygon in design coordinates, or null for the whole square) and
// the copies: the isometries that lay the domain out inside one cell
// of the lattice. Lay the cell at every lattice point and the plane is
// covered exactly once.
//
// Design coordinates are the unit square with the design's main corner
// at (0, 0) and its far corner at (1, 1). The square groups use the
// whole tile, or half of it cut along a diagonal; the hexagonal groups
// use the 60° rhombus whose long diagonal runs corner to corner, or a
// third, a sixth or a twelfth of it. Every domain keeps the main
// corner, so the heart of the design is what gets repeated.
//
// A matrix is [a, b, c, d, e, f] as the canvas has it: x' = ax + cy + e,
// y' = bx + dy + f. `mul(M, N)` applies N first.

export const I = [1, 0, 0, 1, 0, 0];
export function mul(M, N) {
  return [
    M[0] * N[0] + M[2] * N[1], M[1] * N[0] + M[3] * N[1],
    M[0] * N[2] + M[2] * N[3], M[1] * N[2] + M[3] * N[3],
    M[0] * N[4] + M[2] * N[5] + M[4], M[1] * N[4] + M[3] * N[5] + M[5],
  ];
}
export const translate = (x, y) => [1, 0, 0, 1, x, y];
// a turn of `th` about (cx, cy)
export function rotate(th, cx, cy) {
  const c = Math.cos(th), s = Math.sin(th);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}
// a reflection in the line through (px, py) at angle `ph`
export function reflect(ph, px, py) {
  const c = Math.cos(2 * ph), s = Math.sin(2 * ph);
  return [c, s, s, -c, px - c * px - s * py, py - s * px + c * py];
}
export const apply = (M, [x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];

// the orbit of a list of matrices under another: every product
const times = (A, B) => A.flatMap(a => B.map(b => mul(b, a)));
const turns = (n, cx, cy) => Array.from({ length: n }, (_, k) => rotate(2 * Math.PI * k / n, cx, cy));

const PI = Math.PI, Q = PI / 2;
const Mx1 = reflect(Q, 1, 0);            // the line x = 1
const My1 = reflect(0, 0, 1);            // the line y = 1
const DIAG = reflect(PI / 4, 0, 0);      // the line y = x
const ANTI = reflect(-PI / 4, 1, 0);     // the line x + y = 1

// the 60° rhombus corner to corner: short diagonal s = sqrt(2/3)
const R3 = 1 / (2 * Math.sqrt(3));
const C = [0.5 + R3, 0.5 - R3], C2 = [0.5 - R3, 0.5 + R3];
const HEX_A = [1, 1], HEX_B = [0.5 - Math.sqrt(3) / 2, 0.5 + Math.sqrt(3) / 2];
const hex = k => turns(3, C[0], C[1]).flatMap(r => k.map(m => mul(r, m)));

const SQ = [[1, 0], [0, 1]], R21 = [[2, 0], [0, 1]], R22 = [[2, 0], [0, 2]];
const HALF_LR = [[0, 0], [1, 0], [1, 1]];
const HALF_LL = [[0, 0], [1, 0], [0, 1]];
const RHOMB = [[0, 0], C, [1, 1], C2];
const THIRD = [[0, 0], C, C2];
const THIRD_LONG = [[0, 0], C, [1, 1]];
const TWELFTH = [[0, 0], C, [0.5, 0.5]];

export const GROUPS = {
  // translations only
  p1:   { cell: SQ,  domain: null, copies: [I],
          lattice: 'oblique', note: 'translations only: the tile, over and over' },
  // a half turn
  p2:   { cell: R21, domain: null, copies: [I, rotate(PI, 1, 0.5)],
          lattice: 'oblique', note: 'every other tile upside down' },
  // a mirror
  pm:   { cell: R21, domain: null, copies: [I, Mx1],
          lattice: 'rectangular', note: 'mirrors in one direction' },
  // a glide: reflect, then slide half a tile along the mirror
  pg:   { cell: R21, domain: null, copies: [I, mul(translate(0, 0.5), Mx1)],
          lattice: 'rectangular', note: 'a reflection that slides as it goes' },
  // a mirror on a centred lattice: the rows step by half
  cm:   { cell: [[2, 0], [1, 1]], domain: null, copies: [I, Mx1],
          lattice: 'rhombic', note: 'mirrors, with every row stepped by half' },
  // mirrors both ways
  pmm:  { cell: R22, domain: null, copies: [I, Mx1, My1, rotate(PI, 1, 1)],
          lattice: 'rectangular', note: 'mirrors both ways: the four-tile module' },
  // mirrors one way, half turns between them
  pmg:  { cell: R22, domain: null, copies: [I, Mx1, rotate(PI, 0.5, 1), mul(Mx1, rotate(PI, 0.5, 1))],
          lattice: 'rectangular', note: 'mirrors one way, half turns between them' },
  // glides both ways, no mirrors at all
  pgg:  { cell: R22, domain: null,
          copies: [I, mul(translate(0, 1), reflect(Q, 0.5, 0)), rotate(PI, 1, 1), mul(translate(2, -2), mul(mul(translate(0, 1), reflect(Q, 0.5, 0)), rotate(PI, 1, 1)))],
          lattice: 'rectangular', note: 'glides both ways and never a mirror' },
  // mirrors both ways with a half turn off them: the tile cut in two
  cmm:  { cell: R22, domain: HALF_LR, copies: times([I, Mx1, My1, rotate(PI, 1, 1)], [I, rotate(PI, 0.5, 0.5)]),
          lattice: 'rhombic', note: 'mirrors both ways, with a half turn between them' },
  // quarter turns
  p4:   { cell: R22, domain: null, copies: turns(4, 1, 1),
          lattice: 'square', note: 'quarter turns about the far corner' },
  // quarter turns and mirrors: the kaleidoscope
  p4m:  { cell: R22, domain: HALF_LR, copies: times([I, DIAG], turns(4, 1, 1)),
          lattice: 'square', note: 'quarter turns and mirrors: the kaleidoscope' },
  // quarter turns with the mirrors off the centres
  p4g:  { cell: R22, domain: HALF_LL, copies: times([I, ANTI], turns(4, 1, 1)),
          lattice: 'square', note: 'quarter turns, the mirrors missing the centres' },
  // thirds of a turn
  p3:   { cell: [HEX_A, HEX_B], domain: RHOMB, copies: hex([I]),
          lattice: 'hexagonal', note: 'thirds of a turn: three rhombi make a hexagon' },
  // thirds with every centre on a mirror
  p3m1: { cell: [HEX_A, HEX_B], domain: THIRD, copies: hex([I, ANTI]),
          lattice: 'hexagonal', note: 'thirds of a turn, every centre on a mirror' },
  // thirds with one kind of centre off the mirrors
  p31m: { cell: [HEX_A, HEX_B], domain: THIRD_LONG, copies: hex([I, DIAG]),
          lattice: 'hexagonal', note: 'thirds of a turn, one kind of centre off the mirrors' },
  // sixths of a turn
  p6:   { cell: [HEX_A, HEX_B], domain: THIRD, copies: hex([I, rotate(PI, 0.5, 0.5)]),
          lattice: 'hexagonal', note: 'sixths of a turn' },
  // sixths and mirrors: the snowflake
  p6m:  { cell: [HEX_A, HEX_B], domain: TWELFTH, copies: hex(times([I, rotate(PI, 0.5, 0.5)], [I, DIAG])),
          lattice: 'hexagonal', note: 'sixths of a turn and mirrors: the snowflake' },
};
export const GROUP_NAMES = Object.keys(GROUPS);

// a convex polygon moved in by d on every side
export function inset(poly, d) {
  const n = poly.length, out = [];
  // the polygon's turn, so "inward" is the same side on every edge
  let area = 0;
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const sgn = area > 0 ? 1 : -1;
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
    const nx = sgn * dy / L, ny = -sgn * dx / L;      // the inward normal
    return [nx, ny, nx * p[0] + ny * p[1] + d];       // the line n·x = c, moved in
  });
  for (let i = 0; i < n; i++) {
    const [a1, b1, c1] = lines[(i + n - 1) % n], [a2, b2, c2] = lines[i];
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) { out.push(poly[i]); continue; }
    out.push([(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det]);
  }
  return out;
}

// Lays a group over a window. `S` is the tile in pixels, `gap` the
// grout in pixels, the window `W` by `H` with the world's origin at
// (ox, oy); `ctx` is already scaled to css pixels. For every copy in
// every cell the window touches, `draw(ctx, t)` is called with the
// context in design coordinates (the unit square, main corner at the
// origin), clipped to the domain less half the gap, and `t` carrying
// the cell `i`, `j`, the copy `k` and the group. Draw the tile image
// there with `drawTile(ctx, img, S, gap)`.
export function layGroup(ctx, grp, S, gap, W, H, ox, oy, draw) {
  const [A, B] = grp.cell;
  const det = A[0] * B[1] - A[1] * B[0];
  // the window's corners, in lattice coordinates
  const corners = [[-ox, -oy], [W - ox, -oy], [-ox, H - oy], [W - ox, H - oy]];
  let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
  for (const [px, py] of corners) {
    const x = px / S, y = py / S;
    const i = (x * B[1] - y * B[0]) / det, j = (y * A[0] - x * A[1]) / det;
    i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
  }
  // copies may spill out of their cell by up to a tile and a half
  i0 = Math.floor(i0) - 2; i1 = Math.ceil(i1) + 1; j0 = Math.floor(j0) - 2; j1 = Math.ceil(j1) + 1;
  const dom = grp.domain ? (gap > 0 ? inset(grp.domain, gap / (2 * S)) : grp.domain) : null;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cx = i * A[0] + j * B[0], cy = i * A[1] + j * B[1];
      for (let k = 0; k < grp.copies.length; k++) {
        const M = grp.copies[k];
        ctx.save();
        ctx.translate(ox + cx * S, oy + cy * S);
        ctx.scale(S, S);
        ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
        if (dom) {
          ctx.beginPath();
          ctx.moveTo(dom[0][0], dom[0][1]);
          for (let n = 1; n < dom.length; n++) ctx.lineTo(dom[n][0], dom[n][1]);
          ctx.closePath();
          ctx.clip();
        }
        draw(ctx, { i, j, k, grp, M });
        ctx.restore();
      }
    }
  }
}

// the tile image into the design's unit square (the image has the
// main corner at its bottom right), less half the gap on every side
export function drawTile(ctx, img, S, gap) {
  const g = gap / (2 * S);
  ctx.save();
  ctx.scale(-1, -1);
  ctx.drawImage(img, -1 + g, -1 + g, 1 - 2 * g, 1 - 2 * g);
  ctx.restore();
}
