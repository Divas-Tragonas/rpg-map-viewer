// Soroll per a les zones màgiques (`render/zonefx.ts`).
//
// Dues famílies:
//  - El soroll de VALOR de la v4.33 (`txNoise`, `txFBM`, `txFBMD`, `txWorley`, `txFBM3D`…), tal
//    qual: els camps antics del foc, l'aigua, el verí, el gel i la màgia en depenen i l'usuari
//    els vol iguals («el terra semblava que cremés»). No canviar-ne cap constant.
//  - Soroll de GRADIENT 3D (`fbm3`, `fbm2`) amb hash enter i octaves girades (sense blocs
//    alineats amb els eixos), per al que és nou: la tempesta del llamp, el gebre del gel, la
//    vora irregular i el remolí lent de la màgia.

// ── Soroll de valor (v4.33) ──────────────────────────────────────────────────

/**
 * Valor pseudoaleatori [0, 1) d'un punt ENTER de la graella del soroll. La v4.33 feia
 * `fract(sin(x·127,1 + y·311,7)·43758)`: el mateix soroll estadísticament, però el `sin`
 * d'un argument gran costa ~26 ns i el foc en fa 80 per texel (tres quarts del cost).
 * Només es crida amb enters (`floor` de la coordenada), o sigui que un hash enter hi val.
 */
export function txHash(x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function txNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = txHash(ix, iy), b = txHash(ix + 1, iy), c = txHash(ix, iy + 1), d = txHash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function txFBM(x: number, y: number, oct = 5): number {
  let v = 0, a = 0.5, f = 1, mx = 0;
  for (let i = 0; i < oct; i++) { v += txNoise(x * f, y * f) * a; mx += a; a *= 0.5; f *= 2; }
  return v / mx;
}

export function txFBMD(x: number, y: number, oct = 4): number {
  const ox = txFBM(x + 1.7, y + 9.2, oct), oy = txFBM(x + 8.3, y + 2.8, oct);
  return txFBM(x + 2.5 * ox, y + 2.5 * oy, oct);
}

/** Resultat de `txWorley`: un sol objecte reutilitzat (es crida milers de cops per fotograma clau). */
export const WORLEY = { f1: 0, f2: 0, e: 0 };

/** Cel·les de Worley: distància al punt més proper (`f1`), al segon (`f2`) i la vora (`e = f2 − f1`). */
export function txWorley(x: number, y: number, t: number): typeof WORLEY {
  const ix = Math.floor(x), iy = Math.floor(y); let f1 = 9, f2 = 9;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const ni = ix + di, nj = iy + dj, h1 = txHash(ni, nj), h2 = txHash(ni + 97, nj + 211);
      const cx = ni + h1 + 0.38 * Math.sin(h1 * 63.1 + t * 0.7), cy = nj + h2 + 0.38 * Math.cos(h2 * 79.3 + t * 0.55);
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  WORLEY.f1 = f1; WORLEY.f2 = f2; WORLEY.e = f2 - f1;
  return WORLEY;
}

export function txNoise3D(x: number, y: number, z: number): number {
  const iz = Math.floor(z), fz = z - iz, ufz = fz * fz * (3 - 2 * fz);
  return txNoise(x + iz * 73.7, y + iz * 47.1) * (1 - ufz) + txNoise(x + (iz + 1) * 73.7, y + (iz + 1) * 47.1) * ufz;
}

export function txFBM3D(x: number, y: number, z: number, oct = 5): number {
  let v = 0, a = 0.5, f = 1, mx = 0;
  for (let i = 0; i < oct; i++) { v += txNoise3D(x * f, y * f, z * f) * a; mx += a; a *= 0.5; f *= 2; }
  return v / mx;
}

export function txRidgedFBM(x: number, y: number, oct = 7): number {
  let v = 0, a = 0.5, f = 1, prev = 1;
  for (let i = 0; i < oct; i++) {
    const n = txNoise(x * f, y * f);
    const ridge = 1 - Math.abs(n * 2 - 1);
    const s = ridge * ridge * prev;
    v += s * a; prev = s; a *= 0.45; f *= 2.1;
  }
  return v;
}

// ── Soroll de gradient 3D (hash enter, interpolació quíntica) ────────────────

// Les 12 direccions de les arestes d'un cub, com a la referència de Perlin.
const GX = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0];
const GY = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1];
const GZ = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1];

function h3(ix: number, iy: number, iz: number, s: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(iz, 0x9e3779b1) ^ Math.imul(s + 1, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) % 12;
}

function grad(ix: number, iy: number, iz: number, s: number, x: number, y: number, z: number): number {
  const g = h3(ix, iy, iz, s);
  return GX[g] * x + GY[g] * y + GZ[g] * z;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Soroll de gradient 3D, aproximadament dins de [-1, 1]. */
export function pn3(x: number, y: number, z: number, s = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz, u = fade(fx), v = fade(fy), w = fade(fz);
  const g000 = grad(ix, iy, iz, s, fx, fy, fz), g100 = grad(ix + 1, iy, iz, s, fx - 1, fy, fz);
  const g010 = grad(ix, iy + 1, iz, s, fx, fy - 1, fz), g110 = grad(ix + 1, iy + 1, iz, s, fx - 1, fy - 1, fz);
  const g001 = grad(ix, iy, iz + 1, s, fx, fy, fz - 1), g101 = grad(ix + 1, iy, iz + 1, s, fx - 1, fy, fz - 1);
  const g011 = grad(ix, iy + 1, iz + 1, s, fx, fy - 1, fz - 1), g111 = grad(ix + 1, iy + 1, iz + 1, s, fx - 1, fy - 1, fz - 1);
  const x00 = g000 + (g100 - g000) * u, x10 = g010 + (g110 - g010) * u;
  const x01 = g001 + (g101 - g001) * u, x11 = g011 + (g111 - g011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return (y0 + (y1 - y0) * w) * 1.1;
}

const ROT_C = Math.cos(0.6), ROT_S = Math.sin(0.6);

/** fBm de gradient amb cada octava girada (res de quadrícula visible). */
export function fbm3(x: number, y: number, z: number, oct: number, s = 0): number {
  let v = 0, a = 0.5, mx = 0;
  for (let i = 0; i < oct; i++) {
    v += a * pn3(x, y, z, s + i * 31); mx += a;
    const nx = (ROT_C * x - ROT_S * y) * 2.01, ny = (ROT_S * x + ROT_C * y) * 2.01;
    x = nx + 1.7; y = ny - 0.9; a *= 0.5;
  }
  return v / mx;
}

/** fBm de gradient 2D (un tall fix del 3D). */
export const fbm2 = (x: number, y: number, oct: number, s = 0) => fbm3(x, y, 0.37, oct, s);
