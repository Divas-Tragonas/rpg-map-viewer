/**
 * Lletra de píxel del paquet (`uf_interface.png`, a dalt a la dreta): majúscules, xifres i
 * signes de 7 px d'alt en una graella de 8 px. Només hi ha majúscules: les minúscules es
 * pinten en majúscula i les lletres catalanes amb accent (À È É Í Ï Ò Ó Ú Ü Ç, L·L) es
 * componen amb la lletra base i els píxels de l'accent a sobre (o la trenca a sota).
 *
 * Coordenades en píxels de la lletra (1 = un píxel del full): qui pinta escala el llenç
 * sencer a un múltiple enter (`image-rendering: pixelated`), mai una lletra sola.
 */
import { sheet } from './pack';

/** Alçada d'una línia: 3 files per als accents + 7 de lletra + 2 per a la trenca i les comes. */
export const PF_LINE = 12;
/** Fila de la lletra dins de la línia (on comença la fila 0 del glif). */
export const PF_TOP = 3;
const SPACE = 4;

const SYMBOLS = '1234567890!#$%&*()-+=[]:;"\'<>,.?/';
// [esquerra, amplada] de cada glif dins de la seva casella de 8 px (mesurat al full).
const SYM_X: [number, number][] = [
  [2, 4], [1, 5], [1, 5], [1, 6], [1, 5], [1, 5], [1, 5], [1, 5], [1, 5], [1, 5], [2, 4], [0, 8], [0, 7], [0, 7], [0, 7], [0, 8],
  [1, 5], [1, 5], [0, 7], [1, 6], [1, 5], [1, 4], [3, 4], [3, 2], [2, 3], [1, 6], [2, 4], [1, 6], [1, 6], [2, 3], [2, 3], [1, 6], [0, 7],
];
const LET_X: Record<string, [number, number]> = { I: [2, 4], M: [0, 8], V: [0, 8] };

interface Glyph { sx: number; sy: number; left: number; w: number }
const GLYPHS = new Map<string, Glyph>();
for (let i = 0; i < SYMBOLS.length; i++) GLYPHS.set(SYMBOLS[i], { sx: 584 + 8 * i, sy: 8, left: SYM_X[i][0], w: SYM_X[i][1] });
for (let i = 0; i < 26; i++) {
  const ch = String.fromCharCode(65 + i);
  const [left, w] = LET_X[ch] ?? [0, 7];
  GLYPHS.set(ch, { sx: 584 + 8 * i, sy: 24, left, w });
}

type Mark = 'acute' | 'grave' | 'dia' | 'tilde' | 'cedilla';
// Lletra amb accent → lletra base + marca. La resta d'accents (^, ˚…) es pinten sense.
const COMPOSED: Record<string, [string, Mark | null]> = {
  À: ['A', 'grave'], Á: ['A', 'acute'], Â: ['A', null], Ä: ['A', 'dia'],
  È: ['E', 'grave'], É: ['E', 'acute'], Ê: ['E', null], Ë: ['E', 'dia'],
  Ì: ['I', 'grave'], Í: ['I', 'acute'], Î: ['I', null], Ï: ['I', 'dia'],
  Ò: ['O', 'grave'], Ó: ['O', 'acute'], Ô: ['O', null], Ö: ['O', 'dia'],
  Ù: ['U', 'grave'], Ú: ['U', 'acute'], Û: ['U', null], Ü: ['U', 'dia'],
  Ç: ['C', 'cedilla'], Ñ: ['N', 'tilde'],
};
// Píxels de cada marca, relatius al centre del glif (columna) i a la fila 0 de la lletra.
const MARKS: Record<Mark, [number, number][]> = {
  acute: [[0, -3], [1, -3], [-1, -2], [0, -2]],
  grave: [[-1, -3], [0, -3], [0, -2], [1, -2]],
  dia: [[-2, -2], [-1, -2], [1, -2], [2, -2]],
  tilde: [[-2, -2], [-1, -3], [0, -3], [0, -2], [1, -2], [2, -3]],
  cedilla: [[0, 7], [-1, 8], [0, 8]],
};
const ALIAS: Record<string, string> = {
  '«': '"', '»': '"', '“': '"', '”': '"', '’': '\'', '‘': '\'', '´': '\'', '`': '\'',
  '—': '-', '–': '-', '_': '-', '@': 'A', '^': '\'', '~': '-', '{': '(', '}': ')', '|': '!', '\\': '/',
};

/** Caràcter tal com es pinta (majúscula, àlies…) i, si en té, la marca d'accent. */
function resolve(ch: string): { g: Glyph | null; mark: Mark | null; flip: boolean; dot: boolean } {
  if (ch === '·' || ch === '•' || ch === '.') return { g: null, mark: null, flip: false, dot: true };
  if (ch === '¡' || ch === '¿') return { g: GLYPHS.get(ch === '¡' ? '!' : '?') ?? null, mark: null, flip: true, dot: false };
  const up = (ALIAS[ch] ?? ch).toUpperCase();
  const comp = COMPOSED[up];
  if (comp) return { g: GLYPHS.get(comp[0]) ?? null, mark: comp[1], flip: false, dot: false };
  return { g: GLYPHS.get(up) ?? null, mark: null, flip: false, dot: false };
}

/** Amplada que ocupa un caràcter (inclòs l'espai fins al següent). */
export function pfAdvance(ch: string): number {
  if (ch === ' ' || ch === '\n') return SPACE;
  const r = resolve(ch);
  if (r.dot) return 3;
  return r.g ? r.g.w + 1 : SPACE;
}

export function pfMeasure(text: string): number {
  let w = 0;
  for (const ch of text) w += pfAdvance(ch);
  return Math.max(0, w - 1);
}

/** Parteix en línies que no passin de `maxW` (per paraules; una paraula massa llarga es talla). */
export function pfWrap(text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const cand = line ? `${line} ${word}` : word;
      if (pfMeasure(cand) <= maxW || !line) { line = cand; continue; }
      out.push(line); line = word;
    }
    // Paraula sola més ampla que la línia: es talla on toqui.
    while (pfMeasure(line) > maxW && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && pfMeasure(line.slice(0, cut)) > maxW) cut--;
      out.push(line.slice(0, cut)); line = line.slice(cut);
    }
    out.push(line);
  }
  return out;
}

// Còpia de la zona de la lletra pintada de cada color (es fa un sol cop per color).
const FONT_X = 584, FONT_Y = 8, FONT_W = 264, FONT_H = 24;
const _tinted = new Map<string, HTMLCanvasElement>();
function tinted(color: string): HTMLCanvasElement | null {
  const hit = _tinted.get(color); if (hit) return hit;
  const img = sheet('interface'); if (!img) return null;
  const c = document.createElement('canvas'); c.width = FONT_W; c.height = FONT_H;
  const g = c.getContext('2d')!;
  g.drawImage(img, FONT_X, FONT_Y, FONT_W, FONT_H, 0, 0, FONT_W, FONT_H);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, FONT_W, FONT_H);
  _tinted.set(color, c);
  return c;
}

/**
 * Pinta un caràcter amb la cantonada de la línia a (x, y) i en retorna l'avanç. `x`, `y`
 * han de ser enters (en píxels de la lletra): si no, el navegador el difumina.
 */
export function pfDrawChar(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, color: string): number {
  const adv = pfAdvance(ch);
  if (ch === ' ' || ch === '\n') return adv;
  const r = resolve(ch);
  ctx.fillStyle = color;
  // Punt i punt volat: un quadrat de 2×2. El punt del full és un rombe que a mida petita es
  // llegia com una creu («+»).
  if (r.dot) { ctx.fillRect(x, y + PF_TOP + (ch === '.' ? 5 : 2), 2, 2); return adv; }
  const src = tinted(color);
  if (!r.g || !src) return adv;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  const gx = r.g.sx - FONT_X + r.g.left, gy = r.g.sy - FONT_Y;
  if (r.flip) {
    // ¡ i ¿: el ! i el ? girats.
    ctx.save();
    ctx.translate(x + r.g.w, y + PF_TOP + 7); ctx.scale(-1, -1);
    ctx.drawImage(src, gx, gy, r.g.w, 8, 0, 0, r.g.w, 8);
    ctx.restore();
  } else {
    if (r.g.sy === 24 && r.g.sx === 648) {
      // La I del full acaba amb una cua cap a l'esquerra i es llegia com una J («GOBLJN»):
      // es pinta amb el peu recte, igual que el cap.
      ctx.drawImage(src, gx, gy, r.g.w, 6, x, y + PF_TOP, r.g.w, 6);
      ctx.fillRect(x, y + PF_TOP + 6, r.g.w, 1);
    } else ctx.drawImage(src, gx, gy, r.g.w, 8, x, y + PF_TOP, r.g.w, 8);
  }
  ctx.imageSmoothingEnabled = prev;
  if (r.mark) {
    const c = x + Math.floor(r.g.w / 2);
    for (const [dx, dy] of MARKS[r.mark]) ctx.fillRect(c + dx, y + PF_TOP + dy, 1, 1);
  }
  return adv;
}

/** Pinta una línia sencera. Retorna l'amplada. */
export function pfDraw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): number {
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of text) cx += pfDrawChar(ctx, ch, cx, cy, color);
  return cx - Math.round(x);
}
