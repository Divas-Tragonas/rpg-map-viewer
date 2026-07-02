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
  // Static crystal facets: Worley cells shaded by distance to their feature point
  // (t=0 so the ice doesn't crawl), bright fractures along the cell borders.
  const { f1, e } = txWorley(wx * 1.4, wy * 1.4, 0);
  const facet  = Math.min(1, f1 * 1.5);                       // radial shading inside each crystal
  const crack  = Math.pow(Math.max(0, 1 - e * 5), 3);         // fracture lines between crystals
  // Long hairline veins across facets
  const h    = txFBMD(wx * 1.3, wy * 1.3);
  const vein = Math.pow(Math.max(0, 1 - Math.abs(Math.sin(h * Math.PI * 4)) * 6), 4);
  // Depth banding — some regions read deeper/darker
  const depth = txFBM(wx * 0.6, wy * 0.6, 3);
  // Cold twinkle drifting across the surface
  const sparkPh = txFBM(wx * 6, wy * 6, 2) * Math.PI * 10;
  const spark = Math.pow(Math.max(0, Math.sin(sparkPh + t * 2.1)), 16);
  // Subtle shimmer so the whole sheet feels alive without melting the facets
  const shimmer = 0.92 + 0.08 * Math.sin(t * 1.3 + h * Math.PI * 2);

  const v = Math.min(1, Math.max(0, (0.30 + facet * 0.28 - depth * 0.30 + crack * 0.55 + vein * 0.45 + spark * 0.9) * shimmer));
  let r, g, b;
  if      (v < 0.22) { const k = v / 0.22;          r = 10 + 20 * k | 0;   g = 42 + 34 * k | 0;   b = 78 + 46 * k | 0; }   // deep glacial blue
  else if (v < 0.50) { const k = (v - 0.22) / 0.28; r = 30 + 52 * k | 0;   g = 76 + 74 * k | 0;   b = 124 + 74 * k | 0; }  // steel blue
  else if (v < 0.76) { const k = (v - 0.50) / 0.26; r = 82 + 88 * k | 0;   g = 150 + 68 * k | 0;  b = 198 + 44 * k | 0; }  // pale cyan
  else               { const k = (v - 0.76) / 0.24; r = 170 + 85 * k | 0;  g = 218 + 37 * k | 0;  b = 242 + 13 * k | 0; }  // fracture white
  return [r, g, b, 158];
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
  // Filaments = contour lines of a slowly drifting FBM field (`1-|sin(k·h)|` trick):
  // guaranteed thin, continuous arcs everywhere that crawl as the field drifts.
  const h  = txFBMD(wx * 0.85 + t * 0.11, wy * 0.85 - t * 0.08);
  const c1 = Math.abs(Math.sin(h * Math.PI * 6));
  const c2 = Math.abs(Math.sin(h * Math.PI * 6 + Math.PI * 0.5));
  const fil  = Math.pow(Math.max(0, 1 - c1 * 3.2), 3) + Math.pow(Math.max(0, 1 - c2 * 4.5), 4) * 0.6;
  const halo = Math.pow(Math.max(0, 1 - c1 * 1.15), 2);
  // Per-filament flicker + travelling pulse along the arcs
  const ph = h * 42;
  const fl = 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(t * 9 + ph)), 2);
  // Occasional area-wide strike flash lighting the whole region up
  const region = txFBM(wx * 0.22, wy * 0.22, 2);
  const strike = Math.pow(Math.max(0, Math.sin(t * 1.9 + region * Math.PI * 6)), 28);

  const v = Math.min(1, fil * fl + halo * 0.22 + strike * (0.25 + halo * 0.5));
  if (v < 0.02) {
    // Dark charged storm base — keeps the map readable underneath
    const base = 55 + strike * 130;
    return [10, 12, 28, base | 0];
  }
  const k = v;
  let r, g2, b, a;
  if      (k < 0.2)  { const t2 = k / 0.2;          r = 28 + 35 * t2 | 0;   g2 = 36 + 47 * t2 | 0;   b = 92 + 76 * t2 | 0;   a = 100 + 90 * t2 | 0; }  // deep blue glow
  else if (k < 0.5)  { const t2 = (k - 0.2) / 0.3;  r = 63 + 65 * t2 | 0;   g2 = 83 + 76 * t2 | 0;   b = 168 + 74 * t2 | 0;  a = 190 + 45 * t2 | 0; }  // electric blue
  else if (k < 0.8)  { const t2 = (k - 0.5) / 0.3;  r = 128 + 92 * t2 | 0;  g2 = 159 + 71 * t2 | 0;  b = 242 + 13 * t2 | 0;  a = 235 + 20 * t2 | 0; }  // blue-white
  else               { r = 235; g2 = 242; b = 255; a = 255; }                                                                 // white-hot core
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
