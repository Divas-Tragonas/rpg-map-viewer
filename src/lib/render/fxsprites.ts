// Sprites pre-rasteritzats per als efectes de partícules dels spells.
//
// Un `createRadialGradient` per partícula i per frame és car i fa que tot tingui la
// mateixa forma de cercle perfecte. Els motors de joc fan servir sprites: textures
// petites generades UNA vegada (amb soroll, perquè el foc i el fum tinguin grumolls)
// que després només es copien escalades i rotades amb `drawImage`. Cada sprite es
// genera la primera vegada que es demana i queda a la memòria cau del mòdul.

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _cache = new Map<string, HTMLCanvasElement | null>();

function build(key: string, S: number, paint: (img: ImageData, S: number) => void): HTMLCanvasElement | null {
  const hit = _cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (!g) { _cache.set(key, null); return null; }
  const img = g.createImageData(S, S);
  paint(img, S);
  g.putImageData(img, 0, 0);
  _cache.set(key, cv);
  return cv;
}

/** Soroll fractal (value noise, 4 octaves) normalitzat a 0..1. */
function fbm(S: number, seed: number, octaves = 4, base = 3): Float32Array {
  const out = new Float32Array(S * S);
  const rnd = mulberry32(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = base << o, W = n + 1;
    const lat = new Float32Array(W * W);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    for (let y = 0; y < S; y++) {
      const fy = (y / S) * n, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < S; x++) {
        const fx = (x / S) * n, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
        const a = lat[iy * W + ix], b = lat[iy * W + ix + 1];
        const c = lat[(iy + 1) * W + ix], d = lat[(iy + 1) * W + ix + 1];
        out[y * S + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

type RGB = [number, number, number];

/** Halo suau (caiguda tipus 1/(1+d²), no lineal) d'un color. */
export function glowSprite(rgb: RGB): HTMLCanvasElement | null {
  return build(`glow:${rgb.join(',')}`, 128, (img, S) => {
    const h = S / 2, d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const r = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      const k = r >= 1 ? 0 : (1 / (1 + 18 * r * r) - 1 / 19) * (19 / 18) * (1 - r * r);
      const i = (y * S + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = Math.round(255 * k);
    }
  });
}

/**
 * Bufarada de foc amb grumolls de soroll. `temp` 0..3 (0 = blanc incandescent,
 * 3 = vermell fosc que s'apaga). El nucli és més calent que la vora.
 */
const FIRE_RAMP: [RGB, RGB][] = [
  [[255, 255, 240], [255, 196, 90]],
  [[255, 226, 130], [255, 128, 26]],
  [[255, 150, 44], [210, 62, 8]],
  [[210, 76, 18], [110, 22, 4]],
];
export function fireSprite(temp: number, variant: number): HTMLCanvasElement | null {
  return build(`fire:${temp}:${variant}`, 96, (img, S) => {
    const n = fbm(S, 0xf17e + variant * 7919, 4, 3);
    const [core, edge] = FIRE_RAMP[temp];
    const h = S / 2, d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nv = n[y * S + x];
      const r = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      const lim = 0.5 + 0.5 * nv;
      let dens = Math.max(0, 1 - r / lim);
      dens = Math.pow(dens, 0.9) * (0.55 + 0.45 * nv);
      const c = Math.min(1, Math.pow(dens * 1.6, 1.4));
      const i = (y * S + x) * 4;
      d[i] = edge[0] + (core[0] - edge[0]) * c;
      d[i + 1] = edge[1] + (core[1] - edge[1]) * c;
      d[i + 2] = edge[2] + (core[2] - edge[2]) * c;
      d[i + 3] = Math.round(255 * Math.min(1, dens * 1.5));
    }
  });
}

/** Bufarada de fum (blend normal): grumollosa, més clara per dalt. */
export function smokeSprite(variant: number): HTMLCanvasElement | null {
  return build(`smoke:${variant}`, 96, (img, S) => {
    const n = fbm(S, 0x5e0c + variant * 104729, 5, 2);
    const h = S / 2, d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nv = n[y * S + x];
      const r = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      const lim = 0.55 + 0.45 * nv;
      const dens = Math.max(0, 1 - r / lim);
      const lit = 1 - y / S; // llum zenital: la part de dalt una mica més clara
      const g = 30 + 38 * nv * lit;
      const i = (y * S + x) * 4;
      d[i] = g + 6; d[i + 1] = g; d[i + 2] = g - 4;
      d[i + 3] = Math.round(255 * Math.min(1, Math.pow(dens, 1.3) * (0.5 + 0.7 * nv)));
    }
  });
}

/** Marca de socarrim a terra: nucli de carbó, raigs radials i vora esquinçada. */
export function scorchSprite(): HTMLCanvasElement | null {
  return build('scorch', 256, (img, S) => {
    const n = fbm(S, 0x5c07c, 5, 3);
    const rays = mulberry32(0xa11);
    const RAYS = 64, rayAmp = new Float32Array(RAYS);
    for (let i = 0; i < RAYS; i++) rayAmp[i] = rays();
    const h = S / 2, d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - h, dy = y + 0.5 - h;
      const r = Math.hypot(dx, dy) / h;
      const ang = ((Math.atan2(dy, dx) / (Math.PI * 2)) + 1) % 1 * RAYS;
      const a0 = Math.floor(ang), ft = ang - a0;
      const ray = rayAmp[a0 % RAYS] * (1 - ft) + rayAmp[(a0 + 1) % RAYS] * ft;
      const nv = n[y * S + x];
      const reach = 0.55 + 0.35 * ray + 0.15 * nv;
      let a = Math.max(0, 1 - Math.pow(r / reach, 2.2));
      a *= 0.65 + 0.35 * nv;
      const i = (y * S + x) * 4;
      const c = 12 + 26 * nv * r;
      d[i] = c + 6; d[i + 1] = c + 2; d[i + 2] = c;
      d[i + 3] = Math.round(255 * Math.min(1, a * 1.15));
    }
  });
}

/** Dibuixa un sprite centrat a (x,y) amb radi r i rotació rot (sense save/restore). */
export function blit(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement | null, x: number, y: number, r: number, rot = 0): void {
  if (!spr || r <= 0) return;
  if (rot === 0) { ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); return; }
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.drawImage(spr, -r, -r, r * 2, r * 2);
  ctx.rotate(-rot); ctx.translate(-x, -y);
}

/** Dibuixa un sprite estirat (el·lipse rx×ry orientada `rot`): flares, espetecs direccionals. */
export function blitStretch(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement | null, x: number, y: number, rx: number, ry: number, rot: number): void {
  if (!spr || rx <= 0 || ry <= 0) return;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.drawImage(spr, -rx, -ry, rx * 2, ry * 2);
  ctx.rotate(-rot); ctx.translate(-x, -y);
}

// ── Ajudants compartits pels efectes dels spells ─────────────────────────────

export type RGB3 = [number, number, number];
export const TAU = Math.PI * 2;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
export function smoothstep(t: number, a: number, b: number): number {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
}
/** Desplaçament amb fricció: arrenca a velocitat v i es frena (exp). */
export const dragged = (v: number, k: number, age: number) => v * (1 - Math.exp(-k * age)) / k;

/** Halo additiu d'un color (cal estar en 'lighter'). */
export function glow(ctx: CanvasRenderingContext2D, rgb: RGB3, x: number, y: number, r: number, alpha: number): void {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = Math.min(1, alpha);
  blit(ctx, glowSprite(rgb), x, y, r);
}

/** Mida d'una casella en coords de mapa (o una mida raonable de pantalla sense graella). */
export const fxCell = (sc: number, gridSize: number) => (gridSize > 0 ? gridSize : 48 / sc);
