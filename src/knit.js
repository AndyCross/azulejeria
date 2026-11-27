// knit: knitted cloth by rule.
//
// Colourwork is drawn on squared paper before it is knitted. A chart
// is a grid with one square a stitch, and a jumper is a stack of
// bands, each a chart repeated round the body. Fair Isle adds two
// rules to that. A row is worked in two colours and no more, because
// the knitter carries one in each hand; and the colour not in use is
// stranded across the back, so it may not go more than a few stitches
// before it is wanted again, or the float catches on fingers. The
// colours can change from row to row, and they do: a band shades
// towards its middle row and back.
//
// A chart here is a list of strings, a character a stitch. "." is the
// ground and "X" the pattern; any other character is a further colour,
// which Fair Isle would not allow in the same row and a Christmas
// jumper does.
//
// Nothing above the last section needs a document, so the rule can be
// tested without a browser.

const mod = (n, m) => ((n % m) + m) % m;
const rngOf = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// ------------------------------------------------------------- charts ---
export function chartOf(rows, gap) {
  const w = Math.max(1, ...rows.map(r => r.length));
  return { w, h: rows.length, rows: rows.map(r => r.padEnd(w, '.')), gap: gap || 0 };
}
// A motif with the square's eight symmetries, from a rule on how far a
// stitch is from the middle each way: `fn(a, b)` for a and b from 0 to n.
export function byRule(n, fn, gap) {
  const rows = [];
  for (let y = -n; y <= n; y++) {
    let s = '';
    for (let x = -n; x <= n; x++) s += fn(Math.abs(x), Math.abs(y)) ? 'X' : '.';
    rows.push(s);
  }
  return chartOf(rows, gap == null ? 1 : gap);
}
// two charts side by side with a stitch between, as an O and an X are
const beside = (a, b) => chartOf(a.rows.map((r, j) => r + '.' + b.rows[j]), 1);

// the longest float in a chart as it repeats, and the most colours in any row
export function floatsOf(chart) {
  let float = 0, colours = 0;
  for (const row of chart.rows) {
    const line = row + '.'.repeat(chart.gap || 0), n = line.length;
    colours = Math.max(colours, new Set(line).size);
    if (new Set(line).size < 2) continue;   // a plain row strands nothing
    let start = 0;
    while (line[mod(start - 1, n)] === line[start]) start++;
    for (let k = 0, run = 0; k < n; k++) {
      const c = line[(start + k) % n];
      run = k && c === line[(start + k - 1) % n] ? run + 1 : 1;
      float = Math.max(float, run);
    }
  }
  return { float, colours };
}

// ------------------------------------------------------------ motifs ---
// The small bands, peeries, of one to six rows.
export const PEERIES = {
  seed:    chartOf(['X...', '....', '..X.']),
  dots:    chartOf(['X.']),
  check:   chartOf(['XX..', 'XX..', '..XX', '..XX']),
  zig:     chartOf(['..X.', '.X.X', 'X...']),
  wave:    chartOf(['XX....', '.XX..X', '...XX.']),
  cross:   chartOf(['.X..', 'XXX.', '.X..']),
  links:   chartOf(['.XXX..', 'X...X.', '.XXX..']),
  lozenge: chartOf(['..X...', '.X.X..', 'X.X.X.', '.X.X..', '..X...']),
  hearts:  chartOf(['.X.X....', 'XXXXX...', 'XXXXX...', '.XXX....', '..X.....']),
  bars:    chartOf(['XXX.', 'XXX.']),
};

// The large bands, by rule, at any half-width n (the band is 2n + 1
// rows). A motif alone on its ground leaves long floats beside it, so
// each is given what a knitter gives it: small rings of stitches in the
// corners and at the middle of each side, where four motifs meet, no
// more of them than it takes to bring every float under the limit.
const FLOAT = 7;
function fitted(n, shape) {
  let best = null;
  for (let r = 0; r <= n; r++) for (let e = -1; e <= r; e++) {
    const c = byRule(n, (a, b) => {
      if (shape(a, b)) return true;
      const corner = (n - a) + (n - b), edge = Math.min(a, b) + n - Math.max(a, b);
      return (corner <= r - 1 && corner % 2 === 0) || (edge <= e && edge % 2 === 0);
    });
    const f = floatsOf(c).float;
    if (!best || f < best.f) best = { c, f };
    if (f <= FLOAT) return c;
  }
  return best.c;
}
export const BORDERS = {
  // the O and the X: a ring with a seeded middle, then a saltire
  oxo: n => beside(
    fitted(n, (a, b) => { const s = a + b; return (s <= n && s >= n - 1) || (s <= n - 4 && s % 2 === 0); }),
    fitted(n, (a, b) => (Math.abs(a - b) <= 1 && a + b >= 3) || a + b === 0)),
  // eight points: a square laid over a square on its corner, cut into petals along its axes and diagonals
  star: n => fitted(n, (a, b) => {
    const hi = Math.max(a, b), lo = Math.min(a, b), m = Math.round(n * 0.62);
    if (!(hi <= m || a + b <= n)) return false;
    if (hi === 0) return true;
    return !(a === b || (lo === 0 && hi < n) || (hi - lo === 2 && hi < n - 1 && n > 5));
  }),
  // diamonds inside diamonds
  diamond: n => fitted(n, (a, b) => a + b <= n && (n - a - b) % 4 < 2),
  // a snow crystal: six arms would be right, eight is what a square grid gives
  flake: n => fitted(n, (a, b) => {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (lo === 0) return hi <= n - 1 && hi % 4 !== 3;              // the four arms, with a break in each
    if (a === b) return a <= n - 2;                                // and the four between
    if (lo === 1 && hi >= 2 && hi <= n - 2 && hi % 2 === 0) return true;   // barbs on the arms
    return hi - lo === 1 && hi >= 3 && hi <= n - 2 && hi % 2 === 1;
  }),
  // a lattice of crosses and squares
  tile: n => byRule(n, (a, b) => (a % 4 < 2) !== (b % 4 < 2), 0),
};
export const BORDER_NAMES = Object.keys(BORDERS);
export const PEERIE_NAMES = Object.keys(PEERIES);

// A motif nobody charted. A stitch is in the pattern by two short
// repeats read along the diagonals, one against the other, which is
// what gives the big Fair Isle bands their lozenges and saltires. Tried
// again until no float is longer than `limit`.
export function ruleMotif(seed, n, limit) {
  const rng = rngOf(seed * 2654435761 + n * 97 + 13);
  const bits = len => { let s; do { s = Array.from({ length: len }, () => rng() < 0.5); } while (s.every(v => v === s[0])); return s; };
  let best = null;
  for (let tries = 0; tries < 60; tries++) {
    const A = bits(3 + Math.floor(rng() * 4)), B = bits(2 + Math.floor(rng() * 4)), env = rng() < 0.5;
    const c = byRule(n, (a, b) => (!env || a + b <= n + 2) && A[(a + b) % A.length] !== B[Math.abs(a - b) % B.length]);
    const f = floatsOf(c).float;
    if (!best || f < best.f) best = { c, f };
    if (f <= (limit || 7)) break;
  }
  return best.c;
}

// Figures for the season, in more colours than a row should have. The
// letters are inks the page names: X the band's own pattern colour,
// k black, w white, r red, g green, y gold, b brown.
export const FIGURES = {
  reindeer: chartOf([
    '..b.b.....b.b..', '..b.b.....b.b..', '...bbb...bbb...', '....b.....b....', '....bb...bb....',
    '.XX..XXXXX..XX.', '.XXXXXXXXXXXXX.', '...XXXXXXXXX...', '...XkXXXXXkX...', '...XXXXXXXXX...',
    '....XXXXXXX....', '....XXrrrXX....', '.....XrrrX.....', '.....XXXXX.....', '......XXX......'], 2),
  tree: chartOf([
    '.....y.....', '.....g.....', '....ggg....', '...ggrgg...', '....ggg....', '...ggggg...', '..ggyggrg..',
    '...ggggg...', '..gggggrg..', '.ggrgggggg.', 'ggggggygggg', '....bbb....', '....bbb....'], 2),
  pudding: chartOf([
    '....g.g....', '.....r.....', '...wwwww...', '..wwwwwww..', '.wwbwwwbww.', '.wbbbwbbbw.', '.bbbbbbbbb.',
    '.bbkbbbkbb.', '.bbbbkbbbb.', '..bbbbbbb..', '...bbbbb...'], 2),
  snowman: chartOf([
    '...kkk...', '...kkk...', '..kkkkk..', '...www...', '..wkwkw..', '..wwyww..', '...www...', '.rrrrrrr.',
    '..wwwwwr.', '.wwwkwww.', '.wwwwwww.', '.wwwkwww.', '..wwwww..'], 2),
  gift: chartOf([
    '..rr.rr..', '.r..r..r.', '..rrrrr..', 'XXXXrXXXX', 'XXXXrXXXX', 'rrrrrrrrr', 'XXXXrXXXX', 'XXXXrXXXX', 'XXXXrXXXX'], 3),
  cane: chartOf([
    '..rwr..', '.w...w.', '.r...r.', '.....w.', '.....r.', '.....w.', '.....r.', '.....w.', '.....r.', '.....w.'], 3),
  bauble: chartOf([
    '...y...', '..yyy..', '.XXXXX.', 'XXwXXXX', 'XwXXXXX', 'yyyyyyy', 'XXXXXXX', '.XXXXX.', '..XXX..'], 3),
  heart: chartOf([
    '.rr...rr.', 'rrrr.rrrr', 'rrrrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....'], 3),
};
export const FIGURE_NAMES = Object.keys(FIGURES);

// ------------------------------------------------------------ letters ---
// Five stitches by seven, the alphabet of every knitted name.
const FONT = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
  3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
  9: '01110100011000101111000010001001100',
  '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100', '.': '00000000000000000000000000110001100',
  ',': '00000000000000000000001100010001000', '-': '00000000000000011111000000000000000', "'": '00100001000100000000000000000000000',
  '&': '01100100101010001000101011001001101', '*': '00000010101111111111011100010000000', '+': '00000001000010011111001000010000000',
  ' ': '00000000000000000000000000000000000',
};
export function knittable(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[♥❤]/g, '*').toUpperCase().replace(/[^A-Z0-9!?.,\-'&*+ ]/g, '').replace(/\s+/g, ' ').trim();
}
// a word as a chart, seven rows high, a stitch between the letters
export function textChart(text) {
  const t = knittable(text), rows = Array.from({ length: 7 }, () => '');
  for (let k = 0; k < t.length; k++) {
    const gl = FONT[t[k]] || FONT[' '];
    for (let r = 0; r < 7; r++) rows[r] += (k ? '.' : '') + gl.slice(r * 5, r * 5 + 5).replace(/1/g, 'X').replace(/0/g, '.');
  }
  return chartOf(t ? rows : ['.'], 0);
}

// -------------------------------------------------------------- bands ---
// A band is a chart with its colours. `colours` gives a colour for each
// character of the chart: one for the whole band, or a list with one
// for each row of the chart. `repeat` false knits the chart once, at
// `phase`. `scale` knits every stitch of the chart as that many each way.
export function band(chart, colours, opts) {
  const o = opts || {};
  return { chart, colours, repeat: o.repeat !== false, scale: Math.max(1, o.scale || 1), phase: o.phase || 0, gap: o.gap == null ? chart.gap || 0 : o.gap, tag: o.tag || '' };
}
export const plain = (rows, colour) => band(chartOf(Array.from({ length: Math.max(1, rows) }, () => '.')), { '.': colour });

// Bands from the top down, as a stack. `repeat` true begins again at
// the bottom, as an endless cloth; otherwise everything outside is `base`.
export function stackOf(bands, base, repeat) {
  let top = 0;
  const out = bands.map(b => { const r = { ...b, top, rows: b.chart.h * b.scale }; top += r.rows; return r; });
  const index = new Int16Array(Math.max(1, top));
  out.forEach((b, k) => index.fill(k, b.top, b.top + b.rows));
  return { bands: out, rows: Math.max(1, top), base: base || '#888888', repeat: !!repeat, index };
}

// the colour of stitch i of row j
export function stitchAt(stack, i, j) {
  if (!stack.bands.length) return stack.base;
  if (stack.repeat) j = mod(j, stack.rows);
  else if (j < 0 || j >= stack.rows) return stack.base;
  const b = stack.bands[stack.index[j]], c = b.chart;
  const r = Math.floor((j - b.top) / b.scale);
  let x = Math.floor((i - b.phase) / b.scale), ch = '.';
  if (b.repeat) { x = mod(x, c.w + b.gap); if (x < c.w) ch = c.rows[r][x]; }
  else if (x >= 0 && x < c.w) ch = c.rows[r][x];
  const col = b.colours[ch] || b.colours.X || b.colours['.'] || stack.base;
  return typeof col === 'string' ? col : col[Math.min(r, col.length - 1)];
}

// A band's colours shading to its middle row and back: `shades` from
// the edge inwards, for a chart h rows high.
export function shadeRows(h, shades) {
  if (typeof shades === 'string') return shades;
  const out = [], half = (h - 1) / 2;
  for (let r = 0; r < h; r++) {
    const t = half ? 1 - Math.abs(r - half) / half : 1;
    out.push(shades[Math.min(shades.length - 1, Math.floor(t * shades.length))]);
  }
  return out;
}

// --------------------------------------------------------------- wool ---
// Dye lots. Each has a ground for the plain rows, and sets of shades
// for a band's ground and its pattern, from the edge of a band to its
// middle. `pop` is the one bright row at the heart of a large band.
export const WOOLS = {
  shetland:  { base: '#e7dcc4', pop: '#b4532a', sets: [
    { g: ['#e7dcc4', '#d8c9a8', '#c9b68e'], p: ['#4a352a', '#6b4a36', '#8a5f40'] },
    { g: ['#d8c9a8', '#e7dcc4', '#f3ecdb'], p: ['#2f2a28', '#55504c', '#7d766e'] },
    { g: ['#c9b68e', '#d8c9a8'], p: ['#3a2c24', '#4a352a'] }] },
  madder:    { base: '#efe6d0', pop: '#e0a526', sets: [
    { g: ['#efe6d0', '#e8d7a8', '#e0c070'], p: ['#7c1f1c', '#a52a22', '#c8452c'] },
    { g: ['#efe6d0', '#c9d6dc', '#9fb8c8'], p: ['#1d2f55', '#2a4a7c', '#3f6a9c'] },
    { g: ['#e8d7a8', '#efe6d0'], p: ['#3d5a34', '#57783f'] }] },
  sea:       { base: '#dfe6e6', pop: '#f2efe2', sets: [
    { g: ['#1c2e44', '#26405c', '#345878'], p: ['#dfe6e6', '#b9ccd4', '#8fb0c0'] },
    { g: ['#dfe6e6', '#c4d4d8', '#a6c0c8'], p: ['#16263a', '#24405e', '#3a6282'] },
    { g: ['#7f9aa6', '#93aab4'], p: ['#16263a', '#1c2e44'] }] },
  heather:   { base: '#3a3344', pop: '#e6c84a', sets: [
    { g: ['#3a3344', '#4a3f5a', '#5c4a70'], p: ['#c7a9d4', '#dcc4e4', '#f0e2f2'] },
    { g: ['#2f4038', '#3d5548', '#4d6a58'], p: ['#d9c9a0', '#e6dab8', '#f2ecd6'] },
    { g: ['#5c4a70', '#4a3f5a'], p: ['#9ab58c', '#b4cca4'] }] },
  yule:      { base: '#f1e8d6', pop: '#e0b23a', sets: [
    { g: ['#f1e8d6', '#f1e8d6', '#e8dcc0'], p: ['#9c1b22', '#b3202a', '#c8323a'] },
    { g: ['#f1e8d6', '#e8dcc0'], p: ['#17472f', '#1f5a3a', '#2c7048'] },
    { g: ['#b3202a', '#9c1b22'], p: ['#f1e8d6', '#f8f2e4'] }] },
  stepinto:  { base: '#0f1524', pop: '#22d3ee', sets: [
    { g: ['#0f1524', '#152038', '#1e2c4a'], p: ['#38bdf8', '#5ccaf8', '#8adcfb'] },
    { g: ['#152038', '#1e2c4a'], p: ['#8b5cf6', '#a78bfa'] },
    { g: ['#0f1524', '#152038'], p: ['#a7b0c0', '#cbd2de'] }] },
};
export const WOOL_NAMES = Object.keys(WOOLS);

// ----------------------------------------------------------- fair isle ---
// A cloth is written as its bands from the top down: "oxo13 zig star11
// seed". A name from BORDERS takes the rows it is to be knitted over
// (odd, 7 to 21) after it; a name from PEERIES stands alone; "?" is a
// large band by rule from the seed, and may take rows too.
export function parseBands(text) {
  const out = [], re = /(\?|[a-z]+)\s*(\d{0,2})/g;
  let m;
  const t = String(text || '').toLowerCase();
  while ((m = re.exec(t)) && out.length < 40) {
    const name = m[1], rows = m[2] ? Math.max(7, Math.min(21, parseInt(m[2], 10) | 1)) : 13;
    if (name === '?' || BORDERS[name]) out.push({ name, rows });
    else if (PEERIES[name]) out.push({ name, rows: PEERIES[name].h });
  }
  return out;
}
export const writeBands = list => list.map(b => (b.name === '?' || BORDERS[b.name]) ? b.name + b.rows : b.name).join(' ');

// The stack for a cloth: each large band takes the wool's next set of
// shades and the bright row at its heart, each peerie the set after,
// and one plain row lies between any two.
export function fairIsle(text, wool, seed, opts) {
  const o = opts || {}, lot = typeof wool === 'string' ? WOOLS[wool] || WOOLS.madder : wool;
  const list = parseBands(text), bands = [];
  let big = 0, small = 0;
  list.forEach((item, k) => {
    const isBig = item.name === '?' || !!BORDERS[item.name], n = (item.rows - 1) / 2;
    const chart = item.name === '?' ? ruleMotif((seed || 1) + k * 31, n, 7) : isBig ? BORDERS[item.name](n) : PEERIES[item.name];
    const set = lot.sets[(isBig ? big++ : lot.sets.length - 1 - (small++ % 2)) % lot.sets.length];
    const g = o.shade === false ? set.g[0] : shadeRows(chart.h, set.g);
    let p = o.shade === false ? set.p[0] : shadeRows(chart.h, set.p);
    if (isBig && o.shade !== false && lot.pop && typeof p !== 'string') { p = p.slice(); p[n] = lot.pop; }
    bands.push(band(chart, { '.': g, X: p }, { tag: item.name }));
    bands.push(plain(1, lot.base));
  });
  return stackOf(bands, lot.base, true);
}

// a cloth nobody has knitted: large bands and peeries turn about
export function randomBands(seed) {
  const rng = rngOf((seed || 1) * 40503 + 7), pick = a => a[Math.floor(rng() * a.length)];
  const out = [], n = 2 + Math.floor(rng() * 3);
  for (let k = 0; k < n; k++) {
    out.push({ name: rng() < 0.4 ? '?' : pick(BORDER_NAMES), rows: pick([9, 11, 13, 13, 15, 17]) });
    out.push({ name: pick(PEERIE_NAMES), rows: 0 });
    if (rng() < 0.35) out.push({ name: pick(PEERIE_NAMES), rows: 0 });
  }
  return writeBands(out);
}

// -------------------------------------------------------------- cloth ---
// Fills `data` (RGBA, w by h, one pixel a stitch) from stitch i0 of row j0.
const rgbCache = new Map();
const rgbOf = hex => { let c = rgbCache.get(hex); if (!c) { const n = parseInt(hex.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(hex, c); } return c; };
export function knitPixels(data, w, h, i0, j0, stack) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rgbOf(stitchAt(stack, i0 + x, j0 + y)), o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  return data;
}

// A knit stitch is a V, and a column of them is a stack of chevrons.
// ROW is how tall a stitch is against its width, DIP how far the point
// of the V hangs below its shoulders, as a part of that height.
export const ROW = 0.8, DIP = 0.6;

// The stitch itself: one V, `px` wide, in black and white over
// nothing, to be laid over the colour. Each leg is a round strand, dark
// where it meets the next column and where it tucks under the row
// above, with the twist of the plies across it.
const tiles = new Map();
export function stitchTile(px) {
  const W = Math.max(2, Math.round(px)), H = Math.max(2, Math.round(px * ROW));
  const key = W + 'x' + H;
  let c = tiles.get(key);
  if (c) return c;
  if (tiles.size > 24) tiles.clear();
  c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), D = H * DIP;
  for (const side of [0, 1]) {
    const x0 = side ? W / 2 : 0, x1 = x0 + W / 2;
    // the top of this leg at its outer and inner edge
    const yo = k => k * H + (side ? D : 0), yi = k => k * H + (side ? 0 : D);
    for (let k = -2; k <= 1; k++) {
      g.save();
      g.beginPath(); g.moveTo(x0, yo(k)); g.lineTo(x1, yi(k)); g.lineTo(x1, yi(k) + H); g.lineTo(x0, yo(k) + H); g.closePath(); g.clip();
      // round across its width
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      const stops = [[0, 'rgba(0,0,0,0.30)'], [0.25, 'rgba(0,0,0,0.03)'], [0.5, 'rgba(255,255,255,0.15)'], [0.78, 'rgba(0,0,0,0.05)'], [1, 'rgba(0,0,0,0.26)']];
      for (const [t, col] of stops) gr.addColorStop(side ? 1 - t : t, col);
      g.fillStyle = gr; g.fillRect(x0, k * H - 1, W / 2, H + D + 2);
      // tucked under the stitch above, and lit where it comes forward
      if (W >= 5) {
        g.lineCap = 'butt';
        g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = Math.max(1, H * 0.2);
        g.beginPath(); g.moveTo(x0, yo(k)); g.lineTo(x1, yi(k)); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = Math.max(1, H * 0.16);
        g.beginPath(); g.moveTo(x0, yo(k) + H * 0.72); g.lineTo(x1, yi(k) + H * 0.72); g.stroke();
      }
      // the plies
      if (W >= 9) {
        g.strokeStyle = 'rgba(0,0,0,0.11)'; g.lineWidth = Math.max(0.6, W * 0.035);
        for (let p = 0; p < 4; p++) {
          const t = (p + 0.5) / 4, ym = (side ? yo(k) + (yi(k) - yo(k)) * 0.5 : yo(k) + (yi(k) - yo(k)) * 0.5) + t * H;
          g.beginPath(); g.moveTo(x0, ym + (side ? -1 : 1) * H * 0.2); g.lineTo(x1, ym + (side ? 1 : -1) * H * 0.2); g.stroke();
        }
      }
      g.restore();
    }
  }
  tiles.set(key, c);
  return c;
}

// Ribbing, for a welt, a cuff or a collar: a column of knit stitches
// standing forward, a column of purl lying back, turn about.
export function ribTile(px) {
  const W = Math.max(2, Math.round(px)), H = Math.max(2, Math.round(px * ROW));
  const key = 'rib' + W + 'x' + H;
  let c = tiles.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = W * 2; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(stitchTile(px), 0, 0);
  const gr = g.createLinearGradient(W, 0, W * 2, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0.30)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.46)'); gr.addColorStop(1, 'rgba(0,0,0,0.30)');
  g.fillStyle = gr; g.fillRect(W, 0, W, H);
  // the purl bump
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(W + W * 0.2, H * 0.35, W * 0.6, Math.max(1, H * 0.22));
  tiles.set(key, c);
  return c;
}

// The halo: short fibres standing off the yarn, lighter and darker, in
// every direction. A tile that repeats.
export function fuzzTile(seed, size) {
  const key = 'fuzz' + seed + '|' + size;
  let c = tiles.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), rng = rngOf(seed * 7 + 11);
  g.lineCap = 'round';
  for (let i = 0; i < size * size / 12; i++) {
    const x = rng() * size, y = rng() * size, a = rng() * Math.PI * 2, l = 1.5 + rng() * 4.5;
    g.strokeStyle = rng() < 0.6 ? `rgba(255,255,255,${0.05 + rng() * 0.13})` : `rgba(0,0,0,${0.05 + rng() * 0.11})`;
    g.lineWidth = 0.5 + rng() * 0.7;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + Math.cos(a + 0.6) * l * 0.5, y + oy + Math.sin(a + 0.6) * l * 0.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
  tiles.set(key, c);
  return c;
}

// Knits `stack` over nw stitches by nh rows from stitch i0 of row j0,
// into whatever transform the context has: a stitch is one unit wide
// and ROW high, so stitch (i, j) has its shoulders at (i, j * ROW).
// `px` is the width of a stitch in the canvas's own pixels, which
// decides how much of the stitch is worth drawing. Clip first if the
// cloth has an edge.
let pix = null;
export function paintKnit(g, stack, i0, j0, nw, nh, px) {
  if (nw <= 0 || nh <= 0) return;
  // the colour, a pixel a stitch: all there is when stitches are small, and what shows in any crack when they are not
  pix = pix || document.createElement('canvas');
  if (pix.width !== nw || pix.height !== nh) { pix.width = nw; pix.height = nh; }
  const pg = pix.getContext('2d'), img = pg.createImageData(nw, nh);
  knitPixels(img.data, nw, nh, i0, j0, stack);
  pg.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = px < 2;
  g.drawImage(pix, i0, j0 * ROW, nw, nh * ROW);
  g.imageSmoothingEnabled = true;
  if (px >= 4 && nw * nh <= 260000) {
    // Every stitch as its V. A run of one colour along a row is one
    // shape, a zigzag above and the same zigzag below, and the shapes
    // are filled a few rows at a time: one path holding a whole cloth
    // is far slower to fill than the same cloth in pieces.
    const d = ROW * DIP, px32 = new Uint32Array(img.data.buffer), paths = new Map();
    const hexOf = v => '#' + ((1 << 24) | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255)).toString(16).slice(1);
    const run = (v, a, b, j) => {
      let p = paths.get(v);
      if (!p) { p = new Path2D(); paths.set(v, p); }
      const y = j * ROW;
      p.moveTo(a, y);
      for (let i = a; i < b; i++) { p.lineTo(i + 0.5, y + d); p.lineTo(i + 1, y); }
      p.lineTo(b, y + ROW);
      for (let i = b - 1; i >= a; i--) { p.lineTo(i + 0.5, y + ROW + d); p.lineTo(i, y + ROW); }
      p.closePath();
    };
    const flush = () => { for (const [v, p] of paths) { g.fillStyle = hexOf(v); g.fill(p); } paths.clear(); };
    // one row more above, in its own colours, so the top edge is covered
    for (let x = 0; x < nw; x++) { const c = rgbOf(stitchAt(stack, i0 + x, j0 - 1)); run(c[0] | (c[1] << 8) | (c[2] << 16) | 0xff000000, i0 + x, i0 + x + 1, j0 - 1); }
    for (let y = 0; y < nh; y++) {
      let a = 0;
      for (let x = 1; x <= nw; x++) if (x === nw || px32[y * nw + x] !== px32[y * nw + a]) { run(px32[y * nw + a], i0 + a, i0 + x, j0 + y); a = x; }
      if (y % 6 === 5) flush();
    }
    flush();
  }
  if (px >= 2.5) {
    const tile = stitchTile(px), pat = g.createPattern(tile, 'repeat');
    pat.setTransform(new DOMMatrix([1 / tile.width, 0, 0, ROW / tile.height, 0, 0]));
    g.fillStyle = pat; g.fillRect(i0, (j0 - 1) * ROW, nw, (nh + 2) * ROW);
  }
  g.restore();
}

// Ribbing in one colour over a rectangle, in the same units.
export function paintRib(g, colour, x, y, w, h, px) {
  g.save();
  g.fillStyle = colour; g.fillRect(x, y, w, h);
  if (px >= 2.5) {
    const tile = ribTile(px), pat = g.createPattern(tile, 'repeat');
    pat.setTransform(new DOMMatrix([2 / tile.width, 0, 0, ROW / tile.height, x, y]));
    g.fillStyle = pat; g.fillRect(x, y, w, h);
  }
  g.restore();
}
