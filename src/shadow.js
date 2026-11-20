// shadow: a sun that goes round, and the shadows it casts.
//
// Nothing here is drawn in shadow; the shadows are cast. A caster is
// whatever stands off the surface behind it: a course of brick proud of
// a wall, an iron grille a hand's width in front of whitewash, a stone
// screen with a floor below it. Its shadow is its own outline, moved
// along the sun's slant by how far it stands off, with anything that
// must stay lit cut back out, softened at the edge and multiplied onto
// the surface in the colour of the sky.
//
// Sebka needed it first, Rejería second and Jali third, which is when
// it moved here.

// The wall faces south. At six the sun is on the horizon to the left;
// at one it is high and in front; at eight it sets on the right. A
// point standing h proud of the wall throws its shadow h times `slant`
// along the wall (x to the right, y down); `light` is how squarely the
// sun hits the face. `reach` is the longest slant allowed, so dawn and
// dusk don't throw shadows off the page. `az` and `e` are the sun's
// angle along the wall and its height, for a page that needs its own
// projection; `warm` is 1 at the horizon and 0 at the top of the day.
const EMAX = 64 * Math.PI / 180;
export function sunOf(hour, opts) {
  const reach = (opts && opts.reach) || 9;
  const t = Math.min(0.995, Math.max(0.005, (hour - 6) / 14));
  const az = Math.PI * t;
  const e = EMAX * Math.sin(az);
  let sx = Math.cos(az) / Math.sin(az), sy = Math.tan(e) / Math.sin(az);
  const len = Math.hypot(sx, sy);
  if (len > reach) { sx *= reach / len; sy *= reach / len; }
  const light = Math.cos(e) * Math.sin(az);
  // the light itself: white at height, orange at the horizon. What the
  // sun doesn't reach is lit by the sky, so the shade is blue, and
  // bluer against a warm sun
  const warm = 1 - e / EMAX;
  const w2 = warm * warm;
  const sunCol = [255, Math.round(248 - 70 * w2), Math.round(232 - 125 * w2)];
  const shade = [Math.round(112 - 22 * warm), Math.round(118 - 18 * warm), Math.round(162 + 8 * warm)];
  const dl = Math.hypot(sx, sy) || 1;
  return { slant: [sx, sy], light, warm, e, az, sunCol, shade, dir: [-sx / dl, -sy / dl] };
}

// offscreen layers, kept by number and resized as the window is
const layers = [];
export function shadowLayer(n, pw, ph) {
  let c = layers[n];
  if (!c) c = layers[n] = document.createElement('canvas');
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
  return c;
}

// castShadow(g, { w, h, dpr, shade, alpha, blur, layer, cast, cut })
// lays one shadow over what is already on g. `cast(lg)` draws the
// caster where its shadow falls, on a clear layer the size of the
// window whose fill and stroke are already the shade colour; it sets
// its own transform, and may composite as it likes. `cut(lg)`, if
// given, is then drawn with destination-out: whatever it paints is
// taken out of the shadow (the caster itself, or a level the shadow
// can't reach). The layer is multiplied onto g at `alpha`, softened by
// `blur` device pixels (none while something is moving: the blur is
// most of a frame). `shade` is an [r, g, b] or a css colour; `layer`
// picks which kept layer to use, for a page that casts more than once
// and wants each kept.
export function castShadow(g, o) {
  const pw = Math.ceil(o.w * o.dpr), ph = Math.ceil(o.h * o.dpr);
  const lc = shadowLayer(o.layer || 0, pw, ph);
  const lg = lc.getContext('2d');
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalCompositeOperation = 'source-over';
  lg.globalAlpha = 1;
  lg.clearRect(0, 0, pw, ph);
  lg.fillStyle = lg.strokeStyle = Array.isArray(o.shade) ? `rgb(${o.shade})` : o.shade;
  o.cast(lg);
  if (o.cut) { lg.globalCompositeOperation = 'destination-out'; o.cut(lg); }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = o.alpha == null ? 1 : o.alpha;
  if (o.blur) g.filter = `blur(${o.blur.toFixed(2)}px)`;
  g.drawImage(lc, 0, 0);
  g.restore();
  return lc;
}
