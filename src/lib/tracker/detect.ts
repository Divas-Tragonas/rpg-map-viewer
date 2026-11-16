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
  /** Jugador (`Player.id`) que mou aquesta figureta. Absent/`null` = no mou cap token. */
  playerId?: number | null;
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
  /**
   * Totes les taques de cada color, de més grossa a més petita, fins a la meitat de `minArea`
   * (el `FigureTracker` accepta una taca una mica més petita si és on era la figureta: una base
   * mig tapada per la figura o per un reflex no s'ha de perdre).
   */
  all: Blob[][];
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
  const all: Blob[][] = slots.map(() => []);
  const keepArea = Math.max(3, minArea * 0.5);
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
    if (area < keepArea) continue;
    const slot = lab - 1;
    const blob: Blob = { slot, area, x: sx / area, y: sy / area, cx: sx / area / w, cy: sy / area / h, minX, minY, maxX, maxY };
    all[slot].push(blob);
    if (area < minArea) continue;
    const cur = best[slot];
    if (!cur) best[slot] = blob;
    else {
      extra[slot]++;
      if (blob.area > cur.area) best[slot] = blob;
    }
  }
  for (const list of all) list.sort((a, b) => b.area - a.area);
  return { best, extra, all, labels, w, h };
}

export type BlobState = 'perduda' | 'movent' | 'quieta';

/**
 * Seguiment estable de cada figureta (v5.39). Substitueix l'antic `StillTracker`, que marcava
 * «es mou» qualsevol fotograma en què la taca no hi era: un parpelleig de la detecció amagava la
 * rodona de la pantalla de figures i la tornava a ensenyar.
 *
 * - **Àncora**: on era la figureta l'últim cop que es va quedar quieta. Només hi ha moviment si
 *   el centre (suavitzat) se n'allunya més de `moveTol` (normalitzat a l'amplada). El tremolor
 *   de la detecció (1–3 px) no hi arriba.
 * - **Pèrdues curtes**: si la taca no hi és, l'estat **no canvia** (si era quieta, continua
 *   quieta). Només passa a «perduda» al cap de `lostMs`, i «perduda» **no és moviment**: si torna
 *   a aparèixer a l'àncora, torna a ser quieta de seguida (la mà ha passat per sobre).
 * - **Quina taca**: si n'hi ha diverses del mateix color, la més propera a on era (dins de
 *   `maxJump`) i de mida semblant a la de sempre (entre `0,35×` i `3×` l'àrea mitjana). Una taca
 *   petita d'un reflex o una de grossa del mapa no li prenen el lloc.
 */
export interface Track {
  state: BlobState;
  /** Taca triada aquest fotograma (`null` si no n'hi ha cap de bona). */
  blob: Blob | null;
  /** Centre suavitzat (normalitzat) i àncora (on era quieta). */
  pos: { x: number; y: number } | null;
  anchor: { x: number; y: number } | null;
  /** Àrea mitjana de la taca quan es veu bé (px de la imatge processada). */
  area: number;
}

export class FigureTracker {
  private t: (Track & { lastSeen: number; still: { x: number; y: number; t: number } | null })[] = [];

  constructor(
    public moveTol = 0.02,
    public stillTol = 0.008,
    public stillMs = 500,
    public lostMs = 700,
    public maxJump = 0.25,
  ) {}

  /** `all[i]`: taques del color `i` (de `detect`). */
  update(all: Blob[][], now: number): Track[] {
    return all.map((cands, i) => {
      const tr = (this.t[i] ??= { state: 'perduda', blob: null, pos: null, anchor: null, area: 0, lastSeen: -Infinity, still: null });
      const ref = tr.pos ?? tr.anchor;
      let pick: Blob | null = null;
      if (ref) {
        let bestD = Infinity;
        for (const c of cands) {
          if (tr.area > 0 && (c.area < tr.area * 0.35 || c.area > tr.area * 3)) continue;
          const d = Math.hypot(c.cx - ref.x, c.cy - ref.y);
          if (d < bestD && d <= this.maxJump) { bestD = d; pick = c; }
        }
        // Lluny d'on era (l'han moguda d'una revolada o s'havia perdut): la més grossa prou gran.
        if (!pick && tr.state === 'perduda') pick = cands.find(c => tr.area <= 0 || c.area >= tr.area * 0.35) ?? null;
      } else {
        pick = cands[0] ?? null;
      }
      tr.blob = pick;

      if (!pick) {
        if (now - tr.lastSeen > this.lostMs) { tr.state = 'perduda'; tr.pos = null; tr.still = null; }
        return snapshot(tr);
      }
      tr.lastSeen = now;
      tr.area = tr.area > 0 ? tr.area * 0.9 + pick.area * 0.1 : pick.area;
      const p = tr.pos ? { x: tr.pos.x * 0.5 + pick.cx * 0.5, y: tr.pos.y * 0.5 + pick.cy * 0.5 } : { x: pick.cx, y: pick.cy };
      tr.pos = p;

      const farFromAnchor = !tr.anchor || Math.hypot(p.x - tr.anchor.x, p.y - tr.anchor.y) > this.moveTol;
      if (tr.state === 'quieta' && !farFromAnchor) return snapshot(tr);
      if (tr.state === 'perduda' && !farFromAnchor) { tr.state = 'quieta'; tr.still = null; return snapshot(tr); }
      // Es mou (o ha aparegut en un altre lloc): quieta quan fa `stillMs` que no surt d'un cercle petit.
      tr.state = 'movent';
      if (!tr.still || Math.hypot(p.x - tr.still.x, p.y - tr.still.y) > this.stillTol) tr.still = { x: p.x, y: p.y, t: now };
      else if (now - tr.still.t >= this.stillMs) { tr.state = 'quieta'; tr.anchor = { x: p.x, y: p.y }; tr.still = null; }
      return snapshot(tr);
    });
  }
}

function snapshot(tr: Track): Track {
  return { state: tr.state, blob: tr.blob, pos: tr.pos, anchor: tr.anchor, area: tr.area };
}

/**
 * «Hi passa alguna cosa» al voltant de cada figureta: fracció de píxels que han canviat de
 * brillantor respecte del fotograma de fa ~250 ms en un cercle al voltant de l'àncora. Una mà (o una
 * figureta agafada) canvia de cop molts píxels; un parpelleig de la detecció o el tremolor de la
 * càmera, no. Amb el polaritzador la pantalla es veu fosca, així que el que hi passa a sota
 * (una rodona que apareix) gairebé no hi compta, i a més es fa un període de gràcia.
 */
export class ActivityMeter {
  /** Fotogrames recents (brillantor) per comparar amb el de fa `lagMs`: una mà lenta també es veu. */
  private hist: { t: number; lum: Uint8Array }[] = [];
  private w = 0;
  private h = 0;

  constructor(public lagMs = 250) {}

  /**
   * `centers`: on mirar (normalitzat) i amb quin radi (px de la imatge processada). Torna la
   * fracció de píxels del cercle que han canviat respecte del fotograma de fa `lagMs` (0..1), o
   * `null` si no hi ha on mirar (o encara no hi ha prou història).
   */
  measure(data: Uint8ClampedArray, w: number, h: number, centers: ({ x: number; y: number; r: number } | null)[], now: number, diff = 28): (number | null)[] {
    const n = w * h;
    if (w !== this.w || h !== this.h) { this.hist = []; this.w = w; this.h = h; }
    // Reaprofitar el buffer més vell que ja no cal.
    const old = this.hist.length > 1 && this.hist[1].t <= now - this.lagMs ? this.hist.shift()! : null;
    const lum = old && old.lum.length === n ? old.lum : new Uint8Array(n);
    for (let p = 0, k = 0; p < n; p++, k += 4) lum[p] = (data[k] * 77 + data[k + 1] * 150 + data[k + 2] * 29) >> 8;
    // El de referència: el més nou que tingui almenys `lagMs`.
    let ref: Uint8Array | null = null;
    for (const f of this.hist) if (f.t <= now - this.lagMs) ref = f.lum;
    this.hist.push({ t: now, lum });
    if (this.hist.length > 40) this.hist.shift();
    return centers.map(c => {
      if (!c || !ref) return null;
      const cx = c.x * w, cy = c.y * h, r = Math.max(3, c.r), r2 = r * r;
      let tot = 0, ch = 0;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > r2) continue;
          const q = y * w + x;
          tot++;
          if (Math.abs(lum[q] - ref[q]) > diff) ch++;
        }
      }
      return tot ? ch / tot : null;
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
