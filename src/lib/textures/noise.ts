export function txHash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
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

export function txWorley(x: number, y: number, t: number): { f1: number; f2: number; e: number } {
  const ix = Math.floor(x), iy = Math.floor(y); let f1 = 9, f2 = 9;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const ni = ix + di, nj = iy + dj, h1 = txHash(ni, nj), h2 = txHash(ni + 97, nj + 211);
      const cx = ni + h1 + 0.38 * Math.sin(h1 * 63.1 + t * 0.7), cy = nj + h2 + 0.38 * Math.cos(h2 * 79.3 + t * 0.55);
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, e: f2 - f1 };
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
