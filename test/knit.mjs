// Knitting's rule: charts, bands, the float limit and the stack they make.
import assert from 'node:assert/strict';
import { PEERIES, BORDERS, BORDER_NAMES, FIGURES, floatsOf, ruleMotif, chartOf, byRule, textChart, knittable,
         band, plain, stackOf, stitchAt, shadeRows, parseBands, writeBands, fairIsle, randomBands, knitPixels, WOOLS, WOOL_NAMES } from '../src/knit.js';

// a chart is square-edged: every row as wide as the widest
for (const c of [...Object.values(PEERIES), ...Object.values(FIGURES)]) for (const r of c.rows) assert.equal(r.length, c.w);

// Fair Isle's two rules, for every band it can be asked for: two colours a row, and no float over seven
for (const [name, c] of Object.entries(PEERIES)) { const f = floatsOf(c); assert.ok(f.colours <= 2 && f.float <= 7, 'peerie ' + name); }
for (const name of BORDER_NAMES) for (let n = 3; n <= 10; n++) {
  const c = BORDERS[name](n), f = floatsOf(c);
  assert.equal(c.h, 2 * n + 1, name + ' rows');
  assert.ok(f.colours <= 2 && f.float <= 7, name + ' at ' + (2 * n + 1) + ' rows floats ' + f.float);
  // and it is the same upside down
  assert.deepEqual(c.rows.slice().reverse(), c.rows, name + ' mirrors');
}
// a motif by rule keeps the limit too, and the same seed gives the same motif
for (let seed = 1; seed <= 40; seed++) for (const n of [4, 6, 8]) {
  const c = ruleMotif(seed, n, 7);
  assert.ok(floatsOf(c).float <= 7, 'rule motif ' + seed + ' at ' + n);
  assert.deepEqual(ruleMotif(seed, n, 7).rows, c.rows);
}
// the float is counted round the repeat, gap and all
assert.equal(floatsOf(chartOf(['X....'], 3)).float, 7);
assert.equal(floatsOf(chartOf(['..X..'], 0)).float, 4);
assert.equal(floatsOf(chartOf(['XrX.'])).colours, 3);

// letters: five by seven, a stitch between, accents dropped
assert.equal(knittable('  olé,  lotte ♥ '), 'OLE, LOTTE *');
const t = textChart('Hi');
assert.equal(t.h, 7); assert.equal(t.w, 11);
assert.equal(t.rows[3], 'XXXXX...X..');
assert.equal(textChart('').h, 1);

// a stack: bands from the top down, each a chart repeated along its rows
const k = stackOf([band(chartOf(['X.', '.X']), { '.': '#000000', X: '#ffffff' }), plain(2, '#ff0000')], '#00ff00', true);
assert.equal(k.rows, 4);
assert.equal(stitchAt(k, 0, 0), '#ffffff'); assert.equal(stitchAt(k, 1, 0), '#000000'); assert.equal(stitchAt(k, 1, 1), '#ffffff');
assert.equal(stitchAt(k, 5, 2), '#ff0000');
assert.equal(stitchAt(k, -2, -4), '#ffffff');          // it repeats both ways
assert.equal(stitchAt({ ...k, repeat: false }, 0, 9), '#00ff00');   // unless it is a garment, which ends
// a chart knitted once, twice the size, starting where it is told
const once = stackOf([band(chartOf(['X']), { '.': '#000000', X: '#ffffff' }, { repeat: false, scale: 2, phase: 3 })], '#000000', false);
assert.deepEqual([2, 3, 4, 5].map(i => stitchAt(once, i, 1)), ['#000000', '#ffffff', '#ffffff', '#000000']);
// colours by the row
assert.deepEqual(shadeRows(5, ['a', 'b', 'c']), ['a', 'b', 'c', 'b', 'a']);
const sh = stackOf([band(chartOf(['X', 'X', 'X']), { '.': '#000000', X: ['#111111', '#222222', '#111111'] })], '#000000', true);
assert.equal(stitchAt(sh, 0, 1), '#222222');

// a cloth is written as its bands
const list = parseBands('OXO13 zig, star 10 ? nonsense seed');
assert.deepEqual(list.map(b => b.name), ['oxo', 'zig', 'star', '?', 'seed']);
assert.equal(list[2].rows, 11);                        // rows are odd
assert.equal(writeBands(list), 'oxo13 zig star11 ?13 seed');
for (const wool of WOOL_NAMES) {
  const cloth = fairIsle('oxo13 zig star11 seed', wool, 7);
  assert.equal(cloth.rows, 13 + 3 + 11 + 3 + 4);       // a plain row after each
  // two colours a row, in the wool itself and not only on the chart
  for (let j = 0; j < cloth.rows; j++) { const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(stitchAt(cloth, i, j)); assert.ok(seen.size <= 2, wool + ' row ' + j); }
  assert.ok(WOOLS[wool].sets.length >= 2);
}
// a cloth from a seed parses back to itself
for (let seed = 1; seed <= 20; seed++) { const w = randomBands(seed); assert.equal(writeBands(parseBands(w)), w); assert.equal(randomBands(seed), w); }

// one pixel a stitch
const data = knitPixels(new Uint8ClampedArray(2 * 2 * 4), 2, 2, 0, 0, k);
assert.deepEqual([...data.slice(0, 8)], [255, 255, 255, 255, 0, 0, 0, 255]);

console.log('knit ok');
