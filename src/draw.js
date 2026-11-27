// draw: a tile painted by hand, one eighth of it.
//
// Every design the engine paints is symmetric across the diagonal of its
// square, and the repeats do the rest. So a hand only has to draw half
// of the square, the triangle under the diagonal from the main corner
// (0, 0) to the far corner (1, 1): an eighth of a quartered tile. This
// module turns that drawing into a motif. Each stroke is painted once on
// its own side of the diagonal, clipped there, and again reflected onto
// the other side with the same drift, so a petal drawn across the
// diagonal comes out whole and symmetric.
//
// A drawing is a list of strokes `{ k, c, w, pts }`: the kind (`line`,
// `shape` or `dot`), the colour (0 the wash, 1 to 3 an accent, 4 the
// ink), the weight (1 to 8) and the points in design coordinates. It is
// carried in a wall's state as a short string (`encodeDrawing`), two
// bytes a point, so it fits in a query string or a stored value.
//
//   import { drawnMotif, DRAW_PAINTERS, mountPad } from 'azulejeria/draw';
//   const wall = createWall(canvas, { motifs: { drawn: drawnMotif() },
//                                     painters: { ...PAINTERS, ...DRAW_PAINTERS }, ... });
//   mountPad(wall);

import { mulberry32, wash, ink, makeDesign, paintDesign, hexA } from './azulejeria.js';

export const KINDS = ['line', 'shape', 'dot'];
export const MAX_POINTS = 96;     // a stroke is simplified until it has no more than this

// ----------------------------------------------------------- encoding ---
// A version byte, then per stroke a header byte (kind in bits 0-1,
// colour in 2-4, weight less one in 5-7), a point count and the points,
// x then y, each a byte over the unit square. Base64url.
const byte = v => Math.max(0, Math.min(255, Math.round(v * 255)));

export function encodeDrawing(strokes) {
  const bytes = [1];
  for (const s of strokes || []) {
    const k = KINDS.indexOf(s.k);
    const pts = (s.pts || []).slice(0, 255);
    if (k < 0 || !pts.length) continue;
    const c = Math.max(0, Math.min(4, s.c | 0)), w = Math.max(1, Math.min(8, s.w | 0));
    bytes.push(k | (c << 2) | ((w - 1) << 5), pts.length);
    for (const [x, y] of pts) bytes.push(byte(x), byte(y));
  }
  if (bytes.length === 1) return '';
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// anything it cannot read it drops: a drawing from a bad link is empty
export function decodeDrawing(str) {
  if (!str || typeof str !== 'string') return [];
  let bin;
  try { bin = atob(str.replace(/-/g, '+').replace(/_/g, '/')); } catch (e) { return []; }
  if (bin.charCodeAt(0) !== 1) return [];
  const out = [];
  let i = 1;
  while (i + 2 <= bin.length) {
    const h = bin.charCodeAt(i++), n = bin.charCodeAt(i++);
    if (!n || i + 2 * n > bin.length) break;
    const pts = [];
    for (let j = 0; j < n; j++) pts.push([bin.charCodeAt(i++) / 255, bin.charCodeAt(i++) / 255]);
    const k = KINDS[h & 3], c = (h >> 2) & 7;
    if (k && c <= 4) out.push({ k, c, w: (h >> 5) + 1, pts });
  }
  return out;
}

// ------------------------------------------------------------ strokes ---
// Ramer-Douglas-Peucker: drop the points a line through their
// neighbours would pass within `eps` of
export function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy);
    let far = -1, fd = eps;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = dl ? Math.abs(dy * (px - ax) - dx * (py - ay)) / dl : Math.hypot(px - ax, py - ay);
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Chaikin's corners, cut twice: a hand's polyline as a curve
export function smooth(pts, closed, times) {
  let p = pts;
  for (let t = 0; t < (times === undefined ? 2 : times); t++) {
    if (p.length < 3) return p;
    const q = closed ? [] : [p[0]];
    const n = closed ? p.length : p.length - 1;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

const swap = pts => pts.map(([x, y]) => [y, x]);

// A stroke as it is kept: inside the square, on the drawn side of the
// diagonal (a stroke drawn mostly on the other side is reflected over),
// and simplified to no more than MAX_POINTS.
export function settle(stroke) {
  let pts = stroke.pts.map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]);
  if (!pts.length) return null;
  const lean = pts.reduce((s, [x, y]) => s + (y - x), 0);
  if (lean > 0) pts = swap(pts);
  if (stroke.k === 'dot') pts = [pts[0]];
  else {
    let eps = 0.004;
    pts = simplify(pts, eps);
    while (pts.length > MAX_POINTS) pts = simplify(pts, eps *= 1.5);
    if (stroke.k === 'shape' && pts.length < 3) return null;
    if (stroke.k === 'line' && pts.length < 2) return null;
  }
  return { k: stroke.k, c: stroke.c | 0, w: stroke.w | 0 || 1, pts };
}

// a band either side of a polyline, as a closed outline
function ribbon(pts, h) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
    const dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d * h, ny = dx / d * h;
    L.push([pts[i][0] + nx, pts[i][1] + ny]);
    R.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  return L.concat(R.reverse());
}

// The brush's drift along a whole stroke: two slow sines across its
// length, pushed along the normal. The engine's `polyPts` drifts each
// side of a polygon, which suits a shape with a few long sides; a
// hand's stroke is hundreds of short ones and wants one drift from end
// to end. A closed stroke takes whole numbers of waves so it closes.
// Four numbers from the rng, whatever the stroke.
function drift(pts, closed, amp, rng) {
  const p1 = rng() * 6.283, p2 = rng() * 6.283, a = rng(), b = rng();
  const n = pts.length;
  if (n < 2 || !amp) return pts;
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = (len[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0)) || 1;
  // so many waves to a tile's side, not to a stroke: a short stroke gets part of one
  const k = Math.max(0.3, Math.min(2.5, total / 0.8));
  const f1 = closed ? Math.max(1, Math.round((2 + a) * k)) : (1.5 + a * 2) * k;
  const f2 = closed ? Math.max(2, Math.round((5 + b * 3) * k)) : (4 + b * 4) * k;
  return pts.map((p, i) => {
    const q = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], r = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = r[0] - q[0], dy = r[1] - q[1], d = Math.hypot(dx, dy) || 1, t = len[i] / total * 6.283;
    const w = (Math.sin(t * f1 + p1) * 0.65 + Math.sin(t * f2 + p2) * 0.35) * amp;
    return [p[0] - dy / d * w, p[1] + dx / d * w];
  });
}

// two layers the size of the tile, for the halves of a glazed stroke
let LAYERS = null;
function layers(g) {
  const w = g.canvas.width, h = g.canvas.height;
  if (!LAYERS) LAYERS = [0, 1].map(() => { const c = document.createElement('canvas'); return c.getContext('2d'); });
  for (const l of LAYERS) {
    if (l.canvas.width !== w || l.canvas.height !== h) { l.canvas.width = w; l.canvas.height = h; }
    else { l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, w, h); }
    l.setTransform(g.getTransform());
    l.lineCap = 'round'; l.lineJoin = 'round';
  }
  return LAYERS;
}

// ----------------------------------------------------------- painters ---
// `stroke` paints one stroke of a drawing and its reflection. The drift
// is laid once and the brush's random numbers are dealt the same to
// both halves, so the two meet on the diagonal without a seam in the
// line. Glaze is translucent, so its halves are painted on a layer
// each, clipped exactly at the diagonal, and added together: where the
// two soft edges share a pixel their cover sums to one, and no hairline
// shows. A material's `shape`, `line` and `dot` are used when it has
// them, so a drawing comes out in clay or cement as readily as in
// glaze; those are opaque and paint straight on, the drawn half a hair
// past the diagonal. A coloured line is a ribbon, which is a shape.
export const DRAW_PAINTERS = {
  stroke(el, b) {
    const { g, pal } = b;
    const m = b.material || {};
    const seed = Math.floor(b.rng() * 2147483647);
    const col = el.c === 4 ? pal.ink
      : el.c === 0 || !pal.accents.length ? pal.wash
      : pal.accents[(el.c - 1) % pal.accents.length];
    const t = g.getTransform ? g.getTransform() : { a: 100, b: 0 };
    const eps = 0.8 / (Math.hypot(t.a, t.b) || 100);
    const width = b.lw * el.w;
    const r0 = mulberry32(seed);

    let path = null;
    const fill = el.k === 'shape' || (el.k === 'line' && el.c !== 4);
    if (el.k === 'shape' && el.pts.length >= 3) path = drift(smooth(el.pts, true, 3), true, b.amp, r0);
    else if (el.k === 'line' && el.pts.length >= 2) {
      const line = drift(smooth(el.pts, false, 3), false, b.amp, r0);
      path = el.c === 4 ? line : ribbon(line, width * 0.9);
    } else if (el.k !== 'dot') return;
    const own = m.shape || m.line || m.dot;            // the material paints, straight onto the tile
    const L = own ? null : layers(g);

    const rng0 = b.rng, col0 = b.col, g0 = g;
    for (const half of [0, 1]) {
      const rr = mulberry32(seed + 1);
      const g = L ? L[half] : g0, e = L ? 0 : eps;
      g.save();
      g.beginPath();
      if (half) { g.moveTo(-1, -1); g.lineTo(2, 2); g.lineTo(-1, 2); }
      else { g.moveTo(-1, -1); g.lineTo(-1, -1 + e); g.lineTo(2, 2 + e); g.lineTo(2, -1); }
      g.closePath();
      g.clip();
      b.rng = rr; b.col = col;
      if (el.k === 'dot') {
        for (const [x0, y0] of el.pts) {
          const [x, y] = half ? [y0, x0] : [x0, y0], r = width * 0.8;
          if (m.dot) m.dot(g, x, y, r, col, 0.88, b);
          else { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fillStyle = col; g.globalAlpha = 0.88; g.fill(); g.globalAlpha = 1; }
        }
      } else {
        const P = half ? swap(path) : path;
        if (fill) {
          if (m.shape) m.shape(g, P, col, b);
          else { wash(g, P, col, rr); ink(g, P, b.lw, pal, rr, true); }
        } else if (m.line) m.line(g, P, width, false, b);
        else ink(g, P, width, pal, rr, false);
      }
      g.restore();
    }
    b.rng = rng0; b.col = col0;
    if (L) {
      L[0].setTransform(1, 0, 0, 1, 0, 0);
      L[0].globalCompositeOperation = 'lighter';
      L[0].drawImage(L[1].canvas, 0, 0);
      L[0].globalCompositeOperation = 'source-over';
      g0.save(); g0.setTransform(1, 0, 0, 1, 0, 0); g0.drawImage(L[0].canvas, 0, 0); g0.restore();
    }
  },
};

// ------------------------------------------------------------- motif ---
// The motif that paints the drawing in `state[key]` ('d' by default),
// with the engine's band across the far corner when bands are on.
export function drawnMotif(key) {
  key = key || 'd';
  return ({ state, bands }) => {
    const els = decodeDrawing(state && state[key]).map(s => ({ t: 'stroke', ...s }));
    if (bands) els.push({ t: 'band', kind: 'circle', w: 0.045, role: 'wash' });
    return els;
  };
}

// --------------------------------------------------------------- pad ---
// mountPad(wall, opts) wires a drawing pad to a wall whose motif is
// `drawnMotif`. The page provides, inside `#pad`: a canvas `#padCanvas`;
// buttons `.tool[data-tool]` (line, shape, dot); an empty `#swatches`
// the palette's colours are put in; a range `#weight`; buttons `#undo`
// and `#clear`; and `#padHead` with `#padToggle` to fold it. Anything
// missing is skipped. The pad shows the square of the design in the
// wall's own palette, brush and material, with the reflected half
// dimmed; you draw in the bright half. Every stroke is written to
// `wall.state[key]` and the wall repaints, while you draw as well as
// after. `opts.onEdit(d)` hears each change (to put it in the address,
// say). Cmd or Ctrl Z undoes. Returns `{ render, undo, clear }`.
export function mountPad(wall, opts) {
  opts = opts || {};
  const doc = opts.document || document;
  const $ = id => doc.getElementById(id);
  const key = opts.key || 'd';
  const canvas = $(opts.canvasId || 'padCanvas');
  const { state } = wall;
  const pen = { tool: 'shape', c: 0, w: 3 };
  const history = [];
  let strokes = decodeDrawing(state[key]), seen = state[key], live = null, liveTimer = 0, queued = false, palSeen = null;
  const M = 10;   // the margin round the square, css pixels

  function write(list) {
    state[key] = encodeDrawing(list);
    seen = state[key];
    wall.preset = '';
    wall.rebuild(true);
    if (opts.onEdit) opts.onEdit(state[key]);
  }
  function commit(next) {
    history.push(strokes);
    if (history.length > 200) history.shift();
    strokes = next;
    write(strokes);
    schedule();
  }
  function undo() { if (history.length) { strokes = history.pop(); write(strokes); schedule(); } }
  function clear() { if (strokes.length) commit([]); }

  function swatches(pal) {
    const box = $('swatches');
    if (!box) return;
    const cols = [pal.wash, ...pal.accents.slice(0, 3), pal.ink];
    const ids = [0, ...pal.accents.slice(0, 3).map((_, i) => i + 1), 4];
    if (!ids.includes(pen.c)) pen.c = 0;
    box.innerHTML = '';
    ids.forEach((c, i) => {
      const s = doc.createElement('button');
      s.className = 'sw' + (c === pen.c ? ' on' : '');
      s.style.background = cols[i];
      s.title = c === 0 ? 'wash' : c === 4 ? 'ink' : 'accent ' + c;
      s.addEventListener('click', () => { pen.c = c; box.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === s)); });
      box.appendChild(s);
    });
  }

  function render() {
    queued = false;
    if (!canvas) return;
    if (state[key] !== seen) { strokes = decodeDrawing(state[key]); seen = state[key]; history.length = 0; }
    const pal = wall.palettes[state.pal];
    if (pal !== palSeen) { palSeen = pal; swatches(pal); }
    const W = canvas.clientWidth || 200, DPR = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(W * DPR);
    // both, because a canvas starts at 300 by 150: a 150px pad at 2x already has the right width
    if (canvas.width !== px || canvas.height !== px) { canvas.width = canvas.height = px; }
    const g = canvas.getContext('2d');
    const S = W - 2 * M;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = pal.grout; g.fillRect(0, 0, W, W);
    g.translate(M, M);
    g.fillStyle = pal.glaze; g.fillRect(0, 0, S, S);
    const m = wall.material || {};
    if (m.surface) m.surface(g, S, pal, mulberry32(state.seed));
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.save(); g.scale(S, S);
    const list = live ? strokes.concat([settle(live) || []]).filter(s => s.pts) : strokes;
    const view = { ...state, [key]: encodeDrawing(list) };
    const design = makeDesign(state.seed, state.density, state.bands, 1, wall.motifs[state.motif], view);
    paintDesign(g, design, pal, state.hand, 0.012 * state.brush, state.seed * 31 + 17, wall.painters, wall.material, state.brush);
    // the reflected half, dimmed, and the diagonal
    g.beginPath(); g.moveTo(0, 0); g.lineTo(1, 1); g.lineTo(0, 1); g.closePath();
    g.fillStyle = hexA(pal.grout, 0.55); g.fill();
    g.restore();
    g.setLineDash([3, 4]); g.strokeStyle = hexA(pal.ink, 0.45); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(S, S); g.stroke(); g.setLineDash([]);
    // the main corner, where four tiles (or the four quarters) meet
    g.beginPath(); g.arc(0, 0, 4, 0, 6.283); g.fillStyle = hexA(pal.ink, 0.7); g.fill();
    // the stroke under the pen, as drawn
    if (live && live.pts.length > 1) {
      g.beginPath();
      live.pts.forEach(([x, y], i) => (i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
      if (live.k === 'shape') g.closePath();
      g.strokeStyle = hexA(pal.ink, 0.6); g.lineWidth = 1.2; g.stroke();
    }
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(render); } }

  // the wall tells the pad when the palette, brush, preset or seed changes
  const rebuild = wall.rebuild;
  wall.rebuild = t => { rebuild(t); schedule(); };
  const changed = wall.onChange;
  wall.onChange = k => { if (changed) changed(k); schedule(); };

  if (canvas) {
    const at = e => {
      const r = canvas.getBoundingClientRect(), S = r.width - 2 * M;
      return [(e.clientX - r.left - M) / S, (e.clientY - r.top - M) / S];
    };
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = at(e);
      if (pen.tool === 'dot') {
        const s = settle({ k: 'dot', c: pen.c, w: pen.w, pts: [p] });
        if (s) commit(strokes.concat([s]));
        return;
      }
      live = { k: pen.tool, c: pen.c, w: pen.w, pts: [p] };
      schedule();
    });
    canvas.addEventListener('pointermove', e => {
      if (!live) return;
      const p = at(e), q = live.pts[live.pts.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.004) return;
      live.pts.push(p);
      schedule();
      // the wall follows the pen, a few times a second
      if (!liveTimer) liveTimer = setTimeout(() => {
        liveTimer = 0;
        if (!live) return;
        const s = settle(live);
        state[key] = encodeDrawing(s ? strokes.concat([s]) : strokes);
        seen = state[key];
        wall.rebuild(true);
      }, 70);
    });
    const end = () => {
      if (!live) return;
      const s = settle(live);
      live = null;
      clearTimeout(liveTimer); liveTimer = 0;
      if (s) commit(strokes.concat([s]));
      else { write(strokes); schedule(); }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  doc.querySelectorAll('.tool[data-tool]').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.tool === pen.tool);
    btn.addEventListener('click', () => {
      pen.tool = btn.dataset.tool;
      doc.querySelectorAll('.tool[data-tool]').forEach(x => x.classList.toggle('on', x === btn));
    });
  });
  const weight = $('weight');
  if (weight) {
    weight.value = pen.w;
    const val = $('weightVal');
    if (val) val.textContent = pen.w;
    weight.addEventListener('input', () => { pen.w = parseInt(weight.value, 10) || 1; if (val) val.textContent = pen.w; });
  }
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  on('undo', undo);
  on('clear', clear);
  doc.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) {
      e.preventDefault(); undo();
    }
  });
  const box = $('pad');
  on('padHead', () => {
    if (!box) return;
    box.classList.toggle('closed');
    const t = $('padToggle');
    if (t) t.textContent = box.classList.contains('closed') ? '+' : '−';
    schedule();
  });
  window.addEventListener('resize', schedule);
  schedule();
  return { render: schedule, undo, clear };
}
