// Camp de color de cada element de les zones màgiques: (texel, temps) → [r, g, b, alfa 0..1].
//
// Són els camps de la v4.33 («el terra semblava que cremés»), amb el que l'usuari no volia tret:
//  - foc: `txFire` tal qual (el blau de la cua de la rampa, retallat);
//  - gel: el de sempre, quiet, sense el centelleig ni els filaments solts, amb gebre a la vora;
//  - aigua: el camp antic més lent i amb la llum esmorteïda, més fonda cap al mig;
//  - verí: el de sempre;
//  - màgia: els mateixos termes sense el remolí al voltant del centre (res d'espirals);
//  - llamps: núvol de tempesta suau amb venes amples (els arcs els pinta `render/zonefx.ts`).
//
// `wx, wy` són les unitats antigues (px de mapa / 90); `px, py`, caselles. Els termes que no
// depenen del temps es calculen un sol cop per texel (`prep` → `st`): a l'aigua són gairebé tot.

import {
  txFBM, txFBMD, txFBM3D, txRidgedFBM, txWorley, fbm2, fbm3,
} from './noise';

/** Unitats del soroll antic: px de mapa per unitat (la v4.33 escalava el mapa així). */
export const TSCALE = 90;

export interface Texel {
  px: number; py: number;   // caselles (relatives a la zona + desplaçament per llavor)
  wx: number; wy: number;   // unitats antigues
  inner: number;            // 0 a la vora .. 1 a l'interior (vora suau de la zona)
  seed: number;
}

export interface ElementField {
  /** Segons de camp entre fotogrames clau; `Infinity` = quiet (un sol fotograma). */
  period: number;
  /** Valors per texel que no depenen del temps. */
  nStatic: number;
  prep?(x: Texel, st: Float32Array, o: number): void;
  /** Escriu [r, g, b, alfa 0..1] a `out`. */
  shade(x: Texel, t: number, st: Float32Array, o: number, out: Float32Array): void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a: number, b: number, v: number) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };

function put(out: Float32Array, r: number, g: number, b: number, a: number) {
  out[0] = r; out[1] = g; out[2] = b; out[3] = a;
}
/** Barreja `out` (rgb) cap a un color. */
function mixTo(out: Float32Array, r: number, g: number, b: number, k: number) {
  out[0] += (r - out[0]) * k; out[1] += (g - out[1]) * k; out[2] += (b - out[2]) * k;
}

// ── Foc: `txFire` de la v4.33 ────────────────────────────────────────────────

const fire: ElementField = {
  period: 0.15, nStatic: 0,
  shade({ wx, wy }, t, _st, _o, out) {
    const base = txFBM3D(wx * 2, wy * 2, t * 0.28, 4);
    const detail = txFBM3D(wx * 3.8, wy * 3.8, t * 0.42, 3);
    const core = txFBM3D((wx + base * 0.6) * 1.6, (wy + detail * 0.4) * 1.6, t * 0.32, 3);
    const raw = base * 0.45 + core * 0.38 + detail * 0.17;
    const v = clamp01(Math.pow(Math.max(0, raw * 1.7 - 0.18), 1.5));
    let r, g, b;
    if      (v < 0.08) { const k = v / 0.08;          r = 3 + 10 * k;   g = 1 + 3 * k;    b = 0; }
    else if (v < 0.28) { const k = (v - 0.08) / 0.2;  r = 13 + 202 * k; g = 4 + 22 * k;   b = 0; }
    else if (v < 0.55) { const k = (v - 0.28) / 0.27; r = 215 + 40 * k; g = 26 + 148 * k; b = 0; }
    else if (v < 0.78) { const k = (v - 0.55) / 0.23; r = 255;          g = 174 + 72 * k; b = 14 * k; }
    else               { const k = (v - 0.78) / 0.22; r = 255;          g = 246 + 9 * k;  b = 14 + 232 * k; }
    put(out, r, g, Math.min(b, 110), 152 / 255);
  },
};

// ── Gel: facetes de Worley quietes + gebre que entra per la vora ─────────────

function rampIce(v: number, out: Float32Array) {
  if      (v < 0.22) { const q = v / 0.22;          put(out, 10 + 20 * q, 42 + 34 * q, 78 + 46 * q, 0); }
  else if (v < 0.50) { const q = (v - 0.22) / 0.28; put(out, 30 + 52 * q, 76 + 74 * q, 124 + 74 * q, 0); }
  else if (v < 0.76) { const q = (v - 0.50) / 0.26; put(out, 82 + 88 * q, 150 + 68 * q, 198 + 44 * q, 0); }
  else               { const q = (v - 0.76) / 0.24; put(out, 170 + 85 * q, 218 + 37 * q, 242 + 13 * q, 0); }
}

const ice: ElementField = {
  period: Infinity, nStatic: 0,
  shade({ wx, wy, px, py, inner, seed }, _t, _st, _o, out) {
    const { f1, e } = txWorley(wx * 1.4, wy * 1.4, 0);
    const facet = Math.min(1, f1 * 1.5);
    const crack = Math.pow(Math.max(0, 1 - e * 5), 3) * 0.25;   // esquerdes fluixes: abans dibuixaven rajoles
    const depth = txFBM(wx * 0.6, wy * 0.6, 3);
    rampIce(clamp01(0.30 + facet * 0.28 - depth * 0.30 + crack * 0.55), out);
    mixTo(out, 235, 246, 252, 0.2);                              // més blanc, perquè no es confongui amb l'aigua
    const milky = sstep(0.05, 0.5, fbm2(px * 0.45, py * 0.45, 3, seed + 11));
    const ridge = 1 - Math.abs(fbm2(px * 1.6, py * 1.6, 3, seed + 23));
    const frost = (1 - inner) * (0.55 + 0.45 * ridge);
    mixTo(out, 228, 242, 252, 0.35 * milky + 0.4 * frost);
    out[3] = 158 / 255;
  },
};

// ── Aigua: el camp antic, més lent, amb la llum esmorteïda i més fonda al mig ─

const water: ElementField = {
  period: 0.25, nStatic: 4,
  prep({ wx, wy }, st, o) {
    for (let i = 0; i < 3; i++) {
      const f = 1.2 + i * 0.15;
      st[o + i] = txFBM(wx * f + i * 5.1, wy * f + i * 3.7, 3) * Math.PI * 6;
    }
    st[o + 3] = txFBMD(wx * 0.8, wy * 0.8);
  },
  shade({ wx, wy, inner }, t, st, o, out) {
    const T = t * 0.6;
    let caustic = 0;
    for (let i = 0; i < 3; i++) caustic += Math.sin(st[o + i] + T * (1.1 + i * 0.15)) * 0.5 + 0.5;
    caustic = Math.pow(caustic / 3, 2.5);
    const ripple = txFBM(wx * 1.4 + T * 0.15, wy * 1.4 + T * 0.10, 3);
    const v = clamp01(caustic * 0.65 + st[o + 3] * 0.20 + ripple * 0.20);
    if      (v < 0.18) { const k = v / 0.18;          put(out, 2 + 8 * k, 18 + 40 * k, 55 + 80 * k, 0); }
    else if (v < 0.52) { const k = (v - 0.18) / 0.34; put(out, 10 + 35 * k, 58 + 110 * k, 135 + 75 * k, 0); }
    else if (v < 0.80) { const k = (v - 0.52) / 0.28; put(out, 45 + 155 * k, 168 + 72 * k, 210 + 35 * k, 0); }
    else               { const k = (v - 0.80) / 0.20; put(out, 200 + 55 * k, 240 + 15 * k, 245 + 10 * k, 0); }
    mixTo(out, 40, 96, 150, 0.35);
    mixTo(out, 16, 50, 98, 0.4 * inner);
    out[3] = (148 / 255) * (0.9 + 0.1 * inner);
  },
};

// ── Verí: el de la v4.33 ─────────────────────────────────────────────────────

const poison: ElementField = {
  period: 0.3, nStatic: 1,
  prep({ wx, wy }, st, o) {
    const dx = txFBM(wx * 1.1, wy * 1.1, 3) * 0.9 - 0.45;
    const dy = txFBM(wx * 1.1 + 3.3, wy * 1.1 + 2.0, 3) * 0.9 - 0.45;
    st[o] = txRidgedFBM(wx * 1.3 + dx, wy * 1.3 + dy, 4);
  },
  shade({ wx, wy }, t, st, o, out) {
    const sludge = txFBMD(wx * 0.9 + t * 0.06, wy * 0.9 + t * 0.045);
    const spots = txFBM(wx * 2.4 + t * 0.12, wy * 2.4 + t * 0.10, 3);
    const glow = Math.pow(Math.max(0, spots - 0.52) / 0.48, 2);
    const drip = txFBM(wx * 3.2 + t * 0.10, wy * 0.6, 2);
    const streak = Math.pow(Math.max(0, drip - 0.58) / 0.42, 3);
    const v = clamp01(sludge * 0.25 + st[o] * 0.45 + glow * 0.55 + streak * 0.35);
    if      (v < 0.10) { const k = v / 0.10;          put(out, 2 + 6 * k, 10 + 22 * k, 1 + 4 * k, 0); }
    else if (v < 0.32) { const k = (v - 0.10) / 0.22; put(out, 8 + 22 * k, 32 + 68 * k, 5 + 10 * k, 0); }
    else if (v < 0.58) { const k = (v - 0.32) / 0.26; put(out, 30 + 55 * k, 100 + 110 * k, 15 + 18 * k, 0); }
    else if (v < 0.80) { const k = (v - 0.58) / 0.22; put(out, 85 + 100 * k, 210 + 35 * k, 33 + 55 * k, 0); }
    else               { const k = (v - 0.80) / 0.20; put(out, 185 + 60 * k, 245 + 10 * k, 88 + 120 * k, 0); }
    out[3] = 155 / 255;
  },
};

// ── Màgia: els termes antics (nebulosa, runes, espurnes) sense el remolí del centre ─

const magic: ElementField = {
  period: 0.25, nStatic: 2,
  prep({ wx, wy }, st, o) {
    st[o] = txFBM(wx * 2.2, wy * 2.2, 4) * Math.PI * 6;
    st[o + 1] = txFBM(wx * 1.4, wy * 1.4, 4) * Math.PI * 4;
  },
  shade({ wx, wy, seed }, t, st, o, out) {
    // El fluid evoluciona on és (eix z del soroll), no gira al voltant de cap punt.
    const vortex = 0.5 + 0.5 * fbm3(wx * 0.82, wy * 0.82, t * 0.09, 4, seed + 2);
    const rune = Math.abs(Math.sin(st[o] + t * 0.7));
    const { f1 } = txWorley(wx * 2, wy * 2, t * 0.15);
    const sparkle = Math.pow(Math.max(0, 1 - f1 * 4.5), 9) * (0.5 + 0.5 * Math.sin(f1 * 95 + t * 2.2));
    const nebula = 0.5 + 0.5 * Math.sin(st[o + 1] + t * 0.45);
    const v = clamp01(vortex * 0.38 + rune * 0.24 + sparkle * 0.65 + nebula * 0.22);
    if      (v < 0.14) { const q = v / 0.14;          put(out, 5 + 15 * q, 5 * q, 12 + 35 * q, 0); }
    else if (v < 0.38) { const q = (v - 0.14) / 0.24; put(out, 20 + 65 * q, 5 + 15 * q, 47 + 95 * q, 0); }
    else if (v < 0.62) { const q = (v - 0.38) / 0.24; put(out, 85 + 110 * q, 20 + 38 * q, 142 + 78 * q, 0); }
    else if (v < 0.82) { const q = (v - 0.62) / 0.2;  put(out, 195 + 60 * q, 58 + 100 * q, 220 + 30 * q, 0); }
    else                                              put(out, 255, 158, 250, 0);
    out[3] = 148 / 255;
  },
};

// ── Llamps: núvol de tempesta fosc i suau + venes amples que parpellegen ─────
// Els arcs (el que es llegeix com a electricitat) els pinta `render/zonefx.ts` a sobre.

const lightning: ElementField = {
  period: 0.25, nStatic: 0,
  shade({ px, py, inner, seed }, t, _st, _o, out) {
    const x = px * 0.32, y = py * 0.32;
    const q = fbm3(x, y, t * 0.05, 2, seed + 3);
    const v = 0.5 + 0.5 * fbm3(x + 0.6 * q, y - 0.6 * q, t * 0.07, 3, seed + 4);
    const kk = Math.pow(clamp01(v), 1.5);
    put(out, 8 + 80 * kk, 10 + 94 * kk, 34 + 176 * kk, 0.42 + 0.26 * kk);
    const h = fbm3(px * 0.45 + 0.7 * q, py * 0.45 - 0.5 * q, t * 0.045, 3, seed + 7);
    const fil = Math.pow(clamp01(1 - Math.abs(Math.sin(h * Math.PI * 4)) * 1.8), 2);
    const patch = sstep(0.25, 0.7, 0.5 + 0.5 * fbm3(px * 0.22, py * 0.22, t * 0.06, 2, seed + 9));
    const fl = 0.75 + 0.25 * Math.sin(t * 2.6 + h * 9);
    const f = fil * patch * fl * inner;
    mixTo(out, 158, 186, 255, 0.8 * f);
    out[3] += 0.34 * f;
  },
};

export const FIELDS: Record<string, ElementField> = { fire, ice, water, poison, lightning, magic };
