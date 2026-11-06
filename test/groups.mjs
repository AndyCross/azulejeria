// The seventeen groups, checked: every group's copies cover the plane
// exactly once, and each pattern has the rotation orders, mirror
// directions and centre placement its name says. node test/groups.mjs
import { GROUPS, apply, rotate, reflect } from '../src/groups.js';
const SQ = [[0,0],[1,0],[1,1],[0,1]];
function inside(poly, [x, y]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
let bad = 0;
console.log("--- coverage");
for (const [name, g] of Object.entries(GROUPS)) {
  const dom = g.domain || SQ;
  const [A, B] = g.cell;
  // images of the domain for cells in a range
  const polys = [];
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) for (const M of g.copies)
    polys.push(dom.map(p => { const q = apply(M, p); return [q[0] + i * A[0] + j * B[0], q[1] + i * A[1] + j * B[1]]; }));
  const counts = {};
  let n = 0;
  for (let t = 0; t < 4000; t++) {
    const p = [Math.random() * 2 - 0.5, Math.random() * 2 - 0.5];
    let c = 0;
    for (const poly of polys) if (inside(poly, p)) c++;
    counts[c] = (counts[c] || 0) + 1; n++;
  }
  const ok = (counts[1] || 0) / n > 0.995;
  if (!ok) bad++;
  console.log(name.padEnd(5), g.copies.length, 'copies', JSON.stringify(counts), ok ? 'ok' : 'BAD');
}


const seedPts = [[0.07, 0.03], [0.21, 0.11], [0.13, 0.19]];   // asymmetric, inside every domain
const key = ([x, y]) => Math.round(x * 200) + ',' + Math.round(y * 200);
const expect = {
  p1: 'r1 m0', p2: 'r2 m0', pm: "r1 m1 someOff", pg: 'r1 m0', cm: "r1 m1 someOff", pmm: 'r2 m2 allOn', pmg: 'r2 m1 someOff',
  pgg: 'r2 m0', cmm: 'r2 m2 someOff', p4: 'r4 m0', p4m: 'r4 m4 allOn', p4g: "r4 m2 someOff",
  p3: 'r3 m0', p3m1: 'r3 m3 allOn', p31m: 'r3 m3 someOff', p6: 'r6 m0', p6m: 'r6 m6 allOn',
};
console.log("--- symmetry");
for (const [name, g] of Object.entries(GROUPS)) {
  const [A, B] = g.cell, P = new Set(), near = [];
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) for (const M of g.copies) for (const p of seedPts) {
    const q = apply(M, p), r = [q[0] + i * A[0] + j * B[0], q[1] + i * A[1] + j * B[1]];
    P.add(key(r));
    if (Math.hypot(r[0] - 1, r[1] - 1) < 1.6) near.push(r);
  }
  const holds = M => near.every(p => P.has(key(apply(M, p))));
  const step = 1 / 12, centres = [];
  for (let x = 0; x <= 2; x += step) for (let y = 0; y <= 2; y += step) centres.push([x, y]);
  const R3 = 1 / (2 * Math.sqrt(3)); for (const c of [[0.5 + R3, 0.5 - R3], [0.5 - R3, 0.5 + R3]]) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) centres.push([c[0] + i * A[0] + j * B[0], c[1] + i * A[1] + j * B[1]]);
  let rmax = 1;
  const rotC = {};
  for (const n of [6, 4, 3, 2]) for (const c of centres) if (holds(rotate(2 * Math.PI / n, c[0], c[1]))) { rmax = Math.max(rmax, n); (rotC[n] = rotC[n] || []).push(c); }
  const mirrors = [];
  for (const ang of [0,15,30,45,60,75,90,105,120,135,150,165]) for (const c of centres) {
    const M = reflect(ang * Math.PI / 180, c[0], c[1]);
    if (holds(M)) mirrors.push([ang, M]);
  }
  const dirs = new Set(mirrors.map(m => m[0]));
  const onMirror = c => mirrors.some(([, M]) => { const q = apply(M, c); return Math.hypot(q[0] - c[0], q[1] - c[1]) < 1e-6; });
  const top = rotC[rmax] || [];
  // the centres of the highest order, and 2-folds for the r2 groups
  const cs = rmax === 2 ? (rotC[2] || []) : top;
  const all = cs.length && cs.every(onMirror), some = cs.some(c => !onMirror(c));
  const got = `r${rmax} m${dirs.size}` + (dirs.size ? (all ? ' allOn' : ' someOff') : '');
  const ok = got === expect[name];
  if (!ok) bad++;
  console.log(name.padEnd(5), got.padEnd(14), ok ? 'ok' : 'EXPECTED ' + expect[name]);
}
process.exit(bad ? 1 : 0);
