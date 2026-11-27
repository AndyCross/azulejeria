// friezes: the seven ways a border can repeat.
//
// A pattern that repeats along a line and nowhere else has one of
// seven symmetry groups, the frieze groups, the border's answer to the
// seventeen in groups.js. Besides the slide along the line there are
// only four things a strip can do and still lie on itself: turn half
// round, mirror across the line, mirror in an upright, and glide (a
// mirror across the line with half a slide). Seven combinations of
// those are possible and no more.
//
// Each group here is how many domains long one repeat is (`period`),
// how many high the strip is (`rows`), and the copies: the isometries
// that lay the domain out inside one repeat. The domain is a rectangle
// a wide and b high with its corner at (0, 0), x along the strip and y
// down, and it is drawn once; lay the repeat every `period * a` along
// and the strip is covered exactly once.
//
// `step` is Conway's name for each, after the footprints that have that
// symmetry.

import { I, mul, translate, rotate, reflect, apply } from './groups.js';

const PI = Math.PI, Q = PI / 2;

export const FRIEZES = {
  // slides only
  p1:   { period: 1, rows: 1, step: 'hop', note: 'slides only: the motif, over and over',
          copies: () => [I] },
  // a glide: mirror across the middle line, then slide one domain along
  p11g: { period: 2, rows: 1, step: 'step', note: 'every other one upside down, as feet walking fall',
          copies: (a, b) => [I, mul(translate(a, 0), reflect(0, 0, b / 2))] },
  // upright mirrors
  p1m1: { period: 2, rows: 1, step: 'sidle', note: 'upright mirrors: every other one facing back',
          copies: a => [I, reflect(Q, a, 0)] },
  // half turns
  p2:   { period: 2, rows: 1, step: 'spinning hop', note: 'half turns: every other one turned over',
          copies: (a, b) => [I, rotate(PI, a, b / 2)] },
  // upright mirrors and half turns between them, which together make a glide
  p2mg: { period: 4, rows: 1, step: 'spinning sidle', note: 'upright mirrors with half turns between them',
          copies: (a, b) => { const M = reflect(Q, a, 0), R = rotate(PI, 2 * a, b / 2); return [I, M, R, mul(R, M)]; } },
  // a mirror along the line
  p11m: { period: 1, rows: 2, step: 'jump', note: 'a mirror along the strip: each one over its reflection',
          copies: (a, b) => [I, reflect(0, 0, b)] },
  // mirrors both ways
  p2mm: { period: 2, rows: 2, step: 'spinning jump', note: 'mirrors both ways, and so half turns as well',
          copies: (a, b) => [I, reflect(Q, a, 0), reflect(0, 0, b), rotate(PI, a, b)] },
};
export const FRIEZE_NAMES = Object.keys(FRIEZES);

// One repeat of a frieze for a domain a wide and b high: its copies,
// how long the repeat is and how high the strip.
export function layFrieze(name, a, b) {
  const F = FRIEZES[name] || FRIEZES.p1;
  a = a || 1; b = b || 1;
  return { copies: F.copies(a, b), length: F.period * a, height: F.rows * b };
}

// A frieze on squared paper. The domain is w squares by h, `on(i, j)`
// is what is in each of them (0 for nothing), and what comes back is
// one repeat: { W, H, cells }, W by H squares, `cells[j * W + i]`.
// Isometries of a squared strip take squares to squares, so nothing is
// lost; needs no document.
export function friezeCells(name, w, h, on) {
  const { copies, length: W, height: H } = layFrieze(name, w, h);
  const cells = new Uint8Array(W * H);
  for (const M of copies) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = on(i, j);
    if (!v) continue;
    const [x, y] = apply(M, [i + 0.5, j + 0.5]);
    const X = ((Math.floor(x + 1e-9) % W) + W) % W, Y = Math.floor(y + 1e-9);
    if (Y >= 0 && Y < H) cells[Y * W + X] = v;
  }
  return { W, H, cells };
}
