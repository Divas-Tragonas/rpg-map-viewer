import { txFBMD, txFBM, txWorley, txFBM3D, txRidgedFBM } from './noise';

type RGBA = [number, number, number, number];

export function txMagma(wx: number, wy: number, t: number): RGBA {
  const { f1, e } = txWorley(wx * 1.7, wy * 1.7, t * 1.3);
  const flow   = txFBMD(wx * 0.9 + t * 0.28, wy * 0.9 + t * 0.20);
  const detail = txFBM(wx * 3.5 - t * 0.15, wy * 3.5 + t * 0.10, 3);
  const crack  = Math.pow(Math.max(0, 1 - e * 5.5), 3) * 1.4, glow = Math.pow(Math.max(0, 1 - f1 * 2.8), 4) * 0.6;
  const v = Math.min(1, Math.max(0, crack + glow + flow * 0.35 + detail * 0.15));
  let r, g, b;
  if      (v < 0.12) { const k = v / 0.12;        r = 8 + 12 * k | 0;   g = 4 + 8 * k | 0;    b = 3 + 5 * k | 0; }
  else if (v < 0.42) { const k = (v - 0.12) / 0.3; r = 20 + 195 * k | 0; g = 12 + 18 * k | 0;  b = 8; }
  else if (v < 0.72) { const k = (v - 0.42) / 0.3; r = 215 + 40 * k | 0; g = 30 + 120 * k | 0; b = 8 + 5 * k | 0; }
  else               { const k = (v - 0.72) / 0.28; r = 255;              g = 150 + 105 * k | 0; b = 13 + 220 * k | 0; }
  return [r, g, b, 148];
}

export function txIce(wx: number, wy: number, t: number): RGBA {
  const h    = txFBMD(wx * 1.6, wy * 1.6);
  const c1   = Math.abs(Math.sin(h * Math.PI * 5));
  const vein = Math.pow(Math.max(0, 1 - c1 * 5), 3.5);
  const block = txFBM(wx * 0.9, wy * 0.9, 3) * 0.3;
  const sparkPh = txFBM(wx * 7, wy * 7, 2) * Math.PI * 8;
  const spark = Math.pow(Math.max(0, Math.sin(sparkPh + t * 1.5)), 12) * 0.9;
  const v = vein * 0.6 + block + spark * 0.45;
  let r, g, b;
  if      (v < 0.18) { r = 195 + block * 20 | 0; g = 228; b = 248; }
  else if (v < 0.50) { const k = (v - 0.18) / 0.32; r = 195 + 45 * k | 0; g = 228 + 18 * k | 0; b = 248 + 7 * k | 0; }
  else if (v < 0.78) { const k = (v - 0.50) / 0.28; r = 240 + 12 * k | 0; g = 246 + 9 * k | 0;  b = 255; }
  else               { r = 252; g = 254; b = 255; }
  return [r, g, b, 148];
}

export function txWater(wx: number, wy: number, t: number): RGBA {
  let caustic = 0;
  for (let i = 0; i < 3; i++) {
    const ph = txFBM(wx * (1.2 + i * 0.15) + i * 5.1, wy * (1.2 + i * 0.15) + i * 3.7, 3) * Math.PI * 6;
    caustic += Math.sin(ph + t * (1.1 + i * 0.15)) * 0.5 + 0.5;
  }
  caustic = Math.pow(caustic / 3, 2.5);
  const depth  = txFBMD(wx * 0.8, wy * 0.8);
  const ripple = txFBM(wx * 1.4 + t * 0.15, wy * 1.4 + t * 0.10, 3);
  const v = Math.min(1, Math.max(0, caustic * 0.65 + depth * 0.20 + ripple * 0.20));
  let r, g, b;
  if      (v < 0.18) { const k = v / 0.18;          r = 2 + 8 * k | 0;   g = 18 + 40 * k | 0;   b = 55 + 80 * k | 0; }
  else if (v < 0.52) { const k = (v - 0.18) / 0.34; r = 10 + 35 * k | 0; g = 58 + 110 * k | 0;  b = 135 + 75 * k | 0; }
  else if (v < 0.80) { const k = (v - 0.52) / 0.28; r = 45 + 155 * k | 0;g = 168 + 72 * k | 0;  b = 210 + 35 * k | 0; }
  else               { const k = (v - 0.80) / 0.20; r = 200 + 55 * k | 0;g = 240 + 15 * k | 0;  b = 245 + 10 * k | 0; }
  return [r, g, b, 148];
}

export function txFire(wx: number, wy: number, t: number): RGBA {
  const base   = txFBM3D(wx * 2, wy * 2, t * 0.28, 4);
  const detail = txFBM3D(wx * 3.8, wy * 3.8, t * 0.42, 3);
  const wx2 = wx + base * 0.6, wy2 = wy + detail * 0.4;
  const core = txFBM3D(wx2 * 1.6, wy2 * 1.6, t * 0.32, 3);
  const raw = base * 0.45 + core * 0.38 + detail * 0.17;
  const v = Math.min(1, Math.max(0, Math.pow(raw * 1.7 - 0.18, 1.5)));
  let r, g, b;
  if      (v < 0.08) { const k = v / 0.08;           r = 3 + 10 * k | 0;   g = 1 + 3 * k | 0;   b = 0; }
  else if (v < 0.28) { const k = (v - 0.08) / 0.2;   r = 13 + 202 * k | 0; g = 4 + 22 * k | 0;  b = 0; }
  else if (v < 0.55) { const k = (v - 0.28) / 0.27;  r = 215 + 40 * k | 0; g = 26 + 148 * k | 0;b = 0; }
  else if (v < 0.78) { const k = (v - 0.55) / 0.23;  r = 255;              g = 174 + 72 * k | 0; b = 14 * k | 0; }
  else               { const k = (v - 0.78) / 0.22;  r = 255;              g = 246 + 9 * k | 0;  b = 14 + 232 * k | 0; }
  return [r, g, b, 152];
}

export function txPoison(wx: number, wy: number, t: number): RGBA {
  const sludge = txFBMD(wx * 0.9 + t * 0.06, wy * 0.9 + t * 0.045);
  const d1x = txFBM(wx * 1.1, wy * 1.1, 3) * 0.9 - 0.45;
  const d1y = txFBM(wx * 1.1 + 3.3, wy * 1.1 + 2.0, 3) * 0.9 - 0.45;
  const veins = txRidgedFBM(wx * 1.3 + d1x, wy * 1.3 + d1y, 4);
  const spots = txFBM(wx * 2.4 + t * 0.12, wy * 2.4 + t * 0.10, 3);
  const glow  = Math.pow(Math.max(0, spots - 0.52) / 0.48, 2);
  const drip  = txFBM(wx * 3.2 + t * 0.10, wy * 0.6, 2);
  const streak = Math.pow(Math.max(0, drip - 0.58) / 0.42, 3);
  const v = Math.min(1, Math.max(0, sludge * 0.25 + veins * 0.45 + glow * 0.55 + streak * 0.35));
  let r, g, b;
  if      (v < 0.10) { const k = v / 0.10;           r = 2 + 6 * k | 0;   g = 10 + 22 * k | 0; b = 1 + 4 * k | 0; }
  else if (v < 0.32) { const k = (v - 0.10) / 0.22;  r = 8 + 22 * k | 0;  g = 32 + 68 * k | 0; b = 5 + 10 * k | 0; }
  else if (v < 0.58) { const k = (v - 0.32) / 0.26;  r = 30 + 55 * k | 0; g = 100 + 110 * k | 0; b = 15 + 18 * k | 0; }
  else if (v < 0.80) { const k = (v - 0.58) / 0.22;  r = 85 + 100 * k | 0;g = 210 + 35 * k | 0; b = 33 + 55 * k | 0; }
  else               { const k = (v - 0.80) / 0.20;  r = 185 + 60 * k | 0;g = 245 + 10 * k | 0; b = 88 + 120 * k | 0; }
  return [r, g, b, 155];
}

export function txLightning(wx: number, wy: number, t: number): RGBA {
  const s = 0.65;
  const d1x = txFBM(wx * s, wy * s, 4) * 2.4 - 1.2;
  const d1y = txFBM(wx * s + 4.3, wy * s + 1.9, 4) * 2.4 - 1.2;
  const d2x = txFBM(wx * s + d1x * 0.5, wy * s + d1y * 0.5, 3) * 1.6 - 0.8;
  const d2y = txFBM(wx * s + d1x * 0.5 + 2, wy * s + d1y * 0.5, 3) * 1.6 - 0.8;
  const bx = wx + d1x * 1.0 + d2x * 0.5, by = wy + d1y * 1.0 + d2y * 0.5;
  const ridge = txRidgedFBM(bx * 1.3, by * 1.3, 5);
  const bolt  = Math.pow(Math.max(0, ridge - 0.60) / 0.40, 4);
  const glow  = Math.pow(Math.max(0, ridge - 0.38) / 0.62, 2) * 0.35;
  const ph = ridge * 32 + txFBM(wx * 0.35, wy * 0.35, 3) * 18;
  const fl  = Math.pow(Math.max(0, Math.sin(t * 10 + ph)), 3);
  const fl2 = Math.pow(Math.max(0, Math.sin(t * 4 + ph * 0.6)), 2) * 0.5 + 0.5;
  const v = bolt * fl + glow * fl2;
  if (v < 0.018) return [3, 3, 8, 40];
  const k = Math.min(1, v);
  let r, g2, b, a;
  if      (k < 0.18) { const t2 = k / 0.18;          r = 35 + 105 * t2 | 0; g2 = 30 + 115 * t2 | 0; b = 3 + 8 * t2 | 0;   a = 90 + 115 * t2 | 0; }
  else if (k < 0.48) { const t2 = (k - 0.18) / 0.3;  r = 140 + 100 * t2 | 0; g2 = 145 + 100 * t2 | 0; b = 11 + 44 * t2 | 0; a = 205 + 30 * t2 | 0; }
  else if (k < 0.78) { const t2 = (k - 0.48) / 0.3;  r = 240 + 15 * t2 | 0; g2 = 245 + 10 * t2 | 0; b = 55 + 85 * t2 | 0; a = 235 + 15 * t2 | 0; }
  else               { r = 255; g2 = 255; b = 140; a = 255; }
  return [r, g2, b, a];
}

export function txMagic(wx: number, wy: number, t: number, cx: number, cy: number): RGBA {
  const rx = wx - cx, ry = wy - cy, dist = Math.sqrt(rx * rx + ry * ry);
  const ang = Math.atan2(ry, rx) + dist * 0.55 + t * 0.45;
  const swx = Math.cos(ang) * dist + cx, swy = Math.sin(ang) * dist + cy;
  const vortex = txFBMD(swx * 0.82, swy * 0.82);
  const runePh = txFBM(wx * 2.2, wy * 2.2, 4) * Math.PI * 6;
  const rune   = Math.abs(Math.sin(runePh + t * 1.6));
  const { f1 } = txWorley(wx * 2, wy * 2, t * 0.35);
  const sparkle = Math.pow(Math.max(0, 1 - f1 * 4.5), 9) * (0.5 + 0.5 * Math.sin(f1 * 95 + t * 5.5));
  const nebPh  = txFBM(wx * 1.4, wy * 1.4, 4) * Math.PI * 4;
  const nebula = 0.5 + 0.5 * Math.sin(nebPh + t * 1.0);
  const v = Math.min(1, Math.max(0, vortex * 0.38 + rune * 0.24 + sparkle * 0.65 + nebula * 0.22));
  let r, g, b;
  if      (v < 0.14) { const k = v / 0.14;           r = 5 + 15 * k | 0;  g = 5 * k | 0;     b = 12 + 35 * k | 0; }
  else if (v < 0.38) { const k = (v - 0.14) / 0.24;  r = 20 + 65 * k | 0; g = 5 + 15 * k | 0; b = 47 + 95 * k | 0; }
  else if (v < 0.62) { const k = (v - 0.38) / 0.24;  r = 85 + 110 * k | 0;g = 20 + 38 * k | 0;b = 142 + 78 * k | 0; }
  else if (v < 0.82) { const k = (v - 0.62) / 0.2;   r = 195 + 60 * k | 0;g = 58 + 100 * k | 0;b = 220 + 30 * k | 0; }
  else               { r = 255; g = 158; b = 250; }
  return [r, g, b, 148];
}

export type PixelFn = (wx: number, wy: number, t: number, cx?: number, cy?: number) => [number, number, number, number];

export const TX_FN: Record<string, PixelFn> = {
  fire:      txFire,
  ice:       txIce,
  water:     txWater,
  poison:    txPoison,
  lightning: txLightning,
  magic:     txMagic as PixelFn,
};
