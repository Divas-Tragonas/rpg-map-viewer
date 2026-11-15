/**
 * Seguiment de figuretes físiques amb una càmera (fase 0: només detecció).
 *
 * Cada figureta porta la vora de la base pintada d'un color viu i mat. Amb un polaritzador
 * davant de la càmera, la pantalla LCD del tauler es veu gairebé negra i les bases hi
 * destaquen. Aquí es classifica cada píxel per to (HSV) i es busquen les taques connexes
 * de cada color; de cada color es queda la taca més grossa (una figureta per color).
 *
 * Tot és en coordenades de la imatge reduïda que es processa (`w × h`); `cx`/`cy` també es
 * donen normalitzats (0..1) perquè la UI els pinti sobre el vídeo a qualsevol mida.
 */

export interface ColorSlot {
  id: string;
  name: string;
  enabled: boolean;
  /** To central, en graus (0..360). */
  hue: number;
  /** Distància màxima de to acceptada, en graus. */
  hueTol: number;
  /** Saturació mínima (0..1). */
  satMin: number;
  /** Brillantor mínima (0..1). */
  valMin: number;
  /** Color de mostra (`#rrggbb`), per pintar-lo a la UI. */
  swatch: string;
}

export interface Blob {
  slot: number;
  area: number;
  /** Centre en píxels de la imatge processada. */
  x: number;
  y: number;
  /** Centre normalitzat (0..1). */
  cx: number;
  cy: number;
  minX: number; minY: number; maxX: number; maxY: number;
}

export interface DetectResult {
  /** La taca més grossa de cada color (`null` si no n'hi ha cap prou gran), en l'ordre dels slots. */
  best: (Blob | null)[];
  /** Quantes taques prou grosses de més hi ha de cada color (soroll o colors que es confonen). */
  extra: number[];
  /** Etiqueta de cada píxel: 0 = res, i + 1 = slot i. Per pintar la màscara. */
  labels: Uint8Array;
  w: number;
  h: number;
}

/** RGB 0..255 → [h 0..360, s 0..1, v 0..1]. */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max / 255];
}

export function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * La pell de les mans cau en tons vermells i taronges de saturació mitjana. Un color de base
 * en aquesta zona es confondrà amb els dits.
 */
export function looksLikeSkin(slot: Pick<ColorSlot, 'hue' | 'hueTol'>): boolean {
  return hueDist(slot.hue, 20) <= 16 + slot.hueTol / 2;
}

/** Mitjana d'un quadrat de `r` píxels al voltant de (x, y) en HSV (to amb mitjana circular). */
export function sampleHsv(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, r = 2): [number, number, number] {
  let sx = 0, sy = 0, ss = 0, sv = 0, n = 0;
  for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) {
    for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) {
      const k = (j * w + i) * 4;
      const [hh, s, v] = rgbToHsv(data[k], data[k + 1], data[k + 2]);
      const a = (hh * Math.PI) / 180;
      sx += Math.cos(a) * s; sy += Math.sin(a) * s;
      ss += s; sv += v; n++;
    }
  }
  if (n === 0) return [0, 0, 0];
  let hue = (Math.atan2(sy, sx) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return [hue, ss / n, sv / n];
}

/** Llindars raonables a partir d'una mostra feta clicant una base. */
export function slotFromSample(hsv: [number, number, number]): Pick<ColorSlot, 'hue' | 'hueTol' | 'satMin' | 'valMin'> {
  const [h, s, v] = hsv;
  return {
    hue: Math.round(h),
    hueTol: 14,
    satMin: round2(Math.max(0.2, s * 0.55)),
    valMin: round2(Math.max(0.12, v * 0.45)),
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

/** Reutilitza els buffers entre fotogrames (la mida canvia poc). */
let bufLabels = new Uint8Array(0);
let bufSeen = new Uint8Array(0);
let bufStack = new Int32Array(0);

/**
 * Classifica els píxels i troba les taques. `minArea` en píxels de la imatge processada.
 * Cost: un pas per píxel per classificar + un flood fill; a 480×270 són ~130k píxels.
 */
export function detect(data: Uint8ClampedArray, w: number, h: number, slots: ColorSlot[], minArea: number): DetectResult {
  const n = w * h;
  if (bufLabels.length !== n) {
    bufLabels = new Uint8Array(n);
    bufSeen = new Uint8Array(n);
    bufStack = new Int32Array(n);
  }
  const labels = bufLabels, seen = bufSeen, stack = bufStack;
  seen.fill(0);

  const active = slots.map((s, i) => ({ s, i })).filter(o => o.s.enabled);
  // Llindars globals per descartar ràpid el fons fosc sense calcular el to.
  let gSat = 1, gVal = 1;
  for (const { s } of active) { gSat = Math.min(gSat, s.satMin); gVal = Math.min(gVal, s.valMin); }
  const gMaxMin = gVal * 255;

  for (let p = 0, k = 0; p < n; p++, k += 4) {
    labels[p] = 0;
    if (active.length === 0) continue;
    const r = data[k], g = data[k + 1], b = data[k + 2];
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (max < gMaxMin) continue;
    const [hh, s, v] = rgbToHsv(r, g, b);
    if (s < gSat) continue;
    let bestD = 999, bestI = -1;
    for (const { s: sl, i } of active) {
      if (s < sl.satMin || v < sl.valMin) continue;
      const d = hueDist(hh, sl.hue);
      if (d <= sl.hueTol && d < bestD) { bestD = d; bestI = i; }
    }
    if (bestI >= 0) labels[p] = bestI + 1;
  }

  const best: (Blob | null)[] = slots.map(() => null);
  const extra = slots.map(() => 0);
  for (let p = 0; p < n; p++) {
    const lab = labels[p];
    if (lab === 0 || seen[p]) continue;
    let sp = 0, area = 0, sx = 0, sy = 0;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    stack[sp++] = p; seen[p] = 1;
    while (sp > 0) {
      const q = stack[--sp];
      const x = q % w, y = (q - x) / w;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && !seen[q - 1] && labels[q - 1] === lab) { seen[q - 1] = 1; stack[sp++] = q - 1; }
      if (x < w - 1 && !seen[q + 1] && labels[q + 1] === lab) { seen[q + 1] = 1; stack[sp++] = q + 1; }
      if (y > 0 && !seen[q - w] && labels[q - w] === lab) { seen[q - w] = 1; stack[sp++] = q - w; }
      if (y < h - 1 && !seen[q + w] && labels[q + w] === lab) { seen[q + w] = 1; stack[sp++] = q + w; }
    }
    if (area < minArea) continue;
    const slot = lab - 1;
    const blob: Blob = { slot, area, x: sx / area, y: sy / area, cx: sx / area / w, cy: sy / area / h, minX, minY, maxX, maxY };
    const cur = best[slot];
    if (!cur) best[slot] = blob;
    else {
      extra[slot]++;
      if (blob.area > cur.area) best[slot] = blob;
    }
  }
  return { best, extra, labels, w, h };
}

export type BlobState = 'perduda' | 'movent' | 'quieta';

/**
 * Estat de cada figureta al llarg del temps: «quieta» quan fa `stillMs` que no es mou més de
 * `tol` (normalitzat); «perduda» si fa més de `lostMs` que no es veu. La fase 1 enviarà la
 * posició al DM només quan passi a «quieta» en un lloc diferent.
 */
export class StillTracker {
  private hist: { t: number; cx: number; cy: number }[][] = [];
  private lastSeen: number[] = [];

  constructor(public stillMs = 500, public tol = 0.01, public lostMs = 400) {}

  update(best: (Blob | null)[], t: number): BlobState[] {
    return best.map((b, i) => {
      const h = (this.hist[i] ??= []);
      if (b) {
        h.push({ t, cx: b.cx, cy: b.cy });
        this.lastSeen[i] = t;
      }
      while (h.length > 0 && h[0].t < t - this.stillMs * 2) h.shift();
      if (!b) return t - (this.lastSeen[i] ?? -Infinity) > this.lostMs ? 'perduda' : 'movent';
      const recent = h.filter(p => p.t >= t - this.stillMs);
      if (h[0].t > t - this.stillMs) return 'movent'; // encara no fa prou que la veiem
      const moved = recent.some(p => Math.hypot(p.cx - b.cx, p.cy - b.cy) > this.tol);
      return moved ? 'movent' : 'quieta';
    });
  }
}

export const DEFAULT_SLOTS: ColorSlot[] = [
  { id: 's1', name: 'Verd',    enabled: true, hue: 125, hueTol: 18, satMin: 0.35, valMin: 0.2, swatch: '#2ecc40' },
  { id: 's2', name: 'Blau',    enabled: true, hue: 220, hueTol: 18, satMin: 0.35, valMin: 0.2, swatch: '#1f6fff' },
  { id: 's3', name: 'Groc',    enabled: true, hue: 55,  hueTol: 12, satMin: 0.35, valMin: 0.3, swatch: '#ffdc00' },
  { id: 's4', name: 'Magenta', enabled: true, hue: 322, hueTol: 16, satMin: 0.35, valMin: 0.2, swatch: '#e83e8c' },
  { id: 's5', name: 'Cian',    enabled: true, hue: 185, hueTol: 12, satMin: 0.35, valMin: 0.2, swatch: '#22d3ee' },
];

/** `#rrggbb` del to/sat/val (per actualitzar la mostra en ajustar). */
export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hx = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}
