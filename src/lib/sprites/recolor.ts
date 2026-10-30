/**
 * Recolor de figuretes (app Píxel). Cada criatura del paquet té pocs colors, en rampes de 3–4
 * tons (la túnica, el ribet, la pell…). Aquí es troben aquestes rampes («famílies» de color) i
 * se'n canvia el to sencer conservant-ne la forma: el resultat sembla fet per l'autor.
 *
 * El recolor viatja DINS del nom de la figureta (`wizard~14=c0392b,n=f1c40f`): així el porten
 * sols el STATE, la partida, el rètol de torn, els diàlegs i les cinemàtiques, sense camps nous
 * ni canvis a la API. Funcions pures sobre els píxels: el canvas i la memòria cau són a `draw.ts`.
 */

/** Separador entre el nom de la criatura i el recolor. */
const SEP = '~';
/** Família de grisos (armadures, ossos, roba blanca): no tenen to, se'ls en dona un. */
export const NEUTRAL = 'n';

const BINS = 24;
/** Una família ha de tenir almenys aquesta fracció dels píxels de color (fora els ulls, gemmes…). */
const MIN_FAMILY = 0.06;
const MIN_NEUTRAL = 0.1;
const MAX_FAMILIES = 4;

export interface SpriteLook {
  /** Criatura del paquet (`CREATURES`). */
  name: string;
  /** Família → color de destí (`rrggbb`). */
  tints: Record<string, string>;
}

export function parseSprite(s: string): SpriteLook {
  const i = s.indexOf(SEP);
  if (i < 0) return { name: s, tints: {} };
  const tints: Record<string, string> = {};
  for (const kv of s.slice(i + 1).split(',')) {
    const [k, v] = kv.split('=');
    if (k && v && /^[0-9a-f]{6}$/i.test(v)) tints[k] = v.toLowerCase();
  }
  return { name: s.slice(0, i), tints };
}

export function buildSprite(name: string, tints: Record<string, string>): string {
  const kv = Object.entries(tints).map(([k, v]) => `${k}=${v}`);
  return kv.length ? `${name}${SEP}${kv.join(',')}` : name;
}

// ── Color ────────────────────────────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return [h, max ? d / max : 0, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export const hexToHsv = (hex: string) => rgbToHsv(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));

/**
 * A quina família pot pertànyer un píxel: `null` = no es toca (ombra semitransparent, contorn
 * gairebé negre), `NEUTRAL` = gris, o la casella de to (0..BINS-1).
 */
function classify(d: Uint8ClampedArray, i: number): string | number | null {
  if (d[i + 3] < 200) return null;
  const [h, s, v] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
  if (v < 0.18) return null;
  if (s < 0.2) return NEUTRAL;
  return Math.floor(h * BINS) % BINS;
}

export interface ColorFamily {
  key: string;
  /** Color més freqüent de la família (`rrggbb`): el que es veu a la mostra. */
  color: string;
  count: number;
}

/** Famílies d'una criatura i a quina pertany cada casella de to. */
export interface Families {
  list: ColorFamily[];
  /** Casella de to → clau de família (les caselles de famílies massa petites no hi són). */
  owner: Map<number, string>;
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/**
 * Troba les famílies: histograma de to dels píxels amb color, suavitzat, i cada casella
 * s'adjudica al pic al qual s'arriba pujant (així dues rampes de tons propers però separades
 * per una vall, com el marró del bastó i el groc del ribet, queden en famílies diferents).
 */
export function findFamilies(d: Uint8ClampedArray): Families {
  const hist = new Array<number>(BINS).fill(0);
  const freq = new Map<string, Map<number, number>>();  // família/casella → color → vegades
  let neutral = 0, total = 0;
  const bump = (k: string, i: number) => {
    const rgb = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let m = freq.get(k); if (!m) freq.set(k, m = new Map());
    m.set(rgb, (m.get(rgb) ?? 0) + 1);
  };
  for (let i = 0; i < d.length; i += 4) {
    const c = classify(d, i);
    if (c === null) continue;
    total++;
    if (c === NEUTRAL) { neutral++; bump(NEUTRAL, i); }
    else { hist[c as number]++; bump(String(c), i); }
  }
  const at = (i: number) => (i + BINS) % BINS;
  const sm = hist.map((_, i) => hist[at(i - 1)] * 0.25 + hist[i] * 0.5 + hist[at(i + 1)] * 0.25);
  const climb = (i: number) => {
    for (let guard = 0; guard < BINS; guard++) {
      const l = sm[at(i - 1)], r = sm[at(i + 1)];
      if (l > sm[i] && l >= r) i = at(i - 1);
      else if (r > sm[i]) i = at(i + 1);
      else break;
    }
    return i;
  };
  const peakOf = new Map<number, number>();
  const counts = new Map<number, number>();
  hist.forEach((n, i) => {
    if (!n) return;
    const p = climb(i);
    peakOf.set(i, p);
    counts.set(p, (counts.get(p) ?? 0) + n);
  });
  const list: ColorFamily[] = [];
  for (const [p, n] of counts) if (n >= MIN_FAMILY * total) list.push({ key: String(p), color: '', count: n });
  if (neutral >= MIN_NEUTRAL * total) list.push({ key: NEUTRAL, color: '', count: neutral });
  list.sort((a, b) => b.count - a.count);
  list.length = Math.min(list.length, MAX_FAMILIES);
  const keys = new Set(list.map(f => f.key));
  const owner = new Map<number, string>();
  for (const [i, p] of peakOf) if (keys.has(String(p))) owner.set(i, String(p));
  // Color de mostra: el més freqüent de tots els de la família.
  for (const f of list) {
    let best = 0, bestN = -1;
    const merge = (m?: Map<number, number>) => m?.forEach((n, rgb) => { if (n > bestN) { bestN = n; best = rgb; } });
    if (f.key === NEUTRAL) merge(freq.get(NEUTRAL));
    else for (const [i, o] of owner) if (o === f.key) merge(freq.get(String(i)));
    f.color = hex2(best >> 16) + hex2((best >> 8) & 255) + hex2(best & 255);
  }
  return { list, owner };
}

const familyOf = (c: string | number | null, fam: Families) =>
  c === null ? null : c === NEUTRAL ? (fam.list.some(f => f.key === NEUTRAL) ? NEUTRAL : null) : fam.owner.get(c as number) ?? null;

const clampLog = (x: number) => Math.log(Math.min(0.96, Math.max(0.04, x)));

/**
 * Recolora els píxels (in place). Per a cada família es porta el seu to mitjà al del color de
 * destí conservant les diferències de to de la rampa, i la saturació i la lluminositat es
 * corben (`x^k`, que manté 0 i 1 i l'ordre) perquè la mitjana arribi a la del destí: les
 * ombres continuen sent ombres i les llums, llums, sense cremar-se.
 */
export function recolorPixels(d: Uint8ClampedArray, fam: Families, tints: Record<string, string>) {
  const stats = new Map<string, { cx: number; cy: number; s: number; v: number; n: number }>();
  for (let i = 0; i < d.length; i += 4) {
    const k = familyOf(classify(d, i), fam);
    if (!k || !tints[k]) continue;
    const [h, s, v] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
    let st = stats.get(k); if (!st) stats.set(k, st = { cx: 0, cy: 0, s: 0, v: 0, n: 0 });
    st.cx += Math.cos(h * 2 * Math.PI); st.cy += Math.sin(h * 2 * Math.PI); st.s += s; st.v += v; st.n++;
  }
  const map = new Map<string, { mh: number; ks: number; kv: number; th: number; ts: number }>();
  for (const [k, st] of stats) {
    const [th, ts, tv] = hexToHsv(tints[k]);
    const mh = ((Math.atan2(st.cy, st.cx) / (2 * Math.PI)) % 1 + 1) % 1;
    map.set(k, { mh, th, ts, ks: clampLog(ts) / clampLog(st.s / st.n), kv: clampLog(tv) / clampLog(st.v / st.n) });
  }
  for (let i = 0; i < d.length; i += 4) {
    const k = familyOf(classify(d, i), fam);
    const m = k ? map.get(k) : undefined;
    if (!m) continue;
    const [h, s, v] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
    let h2: number, s2: number;
    if (k === NEUTRAL) {
      // Un gris no té to per desplaçar: pren el del destí, amb la saturació del destí atenuada
      // (si no, una armadura acabaria del color pla de la mostra).
      h2 = m.th;
      s2 = Math.min(1, (m.ts > 0.2 ? m.ts * (0.35 + 3.25 * s) : m.ts * 0.5 + s * 0.5) * 0.7);
    } else {
      h2 = ((m.th + h - m.mh) % 1 + 1) % 1;
      s2 = Math.pow(s, m.ks);
    }
    const [r, g, b] = hsvToRgb(h2, s2, Math.pow(v, m.kv));
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
}

/** Mostres de la paleta del recolor (`rrggbb`). */
export const TINT_SWATCHES: { hex: string; label: string }[] = [
  { hex: 'c0392b', label: 'Vermell' }, { hex: 'e67e22', label: 'Taronja' }, { hex: 'f1c40f', label: 'Groc' },
  { hex: '27ae60', label: 'Verd' }, { hex: '16a085', label: 'Turquesa' }, { hex: '2e86de', label: 'Blau' },
  { hex: '8e44ad', label: 'Lila' }, { hex: 'e84393', label: 'Rosa' }, { hex: '6d4c41', label: 'Marró' },
  { hex: '95a5a6', label: 'Gris' }, { hex: '2d2d2d', label: 'Negre' }, { hex: 'ecf0f1', label: 'Blanc' },
];
