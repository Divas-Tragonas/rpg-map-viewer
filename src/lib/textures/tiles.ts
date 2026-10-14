// Textures enrajolables de les zones màgiques (foc, gel, aigua, verí, llamps, màgia).
//
// Abans cada zona es pintava texel a texel amb soroll calculat en JS 8–20 cops per segon,
// a ≤70 texels de costat: sortia borrosa, anava a salts i costava força. Ara cada textura
// es genera UN sol cop (256×256 i periòdica: es repeteix sense costures) i l'animació la
// fa `render/zonefx.ts` movent-les i girant-les com a patrons, amb partícules a sobre.
//
// Tot el soroll d'aquí és periòdic (la xarxa de valors fa la volta), si no, en repetir la
// textura es veurien les juntes. Sense `document` (servidor) els getters retornen null.

import { mulberry32, type RGB3 } from '@/lib/render/fxsprites';

export const TILE = 256;
const S = TILE;

// ── Camps de soroll periòdics ────────────────────────────────────────────────

/** Soroll de valor fractal periòdic: `base` cel·les per costat a la primera octava. */
function fbm(seed: number, base: number, octaves: number): Float32Array {
  const out = new Float32Array(S * S);
  const rnd = mulberry32(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = base << o;
    const lat = new Float32Array(n * n);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    for (let y = 0; y < S; y++) {
      const fy = (y / S) * n, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
      const y0 = (iy % n) * n, y1 = ((iy + 1) % n) * n;
      for (let x = 0; x < S; x++) {
        const fx = (x / S) * n, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
        const x0 = ix % n, x1 = (ix + 1) % n;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * S + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Estira el camp a 0..1 (el soroll de valor es concentra al voltant de 0,5). */
function norm(a: Float32Array): Float32Array {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const k = hi > lo ? 1 / (hi - lo) : 0;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) * k;
  return a;
}

/** Mostra bilineal periòdica d'un camp. */
function sample(a: Float32Array, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const x0 = ((ix % S) + S) % S, x1 = (x0 + 1) % S, y0 = ((iy % S) + S) % S, y1 = (y0 + 1) % S;
  const p = a[y0 * S + x0], q = a[y0 * S + x1], r = a[y1 * S + x0], s = a[y1 * S + x1];
  return (p + (q - p) * tx) * (1 - ty) + (r + (s - r) * tx) * ty;
}

/** Deformació de domini: `a` llegit en coordenades desplaçades per dos camps (llengües, remolins). */
function warp(a: Float32Array, wx: Float32Array, wy: Float32Array, amt: number): Float32Array {
  const out = new Float32Array(S * S), k = amt * S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    out[i] = sample(a, x + (wx[i] - 0.5) * k, y + (wy[i] - 0.5) * k);
  }
  return out;
}

/**
 * Cel·les de Worley periòdiques (`n` per costat): distància al punt més proper (f1), al
 * segon (f2) i un valor aleatori per cel·la (id). `f2 − f1` ≈ distància a la vora: amb
 * això surten esquerdes, facetes de cristall i la xarxa de càustiques. `warp` torça les
 * vores (sense, les cel·les són polígons massa rectes).
 */
function worley(seed: number, n: number, warpBy?: { wx: Float32Array; wy: Float32Array; amt: number }) {
  const rnd = mulberry32(seed);
  const fx = new Float32Array(n * n), fy = new Float32Array(n * n), fid = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) { fx[k] = rnd(); fy[k] = rnd(); fid[k] = rnd(); }
  const f1 = new Float32Array(S * S), f2 = new Float32Array(S * S), id = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    let cx = (x / S) * n, cy = (y / S) * n;
    if (warpBy) { cx += (warpBy.wx[i] - 0.5) * warpBy.amt; cy += (warpBy.wy[i] - 0.5) * warpBy.amt; }
    const ix = Math.floor(cx), iy = Math.floor(cy);
    let d1 = 9, d2 = 9, best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = ix + dx, gy = iy + dy;
      const k = (((gy % n) + n) % n) * n + (((gx % n) + n) % n);
      const d = Math.hypot(cx - (gx + fx[k]), cy - (gy + fy[k]));
      if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d;
    }
    f1[i] = d1; f2[i] = d2; id[i] = fid[best];
  }
  return { f1, f2, id };
}

const smooth = (a: number, b: number, v: number) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
const mix = (a: RGB3, b: RGB3, k: number): RGB3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// ── Memòria cau ──────────────────────────────────────────────────────────────

const _tiles = new Map<string, HTMLCanvasElement | null>();

/** `paint(i)` retorna el color i l'alfa (0..1) del píxel `i`; es crida un sol cop per píxel. */
function tile(key: string, prepare: () => (i: number) => [RGB3, number]): HTMLCanvasElement | null {
  const hit = _tiles.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (!g) { _tiles.set(key, null); return null; }
  const img = g.createImageData(S, S), d = img.data, paint = prepare();
  for (let i = 0; i < S * S; i++) {
    const [c, a] = paint(i);
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
    d[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, a)));
  }
  g.putImageData(img, 0, 0);
  _tiles.set(key, cv);
  return cv;
}

// ── Foc ──────────────────────────────────────────────────────────────────────

/** Terra cremat: carbó amb esquerdes incandescents (la lava que es veu entre les plaques). */
export const fireGround = () => tile('fireGround', () => {
  const heat = norm(warp(fbm(0xf1a, 2, 5), fbm(0xf1b, 2, 3), fbm(0xf1c, 2, 3), 0.3));
  const wx = fbm(0xa1, 3, 4), wy = fbm(0xa2, 3, 4);
  const big = worley(0xc4a, 8, { wx, wy, amt: 1.8 });
  const fine = worley(0xc4b, 20, { wx, wy, amt: 2.4 });
  return (i) => {
    const e = big.f2[i] - big.f1[i], ef = fine.f2[i] - fine.f1[i];
    const h = smooth(0.2, 0.85, heat[i]);                          // on crema (1) i on ja és carbó (0)
    const crack = (1 - smooth(0, 0.06, e)) * (0.15 + 0.85 * h);
    const halo = (1 - smooth(0, 0.25, e)) * h;
    const hair = (1 - smooth(0, 0.07, ef)) * h * h;                 // esquerdes fines, només on crema
    let c = mix([10, 6, 5], [70, 20, 6], h);
    c = mix(c, [175, 40, 4], Math.max(halo * 0.6, hair * 0.55, h * h * 0.35));
    c = mix(c, [255, 140, 34], crack);
    return [c, 0.48 + 0.22 * h + 0.18 * halo + 0.12 * crack];
  };
});

/** Flames vistes des de dalt: llengües de soroll deformat, per a la mescla additiva. */
export const fireFlame = () => tile('fireFlame', () => {
  const v = norm(warp(fbm(0xf1, 3, 5), fbm(0xf2, 2, 4), fbm(0xf3, 2, 4), 0.22));
  return (i) => {
    const k = Math.pow(smooth(0.4, 1, v[i]), 1.3);
    const c = k < 0.5 ? mix([200, 40, 0], [255, 122, 12], k / 0.5) : mix([255, 122, 12], [255, 236, 170], (k - 0.5) / 0.5);
    return [c, k];
  };
});

// ── Gel ──────────────────────────────────────────────────────────────────────

/**
 * Placa de gel: llisa i translúcida (es veu el terra a sota), més blava on és fonda i més
 * clara on és prima. Les esquerdes no tanquen cel·les (semblaria un enrajolat): només
 * algunes vores de Worley i unes quantes fractures llargues i corbes. Bombolles atrapades.
 */
export const iceSheet = () => tile('iceSheet', () => {
  const depth = norm(warp(fbm(0x1c3, 2, 5), fbm(0x1c4, 2, 3), fbm(0x1c5, 2, 3), 0.25));
  const { f1, f2, id } = worley(0x1ce, 5, { wx: fbm(0x1c1, 2, 3), wy: fbm(0x1c2, 2, 3), amt: 0.9 });
  const keep = norm(fbm(0x1c6, 3, 3));                 // quines vores són esquerda i quines no
  const frx = norm(warp(fbm(0x1d0, 2, 5), fbm(0x1d2, 2, 3), fbm(0x1d3, 2, 3), 0.15));
  const grain = norm(fbm(0x1cf, 16, 3));
  const bub = worley(0x1d1, 26);
  return (i) => {
    const e = f2[i] - f1[i], d = Math.pow(depth[i], 1.2);
    const crack = (1 - smooth(0, 0.022, e)) * smooth(0.5, 0.62, keep[i]);
    const fracture = 1 - smooth(0, 0.035, Math.abs(Math.sin(frx[i] * Math.PI * 3)));
    const halo = Math.max((1 - smooth(0, 0.1, e)) * smooth(0.5, 0.62, keep[i]), 1 - smooth(0, 0.12, Math.abs(Math.sin(frx[i] * Math.PI * 3))));
    const bubble = (1 - smooth(0.03, 0.07, bub.f1[i])) * smooth(0.8, 0.82, bub.id[i]);
    let c = mix([168, 222, 246], [34, 104, 186], d * 0.85);
    c = mix(c, [120, 185, 235], (id[i] - 0.5) * 0.25 + 0.1);   // les facetes, només insinuades
    c = mix(c, [215, 240, 255], halo * 0.35);
    c = mix(c, [250, 254, 255], Math.max(crack, fracture * 0.9, bubble * 0.8));
    c = mix(c, [232, 246, 255], grain[i] * 0.1);
    return [c, 0.34 + 0.26 * d + 0.12 * halo + 0.5 * Math.max(crack, fracture * 0.8, bubble * 0.6)];
  };
});

// ── Aigua ────────────────────────────────────────────────────────────────────

/** Fons de l'aigua: blau fosc amb zones més i menys fondes. */
export const waterDeep = () => tile('waterDeep', () => {
  const v = norm(warp(fbm(0x3a7, 3, 5), fbm(0x3a8, 2, 3), fbm(0x3a9, 2, 3), 0.15));
  return (i) => { const k = Math.pow(v[i], 1.3); return [mix([3, 24, 66], [34, 112, 172], k), 0.58 + 0.14 * k]; };
});

/**
 * Càustiques (la llum que fa l'aigua al fons), per a la mescla additiva: corbes de nivell
 * suaus d'un soroll remenat, no vores de cel·les (amb cel·les semblava vidre esquerdat). Dues
 * còpies que es mouen en direccions diferents es creuen i fan la xarxa que balla.
 */
export const caustics = () => tile('caustics', () => {
  const v = norm(warp(fbm(0xca1, 3, 4), fbm(0xca2, 2, 3), fbm(0xca4, 2, 3), 0.35));
  const patch = norm(fbm(0xca3, 2, 3));   // la llum no cau igual a tot arreu: clapes amb i sense
  return (i) => {
    const k = Math.pow(Math.max(0, 1 - Math.abs(Math.sin(v[i] * Math.PI * 5)) * 1.5), 2);
    return [[190, 238, 255], k * smooth(0.15, 0.7, patch[i])];
  };
});

/** Reflexos de la superfície: crestes suaus d'onades, per a la mescla additiva. */
export const waterWaves = () => tile('waterWaves', () => {
  const v = norm(warp(fbm(0x3b1, 4, 4), fbm(0x3b2, 2, 3), fbm(0x3b3, 2, 3), 0.25));
  return (i) => [[205, 240, 255], Math.pow(smooth(0.6, 1, v[i]), 2)];
});

// ── Verí ─────────────────────────────────────────────────────────────────────

/** Fang tòxic: verds foscos remenats amb venes negres. */
export const poisonSludge = () => tile('poisonSludge', () => {
  const v = norm(warp(fbm(0x9a1, 3, 5), fbm(0x9a2, 2, 4), fbm(0x9a3, 2, 4), 0.25));
  const vn = norm(fbm(0x9a4, 4, 4));
  return (i) => {
    const vein = Math.pow(1 - Math.abs(vn[i] * 2 - 1), 12);
    let c = v[i] < 0.5 ? mix([8, 26, 6], [40, 84, 12], v[i] / 0.5) : mix([40, 84, 12], [112, 168, 26], (v[i] - 0.5) / 0.5);
    c = mix(c, [4, 12, 3], vein * 0.7);
    return [c, 0.64 + 0.16 * v[i] + 0.1 * vein];
  };
});

/** Taques que brillen de color llima, per a la mescla additiva. */
export const poisonGlow = () => tile('poisonGlow', () => {
  const v = norm(warp(fbm(0x9b1, 4, 4), fbm(0x9b2, 2, 3), fbm(0x9b3, 2, 3), 0.2));
  return (i) => [[160, 255, 60], smooth(0.6, 0.88, v[i])];
});

// ── Llamps ───────────────────────────────────────────────────────────────────

/** Camp de tempesta: núvols blau fosc carregats, prou transparents per veure el mapa. */
export const stormField = () => tile('stormField', () => {
  const v = norm(warp(fbm(0x5f1, 3, 5), fbm(0x5f2, 2, 3), fbm(0x5f3, 2, 3), 0.2));
  return (i) => { const k = Math.pow(v[i], 1.6); return [mix([4, 6, 22], [78, 92, 190], k), 0.42 + 0.3 * k]; };
});

/** Filaments d'electricitat estàtica (corbes de nivell d'un soroll), per a la mescla additiva. */
export const stormVeins = () => tile('stormVeins', () => {
  const v = norm(warp(fbm(0x5e1, 3, 4), fbm(0x5e2, 2, 3), fbm(0x5e3, 2, 3), 0.3));
  const patch = norm(fbm(0x5e4, 2, 3));
  return (i) => {
    const fil = Math.pow(Math.max(0, 1 - Math.abs(Math.sin(v[i] * Math.PI * 7)) * 3.4), 3);
    return [[150, 180, 255], fil * smooth(0.3, 0.8, patch[i])];
  };
});

// ── Màgia ────────────────────────────────────────────────────────────────────

/** Nebulosa arcana: violeta profund amb núvols magenta. */
export const nebula = () => tile('nebula', () => {
  const v1 = norm(warp(fbm(0x6b1, 3, 5), fbm(0x6b2, 2, 4), fbm(0x6b3, 2, 4), 0.28));
  const v2 = norm(fbm(0x6b4, 4, 4));
  return (i) => {
    const k = Math.pow(v1[i], 1.4);
    let c = mix([10, 3, 32], [124, 48, 220], k);
    c = mix(c, [236, 84, 206], smooth(0.5, 0.9, v2[i]) * k);
    return [c, 0.4 + 0.36 * k];
  };
});

/** Corrents del fluid arcà: corbes de nivell amples d'un soroll remenat, per a la mescla additiva. */
export const arcaneFlow = () => tile('arcaneFlow', () => {
  const v = norm(warp(fbm(0x6d1, 3, 5), fbm(0x6d2, 2, 4), fbm(0x6d3, 2, 4), 0.35));
  const patch = norm(fbm(0x6d4, 2, 3));
  return (i) => {
    const band = Math.pow(1 - Math.abs(Math.sin(v[i] * Math.PI * 4)), 2.5);
    return [[214, 140, 255], band * (0.35 + 0.65 * smooth(0.25, 0.8, patch[i]))];
  };
});

/**
 * Remolí (no enrajolable: es pinta centrat a la zona). El soroll es mostreja en coordenades
 * d'espiral logarítmica (angle + `twist`·ln r): en girar el sprite, els braços semblen
 * xuclats cap al centre, com un portal. Periòdic en l'angle, així no hi ha cap junta.
 */
export const vortex = (twist: number) => tile(`vortex:${twist}`, () => {
  const n = norm(fbm(0x7a1 + Math.round(twist * 100), 3, 5));
  return (i) => {
    const x = i % S, y = (i / S) | 0;
    const dx = ((x + 0.5) / S) * 2 - 1, dy = ((y + 0.5) / S) * 2 - 1, r = Math.hypot(dx, dy);
    if (r >= 1) return [[0, 0, 0], 0];
    const th = Math.atan2(dy, dx) / (Math.PI * 2), lr = Math.log(r + 0.03);
    const v = sample(n, (th + twist * lr) * S, lr * S * 0.22);
    const k = Math.pow(smooth(0.35, 1, v), 1.6) * (1 - smooth(0.55, 1, r)) * (0.55 + 0.45 * (1 - smooth(0.05, 0.6, r)));
    const c = k < 0.5 ? mix([120, 50, 230], [225, 90, 230], k / 0.5) : mix([225, 90, 230], [255, 215, 255], (k - 0.5) / 0.5);
    return [c, k];
  };
});
