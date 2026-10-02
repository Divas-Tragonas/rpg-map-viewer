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

// ── Llenguatge visual comú ───────────────────────────────────────────────────
// Cada escola de màgia té UNA paleta (blanc de nucli → clar → mig → profund) i tots
// els seus spells la comparteixen: el projectil màgic i el raig màgic són del mateix
// violeta, la bola de foc i les mans ardents del mateix foc. Així els spells semblen
// d'un mateix joc i no vuit efectes fets per separat.

export interface Palette { white: RGB3; light: RGB3; mid: RGB3; deep: RGB3; }
export const PAL = {
  fire:   { white: [255, 246, 225], light: [255, 176, 80],  mid: [255, 112, 26], deep: [200, 50, 10] },
  arcane: { white: [250, 240, 255], light: [215, 170, 255], mid: [160, 80, 255], deep: [90, 40, 230] },
  charm:  { white: [255, 240, 248], light: [255, 170, 215], mid: [236, 72, 153], deep: [150, 30, 100] },
  dream:  { white: [236, 238, 255], light: [170, 182, 252], mid: [110, 112, 240], deep: [55, 50, 170] },
  frost:  { white: [240, 250, 255], light: [170, 225, 255], mid: [90, 180, 250],  deep: [30, 100, 210] },
  storm:  { white: [245, 248, 255], light: [170, 200, 255], mid: [100, 140, 255], deep: [50, 70, 220] },
  radiant:{ white: [255, 252, 235], light: [255, 232, 150], mid: [255, 200, 70],  deep: [210, 140, 20] },
  life:   { white: [240, 255, 240], light: [150, 245, 170], mid: [60, 210, 110],  deep: [20, 140, 70] },
} satisfies Record<string, Palette>;

export const rgb = (c: RGB3) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Bufarada de foc amb temperatura contínua 0..3 (fosa entre dos sprites veïns). */
export function fire(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, temp: number, alpha: number, variant: number): void {
  if (alpha <= 0.004 || r <= 0) return;
  const t = Math.min(3, Math.max(0, temp)), i = Math.floor(t), f = t - i;
  ctx.globalAlpha = alpha * (1 - f);
  blit(ctx, fireSprite(i, variant), x, y, r, rot);
  if (f > 0.02 && i < 3) {
    ctx.globalAlpha = alpha * f;
    blit(ctx, fireSprite(i + 1, variant), x, y, r, rot);
  }
}

/** Ratlla d'espurna (motion blur) de q a p. */
export function streak(ctx: CanvasRenderingContext2D, q: Point2, p: Point2, c: RGB3, width: number, alpha: number): void {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.strokeStyle = rgb(c); ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
}
type Point2 = { x: number; y: number };

/**
 * Esclat d'impacte petit/mitjà, el mateix per a tots els spells que toquen un objectiu:
 * flaix → llum → anell → espurnes. `k` 0..1 és el progrés; `size` el radi en coords de
 * mapa. Cal estar en 'lighter'.
 */
export function impactBurst(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pal: Palette, k: number, seed: number, px: number): void {
  if (k < 0 || k >= 1) return;
  const f = 1 - k;
  if (k < 0.25) glow(ctx, pal.white, x, y, size * (0.5 + 1.4 * k / 0.25), (1 - k / 0.25) ** 2);
  glow(ctx, pal.mid, x, y, size * 2.2, 0.5 * f * f);
  glow(ctx, pal.white, x, y, size * 0.45, f);
  ctx.globalAlpha = 0.8 * f; ctx.strokeStyle = rgb(pal.light);
  ctx.lineWidth = Math.max(px, size * 0.12 * f);
  ctx.beginPath(); ctx.arc(x, y, size * 1.5 * easeOutQuart(k), 0, TAU); ctx.stroke();
  const rnd = mulberry32(seed);
  for (let i = 0; i < 10; i++) {
    const a = rnd() * TAU, sp = size * (4 + rnd() * 5), hot = rnd();
    const at = (t: number) => { const d = dragged(sp, 5, t); return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }; };
    const tt = k * 0.5;
    streak(ctx, at(Math.max(0, tt - 0.03)), at(tt), hot > 0.4 ? pal.white : pal.light, (1 + hot) * px, f);
  }
}

/** Boira de color (blend normal): com el fum, però clara i d'un to. */
export function mistSprite(c: RGB3, variant: number): HTMLCanvasElement | null {
  return build(`mist:${c.join(',')}:${variant}`, 96, (img, S) => {
    const n = fbm(S, 0x3157 + variant * 7753, 5, 2);
    const h = S / 2, d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nv = n[y * S + x];
      const r = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      const dens = Math.max(0, 1 - r / (0.6 + 0.4 * nv));
      const l = 0.75 + 0.35 * nv;
      const i = (y * S + x) * 4;
      d[i] = Math.min(255, c[0] * l); d[i + 1] = Math.min(255, c[1] * l); d[i + 2] = Math.min(255, c[2] * l);
      d[i + 3] = Math.round(255 * Math.min(1, Math.pow(dens, 1.5) * (0.4 + 0.8 * nv)));
    }
  });
}

/** Textura del greix: oli verd fosc amb vetes irisades (es retalla a la forma del bassal). */
export function greaseSprite(): HTMLCanvasElement | null {
  return build('grease', 256, (img, S) => {
    const n = fbm(S, 0x6ea5e, 5, 3), m = fbm(S, 0x0111, 4, 2);
    const d = img.data;
    for (let i = 0; i < S * S; i++) {
      const nv = n[i], vein = Math.pow(Math.abs(Math.sin((m[i] * 2 + nv) * 7)), 40);
      const k = 0.35 + 0.65 * nv;
      d[i * 4]     = 30 + 70 * k + 35 * vein;
      d[i * 4 + 1] = 44 + 88 * k + 45 * vein;
      d[i * 4 + 2] = 6 + 20 * k + 25 * vein;
      d[i * 4 + 3] = 255;
    }
  });
}
