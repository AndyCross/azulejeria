// knots — interlace by rule on a grid, for azulejeria.
//
// Take a region of squares. Every edge of every square has a midpoint,
// and a strand runs diagonally from one midpoint to the next, so at
// every midpoint two strands cross. Some edges are breaks: a strand
// that reaches a break turns back off it instead of crossing. The rim
// of the region is all breaks, so every strand closes. A cut is a break
// the strand does not turn back off but ends at, and the two ends that
// meet there become a beast: one end a head, the other the tail it bites.
//
// Over and under need no bookkeeping. A crossing on a horizontal edge
// takes the rising strand over, a crossing on a vertical edge the
// falling one. Every step along a strand changes the kind of edge and
// every bounce changes the direction, so the over-under alternates
// round every strand by construction.
//
// Coordinates are doubled: corners of squares at (even, even), edge
// midpoints at (odd, even) on horizontal edges and (even, odd) on
// vertical ones. `place(x, y)` maps them to wherever you are drawing.

import { HEAD } from './head.js';

const key = (x, y) => x * 4096 + y;
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- masks ---
// A mask says which squares (i, j) are in the region. These make the
// shapes a carpet page wants: a plus, its surround, the channel between.
export const masks = {
  all: () => true,
  // a plus centred in an n by m grid: arms `half` squares either side of
  // the centre line, reaching `reach` squares from the centre
  plus(nx, ny, half, reach) {
    const cx = nx / 2, cy = ny / 2;
    return (i, j) => {
      const x = i + 0.5 - cx, y = j + 0.5 - cy;
      return (Math.abs(x) < half && Math.abs(y) < reach) || (Math.abs(y) < half && Math.abs(x) < reach);
    };
  },
  // grow a mask by one square in each direction
  grow: mask => (i, j) => {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (mask(i + a, j + b)) return true;
    return false;
  },
  not: mask => (i, j) => !mask(i, j),
};

// ----------------------------------------------------------------- knot ---
// buildKnot({ nx, ny, rng, breaks, runs, cuts, mask, symmetry }) grows a
// knot in an nx by ny grid. `breaks` is the chance an interior edge is
// a break, `runs` the chance a break runs on along its line for one or
// two more edges, `cuts` the chance a break (or a stretch of rim) is a
// cut. Breaks and cuts are chosen a whole orbit of the grid's mirrors at
// a time: 'd4' (both mirrors and the diagonal, square grids), 'd2'
// (both mirrors) or 'none'. Returns { nx, ny, strands, beasts, edge,
// square }: each strand is { pts, open, pig } with pts of kind 'cross'
// (with `over`), 'wall', 'rim' or 'end'; each beast pairs a head end
// with a tail end; `edge(x, y)` and `square(i, j)` describe the region.
export function buildKnot(o) {
  const { nx, ny, rng } = o;
  const breaks = o.breaks ?? 0.3, runs = o.runs ?? 0.45, cuts = o.cuts ?? 0;
  const inside = o.mask || masks.all;
  const sym = o.symmetry || (nx === ny ? 'd4' : 'd2');
  const X = 2 * nx, Y = 2 * ny;
  const sq = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && inside(i, j);
  // 2 for an edge between two squares of the region, 1 for its rim, 0 outside
  const edge = (x, y) => {
    const [a, b] = (x & 1) ? [sq((x - 1) / 2, y / 2 - 1), sq((x - 1) / 2, y / 2)]
                           : [sq(x / 2 - 1, (y - 1) / 2), sq(x / 2, (y - 1) / 2)];
    return a && b ? 2 : a || b ? 1 : 0;
  };
  const orbit = (x, y) => {
    const pts = [[x, y]];
    if (sym !== 'none') pts.push([X - x, y], [x, Y - y], [X - x, Y - y]);
    if (sym === 'd4') for (const [a, b] of pts.slice()) pts.push([b, a]);
    return pts;
  };
  const midpoints = fn => { for (let y = 0; y <= Y; y++) for (let x = 0; x <= X; x++) if ((x + y) & 1) fn(x, y); };

  const wall = new Set(), cut = new Set();
  let seen = new Set();
  midpoints((x, y) => {
    if (edge(x, y) !== 2 || seen.has(key(x, y))) return;
    for (const [a, b] of orbit(x, y)) seen.add(key(a, b));
    if (rng() >= breaks) return;
    const run = rng() < runs ? 2 + Math.floor(rng() * 2) : 1;
    const hz = (x & 1) === 1;                 // a horizontal edge runs along x
    for (let k = 0; k < run; k++) {
      const ax = hz ? x + 2 * k : x, ay = hz ? y : y + 2 * k;
      if (ax > 0 && ax < X && ay > 0 && ay < Y && edge(ax, ay) === 2)
        for (const [a, b] of orbit(ax, ay)) if (edge(a, b) === 2) wall.add(key(a, b));
    }
  });
  const isWall = (x, y) => { const e = edge(x, y); return e === 1 || (e === 2 && wall.has(key(x, y))); };
  if (cuts > 0) {
    seen = new Set();
    midpoints((x, y) => {
      if (!isWall(x, y) || seen.has(key(x, y))) return;
      for (const [a, b] of orbit(x, y)) seen.add(key(a, b));
      if (rng() >= cuts) return;
      // no cut beside another, or the heads would lie on each other; a
      // mirror image that would is left a plain break
      for (const [a, b] of orbit(x, y)) {
        if (!isWall(a, b)) continue;
        let clear = true;
        for (let u = -2; u <= 2 && clear; u++) for (let v = -2; v <= 2; v++)
          if (Math.abs(u) + Math.abs(v) <= 2 && cut.has(key(a + u, b + v))) { clear = false; break; }
        if (clear) cut.add(key(a, b));
      }
    });
  }

  // walk from a crossing until the strand comes round or reaches a cut
  const done = new Set();
  const axis = (dx, dy) => (dx * dy > 0 ? 0 : 1);
  function walk(sx, sy, sdx, sdy) {
    const pts = [];
    let x = sx, y = sy, dx = sdx, dy = sdy, guard = 0;
    do {
      if (isWall(x, y)) {
        if (cut.has(key(x, y))) { pts.push({ x, y, kind: 'end' }); return { pts, open: true }; }
        if (x & 1) dy = -dy; else dx = -dx;
        pts.push({ x, y, kind: edge(x, y) === 1 ? 'rim' : 'wall' });
      } else {
        done.add(key(x, y) * 2 + axis(dx, dy));
        pts.push({ x, y, kind: 'cross', over: ((x & 1) === 1) === (dx * dy > 0) });
      }
      x += dx; y += dy;
    } while (!(x === sx && y === sy && dx === sdx && dy === sdy) && ++guard < 200000);
    return { pts, open: false };
  }

  const strands = [];
  midpoints((x, y) => {
    if (edge(x, y) !== 2 || isWall(x, y)) return;
    for (const ax of [0, 1]) {
      if (done.has(key(x, y) * 2 + ax)) continue;
      const dy = ax === 0 ? 1 : -1;
      const f = walk(x, y, 1, dy);
      if (!f.open) { strands.push({ pts: f.pts, open: false, pig: rng() }); continue; }
      const b = walk(x, y, -1, -dy);
      strands.push({ pts: b.pts.slice(1).reverse().concat(f.pts), open: true, pig: rng() });
    }
  });

  // the two ends that meet at a cut from the same side make one beast
  const ends = new Map();
  strands.forEach((s, si) => {
    if (!s.open) return;
    for (const i of [0, s.pts.length - 1]) {
      const w = s.pts[i], nb = s.pts[i === 0 ? 1 : i - 1];
      const side = (w.x & 1) ? nb.y > w.y : nb.x > w.x;
      const k = key(w.x, w.y) * 2 + (side ? 1 : 0);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push({ s: si, i });
    }
  });
  const beasts = [];
  for (const pair of ends.values()) {
    if (pair.length !== 2) continue;
    const flip = rng() < 0.5;
    beasts.push({ head: pair[flip ? 1 : 0], tail: pair[flip ? 0 : 1] });
  }
  return { nx, ny, strands, beasts, edge, square: sq };
}

// ---------------------------------------------------------------- paths ---
// The strand as a Path2D through the placed points. Every point is a
// control point and the curve passes through the midpoints between
// them, so a crossing is straight and a bounce is rounded. `bends`:
// 'round' leaves it so; 'corners' points the strand where it turns in a
// convex corner of the rim, as the scribes did; 'pointed' also points
// every bounce off the rim.
// 'curved' is another strand altogether, curvedStrand below, which
// goes round the squares; it has no over and under to relay.
export function strandPath(knot, s, P, bends, place, hug) {
  const pts = s.pts, n = pts.length, p = new Path2D();
  if (bends === 'curved') {
    curvedStrand(knot, s, place, hug).forEach(([a, c1, c2, b], k) => {
      if (!k) p.moveTo(a[0], a[1]);
      p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]);
    });
    if (!s.open) p.closePath();
    return p;
  }
  const at = k => P[(k + n) % n];
  const convex = (A, B) => {
    if ((A.x & 1) === (B.x & 1)) return null;
    const cx = (A.x & 1) ? B.x : A.x, cy = (A.x & 1) ? A.y : B.y;
    const i = cx / 2, j = cy / 2;
    const c = knot.square(i - 1, j - 1) + knot.square(i, j - 1) + knot.square(i - 1, j) + knot.square(i, j);
    return c === 1 ? [cx, cy] : null;
  };
  const first = s.open ? 1 : 0, last = s.open ? n - 2 : n - 1;
  const start = s.open ? mid(P[0], P[1]) : mid(P[n - 1], P[0]);
  p.moveTo(start[0], start[1]);
  for (let k = first; k <= last; k++) {
    const q = pts[k], e = mid(at(k), at(k + 1));
    if (bends !== 'round' && q.kind === 'rim' && k + 1 <= last && pts[k + 1].kind === 'rim') {
      const c = convex(q, pts[k + 1]);
      if (c) {
        // a point into the corner: arrive along one rim, leave along the other
        // a point into the corner: arrive up one rim and leave along the
        // other, each leaning in toward the corner, so the tip is sharp
        const A = at(k), B = at(k + 1), C = place(c[0], c[1]);
        const V = lerp(C, mid(A, B), 0.75);
        const u = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
        const t = u(C[0] - V[0], C[1] - V[1]), ra = u(C[0] - A[0], C[1] - A[1]), rb = u(B[0] - C[0], B[1] - C[1]);
        const din = u(ra[0] + t[0], ra[1] + t[1]), dout = u(rb[0] - t[0], rb[1] - t[1]);
        const len = Math.hypot(A[0] - C[0], A[1] - C[1]) * 0.7;
        const c1 = lerp(mid(at(k - 1), A), A, 0.8), c4 = lerp(mid(B, at(k + 2)), B, 0.8);
        const c2 = [V[0] - din[0] * len, V[1] - din[1] * len], c3 = [V[0] + dout[0] * len, V[1] + dout[1] * len];
        const e2 = mid(B, at(k + 2));
        p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], V[0], V[1]);
        p.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], e2[0], e2[1]);
        k++;
        continue;
      }
    }
    if (bends === 'pointed' && q.kind === 'rim') {
      // a point just short of the rim, the curve either side of it
      // keeping its tangent where it meets the rest of the strand
      const A = at(k), s0 = mid(at(k - 1), A);
      const V = lerp(A, mid(at(k - 1), at(k + 1)), 0.12);
      const c1 = lerp(s0, A, 0.55), c2 = lerp(e, A, 0.55);
      p.quadraticCurveTo(c1[0], c1[1], V[0], V[1]);
      p.quadraticCurveTo(c2[0], c2[1], e[0], e[1]);
      continue;
    }
    p.quadraticCurveTo(at(k)[0], at(k)[1], e[0], e[1]);
  }
  if (!s.open) p.closePath();
  return p;
}
// A strand that goes round the squares it turns in, as a line drawn
// round dots does. It passes through every crossing where the crossing
// is, on the diagonal, and where it turns back off a break it is drawn
// in toward the middle of the square it is in, to `hug` of the way out
// from that middle to the break (0.72), and runs along the break there.
// Two breaks in a row round one square make a quarter of a circle, and
// three make a loop that crosses its own tail. Returns the strand as
// cubics, [from, control, control, to] in placed coordinates, so a page
// can walk along it; strandPath(..., 'curved', place, hug) is the same
// thing as a Path2D.
export function curvedStrand(knot, s, place, hug) {
  const h = hug == null ? 0.72 : hug, pts = s.pts, n = pts.length;
  const idx = k => (s.open ? Math.max(0, Math.min(n - 1, k)) : ((k % n) + n) % n);
  const raw = k => { const q = pts[idx(k)]; return place(q.x, q.y); };
  const at = k => {
    const q = pts[idx(k)];
    if (q.kind === 'cross' || q.kind === 'end') return place(q.x, q.y);
    // the square it turns in: this point and the one before lie on two of its edges
    const nb = pts[idx(k) > 0 ? idx(k) - 1 : (s.open ? 1 : n - 1)];
    const cx = (q.x & 1) ? q.x : nb.x, cy = (q.x & 1) ? nb.y : q.y;
    return place(cx + (q.x - cx) * h, cy + (q.y - cy) * h);
  };
  const dir = k => {
    const a = raw(k - 1), b = raw(k + 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const out = [];
  for (let k = 0; k < (s.open ? n - 1 : n); k++) {
    const a = at(k), b = at(k + 1), ta = dir(k), tb = dir(k + 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.39;
    out.push([a, [a[0] + ta[0] * l, a[1] + ta[1] * l], [b[0] - tb[0] * l, b[1] - tb[1] * l], b]);
  }
  return out;
}
// the piece of a strand either side of point k, for relaying a crossing
function piecePath(P, k) {
  const n = P.length, p = new Path2D();
  const s = mid(P[(k + n - 1) % n], P[k]), e = mid(P[k], P[(k + 1) % n]);
  p.moveTo(s[0], s[1]); p.quadraticCurveTo(P[k][0], P[k][1], e[0], e[1]);
  return p;
}

// ---------------------------------------------------------------- paint ---
// a ribbon: an ink edge either side and a core of colour, and for a
// split ribbon a line of ink down the middle
export function ribbon(g, path, col, o) {
  g.strokeStyle = o.ink; g.lineWidth = o.ribbon; g.stroke(path);
  g.strokeStyle = col; g.lineWidth = Math.max(o.ribbon - 2 * o.inkWidth, o.inkWidth); g.stroke(path);
  if (o.split) { g.strokeStyle = o.ink; g.lineWidth = o.inkWidth * 0.75; g.stroke(path); }
}

// paintKnot(g, knot, opts) draws the whole knot. opts: `place(x, y)`
// maps a doubled grid point to [x, y] on g (add the hand's drift there);
// `ribbon` and `inkWidth` in g's units; `ink`; `colour(strand)` for each
// strand's core; `ground`, a fill style for the gap cut either side of
// an over strand; `split`; `bends` ('round', 'corners', 'pointed');
// `heads` to draw the beasts at the cuts, `neck` for how narrow their
// necks are against the ribbon, `eye` for the colour of their eyes.
export function paintKnot(g, knot, o) {
  const rw = o.ribbon, iw = o.inkWidth;
  const drawn = knot.strands.map(s => {
    const P = s.pts.map(q => o.place(q.x, q.y));
    return { s, P, col: o.colour(s), path: strandPath(knot, s, P, o.bends || 'round', o.place) };
  });
  g.lineJoin = 'miter'; g.miterLimit = 4; g.lineCap = 'butt';
  for (const d of drawn) ribbon(g, d.path, d.col, o);

  // at every crossing the strand over is laid again across a gap: the
  // gap is cut inside one circle and the strand relaid inside a slightly
  // larger one, so the relay covers the gap's soft edge
  const gap = Math.max(iw * 0.8, rw * 0.12);
  const unit = Math.hypot(drawn[0] ? drawn[0].P[0][0] - drawn[0].P[1][0] : 1, drawn[0] ? drawn[0].P[0][1] - drawn[0].P[1][1] : 1);
  const R = Math.hypot(rw / 2, rw / 2 + gap) * 1.08, R2 = Math.min(R + rw * 0.18, unit * 0.5);
  for (const d of drawn) {
    d.s.pts.forEach((q, k) => {
      if (!q.over) return;
      const [cx, cy] = d.P[k], piece = piecePath(d.P, k);
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      g.strokeStyle = o.ground; g.lineWidth = rw + 2 * gap; g.stroke(piece);
      g.restore();
      g.save(); g.beginPath(); g.arc(cx, cy, R2, 0, TAU); g.clip();
      ribbon(g, piece, d.col, o);
      g.restore();
    });
  }

  if (o.heads) for (const b of knot.beasts) beast(g, drawn, b, o);
}

// ---------------------------------------------------------------- beast ---
// Where a strand is cut, its two ends meet from the same side. One
// becomes a head and the other a tail, curled round into its jaws. The
// head is traced (see head.js), a hound's head with an almond eye and a
// lappet, laid on in the strand's own colour. Its neck turns off the
// strand, narrowing to `o.neck` of the ribbon (0.55), so the head lies
// along the cut facing the tail, crown away from the cut.
function beast(g, drawn, b, o) {
  const r = o.ribbon, iw = o.inkWidth;
  const endOf = ({ s, i }) => {
    const d = drawn[s], P = d.P, nb = i === 0 ? 1 : P.length - 2;
    const E = mid(P[i], P[nb]);
    const dl = Math.hypot(P[i][0] - P[nb][0], P[i][1] - P[nb][1]) || 1;
    return { d, E, dir: [(P[i][0] - P[nb][0]) / dl, (P[i][1] - P[nb][1]) / dl] };
  };
  const H = endOf(b.head), T = endOf(b.tail);
  // the head lies along the cut, facing the tail's end, its crown away
  // from the cut and its jaws toward it
  const ax = T.E[0] - H.E[0], ay = T.E[1] - H.E[1], al = Math.hypot(ax, ay) || 1;
  const d = [ax / al, ay / al];
  let up = [-d[1], d[0]];
  if (up[0] * H.dir[0] + up[1] * H.dir[1] > 0) up = [-up[0], -up[1]];
  const down = [-up[0], -up[1]];
  const k = o.neck || 0.55, S = k * r / HEAD.neck.w;
  const N = [H.E[0] + (H.dir[0] * 0.3 + d[0] * 0.35) * r, H.E[1] + (H.dir[1] * 0.3 + d[1] * 0.35) * r];
  // a point of the drawing, (x, y) in its unit box, placed in the world
  const at = (x, y) => {
    const X = x * HEAD.asp * S, Y = (y - HEAD.neck.y) * S;
    return [N[0] + d[0] * X + down[0] * Y, N[1] + d[1] * X + down[1] * Y];
  };
  const M = at(HEAD.mouth[0], HEAD.mouth[1]);

  // the tail: on from its end toward the cut, then hooked round under
  // the jaws and up into the mouth, narrowing as it goes, laid first so
  // the head closes over it
  {
    const tip = [M[0] + up[0] * k * r * 0.6, M[1] + up[1] * k * r * 0.6];
    const c1 = [T.E[0] + T.dir[0] * r * 1.2, T.E[1] + T.dir[1] * r * 1.2];
    const c2 = [M[0] + down[0] * r * 1.6, M[1] + down[1] * r * 1.6];
    taper(g, T.E, c1, c2, tip, r, k * r * 0.55, T.d.col, o, true);
  }

  // the head, its silhouette stroked wide first so its outline weighs
  // the same as the strands', then the colours, then the ink
  const loops = ls => {
    const p = new Path2D();
    for (const l of ls) {
      l.forEach(([x, y], n) => { const q = at(x, y); n ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); });
      p.closePath();
    }
    return p;
  };
  // the neck, from the strand's end round into the drawing's neck and on
  // under it, so the drawing's square cut is hidden
  {
    const back = [H.E[0] - H.dir[0] * iw, H.E[1] - H.dir[1] * iw];
    const c1 = [H.E[0] + H.dir[0] * r * 0.3, H.E[1] + H.dir[1] * r * 0.3];
    taper(g, back, c1, at(0, HEAD.neck.y), at(0.08, HEAD.neck.y), r, k * r, H.d.col, o, false);
  }
  g.save();
  const keep = new Path2D(), K = [at(0.03, -1), at(2, -1), at(2, 2), at(0.03, 2)];
  K.forEach((q, n) => (n ? keep.lineTo(q[0], q[1]) : keep.moveTo(q[0], q[1])));
  g.clip(keep);
  const sil = loops(HEAD.main);
  g.lineJoin = 'round';
  g.strokeStyle = o.ink; g.lineWidth = iw; g.stroke(sil);
  g.fillStyle = H.d.col; g.fill(sil, 'evenodd');
  g.fillStyle = T.d.col; g.fill(loops(HEAD.blue));
  g.fillStyle = o.eye || '#b8452a'; g.fill(loops(HEAD.red));
  const ink = loops(HEAD.sable);
  g.fillStyle = o.ink; g.fill(ink, 'evenodd');
  g.lineWidth = iw * 0.2; g.strokeStyle = o.ink; g.stroke(ink);
  g.restore();

  g.lineJoin = 'miter';
}

// a ribbon narrowing from w0 to w1 along a cubic, its sides inked and,
// for a tail, its far end too
function taper(g, p0, c1, c2, p1, w0, w1, col, o, closed) {
  const n = 32, L = [], R = [], Cn = [];
  for (let s = 0; s <= n; s++) {
    const t = s / n, u = 1 - t;
    const B = (i) => u * u * u * p0[i] + 3 * u * u * t * c1[i] + 3 * u * t * t * c2[i] + t * t * t * p1[i];
    const x = B(0), y = B(1);
    let tx = 3 * u * u * (c1[0] - p0[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (p1[0] - c2[0]);
    let ty = 3 * u * u * (c1[1] - p0[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (p1[1] - c2[1]);
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const h = (w0 + (w1 - w0) * t) / 2 - o.inkWidth / 2;
    L.push([x - ty * h, y + tx * h]); R.push([x + ty * h, y - tx * h]); Cn.push([x, y]);
  }
  const body = new Path2D();
  L.forEach((q, i) => (i ? body.lineTo(q[0], q[1]) : body.moveTo(q[0], q[1])));
  for (let i = R.length - 1; i >= 0; i--) body.lineTo(R[i][0], R[i][1]);
  body.closePath();
  g.fillStyle = col; g.fill(body);
  g.strokeStyle = o.ink; g.lineJoin = 'round';
  if (o.split) {
    // the split runs on, stopping short of a tail's point
    const e = new Path2D(), m = closed ? Math.round(n * 0.8) : n;
    Cn.slice(0, m + 1).forEach((q, i) => (i ? e.lineTo(q[0], q[1]) : e.moveTo(q[0], q[1])));
    g.lineWidth = o.inkWidth * 0.75; g.stroke(e);
  }
  g.lineWidth = o.inkWidth;
  if (closed) {
    // the far end rounded, the near end left open to meet the strand
    const e = new Path2D();
    L.forEach((q, i) => (i ? e.lineTo(q[0], q[1]) : e.moveTo(q[0], q[1])));
    for (let i = R.length - 1; i >= 0; i--) e.lineTo(R[i][0], R[i][1]);
    g.stroke(e);
  } else {
    for (const side of [L, R]) {
      const e = new Path2D();
      side.forEach((q, i) => (i ? e.lineTo(q[0], q[1]) : e.moveTo(q[0], q[1])));
      g.stroke(e);
    }
  }
}
