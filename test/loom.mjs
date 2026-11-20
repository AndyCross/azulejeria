// The loom's rule: the drafts, the sett and the cloth they make.
import assert from 'node:assert/strict';
import { DRAFTS, DRAFT_NAMES, lifted, drawdown, parseSett, threadsOf, writeSett, dyeOf, weavePixels } from '../src/loom.js';

// plain weave is a chequer; 2/2 twill is over two, under two, stepping one a pick
for (let j = -3; j < 5; j++) for (let i = -3; i < 5; i++) {
  assert.equal(lifted(DRAFTS.plain, i, j), (((i - j) % 2) + 2) % 2 === 0);
  assert.equal(lifted(DRAFTS.twill, i, j), (((i - j) % 4) + 4) % 4 < 2);
}
// every draft is balanced enough to be a cloth: no end and no pick floats the whole repeat
for (const name of DRAFT_NAMES) {
  const d = drawdown(DRAFTS[name]);
  for (let j = 0; j < d.h; j++) { const s = d.m.slice(j * d.w, (j + 1) * d.w).reduce((a, b) => a + b, 0); assert.ok(s > 0 && s < d.w, name + ' pick ' + j); }
  for (let i = 0; i < d.w; i++) { let s = 0; for (let j = 0; j < d.h; j++) s += d.m[j * d.w + i]; assert.ok(s > 0 && s < d.h, name + ' end ' + i); }
}
// in a 2/2 twill half of every repeat is warp; in drill three quarters
assert.equal(drawdown(DRAFTS.twill).m.reduce((a, b) => a + b, 0), 8);
assert.equal(drawdown(DRAFTS.drill).m.reduce((a, b) => a + b, 0), 12);

// a sett turns back at its pivots, which are counted once
const s = parseSett('K4 R24 K24 Y4');
assert.deepEqual(s.stripes, [{ code: 'K', n: 4 }, { code: 'R', n: 24 }, { code: 'K', n: 24 }, { code: 'Y', n: 4 }]);
assert.equal(s.mirror, true);
assert.equal(threadsOf(s).length, 4 + 24 + 24 + 4 + 24 + 24);
assert.equal(threadsOf(s).join('').replace(/(.)\1*/g, '$1'), 'KRKYKR');
assert.equal(writeSett(s), 'K/4 R24 K24 Y/4');
// the register's slashes are read; Royal Stewart is 190 threads
assert.equal(threadsOf(parseSett('R/72 B8 K12 Y2 K2 W2 K2 G16 R8 K2 R4 W/2')).length, 190);
// "..." says it repeats without turning
const h = parseSett('k4 w4 ...');
assert.equal(h.mirror, false);
assert.equal(threadsOf(h).join(''), 'KKKKWWWW');
// two stripes have nothing between the pivots to turn back through
assert.equal(threadsOf(parseSett('R/8 K/8')).length, 16);
// hex colours, light and dark, nonsense
assert.deepEqual(parseSett('#C8102E 6 LB 2').stripes, [{ code: '#c8102e', n: 6 }, { code: 'LB', n: 2 }]);
assert.deepEqual(dyeOf('#c8102e', 'modern'), [200, 16, 46]);
assert.deepEqual(dyeOf('K', 'modern'), [16, 16, 16]);
assert.ok(dyeOf('LB', 'modern')[2] > dyeOf('B', 'modern')[2] && dyeOf('DB', 'modern')[2] < dyeOf('B', 'modern')[2]);
assert.deepEqual(dyeOf('ZZ', 'modern'), dyeOf('N', 'modern'));
assert.deepEqual(threadsOf(parseSett('')), ['N']);
assert.deepEqual(parseSett('hello world').stripes, []);

// the cloth: red warp, white weft, plain weave is a chequer of the two
const px = weavePixels(new Uint8ClampedArray(4 * 4 * 4), 4, 4, 0, 0, [[200, 0, 0]], [[255, 255, 255]], DRAFTS.plain, 0);
assert.deepEqual([...px.slice(0, 8)], [200, 0, 0, 255, 255, 255, 255, 255]);
assert.deepEqual([...px.slice(16, 24)], [255, 255, 255, 255, 200, 0, 0, 255]);
// and it is the same cloth wherever the window starts
const a = weavePixels(new Uint8ClampedArray(8 * 8 * 4), 8, 8, -5, 3, [[1, 2, 3], [9, 9, 9], [50, 60, 70]], [[7, 7, 7], [100, 0, 0]], DRAFTS.herringbone, 0.2);
const b = weavePixels(new Uint8ClampedArray(9 * 9 * 4), 9, 9, -6, 2, [[1, 2, 3], [9, 9, 9], [50, 60, 70]], [[7, 7, 7], [100, 0, 0]], DRAFTS.herringbone, 0.2);
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) for (let k = 0; k < 4; k++) assert.equal(a[(y * 8 + x) * 4 + k], b[((y + 1) * 9 + x + 1) * 4 + k]);
console.log('loom ok');
