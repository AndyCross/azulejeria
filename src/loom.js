// loom: cloth by rule.
//
// A weaving draft is a small program. The threading says which shaft
// each warp end is drawn through, the tie-up says which shafts each
// treadle lifts, and the treadling says which treadle is pressed for
// each pick of the weft. Where an end's shaft is lifted the warp lies
// over the weft; everywhere else the weft lies over the warp. That is
// the whole of the structure, and `lifted` is the whole of the rule.
//
// The colour is a second program laid over the first. A sett is a
// string of colours and thread counts, "K4 R24 K24 Y4", and the cloth
// shows a thread's colour wherever that thread is on top.
//
// Nothing above the last section needs a document, so the rule can be
// tested without a browser.

const mod = (n, m) => ((n % m) + m) % m;

// ------------------------------------------------------------- drafts ---
// threading: a shaft for each end, repeating. tieup: for each treadle,
// the shafts it lifts. treadling: a treadle for each pick, repeating.
const TWILL_TIE = [[0, 1], [1, 2], [2, 3], [3, 0]];
export const DRAFTS = {
  // over one, under one
  plain:       { threading: [0, 1], tieup: [[0], [1]], treadling: [0, 1] },
  // 2/2 twill: over two, under two, stepping one along each pick. The cloth of tartan
  twill:       { threading: [0, 1, 2, 3], tieup: TWILL_TIE, treadling: [0, 1, 2, 3] },
  // 3/1 twill: the warp shows on the face. Denim
  drill:       { threading: [0, 1, 2, 3], tieup: [[0, 1, 2], [1, 2, 3], [2, 3, 0], [3, 0, 1]], treadling: [0, 1, 2, 3] },
  // the twill turned back on itself every eight ends, with a break at the turn
  herringbone: { threading: [0, 1, 2, 3, 0, 1, 2, 3, 1, 0, 3, 2, 1, 0, 3, 2], tieup: TWILL_TIE, treadling: [0, 1, 2, 3] },
  // the twill turned back in the weft as well: diamonds
  diamond:     { threading: [0, 1, 2, 3, 0, 1, 2, 3, 2, 1, 0, 3, 2, 1], tieup: TWILL_TIE, treadling: [0, 1, 2, 3, 0, 1, 2, 3, 2, 1, 0, 3, 2, 1] },
  // plain weave with every thread doubled
  basket:      { threading: [0, 0, 1, 1], tieup: [[0], [1]], treadling: [0, 0, 1, 1] },
};
export const DRAFT_NAMES = Object.keys(DRAFTS);

// is warp end i over the weft at pick j?
export function lifted(draft, i, j) {
  const shaft = draft.threading[mod(i, draft.threading.length)];
  return draft.tieup[draft.treadling[mod(j, draft.treadling.length)]].includes(shaft);
}

// the drawdown of one repeat: w ends by h picks, 1 where the warp is up
export function drawdown(draft) {
  const w = draft.threading.length, h = draft.treadling.length, m = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m[j * w + i] = lifted(draft, i, j) ? 1 : 0;
  return { w, h, m };
}

// --------------------------------------------------------------- setts ---
// A sett is written as the weavers write it: a colour code and a
// count, over and over. "K4 R24 K24 Y4" is four black, twenty-four
// red, twenty-four black, four yellow. A colour is one or two letters
// (K black, R red, G green, B blue, Y yellow, W white, N grey, P
// purple, O orange, T brown, A azure, with L or D in front for light
// and dark) or a hex colour, #c8102e. A slash may sit between the
// colour and the count, as it does at the pivots of a registered
// threadcount ("B/24 K4 ... B/4"), and is ignored: a sett is taken to
// turn back at both ends, the first and last stripes being the pivots
// and counted once, unless it is written with "..." in it, which
// says it simply repeats.
export function parseSett(text) {
  const t = String(text || '');
  const stripes = [];
  const re = /(#[0-9a-fA-F]{6}|[A-Za-z]{1,2})\s*\/?\s*(\d{1,3})/g;
  let m;
  while ((m = re.exec(t)) && stripes.length < 64) {
    const n = Math.min(400, parseInt(m[2], 10));
    if (n > 0) stripes.push({ code: m[1][0] === '#' ? m[1].toLowerCase() : m[1].toUpperCase(), n });
  }
  return { stripes, mirror: !t.includes('...') };
}

// one repeat of the sett, a colour code for each thread
export function threadsOf(sett) {
  const s = sett.stripes;
  if (!s.length) return ['N'];
  const order = sett.mirror && s.length > 2 ? s.concat(s.slice(1, -1).reverse()) : s;
  const out = [];
  for (const { code, n } of order) for (let k = 0; k < n; k++) out.push(code);
  return out;
}

// the sett written back out, as the register would have it
export function writeSett(sett) {
  const s = sett.stripes;
  if (!sett.mirror) return s.map(x => x.code + x.n).join(' ') + ' ...';
  return s.map((x, i) => x.code + (i === 0 || i === s.length - 1 ? '/' : '') + x.n).join(' ');
}

// --------------------------------------------------------------- dyes ---
// The same sett in three dye lots. Modern is the aniline dye of the
// mills, ancient the paler shades the vegetable dyes are supposed to
// have given, weathered what a plaid looks like after a century in a
// peat bog.
export const DYES = {
  modern:    { K: '#101010', R: '#c80000', G: '#006818', B: '#2c2c80', Y: '#e8c000', W: '#e0e0e0', N: '#808080', P: '#780078', O: '#d87c00', T: '#604000', A: '#5c8cd0', M: '#901c38', C: '#b01030' },
  ancient:   { K: '#2a2a2a', R: '#d4542c', G: '#4f8a4a', B: '#5a86b8', Y: '#e6cc5c', W: '#f0ebdd', N: '#9a9a94', P: '#9a5a9a', O: '#e89a3c', T: '#8a6a3a', A: '#8cb4dc', M: '#b0506a', C: '#c8485a' },
  weathered: { K: '#4c4a48', R: '#a2553f', G: '#6f7046', B: '#5a6c80', Y: '#c2a85e', W: '#d9d0bd', N: '#8f8a80', P: '#7d6478', O: '#b9814a', T: '#75603f', A: '#8a9cab', M: '#8f5a5c', C: '#9c5450' },
};
const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// a code as [r, g, b] in a dye lot: a letter, a letter with L or D
// before it, or a hex colour as it stands
export function dyeOf(code, dye) {
  const lot = typeof dye === 'string' ? DYES[dye] || DYES.modern : dye;
  if (code[0] === '#') return rgbOf(code);
  if (lot[code]) return rgbOf(lot[code]);
  if (code.length === 2 && (code[0] === 'L' || code[0] === 'D') && lot[code[1]]) {
    const c = rgbOf(lot[code[1]]), to = code[0] === 'L' ? 255 : 0, t = code[0] === 'L' ? 0.4 : 0.35;
    return c.map(v => Math.round(v + (to - v) * t));
  }
  return rgbOf(lot.N);
}

// -------------------------------------------------------------- cloth ---
// Fills `data` (RGBA, w by h, one pixel a crossing) with the cloth from
// end i0 and pick j0: at each crossing the colour of whichever thread
// is on top. `warp` and `weft` are one repeat of colours, [r, g, b]
// each. The thread underneath shows a little at the edges of the one
// above, so `under` (0 to 1) lets that much of it through.
export function weavePixels(data, w, h, i0, j0, warp, weft, draft, under) {
  const dd = drawdown(draft), u = under || 0, nw = warp.length, nf = weft.length;
  for (let y = 0; y < h; y++) {
    const j = j0 + y, f = weft[mod(j, nf)], row = mod(j, dd.h) * dd.w;
    for (let x = 0; x < w; x++) {
      const i = i0 + x, p = warp[mod(i, nw)], up = dd.m[row + mod(i, dd.w)];
      const a = up ? p : f, b = up ? f : p, o = (y * w + x) * 4;
      data[o] = a[0] + (b[0] - a[0]) * u; data[o + 1] = a[1] + (b[1] - a[1]) * u; data[o + 2] = a[2] + (b[2] - a[2]) * u; data[o + 3] = 255;
    }
  }
  return data;
}

// The same as a canvas, one pixel a crossing, to be drawn scaled up
// with smoothing off. Pass `into` to reuse a canvas.
export function clothCanvas(w, h, i0, j0, warp, weft, draft, under, into) {
  const c = into || document.createElement('canvas');
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  weavePixels(img.data, w, h, i0, j0, warp, weft, draft, under);
  g.putImageData(img, 0, 0);
  return c;
}

// The threads themselves: one repeat of the draft with each crossing
// `t` pixels square, in black and white over nothing, to be laid over
// the colour. The thread on top is round (dark at its edges, light
// down its middle) and goes under where the other system comes up.
const tiles = new Map();
export function threadTile(draft, t) {
  const key = JSON.stringify(draft) + '|' + t;
  let c = tiles.get(key);
  if (c) return c;
  if (tiles.size > 24) tiles.clear();
  const dd = drawdown(draft);
  c = document.createElement('canvas'); c.width = dd.w * t; c.height = dd.h * t;
  const g = c.getContext('2d');
  const up = (i, j) => dd.m[mod(j, dd.h) * dd.w + mod(i, dd.w)];
  for (let j = 0; j < dd.h; j++) for (let i = 0; i < dd.w; i++) {
    const x = i * t, y = j * t, warp = up(i, j);
    const gr = warp ? g.createLinearGradient(x, 0, x + t, 0) : g.createLinearGradient(0, y, 0, y + t);
    gr.addColorStop(0, 'rgba(0,0,0,0.34)'); gr.addColorStop(0.22, 'rgba(0,0,0,0.04)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.16)'); gr.addColorStop(0.78, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = gr; g.fillRect(x, y, t, t);
    // where it dives under its neighbour along its own length
    const e = Math.max(1, t * 0.16);
    g.fillStyle = 'rgba(0,0,0,0.26)';
    if (warp) { if (!up(i, j - 1)) g.fillRect(x, y, t, e); if (!up(i, j + 1)) g.fillRect(x, y + t - e, t, e); }
    else { if (up(i - 1, j)) g.fillRect(x, y, e, t); if (up(i + 1, j)) g.fillRect(x + t - e, y, e, t); }
  }
  tiles.set(key, c);
  return c;
}
