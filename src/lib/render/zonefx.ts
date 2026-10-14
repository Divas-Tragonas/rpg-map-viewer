// Zones màgiques a la pantalla dels jugadors (foc, gel, aigua, verí, llamps, màgia).
//
// UN SOL PIPELINE per als sis elements (és el que els dona cohesió):
//  1. Vora: camp de distàncies amb signe (EDT de Felzenszwalb–Huttenlocher) → `maskA`, una
//     rampa suau centrada sobre el contorn amb una irregularitat quieta. Res de vora
//     lluminosa, contorns ni partícules a la vora: era el que feia que es notés tallada.
//  2. Interior: `inner` (0 a la vora .. 1 a dins), la màscara difuminada i normalitzada; no
//     fa plecs a l'eix mitjà i s'adapta a les zones petites.
//  3. Camp de color de l'element (`textures/fields.ts`) avaluat texel a texel a `D` texels
//     per casella (baixa resolució = suau) i ampliat amb un sol `drawImage` suavitzat.
//  4. Només el llamp hi afegeix accents (arcs curts), esvaïts amb `inner`.
//
// Calcular el camp a cada fotograma costava 6–40 ms per zona. Ara se'n calculen FOTOGRAMES
// CLAU cada `period` segons de camp, repartits entre fotogrames (pressupost `BUDGET_MS`
// compartit per totes les zones), i entre dos claus es fon amb 'lighter' a pesos (1−f) i f
// (interpolació exacta, sense batec d'opacitat). Si el pressupost no arriba, l'animació
// només va més lenta: mai no salta ni bloqueja el fotograma.
//
// El camp es mesura des de la cantonada de la zona (+ un desplaçament per llavor): arrossegar
// una zona la trasllada sense refer res, i dues zones iguals no es veuen iguals.
//
// ⚠️ Res de `ctx.filter` ni de `shadowBlur` per a la vora: la pantalla de jugador sovint és un
// iPad (Safari no suporta `filter` i comprimeix el `shadowBlur` gran).

import type { PaintedZone } from '@/types';
import { fbm2 } from '@/lib/textures/noise';
import { FIELDS, TSCALE, type ElementField, type Texel } from '@/lib/textures/fields';

type G = CanvasRenderingContext2D;

/** Casella quan no hi ha graella: fixa, perquè la textura no «nedi» amb el zoom. */
const NO_GRID_CELL = 70;
const EDGE_H = 0.5;        // semiamplada de la rampa de la vora (caselles)
const EROSION = 0.18;      // irregularitat de la vora (caselles)
const PAD = 1.2;           // marge al voltant del bbox (caselles): hi cap la rampa i l'erosió
const D_MAX = 10;          // texels per casella
const D_MIN = 4;
const MAX_TEX = 9000;      // texels de l'interior com a màxim: les zones grans baixen de `D`
const BUDGET_MS = 3;       // temps de càlcul de fotogrames clau per fotograma, entre totes les zones
const EVICT_S = 10;        // estats de zones que fa tant que no es dibuixen (esborrades, arrossegades)

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a: number, b: number, v: number) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// ── Geometria: EDT, vora i interior ──────────────────────────────────────────

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

/** Distància euclidiana (texels) de cada texel al texel `feat` més proper. */
function edt2d(feat: Uint8Array, w: number, h: number): Float64Array {
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = feat[i] ? 0 : 1e20;
  const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
  }
  return g;
}

/** Tres passades de mitjana mòbil (≈ gaussiana) de radi `r`. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(src);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0, cnt = 0;
      for (let x = -r; x < w + r; x++) {
        if (x + r < w) { acc += out[y * w + x + r]; cnt++; }
        if (x - r - 1 >= 0) { acc -= out[y * w + x - r - 1]; cnt--; }
        if (x >= 0 && x < w) tmp[y * w + x] = acc / Math.max(1, cnt);
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0, cnt = 0;
      for (let y = -r; y < h + r; y++) {
        if (y + r < h) { acc += tmp[(y + r) * w + x]; cnt++; }
        if (y - r - 1 >= 0) { acc -= tmp[(y - r - 1) * w + x]; cnt--; }
        if (y >= 0 && y < h) out[y * w + x] = acc / Math.max(1, cnt);
      }
    }
  }
  return out;
}

interface Geo {
  cell: number; D: number; cpx: number;     // casella (px de mapa), texels per casella, px de mapa per texel
  pad: number;                              // marge en px de mapa (el texel 0 és a bbox.left − pad)
  tw: number; th: number;
  maskA: Float32Array;                      // cobertura (0..1): la vora suau
  inner: Float32Array;                      // interior (0 a la vora .. 1 a dins)
  rowLo: Int32Array; rowHi: Int32Array;     // texels amb cobertura de cada fila
  area: number;                             // caselles
  seed: number;
  fx: number; fy: number;                   // desplaçament del camp per llavor (caselles)
  samples: number[];                        // punts de l'interior [x0, y0, x1, y1…] (texels)
}

function buildGeo(zone: PaintedZone, cell: number): Geo | null {
  const { left, top, w, h } = zone.bbox;
  if (zone.points.length < 3 || w <= 0 || h <= 0) return null;
  const areaCells = (w * h) / (cell * cell);
  const D = Math.max(D_MIN, Math.min(D_MAX, Math.floor(Math.sqrt(MAX_TEX / Math.max(areaCells * 0.8, 1e-6)))));
  const cpx = cell / D, pad = PAD * cell;
  const tw = Math.ceil((w + 2 * pad) / cpx), th = Math.ceil((h + 2 * pad) / cpx), n = tw * th;

  // Polígon rasteritzat a la resolució dels texels.
  const cv = makeCanvas(tw, th);
  const g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.setTransform(1 / cpx, 0, 0, 1 / cpx, (pad - left) / cpx, (pad - top) / cpx);
  g.beginPath();
  zone.points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath(); g.fill();
  const px = g.getImageData(0, 0, tw, th).data;
  const inside = new Uint8Array(n), outside = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++) { const k = px[i * 4 + 3] >= 128 ? 1 : 0; inside[i] = k; outside[i] = 1 - k; if (k) any = true; }
  if (!any) return null;

  // Distància amb signe (caselles): positiva a dins.
  const dIn = edt2d(outside, tw, th), dOut = edt2d(inside, tw, th);
  const sd = new Float32Array(n); let inr = 0;
  for (let i = 0; i < n; i++) { sd[i] = (inside[i] ? dIn[i] - 0.5 : -(dOut[i] - 0.5)) / D; if (sd[i] > inr) inr = sd[i]; }

  const seed = hashStr(zone.id) % 9973;
  const fx = (seed % 101) * 1.37, fy = ((seed * 7) % 103) * 1.13;

  // Vora: rampa centrada al contorn, més estreta a les zones petites, amb erosió quieta.
  const hh = Math.min(EDGE_H, 0.4 * inr), band = hh + EROSION * 1.2;
  const maskA = new Float32Array(n);
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) {
      const k = j * tw + i, s = sd[k];
      if (s > band) { maskA[k] = 1; continue; }
      if (s < -band) continue;
      const cx = (i + 0.5) / D - PAD + fx, cy = (j + 0.5) / D - PAD + fy;
      maskA[k] = sstep(-hh, hh, s + EROSION * fbm2(cx * 0.8, cy * 0.8, 3, seed + 991));
    }
  }

  // Interior: màscara difuminada i normalitzada (satura al nucli, sense plecs).
  const r = Math.max(2, Math.min(Math.round(1.1 * D), Math.round(0.45 * inr * D)));
  const bl = boxBlur(maskA, tw, th, r);
  let mx = 0; for (let i = 0; i < n; i++) if (bl[i] > mx) mx = bl[i];
  const inner = new Float32Array(n);
  for (let i = 0; i < n; i++) inner[i] = sstep(0.15, 0.95, mx ? bl[i] / mx : 0);

  const rowLo = new Int32Array(th).fill(1), rowHi = new Int32Array(th);
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) if (maskA[j * tw + i] > 0.002) { if (rowLo[j] > rowHi[j]) rowLo[j] = i; rowHi[j] = i; }
  }

  const samples: number[] = [];
  let s = seed;
  for (let k = 0; k < 4000 && samples.length < 400; k++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const i = s % tw;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % th;
    if (inner[j * tw + i] > 0.6) samples.push(i + 0.5, j + 0.5);
  }

  return { cell, D, cpx, pad, tw, th, maskA, inner, rowLo, rowHi, area: areaCells * 0.8, seed, fx, fy, samples };
}

// ── Estat de cada zona: fotogrames clau ──────────────────────────────────────

interface FxState {
  sig: string;
  geo: Geo;
  field: ElementField;
  lightning: boolean;
  st: Float32Array; stRow: Uint8Array;     // termes quiets del camp, calculats fila a fila
  img: ImageData;                           // fotograma clau en curs (fora de la màscara queda a 0)
  job: number; jobT: number;                // fila següent i temps de camp del fotograma en curs (−1 = cap)
  a: HTMLCanvasElement | null; aT: number;  // fotograma clau de sortida
  b: HTMLCanvasElement | null; bT: number;  // fotograma clau d'arribada
  next: HTMLCanvasElement | null; nextT: number;
  spare: HTMLCanvasElement[];
  p: number;                                // fosa de `a` a `b` (0..1)
  lastT: number; used: number;
  work: HTMLCanvasElement | null;           // llenç de la fosa
  acc: HTMLCanvasElement | null; accF: number;  // arcs del llamp (px per texel)
  accRect: ArcsRect | null;                 // el que s'hi va pintar el fotograma anterior
  innerCv: HTMLCanvasElement | null;        // `inner` com a alfa, per esvair els arcs
}

const _states = new Map<string, FxState>();
const _byZone = new WeakMap<PaintedZone, FxState>();
let _sweepAt = 0;

function signature(zone: PaintedZone, cell: number): string {
  const { left, top } = zone.bbox;
  let h = 2166136261 >>> 0;
  for (const p of zone.points) {
    h ^= Math.round((p.x - left) * 2); h = Math.imul(h, 16777619);
    h ^= Math.round((p.y - top) * 2); h = Math.imul(h, 16777619);
  }
  return `${zone.element}|${cell}|${zone.points.length}|${h >>> 0}`;
}

function createState(zone: PaintedZone, cell: number, sig: string, t: number): FxState | null {
  const field = FIELDS[zone.element];
  if (!field) return null;
  const geo = buildGeo(zone, cell);
  if (!geo) return null;
  return {
    sig, geo, field, lightning: zone.element === 'lightning',
    st: new Float32Array(geo.tw * geo.th * field.nStatic), stRow: new Uint8Array(geo.th),
    img: new ImageData(geo.tw, geo.th), job: 0, jobT: 10 + (geo.seed % 97) * 0.37,
    a: null, aT: 0, b: null, bT: 0, next: null, nextT: 0, spare: [],
    p: 0, lastT: t, used: t, work: null, acc: null, accF: 1, accRect: null, innerCv: null,
  };
}

function stateFor(zone: PaintedZone, cell: number, t: number): FxState | null {
  let s = _byZone.get(zone);
  if (!s || s.geo.cell !== cell) {
    const sig = signature(zone, cell);
    s = _states.get(zone.id);
    if (!s || s.sig !== sig) {
      const made = createState(zone, cell, sig, t);
      if (!made) return null;
      s = made;
    }
    _byZone.set(zone, s);
  }
  if (_states.get(zone.id) !== s) _states.set(zone.id, s);
  s.used = t;
  if (t > _sweepAt) {
    _sweepAt = t + 2;
    for (const [id, st] of _states) if (t - st.used > EVICT_S) _states.delete(id);
  }
  return s;
}

// Pressupost compartit: cada fotograma (mateix `t` per a totes les zones) es reparteix entre
// les zones que tenen feina (comptades el fotograma anterior: l'ordre de la llista no hi
// compta); una zona que encara no té cap fotograma clau pot fer servir tot el que queda.
let _frameT = NaN, _spent = 0, _busy = 0, _busyPrev = 1;

const TX: Texel = { px: 0, py: 0, wx: 0, wy: 0, inner: 0, seed: 0 };
const OUT = new Float32Array(4);

function shadeRow(s: FxState, j: number) {
  const { geo, field, st, img } = s;
  const { tw, D, cell, maskA, inner } = geo;
  const d = img.data, nSt = field.nStatic, prep = !s.stRow[j] && field.prep;
  TX.seed = geo.seed;
  TX.py = (j + 0.5) / D - PAD + geo.fy;
  TX.wy = TX.py * cell / TSCALE;
  for (let i = geo.rowLo[j]; i <= geo.rowHi[j]; i++) {
    const k = j * tw + i, m = maskA[k];
    if (m <= 0.002) continue;
    TX.px = (i + 0.5) / D - PAD + geo.fx;
    TX.wx = TX.px * cell / TSCALE;
    TX.inner = inner[k];
    if (prep) prep(TX, st, k * nSt);
    field.shade(TX, s.jobT, st, k * nSt, OUT);
    const o = k * 4;
    d[o] = OUT[0]; d[o + 1] = OUT[1]; d[o + 2] = OUT[2];
    d[o + 3] = 255 * clamp01(OUT[3]) * m;
  }
  s.stRow[j] = 1;
}

/** Avança el fotograma clau en curs; quan s'acaba, el posa on toca. */
function work(s: FxState, allowMs: number) {
  const t0 = performance.now();
  do {
    shadeRow(s, s.job++);
    if (s.job >= s.geo.th) {
      const c = s.spare.pop() ?? makeCanvas(s.geo.tw, s.geo.th);
      c.getContext('2d')?.putImageData(s.img, 0, 0);
      if (!s.a) { s.a = c; s.aT = s.jobT; }
      else if (!s.b) { s.b = c; s.bT = s.jobT; s.p = 0; }
      else { s.next = c; s.nextT = s.jobT; }
      s.job = -1;
      break;
    }
  } while (performance.now() - t0 < allowMs);
  _spent += performance.now() - t0;
}

function step(s: FxState, t: number) {
  const K = s.field.period;
  const dt = Math.min(0.25, Math.max(0, t - s.lastT));
  s.lastT = t;
  if (s.a && s.b) {
    s.p += dt / K;
    if (s.p >= 1) {
      if (s.next) {
        s.spare.push(s.a);
        s.a = s.b; s.aT = s.bT; s.b = s.next; s.bT = s.nextT; s.next = null;
        s.p = Math.min(s.p - 1, 0.999);
      } else s.p = 1;                 // el següent encara no és a punt: espera (va més lent, no salta)
    }
  }
  if (s.job < 0 && s.a && K !== Infinity) {
    if (!s.b) { s.job = 0; s.jobT = s.aT + K; }
    else if (!s.next) { s.job = 0; s.jobT = s.bT + K; }
  }
  if (s.job >= 0) {
    const left = Math.max(0, BUDGET_MS - _spent);
    const allow = s.a ? left / Math.max(1, _busyPrev - _busy) : left;
    _busy++;
    work(s, allow);
  }
}

/** El fotograma a pintar: `a`, o la fosa exacta de `a` i `b`. */
function composite(s: FxState): HTMLCanvasElement | null {
  if (!s.a) return null;
  if (!s.b || s.p <= 0.002) return s.a;
  if (s.p >= 0.998) return s.b;
  const w = s.work ??= makeCanvas(s.geo.tw, s.geo.th);
  const g = w.getContext('2d');
  if (!g) return s.a;
  g.clearRect(0, 0, w.width, w.height);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 1 - s.p; g.drawImage(s.a, 0, 0);
  g.globalAlpha = s.p; g.drawImage(s.b, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return w;
}

// ── Llamps: arcs curts que espurnegen ────────────────────────────────────────
// Cada arc viu ~0,3 s i canvia de forma 12 cops per segon, amb un halo ample i un nucli
// gruixut: és el llamp de la v4.35 sense les línies blanques d'1 px que el feien massa nítid.

const ACC_PX_PER_CELL = 30;
const ACC_MAX = 1200;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

type P2 = [number, number];

function bolt(A: P2, B: P2, r: () => number, levels: number): P2[] {
  let pts: P2[] = [A, B], amp = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.22;
  for (let l = 0; l < levels; l++) {
    const n: P2[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, off = (r() - 0.5) * 2 * amp;
      n.push([(p[0] + q[0]) / 2 - dy / L * off, (p[1] + q[1]) / 2 + dx / L * off], q);
    }
    pts = n; amp *= 0.55;
  }
  return pts;
}

function arcStroke(g: G, pts: P2[], w: number, I: number) {
  const line = (lw: number, col: string, a: number) => {
    g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = lw;
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  };
  line(3.0 * w, '110,140,255', 0.24 * I);
  line(1.5 * w, '165,190,255', 0.5 * I);
  line(0.8 * w, '222,232,255', 0.85 * I);
}

/** Rectangle del llenç dels arcs que s'ha pintat aquest fotograma (px del llenç). */
interface ArcsRect { x: number; y: number; w: number; h: number }

/**
 * Pinta els arcs vius al seu llenç i retorna el rectangle que ocupen. Només es toca aquest
 * rectangle (esborrar, esvair amb `inner` i copiar al mapa): fer-ho al llenç sencer costava
 * 1–3 ms per fotograma a les zones grans.
 */
function drawArcs(s: FxState, t: number): ArcsRect | null {
  const { geo } = s;
  const { tw, th, D, samples } = geo;
  if (samples.length < 2) return null;
  const nS = samples.length / 2, wk = D / 10;           // gruixos pensats per a D = 10
  const n = Math.max(3, Math.min(12, Math.round(geo.area * 0.35)));
  const fr = Math.floor(t * 12);
  const arcs: { pts: P2[]; w: number; I: number }[] = [];
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let j = 0; j < n; j++) {
    const per = 0.8 + 0.9 * ((j * 0.618 + (geo.seed % 13) * 0.1) % 1);
    const c = t / per + ((j * 0.37) % 1), cyc = Math.floor(c), a = c - cyc;
    if (a > 0.35) continue;
    const r = rng(geo.seed * 7919 + j * 131 + cyc * 977);
    const si = Math.floor(r() * nS) * 2;
    const A: P2 = [samples[si], samples[si + 1]];
    const ang = r() * Math.PI * 2, len = (1.2 + r() * 1.8) * D;
    const B: P2 = [A[0] + Math.cos(ang) * len, A[1] + Math.sin(ang) * len];
    const jr = rng(geo.seed * 31 + j * 17 + fr * 101);
    const main = bolt(A, B, jr, 4), m = main[4 + Math.floor(jr() * 8)], bang = ang + (jr() < 0.5 ? 0.9 : -0.9);
    const br = bolt(m, [m[0] + Math.cos(bang) * len * 0.35, m[1] + Math.sin(bang) * len * 0.35], jr, 3);
    const I = (1 - a / 0.35) * (0.75 + 0.25 * jr());
    arcs.push({ pts: main, w: wk, I }, { pts: br, w: 0.65 * wk, I });
    for (const p of main.concat(br)) {
      if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0];
      if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
    }
  }
  if (!arcs.length) return null;

  if (!s.acc) {
    s.accF = Math.min(ACC_PX_PER_CELL / D, ACC_MAX / tw, ACC_MAX / th);
    s.acc = makeCanvas(Math.ceil(tw * s.accF), Math.ceil(th * s.accF));
  }
  const g = s.acc.getContext('2d');
  if (!g) return null;
  const f = s.accF, cw = s.acc.width, ch = s.acc.height, mg = 1.5 * wk + 1;
  const x = Math.max(0, Math.floor((bx0 - mg) * f)), y = Math.max(0, Math.floor((by0 - mg) * f));
  const rect: ArcsRect = { x, y, w: Math.min(cw, Math.ceil((bx1 + mg) * f)) - x, h: Math.min(ch, Math.ceil((by1 + mg) * f)) - y };
  if (rect.w <= 0 || rect.h <= 0) return null;

  g.setTransform(1, 0, 0, 1, 0, 0);
  const prev = s.accRect;
  if (prev) g.clearRect(prev.x, prev.y, prev.w, prev.h);
  g.clearRect(rect.x, rect.y, rect.w, rect.h);
  s.accRect = rect;
  g.setTransform(f, 0, 0, f, 0, 0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const a of arcs) arcStroke(g, a.pts, a.w, a.I);

  // Esvaïts cap a la vora amb `inner`, com tot el que és a l'interior.
  if (!s.innerCv) {
    const mk = new ImageData(tw, th);
    for (let i = 0; i < tw * th; i++) { mk.data[i * 4] = mk.data[i * 4 + 1] = mk.data[i * 4 + 2] = 255; mk.data[i * 4 + 3] = 255 * geo.inner[i]; }
    s.innerCv = makeCanvas(tw, th);
    s.innerCv.getContext('2d')?.putImageData(mk, 0, 0);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(s.innerCv, rect.x / f, rect.y / f, rect.w / f, rect.h / f, rect.x, rect.y, rect.w, rect.h);
  g.globalCompositeOperation = 'source-over';
  return rect;
}

// ── Entrada ──────────────────────────────────────────────────────────────────

/**
 * Pinta una zona màgica (pantalla de jugador). `ctx` ha d'estar en coords de mapa; `t` en
 * segons (el mateix per a totes les zones d'un fotograma: marca on comença el pressupost);
 * `alpha` per a l'aparició. Les zones fora de pantalla ni es calculen ni es pinten.
 */
export function drawZoneFx(ctx: G, zone: PaintedZone, t: number, gridSize: number, alpha = 1): void {
  if (t !== _frameT) { _frameT = t; _busyPrev = Math.max(1, _busy); _busy = 0; _spent = 0; }
  const cell = gridSize > 0 ? gridSize : NO_GRID_CELL;

  const pad = PAD * cell, { left, top, right, bottom } = zone.bbox;
  const m = ctx.getTransform(), cw = ctx.canvas.width, ch = ctx.canvas.height;
  const sx0 = m.a * (left - pad) + m.e, sx1 = m.a * (right + pad) + m.e;
  const sy0 = m.d * (top - pad) + m.f, sy1 = m.d * (bottom + pad) + m.f;
  if (Math.max(sx0, sx1) < 0 || Math.min(sx0, sx1) > cw || Math.max(sy0, sy1) < 0 || Math.min(sy0, sy1) > ch) return;

  const s = stateFor(zone, cell, t);
  if (!s) return;
  step(s, t);
  const img = composite(s);
  if (!img || alpha <= 0.003) return;

  const { geo } = s;
  const x0 = left - geo.pad, y0 = top - geo.pad, W = geo.tw * geo.cpx, H = geo.th * geo.cpx;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';   // bilineal: 'high' costa el doble i no es nota
  ctx.drawImage(img, x0, y0, W, H);
  if (s.lightning) {
    const r = drawArcs(s, t + (geo.seed % 97) / 13);
    if (r && s.acc) {
      const k = geo.cpx / s.accF;               // px de mapa per px del llenç dels arcs
      ctx.drawImage(s.acc, r.x, r.y, r.w, r.h, x0 + r.x * k, y0 + r.y * k, r.w * k, r.h * k);
    }
  }
  ctx.restore();
}
