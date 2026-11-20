// azulejeria: tin-glazed tiles painted by rule.
//
// A design lives in the unit square and is symmetric across its
// diagonal, which is the trick every four-tile módulo relies on. Lay it as a
// quarter of a tile and the tile carries the whole motif. Lay it as a
// whole tile and the motif only completes where four tiles meet,
// mirrored or turned, so the wall reads at a scale no single tile has.
//
// This module is the engine: the seeded random, the brushwork (every
// line a polyline with a slow wobble along its normal, washes laid
// thin twice so the glaze pools), the tile (mottled glaze, the design
// laid once or four times), the viewer (a canvas you paint a world
// into, with drag, pinch, wheel and the double tap), the wall (a
// viewer painting tiles repeated with a symmetry, each turned and
// shifted a little, some crazed) and the standard chrome. Motifs,
// palettes and presets belong to the page that uses it. See README.md
// for the shape of each.
//
// A material, optionally, changes what the tile is made of without
// touching what is drawn on it: how the ground is laid, how a shape
// is filled, how far a piece strays from the drawing, what the grout
// is, and what age does. Without one the tile is tin-glazed.
//
// The wall's repeat is one of the four classic layings (module, rotate,
// single, checker), the whole tile laid the same way up, or any of the
// seventeen wallpaper groups, which live in groups.js.

import { GROUPS, layGroup, drawTile } from './groups.js';
export { GROUPS, GROUP_NAMES, layGroup, drawTile, inset } from './groups.js';

// ------------------------------------------------------------- random ---
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const hash2 = (i, j) => Math.abs((i * 73856093) ^ (j * 19349663) ^ ((i * 7 + j * 13) * 83492791)) | 0;

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${a})`;
}

// ------------------------------------------------------------- design ---
// A motif is a function of the design context that returns a list of
// elements, each `{ t: 'painterName', ...params }`. The context carries
// the seeded rng and a few helpers every motif wants: `pick` one of a
// list, `role` (wash or one of the accents), and `dots` for the
// scatter that higher densities add. `state`, if given, is the wall's
// state, for a motif that paints something the state carries (a
// drawing, say) rather than what the seed grows.
export function makeDesign(seed, density, bands, bold, motif, state) {
  const rng = mulberry32(seed);
  bold = bold || 1;                       // single tiles carry the motif larger
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const role = () => (rng() < 0.6 ? { role: 'wash' } : { role: 'accent', ai: Math.floor(rng() * 3) });
  const dots = (kMin, kSpan, x0, xSpan, yk) => {
    const d = [], k = kMin + Math.floor(rng() * kSpan);
    for (let i = 0; i < k; i++) {
      const x = x0 + rng() * xSpan;
      d.push([x, rng() * x * yk, 0.012 + rng() * 0.012]);
    }
    return { t: 'dots', dots: d };
  };
  return motif({ rng, density, bands, bold, pick, role, dots, state });
}

// ---------------------------------------------------------- brushwork ---
// A loaded brush drifts: every curve gets a slow sideways wobble
// along its length, two sines of different pitch, never a jitter.
export function wobble(rng) {
  const p1 = rng() * 6.283, p2 = rng() * 6.283, f1 = 1.5 + rng() * 2, f2 = 4 + rng() * 4;
  return t => Math.sin(t * 6.283 * f1 + p1) * 0.65 + Math.sin(t * 6.283 * f2 + p2) * 0.35;
}
export function arcPts(cx, cy, r, a0, a1, amp, rng, n) {
  const w = wobble(rng), pts = [];
  n = n || 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * t, rr = r + amp * w(t);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}
export function linePts(x0, y0, x1, y1, amp, rng, n) {
  const w = wobble(rng), pts = [];
  const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
  const nx = -dy / dl, ny = dx / dl;
  n = n || 20;
  for (let i = 0; i <= n; i++) {
    const t = i / n, o = amp * w(t);
    pts.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]);
  }
  return pts;
}
// a leaf, petal or drop pointing along `ang` from (cx, cy), between two radii
export function petalPts(cx, cy, ang, rIn, rOut, wd, amp, rng) {
  const w1 = wobble(rng), w2 = wobble(rng);
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const n = 16, pts = [], half = wd * (rOut - rIn) * 0.5;
  for (let i = 0; i <= n; i++) {
    const t = i / n, d = rIn + (rOut - rIn) * t, h = half * Math.sin(Math.PI * t) + amp * w1(t) * Math.sin(Math.PI * t);
    pts.push([cx + ux * d + nx * h, cy + uy * d + ny * h]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n, d = rIn + (rOut - rIn) * t, h = half * Math.sin(Math.PI * t) + amp * w2(t) * Math.sin(Math.PI * t);
    pts.push([cx + ux * d - nx * h, cy + uy * d - ny * h]);
  }
  return pts;
}
// a kite pointing along `ang`: straight sides, the way arista tiles
// are cut rather than painted
export function kitePts(cx, cy, ang, rIn, rOut, wd, amp, rng) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const mid = rIn + (rOut - rIn) * 0.55, half = wd * (rOut - rIn) * 0.5;
  const c = [[cx + ux * rIn, cy + uy * rIn], [cx + ux * mid + nx * half, cy + uy * mid + ny * half],
             [cx + ux * rOut, cy + uy * rOut], [cx + ux * mid - nx * half, cy + uy * mid - ny * half]];
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    const seg = linePts(a[0], a[1], b[0], b[1], amp * 0.6, rng, 8);
    for (let k = 0; k < seg.length - 1; k++) pts.push(seg[k]);
  }
  return pts;
}
// a straight strap between two points, a band with a body to it
export function strapPts(x0, y0, x1, y1, w, amp, rng) {
  const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
  const nx = -dy / dl * w / 2, ny = dx / dl * w / 2;
  const c = [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    const seg = linePts(a[0], a[1], b[0], b[1], (i & 1) ? 0 : amp * 0.6, rng, (i & 1) ? 2 : 14);
    for (let k = 0; k < seg.length - 1; k++) pts.push(seg[k]);
  }
  return pts;
}
// a polygon from vertices, each side given the brush's drift
export function polyPts(verts, closeIt, amp, rng) {
  const pts = [], m = verts.length - (closeIt ? 0 : 1);
  for (let i = 0; i < m; i++) {
    const p = verts[i], q = verts[(i + 1) % verts.length];
    const seg = linePts(p[0], p[1], q[0], q[1], amp, rng, 5);
    for (let k = 0; k < seg.length - 1; k++) pts.push(seg[k]);
  }
  if (!closeIt) pts.push(verts[verts.length - 1]);
  return pts;
}
export function trace(g, pts, close) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}
export function ink(g, pts, lw, pal, rng, close) {
  trace(g, pts, close);
  g.strokeStyle = pal.ink;
  g.lineWidth = lw * (0.8 + 0.4 * rng());
  g.globalAlpha = 0.88;
  g.stroke();
  g.globalAlpha = 1;
}
// a wash is laid thin, then a second pass slides a little and pools
export function wash(g, pts, col, rng) {
  trace(g, pts, true);
  g.fillStyle = col;
  g.globalAlpha = 0.5 + 0.18 * rng();
  g.fill();
  g.save();
  g.translate((rng() - 0.5) * 0.012, (rng() - 0.5) * 0.012);
  g.globalAlpha = 0.22;
  g.fill();
  g.restore();
  g.globalAlpha = 1;
}
export function colourOf(el, pal) {
  if (el.role === 'accent' && pal.accents.length) return pal.accents[el.ai % pal.accents.length];
  return pal.wash;
}

// ------------------------------------------------------------ painters ---
// A painter is `(el, b) => void`. `b` is the brush for this design: the
// context `g` (already scaled to the unit square), the palette, the
// line weight `lw`, the wobble amplitude `amp`, the rng, the colour
// `col` the element's role resolved to, the quarter turn `Q`, the
// diagonal `D` with its cosine `dc` and sine `ds`, and the strokes
// every motif reaches for: `shape` (wash then ink), `dot`, `petal`,
// `kite`, `lobes`, and `altOf` (the next accent along).
//
// These four are the ones every motif so far has shared.
export const PAINTERS = {
  // a border across the far corner: a quarter circle (which four tiles
  // close into a ring) or a straight edge (which they close into a
  // diamond)
  band(el, b) {
    const { g, pal, lw, amp, rng, col, Q } = b;
    const pts = el.kind === 'circle'
      ? arcPts(1, 1, 0.5, Math.PI, Math.PI + Q, amp, rng, 32)
      : linePts(1, 0.5, 0.5, 1, amp, rng, 24);
    trace(g, pts, false);
    g.strokeStyle = pal.ink; g.lineWidth = el.w; g.globalAlpha = 0.88; g.stroke();
    g.strokeStyle = col; g.lineWidth = el.w - 2.2 * lw; g.globalAlpha = 0.75; g.stroke();
    g.globalAlpha = 1;
  },
  // a scalloped ring around the main corner
  ring(el, b) {
    b.lobes(0, 0, el.r, 0, b.Q, el.lobes);
  },
  // a line from one edge to the other, parallel to the diamond band;
  // mirrors into a lozenge net
  lattice(el, b) {
    const { g, pal, lw, amp, rng, col } = b;
    const pts = linePts(1, el.a, el.a, 1, amp, rng, 24);
    trace(g, pts, false);
    g.strokeStyle = pal.ink; g.lineWidth = el.w; g.globalAlpha = 0.88; g.stroke();
    g.strokeStyle = col; g.lineWidth = Math.max(el.w - 2.2 * lw, lw * 0.5); g.globalAlpha = 0.75; g.stroke();
    g.globalAlpha = 1;
  },
  // a scatter in the spare space, mirrored across the diagonal
  dots(el, b) {
    for (const [x, y, r] of el.dots)
      for (const [px, py] of [[x, y], [y, x]]) b.dot(px, py, r);
  },
};

// paints one design into the unit square of g (already scaled). The
// material, if given, may supply `ampOf(hand)`, `shape(g, pts, col, b)`,
// `line(g, pts, lw, close, b)` and `dot(g, x, y, r, col, a, b)`. The
// brush `b` also carries `hand` and `brush` as the state has them, for
// a painter whose line is not drawn with `lw` (a traced drawing, say).
export function paintDesign(g, els, pal, hand, lw, jseed, painters, material, brush) {
  const rng = mulberry32(jseed);
  const m = material || {};
  const amp = m.ampOf ? m.ampOf(hand) : 0.012 * hand;
  const Q = Math.PI / 2, D = Q / 2;
  const dc = Math.cos(D), ds = Math.sin(D);       // the diagonal
  const b = { g, pal, lw, amp, rng, Q, D, dc, ds, col: pal.wash, hand, brush: brush === undefined ? 1 : brush, material: material || null };
  const shape = m.shape
    ? (pts, col) => m.shape(g, pts, col, b)
    : (pts, col) => { wash(g, pts, col, rng); ink(g, pts, lw, pal, rng, true); };
  const line = m.line
    ? (pts, w, close) => m.line(g, pts, w, close, b)
    : (pts, w, close) => ink(g, pts, w, pal, rng, close);
  const dot = m.dot
    ? (x, y, r, col, a) => m.dot(g, x, y, r, col, a, b)
    : (x, y, r, col, a) => {
      g.beginPath(); g.arc(x, y, r, 0, 6.283);
      g.fillStyle = col || pal.ink; g.globalAlpha = a || 0.85; g.fill(); g.globalAlpha = 1;
    };
  const petal = (cx, cy, ang, rIn, rOut, wd, col) => shape(petalPts(cx, cy, ang, rIn, rOut, wd, amp, rng), col);
  const kite = (cx, cy, ang, rIn, rOut, wd, col) => shape(kitePts(cx, cy, ang, rIn, rOut, wd, amp, rng), col);
  const lobes = (cx, cy, r, a0, a1, count) => {
    const step = (a1 - a0) / count, s = r * Math.sin(step / 2) * 1.05;
    for (let k = 0; k < count; k++) {
      const a = a0 + (k + 0.5) * step;
      const lx = cx + r * Math.cos(a), ly = cy + r * Math.sin(a);
      ink(g, arcPts(lx, ly, s, a - Q, a + Q, amp * 0.5, rng, 12), lw * 0.8, pal, rng, false);
    }
  };
  const altOf = el => pal.accents.length ? pal.accents[((el.ai || 0) + 1) % pal.accents.length] : pal.ink;
  Object.assign(b, { shape, line, dot, petal, kite, lobes, altOf });
  for (const el of els) {
    const painter = painters[el.t];
    if (!painter) continue;
    b.col = colourOf(el, pal);
    painter(el, b);
  }
}

// --------------------------------------------------------------- tile ---
// One tile, painted. `o.quarter` lays the design four times mirrored
// about the centre; otherwise the design fills the tile with its main
// corner at bottom right, for the module to complete (or, with the
// 'whole' repeat, every tile laid the same way up: a tile that is a
// picture). `o.plain` paints
// the small tile a checker alternates with.
export function makeTile(o, S, k, jseed) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(S * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  const rng = mulberry32(jseed);
  const pal = o.pal, m = o.material || {};
  g.fillStyle = pal.glaze;
  g.fillRect(0, 0, S, S);
  if (m.surface) m.surface(g, S, pal, rng);
  else {
    for (let i = 0; i < 3; i++) {
      const x = rng() * S, y = rng() * S, rr = S * (0.3 + rng() * 0.5);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, hexA(pal.tint, 0.22));
      gr.addColorStop(1, hexA(pal.tint, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
    // glaze thickens at the edge
    g.strokeStyle = hexA(pal.ink, 0.06);
    g.lineWidth = S * 0.06;
    g.strokeRect(0, 0, S, S);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (o.plain && m.plain) {
    m.plain(g, S, pal, mulberry32(jseed + 3), o);
  } else if (o.plain) {
    g.save(); g.translate(S / 2, S / 2); g.scale(S, S);
    const r2 = mulberry32(jseed + 3);
    const amp = 0.012 * o.hand;
    ink(g, arcPts(0, 0, 0.05, 0, 6.283, amp, r2, 24), 0.012 * o.brush, pal, r2, true);
    for (let q = 0; q < 4; q++) {
      g.beginPath(); g.arc(Math.cos(q * Math.PI / 2) * 0.12, Math.sin(q * Math.PI / 2) * 0.12, 0.014, 0, 6.283);
      g.fillStyle = pal.ink; g.globalAlpha = 0.8; g.fill(); g.globalAlpha = 1;
    }
    g.restore();
  } else if (o.quarter) {
    let v = 0;
    for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      g.save(); g.translate(S / 2, S / 2); g.scale(fx * S / 2, fy * S / 2);
      paintDesign(g, o.design, pal, o.hand, 0.024 * o.brush, jseed + 17 + v++, o.painters, o.material, o.brush);
      g.restore();
    }
  } else {
    g.save(); g.translate(S, S); g.scale(-S, -S);
    paintDesign(g, o.design, pal, o.hand, 0.012 * o.brush, jseed + 17, o.painters, o.material, o.brush);
    g.restore();
  }
  return c;
}

export const REPEATS = ['module', 'rotate', 'single', 'checker', 'whole'];
const ROT = [0, Math.PI / 2, 3 * Math.PI / 2, Math.PI];

// the tile options for a given state (preset or live)
export function tileOpts(cfg, s) {
  const pal = cfg.palettes[s.pal];
  const quarter = s.repeat === 'single' || s.repeat === 'checker';
  const design = makeDesign(s.seed, s.density, s.bands, quarter ? 1.35 : 1, cfg.motifs[s.motif], s);
  return { pal, design, quarter, hand: s.hand, brush: s.brush, painters: cfg.painters, material: cfg.material };
}

// what age does to a glazed tile, drawn in the tile's own frame: a
// warm cast on some, a craze on a few, a chipped corner on fewer
export function ageTile(ctx, rng, s, pal) {
  if (rng() < 0.5) { ctx.fillStyle = `rgba(120, 85, 30, ${0.04 + rng() * 0.1})`; ctx.fillRect(-s / 2, -s / 2, s, s); }
  if (rng() < 0.18) {
    ctx.strokeStyle = 'rgba(60, 45, 30, 0.35)';
    ctx.lineWidth = 0.7;
    const pts = linePts(-s / 2, (rng() - 0.5) * s, s / 2, (rng() - 0.5) * s, s * 0.08, rng, 14);
    trace(ctx, pts, false); ctx.stroke();
    if (rng() < 0.5) {
      const q = linePts((rng() - 0.5) * s, -s / 2, (rng() - 0.5) * s, s / 2, s * 0.08, rng, 14);
      trace(ctx, q, false); ctx.stroke();
    }
  }
  if (rng() < 0.05) {
    const cxs = rng() < 0.5 ? -1 : 1, cys = rng() < 0.5 ? -1 : 1;
    ctx.fillStyle = pal.grout;
    ctx.beginPath();
    ctx.moveTo(cxs * s / 2, cys * s / 2);
    ctx.lineTo(cxs * (s / 2 - s * (0.08 + rng() * 0.1)), cys * s / 2);
    ctx.lineTo(cxs * (s / 2 - s * 0.03), cys * (s / 2 - s * 0.05));
    ctx.lineTo(cxs * s / 2, cys * (s / 2 - s * (0.08 + rng() * 0.1)));
    ctx.closePath(); ctx.fill();
  }
}

// A border tile bent round a corner. `strip` is a square tile painted
// as a run of border: the outside of the wall along its top edge, the
// inside along its bottom, the design meeting itself at left and
// right. The corner is the quarter-annulus about the tile's inner
// corner: distance from that corner becomes how far in the design
// sits, and the angle round it becomes how far along, so the strip's
// right edge becomes the corner's right edge, its left edge the
// corner's bottom edge, and the design turns through a quarter between
// them. Where the annulus does not reach, the outer corner, `fill(g)`
// paints the ground (the glaze by default, sampled from the strip's
// own corner). The result joins the strip laid to its right unturned
// and laid below it turned three quarters; the other three corners are
// this one turned.
export function bendCorner(strip, fill) {
  const N = strip.width;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  if (fill) fill(g, N);
  else { g.drawImage(strip, 0, 0, 2, 2, 0, 0, N, N); }
  const src = strip.getContext('2d').getImageData(0, 0, N, N).data;
  const out = g.getImageData(0, 0, N, N), d = out.data;
  const Q = Math.PI / 2;
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const u = 1 - (px + 0.5) / N, v = 1 - (py + 0.5) / N;
    const r = Math.hypot(u, v);
    if (r > 1) continue;
    const along = Math.atan2(u, v) / Q, inward = 1 - r;
    // bilinear sample of the strip at (along, inward)
    const sx = Math.min(N - 1.001, Math.max(0, along * N - 0.5)), sy = Math.min(N - 1.001, Math.max(0, inward * N - 0.5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const i = (py * N + px) * 4;
    for (let ch = 0; ch < 4; ch++) {
      const a = src[(y0 * N + x0) * 4 + ch], b = src[(y0 * N + x0 + 1) * 4 + ch];
      const cc = src[((y0 + 1) * N + x0) * 4 + ch], dd = src[((y0 + 1) * N + x0 + 1) * 4 + ch];
      d[i + ch] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + dd * fx) * fy;
    }
  }
  g.putImageData(out, 0, 0);
  return c;
}

// The same strip mitred instead: the corner is cut on the diagonal
// from the outer corner to the inner one, the strip laid unturned
// above the cut and turned three quarters below it, the way a picture
// frame or a run of border tiles is cut at forty-five degrees. It joins
// the same neighbours as bendCorner's.
export function mitreCorner(strip) {
  const N = strip.width;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(N, 0); g.lineTo(N, N); g.closePath(); g.clip();
  g.drawImage(strip, 0, 0); g.restore();
  g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, N); g.lineTo(N, N); g.closePath(); g.clip();
  g.translate(N / 2, N / 2); g.rotate(3 * Math.PI / 2); g.drawImage(strip, -N / 2, -N / 2); g.restore();
  return c;
}

// a wall laid by a wallpaper group: every copy of the domain in every
// cell the window touches, each straying from its place as the hand
// allows, aged if asked. `pick(rng)` chooses the tile image.
function layWall(ctx, grp, S, gap, W, H, ox, oy, state, pal, m, lay, pick) {
  layGroup(ctx, grp, S, gap, W, H, ox, oy, (g, t) => {
    const rng = mulberry32(hash2(t.i * 32 + t.k, t.j) + state.seed);
    const img = pick(rng);
    g.translate(0.5 + (rng() - 0.5) * lay.shift * state.hand, 0.5 + (rng() - 0.5) * lay.shift * state.hand);
    g.rotate((rng() - 0.5) * lay.turn * state.hand);
    g.translate(-0.5, -0.5);
    drawTile(g, img, S, gap);
    if (state.age) {
      // age is drawn in pixels about the tile's centre
      g.translate(0.5, 0.5); g.scale(1 / S, 1 / S);
      const s = S - gap;
      if (m.age) m.age(g, { i: t.i, j: t.j, k: t.k, rng, s, S, pal, state, cx: (t.i + 0.5) * S, cy: (t.j + 0.5) * S, fx: 1, fy: 1, rot: 0 });
      else ageTile(g, rng, s, pal);
    }
  });
}

// a small wall of four tiles, for a preset card
export function paintThumb(cfg, p, g, T, k) {
  const o = tileOpts(cfg, p);
  const A = makeTile(o, T, k, p.seed * 31);
  const grp = GROUPS[p.repeat];
  if (grp) {
    g.fillStyle = o.pal.grout; g.fillRect(0, 0, 2 * T, 2 * T);
    const m = cfg.material || {}, gap = p.grout === false ? 0 : (m.gapOf ? m.gapOf(T, p) : Math.max(1.2, T * 0.022));
    layWall(g, grp, T, gap, 2 * T, 2 * T, 0, 0, { ...p, age: false }, o.pal, m, { shift: 0, turn: 0 }, () => A);
    return;
  }
  const B = p.repeat === 'checker' ? makeTile({ ...o, plain: true }, T, k, p.seed * 37) : null;
  g.fillStyle = o.pal.grout; g.fillRect(0, 0, 2 * T, 2 * T);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    let fx = 1, fy = 1, rot = 0, img = A;
    if (p.repeat === 'module') { fx = i ? -1 : 1; fy = j ? -1 : 1; }
    else if (p.repeat === 'rotate') rot = ROT[i + (j << 1)];
    else if (p.repeat === 'checker' && ((i + j) & 1)) img = B;
    g.save(); g.translate((i + 0.5) * T, (j + 0.5) * T); g.rotate(rot); g.scale(fx, fy);
    g.drawImage(img, -T / 2 + 1, -T / 2 + 1, T - 2, T - 2);
    g.restore();
  }
}

// -------------------------------------------------------------- print ---
// exportTile(wall, { cm, dpi, bleed }) paints the wall's tile once at
// print size, for someone to have it made: 15 cm at 300 dpi by default
// (1772 pixels), with a bleed of 3 mm all round. The bleed is the tile
// mirrored out past each edge, which is what its neighbour is in the
// module and close enough under the other repeats for a cutter's
// tolerance. It resolves to a PNG blob that says its own dpi, so it
// opens at the right size. A checker exports its painted tile.
export function exportTile(wall, opts) {
  opts = opts || {};
  const cm = opts.cm || 15, dpi = opts.dpi || 300, bleedMm = opts.bleed === undefined ? 3 : opts.bleed;
  const px = Math.round(cm / 2.54 * dpi), bl = Math.round(bleedMm / 25.4 * dpi);
  const cfg = { palettes: wall.palettes, motifs: wall.motifs, painters: wall.painters, material: wall.material };
  const tile = makeTile(tileOpts(cfg, wall.state), px, 1, wall.state.seed * 31);
  const c = document.createElement('canvas');
  c.width = c.height = px + 2 * bl;
  const g = c.getContext('2d');
  for (const fy of [-1, 0, 1]) for (const fx of [-1, 0, 1]) {
    if ((fx || fy) && !bl) continue;
    g.save();
    g.translate(bl + px / 2 + fx * px, bl + px / 2 + fy * px);
    g.scale(fx ? -1 : 1, fy ? -1 : 1);
    g.drawImage(tile, -px / 2, -px / 2);
    g.restore();
  }
  return new Promise((resolve, reject) => c.toBlob(blob => {
    if (!blob) { reject(new Error('the tile could not be encoded')); return; }
    blob.arrayBuffer().then(buf => resolve(new Blob([pngWithDpi(new Uint8Array(buf), dpi)], { type: 'image/png' })), reject);
  }, 'image/png'));
}

let CRC_TABLE = null;
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// a PNG's bytes with a pHYs chunk saying `dpi`, replacing one it has
export function pngWithDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21), v = new DataView(chunk.buffer);
  v.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);              // pHYs
  v.setUint32(8, ppm); v.setUint32(12, ppm);
  chunk[16] = 1;                                 // per metre
  v.setUint32(17, crc32(chunk.subarray(4, 17)));
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8, after = 33;                        // the signature, then IHDR
  while (at + 8 <= png.length) {
    const len = dv.getUint32(at), type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type === 'pHYs') {
      const out = new Uint8Array(png.length - (len + 12) + 21);
      out.set(png.subarray(0, at)); out.set(chunk, at); out.set(png.subarray(at + len + 12), at + 21);
      return out;
    }
    if (type === 'IDAT' || type === 'IEND') break;
    at += len + 12;
  }
  const out = new Uint8Array(png.length + 21);
  out.set(png.subarray(0, after)); out.set(chunk, after); out.set(png.subarray(after), after + 21);
  return out;
}

// ------------------------------------------------------------- viewer ---
// createViewer(canvas, { paint, scale, minZoom, maxZoom, margin }) is
// a canvas you paint a world into. It fills the window, and handles
// drag, pinch, wheel and the double tap. `paint(g, state, w, h, dpr,
// ox, oy)` paints the world into g, w by h css pixels at dpr, with
// the world's origin at (ox, oy). With a `margin` the world is painted
// into a buffer that much larger than the window and only blitted
// while you drag, which is what a slow paint wants; without one it is
// painted straight to the canvas every time. `state` carries `scale`,
// `panX` and `panY`, plus whatever the page adds. Call `repaint()`
// when the world changes and `moved()` when only the pan did. Set
// `onChange(kind)` to hear 'zoom', `onInteract()` to hear the first
// touch, `onDoubleTap()` for the double tap and `onZoom()` for the end
// of a zoom.
export function createViewer(canvas, opts) {
  opts = opts || {};
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const state = { scale: opts.scale || 120, panX: 0, panY: 0 };
  const viewer = { canvas, ctx, state, W: 0, H: 0, DPR, paint: opts.paint,
                   minZoom: opts.minZoom || 40, maxZoom: opts.maxZoom || 260, margin: opts.margin || 0,
                   preset: '', onChange: null, onInteract: null, onDoubleTap: null, onZoom: null };
  let dirty = true, needPaint = true, buf = null, bg = null, bufPan = null;

  function render() {
    const W = viewer.W, H = viewer.H, M = viewer.margin;
    if (!M) { viewer.paint(ctx, state, W, H, DPR, W / 2 + state.panX, H / 2 + state.panY); return; }
    if (needPaint || !bufPan) {
      if (!buf) { buf = document.createElement('canvas'); bg = buf.getContext('2d'); }
      buf.width = Math.ceil((W + 2 * M) * DPR); buf.height = Math.ceil((H + 2 * M) * DPR);
      viewer.paint(bg, state, W + 2 * M, H + 2 * M, DPR, W / 2 + M + state.panX, H / 2 + M + state.panY);
      bufPan = [state.panX, state.panY];
      needPaint = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buf, (state.panX - bufPan[0] - M) * DPR, (state.panY - bufPan[1] - M) * DPR);
  }
  function repaint() { needPaint = true; dirty = true; }
  function moved() {
    const M = viewer.margin;
    if (M && bufPan && (Math.abs(state.panX - bufPan[0]) > M * 0.9 || Math.abs(state.panY - bufPan[1]) > M * 0.9)) needPaint = true;
    dirty = true;
  }
  function frame() {
    if (dirty) { dirty = false; render(); }
    requestAnimationFrame(frame);
  }
  function resize() {
    viewer.W = window.innerWidth; viewer.H = window.innerHeight;
    canvas.width = Math.round(viewer.W * DPR); canvas.height = Math.round(viewer.H * DPR);
    repaint();
  }
  window.addEventListener('resize', resize);

  const changed = kind => { if (viewer.onChange) viewer.onChange(kind); };

  function zoomAt(sx, sy, factor) {
    const next = Math.max(viewer.minZoom, Math.min(viewer.maxZoom, state.scale * factor));
    factor = next / state.scale;
    // keep the world point under (sx, sy) fixed while the scale changes
    state.panX = sx - viewer.W / 2 - (sx - viewer.W / 2 - state.panX) * factor;
    state.panY = sy - viewer.H / 2 - (sy - viewer.H / 2 - state.panY) * factor;
    state.scale = next;
    repaint();
    if (viewer.onZoom) viewer.onZoom();
    changed('zoom');
  }

  // drag to pan, pinch or wheel to zoom, double-tap for whatever the page wants
  const pointers = new Map();
  let pinchDist = 0, pinchMid = null, lastTap = 0, lastTapX = 0, lastTapY = 0;

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      const now = performance.now();
      if (now - lastTap < 320 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 40) {
        if (viewer.onDoubleTap) viewer.onDoubleTap();
        lastTap = 0;
      } else { lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY; }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pinchMid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    if (viewer.onInteract) viewer.onInteract();
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      state.panX += e.clientX - prev[0];
      state.panY += e.clientY - prev[1];
      moved();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (pinchMid) { state.panX += mid[0] - pinchMid[0]; state.panY += mid[1] - pinchMid[1]; }
      if (pinchDist > 0) zoomAt(mid[0], mid[1], dist / pinchDist);
      else moved();
      pinchDist = dist; pinchMid = mid;
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) { pinchDist = 0; pinchMid = null; }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.08 : 1 / 1.08);
  }, { passive: false });

  Object.assign(viewer, { render, repaint, moved, zoomAt, resize });
  resize();
  requestAnimationFrame(frame);
  return viewer;
}

// --------------------------------------------------------------- wall ---
// createWall(canvas, { palettes, motifs, painters, presets, material,
// variants }) is a viewer that paints a wall of tiles. `variants` is how
// many paintings of the design the wall draws from (four unless told
// otherwise; a wall of whole tiles, each its own picture, wants more). It returns the wall, which
// is the viewer with more on it: `state` to read or change, then
// `rebuild(true)` to repaint the tiles or `rebuild(false)` to redraw
// the wall with the tiles it has. `applyPreset(name)`, `newDesign()`
// and `zoomAt(x, y, factor)` do the usual things. Set `onChange(kind)`
// to hear about them ('preset', 'design', 'zoom') and `onInteract()`
// to hear the first touch. `material`, if given, may supply the
// painting hooks above plus `lay` ({ shift, turn }, how far a tile
// strays from its cell), `gapOf(S, state)` (the grout, in pixels),
// `age(ctx, t)` (what age does to one tile, drawn over it in the
// tile's own frame) and `finish(ctx, W, H, state, pal)` (over the wall).
export function createWall(canvas, cfg) {
  const palettes = cfg.palettes, motifs = cfg.motifs, presets = cfg.presets || {};
  const painters = cfg.painters || PAINTERS;
  const material = cfg.material || null, m = material || {};
  const lay = m.lay || { shift: 0.014, turn: 0.016 };
  const variants = cfg.variants || 4;
  const firstMotif = Object.keys(motifs)[0];
  for (const p of Object.values(presets)) if (!p.motif) p.motif = firstMotif;

  const wall = createViewer(canvas, { paint, scale: 120, minZoom: 40, maxZoom: 260 });
  const state = Object.assign(wall.state, {
    seed: 1,
    repeat: 'module',   // module | rotate | single | checker | whole | a wallpaper group
    pal: Object.keys(palettes)[0],
    motif: firstMotif,
    density: 3,         // how much of the design is drawn, 1..5
    hand: 0.5,          // wobble of the brush
    brush: 1,           // line weight
    bands: true,
    grout: true,
    age: false,
  });
  Object.assign(wall, { palettes, motifs, painters, material, presets });
  const tcfg = { palettes, motifs, painters, material };
  const DPR = wall.DPR;

  let tiles = { A: [], B: [] }, needTiles = true;

  function buildTiles() {
    const o = tileOpts(tcfg, state);
    tiles.A = [];
    tiles.B = [];
    for (let v = 0; v < variants; v++) tiles.A.push(makeTile(o, state.scale, DPR, state.seed * 31 + v));
    if (state.repeat === 'checker')
      for (let v = 0; v < 3; v++) tiles.B.push(makeTile({ ...o, plain: true }, state.scale, DPR, state.seed * 37 + v));
    needTiles = false;
  }

  function paint(ctx, st, W, H, dpr, ox, oy) {
    if (needTiles) buildTiles();
    const pal = palettes[state.pal];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.grout;
    ctx.fillRect(0, 0, W, H);

    const S = state.scale;
    const gap = state.grout ? (m.gapOf ? m.gapOf(S, state) : Math.max(1.2, S * 0.022)) : 0;
    const grp = GROUPS[state.repeat];
    if (grp) {
      layWall(ctx, grp, S, gap, W, H, ox, oy, state, pal, m, lay, rng => tiles.A[Math.floor(rng() * tiles.A.length)]);
      if (m.finish) m.finish(ctx, W, H, state, pal);
      else if (state.age) { ctx.fillStyle = 'rgba(90, 60, 20, 0.05)'; ctx.fillRect(0, 0, W, H); }
      return;
    }
    const i0 = Math.floor(-ox / S) - 1, i1 = Math.ceil((W - ox) / S) + 1;
    const j0 = Math.floor(-oy / S) - 1, j1 = Math.ceil((H - oy) / S) + 1;
    const s = S - gap;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const rng = mulberry32(hash2(i, j) + state.seed);
        const cx = ox + (i + 0.5) * S, cy = oy + (j + 0.5) * S;
        let fx = 1, fy = 1, rot = 0, set = tiles.A;
        if (state.repeat === 'module') { fx = i & 1 ? -1 : 1; fy = j & 1 ? -1 : 1; }
        else if (state.repeat === 'rotate') rot = ROT[(i & 1) + ((j & 1) << 1)];
        else if (state.repeat === 'checker' && ((i + j) & 1)) set = tiles.B;
        const img = set[Math.floor(rng() * set.length)];
        ctx.save();
        ctx.translate(cx + (rng() - 0.5) * S * lay.shift * state.hand, cy + (rng() - 0.5) * S * lay.shift * state.hand);
        ctx.rotate(rot + (rng() - 0.5) * lay.turn * state.hand);
        ctx.scale(fx, fy);
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        if (state.age && m.age) {
          m.age(ctx, { i, j, rng, s, S, pal, state, cx: (i + 0.5) * S, cy: (j + 0.5) * S, fx, fy, rot });
        } else if (state.age) {
          ageTile(ctx, rng, s, pal);
        }
        ctx.restore();
      }
    }
    if (m.finish) m.finish(ctx, W, H, state, pal);
    else if (state.age) {
      ctx.fillStyle = 'rgba(90, 60, 20, 0.05)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function rebuild(rebuildTiles) { if (rebuildTiles) needTiles = true; wall.repaint(); }
  const changed = kind => { if (wall.onChange) wall.onChange(kind); };

  function applyPreset(name) {
    const p = presets[name];
    if (!p) return false;
    Object.assign(state, p);
    state.panX = 0; state.panY = 0;
    wall.preset = name;
    rebuild(true);
    changed('preset');
    return true;
  }
  function newDesign() {
    state.seed = 1 + Math.floor(Math.random() * 9999);
    wall.preset = '';
    rebuild(true);
    changed('design');
  }
  // tiles are cached at a pixel size: repaint them once the zoom settles
  let zoomTimer = 0;
  wall.onZoom = () => { clearTimeout(zoomTimer); zoomTimer = setTimeout(() => rebuild(true), 160); };
  wall.onDoubleTap = newDesign;

  Object.assign(wall, { rebuild, applyPreset, newDesign });
  wall.rebuild(false);
  return wall;
}

// ------------------------------------------------------------- chrome ---
// mountChrome(viewer, spec) wires the standard page chrome around any
// viewer: the `#panel` with `#panelHead` and `#panelToggle`, the `.tab`
// buttons switching `#presetsBody` and `#panelBody`, the
// `.card[data-preset]` cards (each holding a canvas for its thumbnail),
// the `#title` overlay that fades on first touch, the `#save` button,
// the `#mood` line, and the controls the spec lists. It reads the
// query string and applies it. Anything missing from the page is
// skipped.
//
// The spec: `presets` (name -> settings), `applyPreset(name)`,
// `thumb(ctx, settings)` to paint a 52px card, `controls`, a list of
// `{ id, key, q, kind, fmt, valId, keep, change }`: `kind` is 'select',
// 'range' or 'check'; `key` is the field of `viewer.state` (the id by
// default); `q` is its name in the query string (the key by default);
// `fmt` renders the value beside a range; `valId` is where
// (`<id>Val` by default); `keep` leaves the preset marked when the
// query string sets it; `change(value)` is what to do after. Then
// `newId` and `onNew` for the button that starts over, `mood(state)`
// for the line under it, `query(q)` for anything else in the query
// string, `fileName` and `suffix(state)` for the saved png,
// `order(state)` (a promise of a blob) for the `#order` button that
// saves one tile at print size, and `ready()` once everything is
// applied.
export function mountChrome(viewer, spec) {
  const doc = spec.document || document;
  const $ = id => doc.getElementById(id);
  const { state } = viewer;
  const presets = spec.presets || {};
  const controls = spec.controls || [];
  const presetCards = doc.querySelectorAll('.card[data-preset]');
  const markPreset = name => presetCards.forEach(c => c.classList.toggle('on', c.dataset.preset === name));
  const text = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const valId = c => c.valId || c.id + 'Val';
  const keyOf = c => c.key || c.id;

  function sync() {
    for (const c of controls) {
      const el = $(c.id), v = state[keyOf(c)];
      if (!el) continue;
      if (c.kind === 'check') el.checked = !!v;
      else el.value = v;
      if (c.kind === 'range') text(valId(c), c.fmt ? c.fmt(v) : String(v));
    }
    if (spec.mood) text('mood', spec.mood(state));
    markPreset(viewer.preset);
  }
  viewer.onChange = () => sync();

  presetCards.forEach(c => c.addEventListener('click', () => { spec.applyPreset(c.dataset.preset); sync(); }));

  // each preset card shows its own small piece of wall
  if (spec.thumb) for (const card of presetCards) {
    const p = presets[card.dataset.preset], tc = card.querySelector('canvas');
    if (!p || !tc) continue;
    spec.thumb(tc.getContext('2d'), p);
  }

  // tabs
  const panelBody = $('panelBody'), presetsBody = $('presetsBody');
  for (const tab of doc.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      doc.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === tab));
      const adv = tab.dataset.tab === 'advanced';
      if (panelBody) panelBody.style.display = adv ? '' : 'none';
      if (presetsBody) presetsBody.style.display = adv ? 'none' : '';
    });
  }

  const edited = () => { viewer.preset = ''; markPreset(''); };
  const parse = (c, el) => c.kind === 'check' ? el.checked : c.kind === 'range' ? (c.int ? parseInt(el.value, 10) : parseFloat(el.value)) : el.value;
  for (const c of controls) {
    const el = $(c.id);
    if (!el) continue;
    el.addEventListener(c.kind === 'range' ? 'input' : 'change', () => {
      const v = parse(c, el);
      state[keyOf(c)] = v;
      if (c.kind === 'range') text(valId(c), c.fmt ? c.fmt(v) : String(v));
      if (!c.keep) edited();
      if (c.change) c.change(v);
    });
  }
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  if (spec.onNew) on(spec.newId || 'newDesign', 'click', () => { spec.onNew(); sync(); });

  const download = (blob, tail) => {
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (spec.fileName || 'wall') + '-' + tail + (spec.suffix ? spec.suffix(state) : state.seed) + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  on('save', 'click', () => viewer.canvas.toBlob(blob => download(blob, '')));
  if (spec.order) on('order', 'click', () => {
    const btn = $('order'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'painting the tile…';
    // let the button say so before the paint holds the page
    setTimeout(() => Promise.resolve()
      .then(() => spec.order(state))
      .then(blob => download(blob, 'tile-'))
      .catch(e => console.error(e))
      .finally(() => { btn.disabled = false; btn.textContent = label; }), 30);
  });

  const panel = $('panel');
  if (panel) {
    on('panelHead', 'click', () => {
      panel.classList.toggle('closed');
      text('panelToggle', panel.classList.contains('closed') ? '+' : '−');
    });
    // on a phone the open panel would cover the art; start it folded
    if (window.innerWidth < 520) {
      panel.classList.add('closed');
      text('panelToggle', '+');
    }
  }

  const titleEl = $('title');
  let titleGone = false;
  function dismissTitle() {
    if (titleGone) return;
    titleGone = true;
    if (titleEl) titleEl.classList.add('gone');
  }
  viewer.onInteract = dismissTitle;
  setTimeout(dismissTitle, 7000);

  // the query string: a preset, then any control by its key, within
  // what the page's own element allows
  const q = new URLSearchParams(location.search);
  spec.applyPreset(q.get('preset') || spec.defaultPreset || Object.keys(presets)[0]);
  for (const c of controls) {
    const k = keyOf(c), qn = c.q || k;
    if (!q.has(qn)) continue;
    const el = $(c.id), raw = q.get(qn);
    let v;
    if (c.kind === 'check') { if (raw !== '0' && raw !== '1') continue; v = raw === '1'; }
    else if (c.kind === 'range') {
      v = c.int ? parseInt(raw, 10) : parseFloat(raw);
      if (!(v >= parseFloat(el ? el.min : -Infinity) && v <= parseFloat(el ? el.max : Infinity))) continue;
    } else {
      if (el && ![...el.options].some(o => o.value === raw)) continue;
      v = raw;
    }
    state[k] = v;
    if (!c.keep) viewer.preset = '';
  }
  if (spec.query) spec.query(q);
  sync();
  if (spec.ready) spec.ready();
  return { sync, dismissTitle, markPreset };
}

// -------------------------------------------------------------- panel ---
// mountPanel(wall, { fileName, defaultPreset }) is mountChrome with the
// tile wall's controls: selects `repeat`, `motif` and `palette`; ranges
// `density`, `hand`, `brush` and `zoom` with `densityVal`, `handVal`,
// `brushVal` and `zoomVal` beside them; checkboxes `bands`, `grout` and
// `age`; the `newDesign` button; the `order` button, which saves one
// tile at print size (`opts.print` is passed to `exportTile`). The query string takes ?preset=,
// ?seed=, ?repeat=, ?pal=, ?motif=, ?density=, ?hand=, ?zoom=, ?bands=0
// and ?age=1.
export function mountPanel(wall, opts) {
  opts = opts || {};
  const { state } = wall;
  const tiles = () => wall.rebuild(true), face = () => wall.rebuild(false);
  return mountChrome(wall, {
    document: opts.document,
    presets: wall.presets,
    defaultPreset: opts.defaultPreset,
    applyPreset: name => wall.applyPreset(name),
    thumb: (g, p) => paintThumb(wall, p, g, 52, 2),
    controls: [
      { id: 'repeat', kind: 'select', change: tiles },
      { id: 'palette', key: 'pal', kind: 'select', change: tiles },
      { id: 'motif', kind: 'select', change: tiles },
      { id: 'density', kind: 'range', int: true, change: tiles },
      { id: 'hand', kind: 'range', fmt: v => Number(v).toFixed(2), change: tiles },
      { id: 'brush', kind: 'range', fmt: v => Number(v).toFixed(1), change: tiles },
      { id: 'zoom', key: 'scale', q: 'zoom', kind: 'range', int: true, fmt: v => Math.round(v) + 'px', keep: true, change: tiles },
      { id: 'bands', kind: 'check', keep: true, change: tiles },
      { id: 'grout', kind: 'check', keep: true, change: face },
      { id: 'age', kind: 'check', keep: true, change: face },
    ],
    newId: 'newDesign', onNew: () => wall.newDesign(),
    mood: s => 'design nº ' + s.seed,
    query: q => { if (q.has('seed')) { state.seed = parseInt(q.get('seed'), 10) || state.seed; wall.preset = ''; } },
    fileName: opts.fileName,
    order: () => exportTile(wall, opts.print),
    ready: tiles,
  });
}
