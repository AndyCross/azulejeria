// The seven frieze groups, checked: every group's copies cover one
// repeat exactly once, the repeat is no shorter than it says, and the
// strip has the mirrors, half turns and glide its name says and no others.
import assert from 'node:assert/strict';
import { FRIEZES, FRIEZE_NAMES, layFrieze, friezeCells } from '../src/friezes.js';

assert.equal(FRIEZE_NAMES.length, 7);

// upright mirror, mirror along the strip, half turn, glide
const expect = { p1: '----', p11g: '---g', p1m1: 'v---', p2: '--r-', p2mg: 'v-rg', p11m: '-h--', p2mm: 'vhr-' };
const mod = (n, m) => ((n % m) + m) % m;

for (const [w, h] of [[3, 2], [5, 4], [4, 4], [7, 3]]) for (const name of FRIEZE_NAMES) {
  // every square of the repeat is laid once: number each square of the domain, and count
  const seen = friezeCells(name, w, h, () => 1), F = FRIEZES[name];
  assert.equal(seen.W, F.period * w); assert.equal(seen.H, F.rows * h);
  const hits = new Uint8Array(seen.W * seen.H);
  const { copies } = layFrieze(name, w, h);
  for (const M of copies) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = M[0] * (i + 0.5) + M[2] * (j + 0.5) + M[4], y = M[1] * (i + 0.5) + M[3] * (j + 0.5) + M[5];
    hits[Math.floor(y) * seen.W + mod(Math.floor(x), seen.W)]++;
  }
  assert.ok(hits.every(v => v === 1), name + ' covers its repeat once at ' + w + 'x' + h);

  // a motif with no symmetry of its own, so whatever the strip has, the group gave it
  const on = (i, j) => (i === 0 && j === 0) || (i === 1 && j === 0) || (i === 0 && j === 1) ? 1 : 0;
  const { W, H, cells } = friezeCells(name, w, h, on);
  const at = (i, j) => cells[j * W + mod(i, W)];
  const same = fn => { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const [a, b] = fn(i, j); if (at(i, j) !== at(a, b)) return false; } return true; };
  const any = fn => { for (let c = 0; c < 2 * W; c++) if (same((i, j) => fn(i, j, c))) return true; return false; };
  for (let t = 1; t < W; t++) assert.ok(!same((i, j) => [i + t, j]), name + ' repeats no sooner than ' + W);
  const v = any((i, j, c) => [c - 1 - i, j]);
  const hm = same((i, j) => [i, H - 1 - j]);
  const r = any((i, j, c) => [c - 1 - i, H - 1 - j]);
  let g = false;
  for (let t = 1; t < W; t++) if (same((i, j) => [i + t, H - 1 - j])) g = true;
  const got = (v ? 'v' : '-') + (hm ? 'h' : '-') + (r ? 'r' : '-') + (g ? 'g' : '-');
  assert.equal(got, expect[name], name + ' at ' + w + 'x' + h);
}
console.log('friezes: seven groups, each covering its repeat once with the symmetries of its name');
