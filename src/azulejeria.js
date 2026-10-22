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
// laid once or four times), the wall (tiles repeated with a symmetry,
// each turned and shifted a little, some crazed) and the standard
// control panel. Motifs, palettes and presets belong to the page that
// uses it. See README.md for the shape of each.

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
// scatter that higher densities add.
export function makeDesign(seed, density, bands, bold, motif) {
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
  return motif({ rng, density, bands, bold, pick, role, dots });
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

// paints one design into the unit square of g (already scaled)
export function paintDesign(g, els, pal, hand, lw, jseed, painters) {
  const rng = mulberry32(jseed);
  const amp = 0.012 * hand;
  const Q = Math.PI / 2, D = Q / 2;
  const dc = Math.cos(D), ds = Math.sin(D);       // the diagonal
  const shape = (pts, col) => { wash(g, pts, col, rng); ink(g, pts, lw, pal, rng, true); };
  const dot = (x, y, r, col, a) => {
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
  const b = { g, pal, lw, amp, rng, Q, D, dc, ds, shape, dot, petal, kite, lobes, altOf, col: pal.wash };
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
// corner at bottom right, for the module to complete. `o.plain` paints
// the small tile a checker alternates with.
export function makeTile(o, S, k, jseed) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(S * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  const rng = mulberry32(jseed);
  const pal = o.pal;
  g.fillStyle = pal.glaze;
  g.fillRect(0, 0, S, S);
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
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (o.plain) {
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
      paintDesign(g, o.design, pal, o.hand, 0.024 * o.brush, jseed + 17 + v++, o.painters);
      g.restore();
    }
  } else {
    g.save(); g.translate(S, S); g.scale(-S, -S);
    paintDesign(g, o.design, pal, o.hand, 0.012 * o.brush, jseed + 17, o.painters);
    g.restore();
  }
  return c;
}

export const REPEATS = ['module', 'rotate', 'single', 'checker'];
const ROT = [0, Math.PI / 2, 3 * Math.PI / 2, Math.PI];

// the tile options for a given state (preset or live)
export function tileOpts(cfg, s) {
  const pal = cfg.palettes[s.pal];
  const quarter = s.repeat === 'single' || s.repeat === 'checker';
  const design = makeDesign(s.seed, s.density, s.bands, quarter ? 1.35 : 1, cfg.motifs[s.motif]);
  return { pal, design, quarter, hand: s.hand, brush: s.brush, painters: cfg.painters };
}

// a small wall of four tiles, for a preset card
export function paintThumb(cfg, p, g, T, k) {
  const o = tileOpts(cfg, p);
  const A = makeTile(o, T, k, p.seed * 31);
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

// --------------------------------------------------------------- wall ---
// createWall(canvas, { palettes, motifs, painters, presets }) paints a
// wall that fills the canvas, and handles drag, pinch, wheel and the
// double tap. It returns the wall: `state` to read or change, then
// `rebuild(true)` to repaint the tiles or `rebuild(false)` to redraw
// the wall with the tiles it has. `applyPreset(name)`, `newDesign()`
// and `zoomAt(x, y, factor)` do the usual things. Set `onChange(kind)`
// to hear about them ('preset', 'design', 'zoom') and `onInteract()`
// to hear the first touch.
export function createWall(canvas, cfg) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const palettes = cfg.palettes, motifs = cfg.motifs, presets = cfg.presets || {};
  const painters = cfg.painters || PAINTERS;
  const firstMotif = Object.keys(motifs)[0];
  for (const p of Object.values(presets)) if (!p.motif) p.motif = firstMotif;

  const state = {
    seed: 1,
    repeat: 'module',   // module | rotate | single | checker
    pal: Object.keys(palettes)[0],
    motif: firstMotif,
    density: 3,         // how much of the design is drawn, 1..5
    hand: 0.5,          // wobble of the brush
    brush: 1,           // line weight
    scale: 120,         // pixels per tile
    panX: 0, panY: 0,
    bands: true,
    grout: true,
    age: false,
  };
  const wall = { canvas, ctx, state, palettes, motifs, painters, presets, preset: '', W: 0, H: 0, onChange: null, onInteract: null };
  const tcfg = { palettes, motifs, painters };

  let tiles = { A: [], B: [] }, needTiles = true, dirty = true;

  function buildTiles() {
    const o = tileOpts(tcfg, state);
    tiles.A = [];
    tiles.B = [];
    for (let v = 0; v < 4; v++) tiles.A.push(makeTile(o, state.scale, DPR, state.seed * 31 + v));
    if (state.repeat === 'checker')
      for (let v = 0; v < 3; v++) tiles.B.push(makeTile({ ...o, plain: true }, state.scale, DPR, state.seed * 37 + v));
    needTiles = false;
  }

  function render() {
    if (needTiles) buildTiles();
    const pal = palettes[state.pal];
    const W = wall.W, H = wall.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.grout;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const S = state.scale;
    const gap = state.grout ? Math.max(1.2, S * 0.022) : 0;
    const ox = W / 2 + state.panX, oy = H / 2 + state.panY;
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
        ctx.translate(cx + (rng() - 0.5) * S * 0.014 * state.hand, cy + (rng() - 0.5) * S * 0.014 * state.hand);
        ctx.rotate(rot + (rng() - 0.5) * 0.016 * state.hand);
        ctx.scale(fx, fy);
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        if (state.age) {
          // a warm cast on some, a craze on a few, a chipped corner on fewer
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
        ctx.restore();
      }
    }
    if (state.age) {
      ctx.fillStyle = 'rgba(90, 60, 20, 0.05)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function rebuild(rebuildTiles) { if (rebuildTiles) needTiles = true; dirty = true; }
  function frame() {
    if (dirty) { dirty = false; render(); }
    requestAnimationFrame(frame);
  }
  function resize() {
    wall.W = window.innerWidth; wall.H = window.innerHeight;
    canvas.width = Math.round(wall.W * DPR); canvas.height = Math.round(wall.H * DPR);
    rebuild(false);
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

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

  // drag to pan, pinch or wheel to zoom, double-tap for a new design
  const pointers = new Map();
  let pinchDist = 0, pinchMid = null, lastTap = 0, lastTapX = 0, lastTapY = 0, zoomTimer = 0;

  function zoomAt(sx, sy, factor) {
    const next = Math.max(40, Math.min(260, state.scale * factor));
    factor = next / state.scale;
    state.panX = sx - wall.W / 2 - (sx - wall.W / 2 - state.panX) * factor;
    state.panY = sy - wall.H / 2 - (sy - wall.H / 2 - state.panY) * factor;
    state.scale = next;
    // tiles are cached at a pixel size: repaint them once the zoom settles
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => rebuild(true), 160);
    rebuild(false);
    changed('zoom');
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      const now = performance.now();
      if (now - lastTap < 320 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 40) {
        newDesign();
        lastTap = 0;
      } else { lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY; }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pinchMid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    if (wall.onInteract) wall.onInteract();
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      state.panX += e.clientX - prev[0];
      state.panY += e.clientY - prev[1];
      rebuild(false);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (pinchMid) { state.panX += mid[0] - pinchMid[0]; state.panY += mid[1] - pinchMid[1]; }
      if (pinchDist > 0) zoomAt(mid[0], mid[1], dist / pinchDist);
      else rebuild(false);
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

  Object.assign(wall, { rebuild, render, applyPreset, newDesign, zoomAt, resize, DPR });
  return wall;
}

// -------------------------------------------------------------- panel ---
// mountPanel(wall, { fileName, defaultPreset }) wires the standard
// control panel: the elements with the ids repeat, motif, palette,
// density, hand, brush, zoom, bands, grout, age, newDesign, mood,
// save, panel, panelHead, panelToggle, presetsBody, panelBody, the
// `.tab` buttons, the `.card[data-preset]` cards (each with a canvas
// for its thumbnail) and the `#title` overlay. It reads the query
// string (?preset=, ?seed=, ?repeat=, ?pal=, ?motif=, ?density=,
// ?hand=, ?zoom=, ?bands=0, ?age=1) and applies it. Anything missing
// from the page is skipped.
export function mountPanel(wall, opts) {
  opts = opts || {};
  const doc = opts.document || document;
  const $ = id => doc.getElementById(id);
  const { state, presets } = wall;
  const presetCards = doc.querySelectorAll('.card[data-preset]');
  const markPreset = name => presetCards.forEach(c => c.classList.toggle('on', c.dataset.preset === name));
  const set = (id, v) => { const el = $(id); if (el) el.value = v; };
  const text = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const check = (id, v) => { const el = $(id); if (el) el.checked = v; };

  function syncZoom() {
    set('zoom', Math.round(state.scale)); text('zoomVal', Math.round(state.scale) + 'px');
  }
  function syncControls() {
    set('repeat', state.repeat);
    set('palette', state.pal);
    set('motif', state.motif);
    set('density', state.density); text('densityVal', state.density);
    set('hand', state.hand); text('handVal', Number(state.hand).toFixed(2));
    set('brush', state.brush); text('brushVal', Number(state.brush).toFixed(1));
    syncZoom();
    check('bands', state.bands); check('grout', state.grout); check('age', state.age);
    text('mood', 'design nº ' + state.seed);
    markPreset(wall.preset);
  }
  wall.onChange = kind => { if (kind === 'zoom') syncZoom(); else syncControls(); };

  presetCards.forEach(c => c.addEventListener('click', () => wall.applyPreset(c.dataset.preset)));

  // each preset card shows its own wall, four tiles of it
  for (const card of presetCards) {
    const p = presets[card.dataset.preset], tc = card.querySelector('canvas');
    if (!p || !tc) continue;
    paintThumb(wall, p, tc.getContext('2d'), 52, 2);
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

  const edited = () => { wall.preset = ''; markPreset(''); };
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  on('repeat', 'change', e => { state.repeat = e.target.value; edited(); wall.rebuild(true); });
  on('palette', 'change', e => { state.pal = e.target.value; edited(); wall.rebuild(true); });
  on('motif', 'change', e => { state.motif = e.target.value; edited(); wall.rebuild(true); });
  on('density', 'input', e => { state.density = parseInt(e.target.value, 10); text('densityVal', state.density); edited(); wall.rebuild(true); });
  on('hand', 'input', e => { state.hand = parseFloat(e.target.value); text('handVal', state.hand.toFixed(2)); edited(); wall.rebuild(true); });
  on('brush', 'input', e => { state.brush = parseFloat(e.target.value); text('brushVal', state.brush.toFixed(1)); edited(); wall.rebuild(true); });
  on('zoom', 'input', e => { state.scale = parseInt(e.target.value, 10); text('zoomVal', state.scale + 'px'); edited(); wall.rebuild(true); });
  on('bands', 'change', e => { state.bands = e.target.checked; edited(); wall.rebuild(true); });
  on('grout', 'change', e => { state.grout = e.target.checked; wall.rebuild(false); });
  on('age', 'change', e => { state.age = e.target.checked; wall.rebuild(false); });
  on('newDesign', 'click', () => wall.newDesign());

  on('save', 'click', () => {
    wall.canvas.toBlob(blob => {
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (opts.fileName || 'wall') + '-' + state.seed + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  });

  const panel = $('panel');
  if (panel) {
    on('panelHead', 'click', () => {
      panel.classList.toggle('closed');
      text('panelToggle', panel.classList.contains('closed') ? '+' : '−');
    });
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
  wall.onInteract = dismissTitle;
  setTimeout(dismissTitle, 7000);

  // shareable settings, e.g. ?preset=triana or ?seed=4242&repeat=rotate&pal=coimbra&motif=laceria
  const q = new URLSearchParams(location.search);
  wall.applyPreset(q.get('preset') || opts.defaultPreset || Object.keys(presets)[0]);
  if (q.has('seed')) { state.seed = parseInt(q.get('seed'), 10) || state.seed; wall.preset = ''; }
  if (q.has('repeat') && REPEATS.includes(q.get('repeat'))) state.repeat = q.get('repeat');
  if (q.has('pal') && wall.palettes[q.get('pal')]) state.pal = q.get('pal');
  if (q.has('motif') && wall.motifs[q.get('motif')]) state.motif = q.get('motif');
  const de = parseInt(q.get('density'), 10);
  if (de >= 1 && de <= 5) state.density = de;
  const ha = parseFloat(q.get('hand'));
  if (ha >= 0 && ha <= 1) state.hand = ha;
  const z = parseInt(q.get('zoom'), 10);
  if (z >= 40 && z <= 260) state.scale = z;
  if (q.get('bands') === '0') state.bands = false;
  if (q.get('age') === '1') state.age = true;
  syncControls();
  wall.rebuild(true);
  return { syncControls, dismissTitle };
}
