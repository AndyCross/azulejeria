// The drawing's encoding, the stroke settling and the print export's PNG chunk.
import assert from 'node:assert/strict';
import { encodeDrawing, decodeDrawing, settle, simplify, smooth, drawnMotif } from '../src/draw.js';
import { crc32, pngWithDpi } from '../src/azulejeria.js';

const near = (a, b) => Math.abs(a - b) <= 1 / 255;
const drawing = [
  { k: 'shape', c: 0, w: 3, pts: [[0.1, 0.05], [0.4, 0.1], [0.3, 0.25]] },
  { k: 'line', c: 4, w: 1, pts: [[0.5, 0], [0.8, 0.2], [1, 0.5]] },
  { k: 'line', c: 2, w: 8, pts: [[0.5, 0.1], [0.9, 0.4]] },
  { k: 'dot', c: 3, w: 5, pts: [[0.7, 0.3]] },
];
const back = decodeDrawing(encodeDrawing(drawing));
assert.equal(back.length, drawing.length);
back.forEach((s, i) => {
  assert.equal(s.k, drawing[i].k); assert.equal(s.c, drawing[i].c); assert.equal(s.w, drawing[i].w);
  s.pts.forEach((p, j) => assert.ok(near(p[0], drawing[i].pts[j][0]) && near(p[1], drawing[i].pts[j][1])));
});
// encoding what was decoded gives the same string: a link is stable
assert.equal(encodeDrawing(back), encodeDrawing(drawing));
assert.match(encodeDrawing(drawing), /^[A-Za-z0-9_-]+$/);
assert.equal(encodeDrawing([]), '');
for (const bad of ['', null, '!!!', 'AAAA', 'AQ', 'AQEB', 'not a drawing']) assert.deepEqual(decodeDrawing(bad), []);

// a stroke drawn on the far side of the diagonal is reflected over
const s = settle({ k: 'line', c: 0, w: 2, pts: [[0.1, 0.5], [0.2, 0.9], [-0.3, 1.4]] });
assert.ok(s.pts.every(([x, y]) => y <= x && x >= 0 && x <= 1 && y >= 0 && y <= 1));
assert.equal(settle({ k: 'shape', c: 0, w: 2, pts: [[0, 0], [1, 0]] }), null);
assert.equal(settle({ k: 'dot', c: 0, w: 2, pts: [[0.2, 0.1], [0.5, 0.5]] }).pts.length, 1);
// a long scribble comes down to a stroke that fits
const scribble = Array.from({ length: 4000 }, (_, i) => [0.5 + 0.4 * Math.cos(i / 9) * (i / 4000), 0.3 + 0.2 * Math.sin(i / 7)]);
assert.ok(settle({ k: 'line', c: 0, w: 1, pts: scribble }).pts.length <= 96);
assert.equal(simplify([[0, 0], [0.5, 0.0001], [1, 0]], 0.004).length, 2);
assert.equal(smooth([[0, 0], [1, 0], [1, 1]], false)[0][0], 0);

// the motif reads the drawing from the state it is given
const els = drawnMotif()({ state: { d: encodeDrawing(drawing) }, bands: true });
assert.equal(els.length, 5);
assert.equal(els[0].t, 'stroke'); assert.equal(els[4].t, 'band');
assert.deepEqual(drawnMotif()({ state: {}, bands: false }), []);

// crc32 of "IEND" is the last four bytes of every PNG
assert.equal(crc32(new TextEncoder().encode('IEND')), 0xae426082);
// a 1x1 PNG gains a pHYs chunk after IHDR, and keeps one rather than two
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const out = pngWithDpi(png, 300);
assert.equal(out.length, png.length + 21);
assert.equal(String.fromCharCode(...out.subarray(37, 41)), 'pHYs');
assert.equal(new DataView(out.buffer).getUint32(41), 11811);
const again = pngWithDpi(out, 150);
assert.equal(again.length, out.length);
assert.equal(new DataView(again.buffer).getUint32(41), 5906);
console.log('draw: encoding, settling, motif and the print chunk hold');
