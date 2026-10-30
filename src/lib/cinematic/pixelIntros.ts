/**
 * Cinemàtiques de boss en pixel art (app Píxel), inspirades en les entrades de boss dels
 * RPG clàssics: Pokémon, Dragon Quest, Final Fantasy, Chrono Trigger, EarthBound,
 * Mega Man, Street Fighter, Zelda, Souls.
 *
 * Totes es pinten en una «pantalla virtual» de baixa resolució (~200 px d'alt) ampliada
 * sense suavitzar: així els sprites del paquet, la lletra i les finestres del full
 * d'interfície (`uf_interface.png`) i els efectes (`uf_FX.png`) queden a la mateixa
 * escala de píxel, com en una consola.
 *
 * Mateix contracte que `playBossIntro` (`BossIntro`: `tick`, `skip`, `dispose`): cada
 * pantalla la fa avançar des del seu tick i tot és funció del temps (i d'una llavor), o
 * sigui que el DM i els jugadors veuen la mateixa cinemàtica al mateix moment.
 */
import { sheet } from '@/lib/sprites/pack';
import { drawCreature, hasCreature, creatureFrame } from '@/lib/sprites/draw';
import { drawWindow } from '@/lib/sprites/window';
import { mulberry32 } from '@/lib/render/fxsprites';
import type { BossIntro } from './bossIntro';

export type PixelIntroId =
  | 'wild' | 'quest' | 'warning' | 'versus' | 'shatter'
  | 'portal' | 'psyche' | 'trainer' | 'shadow' | 'title';

/**
 * Catàleg (ordre del selector). `hint`: d'on ve la idea, en una línia. `msg`: el missatge
 * per defecte de les que en tenen (el DM el pot canviar; `{nom}` = el nom de l'enemic o
 * dels enemics).
 */
export const PIXEL_INTROS: { id: PixelIntroId; label: string; hint: string; dur: number; msg?: string }[] = [
  { id: 'wild',    label: 'Encontre salvatge', hint: 'Pokémon: flaixos, franges i combat',             dur: 5.8, msg: 'Ha aparegut {nom}!' },
  { id: 'trainer', label: 'Repte del líder',   hint: 'Pokémon: franja amb línies de velocitat',        dur: 6.6, msg: 'Repte de' },
  { id: 'quest',   label: 'Apareix un monstre', hint: 'Dragon Quest: menú de combat que es fa servir', dur: 9.4, msg: 'Apareix {nom}!' },
  { id: 'shatter', label: 'Mirall trencat',    hint: 'El mapa es trenca com un vidre i el boss el travessa', dur: 6.2, msg: 'Ha travessat el mirall' },
  { id: 'portal',  label: 'Portal del temps',  hint: 'Chrono Trigger: ona, portal i aparició',         dur: 5.8, msg: "Des d'una altra era..." },
  { id: 'psyche',  label: 'Fons psicodèlic',   hint: 'EarthBound: fons ondulant de colors',            dur: 5.2, msg: "T'has trobat amb {nom}!" },
  { id: 'warning', label: 'WARNING',           hint: 'Mega Man: alarma, teletransport i barra',        dur: 5.4 },
  { id: 'versus',  label: 'Versus',            hint: 'Street Fighter: la colla contra el boss',        dur: 5.0 },
  { id: 'title',   label: 'Rètol del boss',    hint: 'Zelda: franges de cinema i nom que cau',         dur: 5.2, msg: 'Enemic terrible' },
  { id: 'shadow',  label: "L'ombra",           hint: 'Souls: terratrèmol, silueta i barra llarga',     dur: 6.0 },
];
/** Estil d'una cinemàtica de boss: la de sempre o una de les de pixel art. */
export type BossIntroStyle = 'classic' | PixelIntroId;
export const isPixelIntro = (s: unknown): s is PixelIntroId => PIXEL_INTROS.some(p => p.id === s);

/** Més enemics que entren amb el boss (cinemàtica de grup). Sense figureta, `img`. */
export interface PixelFoe { name: string; sprite?: string | null; img?: HTMLCanvasElement | HTMLImageElement | null }
/** Quants enemics hi caben en total (el boss inclòs). */
export const MAX_FOES = 5;

export interface PixelIntroOptions {
  stage: HTMLElement;
  style: PixelIntroId;
  bossName: string;
  /** Criatura del paquet Oryx (si el token en té). */
  sprite: string | null;
  /** Sense figureta: el retrat (o la imatge del token), ampliat. */
  portrait: HTMLCanvasElement | HTMLImageElement | null;
  /** Els altres enemics del grup (poden ser cap). */
  extras?: PixelFoe[];
  /** Missatge del DM en lloc del de `PIXEL_INTROS[].msg` (buit = el de sempre). */
  message?: string | null;
  /** La colla (per als estils que la mostren). */
  party: { name: string; sprite?: string }[];
  seed: number;
  offsetMs?: number;
  onCamEnd?: () => void;
  onDone?: () => void;
}

// ── Utilitats ────────────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOut = (p: number) => 1 - (1 - p) ** 3;
const easeIn = (p: number) => p * p * p;
const backOut = (p: number) => { const c = 1.7; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const blink = (t: number, hz: number) => Math.floor(t * hz) % 2 === 0;

/** Text que la lletra del paquet sap pintar: majúscules sense accents. */
export function pixelText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/·/g, '.').toUpperCase();
}

// ── Lletra del full d'interfície (glifs de 7×7 cada 8 px a partir de x = 584) ──
// Glifs de 7×7 (+ una fila de sota per a la cua de la coma, buida a les lletres).
const FONT_X = 584, ADV = 8, GLYPH = 7, GLYPH_H = 8;
// Al full, el glif de després de «>» és la coma (el del punt es pinta a `fontSheet`).
const SYMBOLS = '1234567890!#$%&*()-+=[]:;"\'<>,.?/';
type FontKind = 'plain' | 'fancy';
const _tinted = new Map<string, HTMLCanvasElement>();
function fontSheet(color: string): HTMLCanvasElement | null {
  const img = sheet('interface'); if (!img) return null;
  const hit = _tinted.get(color); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 280; c.height = 32;
  const g = c.getContext('2d')!;
  g.drawImage(img, FONT_X, 0, 280, 32, 0, 0, 280, 32);
  // La «I» del full acaba amb un ganxo i es llegeix com una «J»: peu recte com el cap.
  g.clearRect(64, 30, 8, 1); g.fillStyle = '#fff'; g.fillRect(66, 30, 4, 1);
  // El full no té punt (el glif que hi ha és un punt volat): un de 2×2 a la base, com la coma.
  g.clearRect(30 * ADV, 8, ADV, 8); g.fillRect(30 * ADV + 3, 13, 2, 2);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, 280, 32);
  _tinted.set(color, c);
  return c;
}
function glyphAt(ch: string, kind: FontKind): [number, number] | null {
  const code = ch.charCodeAt(0);
  // La «I» de la lletra decorada sembla un «1»: es fa servir la de la lletra normal.
  if (code >= 65 && code <= 90) return [(code - 65) * ADV, kind === 'fancy' && ch !== 'I' ? 16 : 24];
  const i = SYMBOLS.indexOf(ch);
  return i >= 0 ? [i * ADV, 8] : null;
}
function measure(s: string, scale = 1): number {
  let w = 0;
  for (const ch of s) w += (ch === ' ' ? 5 : ADV) * scale;
  return Math.max(0, w - scale);
}
interface TextOpt { scale?: number; color?: string; shadow?: string | null; align?: 'left' | 'center' | 'right'; kind?: FontKind }
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpt = {}) {
  const scale = o.scale ?? 1, kind = o.kind ?? 'plain';
  const str = pixelText(s);
  let cx = Math.round(o.align === 'center' ? x - measure(str, scale) / 2 : o.align === 'right' ? x - measure(str, scale) : x);
  const y0 = Math.round(y);
  const fg = fontSheet(o.color ?? '#ffffff');
  const sh = o.shadow === null ? null : fontSheet(o.shadow ?? '#000000');
  if (!fg) { // sense el full: lletra del sistema (no hauria de passar a l'app Píxel)
    ctx.fillStyle = o.color ?? '#fff'; ctx.font = `bold ${8 * scale}px monospace`;
    ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = 'top'; ctx.fillText(str, x, y); ctx.textAlign = 'left';
    return;
  }
  for (const ch of str) {
    if (ch === ' ') { cx += 5 * scale; continue; }
    const g = glyphAt(ch, kind);
    if (g) {
      if (sh) ctx.drawImage(sh, g[0], g[1], GLYPH, GLYPH_H, cx + scale, y0 + scale, GLYPH * scale, GLYPH_H * scale);
      ctx.drawImage(fg, g[0], g[1], GLYPH, GLYPH_H, cx, y0, GLYPH * scale, GLYPH_H * scale);
    }
    cx += ADV * scale;
  }
}

// ── Finestra fosca i barres de vida del full d'interfície ────────────────────
/** Finestra fosca del full (`drawWindow`); sense el full, un rectangle. */
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (w >= 16 && h >= 16 && drawWindow(ctx, 'navy', x, y, w, h)) return;
  ctx.fillStyle = '#1b1d2e'; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.strokeStyle = '#9aa0b4'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
}
/** Barra de vida del full (blava, vermella o verda), estirada a `w` i plena fins a `frac`. */
function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: 'blue' | 'red' | 'green', h = 12) {
  const img = sheet('interface');
  x = Math.round(x); y = Math.round(y); w = Math.round(w);
  if (!img) { ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, 6); ctx.fillStyle = '#e33'; ctx.fillRect(x, y, w * frac, 6); return; }
  // Barra de 48×12 amb extrems de 3 px, a x 8 del bloc de cada color (blocs cada 160 px:
  // blau, vermell, verd). Just a la dreta en comença una altra: no agafar-ne res.
  const off = color === 'blue' ? 0 : color === 'red' ? 160 : 320, cap = 3, BW = 48;
  const draw = (sy: number, ww: number) => {
    if (ww <= 0) return;
    ctx.drawImage(img, 8 + off, sy, cap, 12, x, y, cap, h);
    if (ww > 2 * cap) ctx.drawImage(img, 8 + off + cap, sy, BW - 2 * cap, 12, x + cap, y, ww - 2 * cap, h);
    ctx.drawImage(img, 8 + off + BW - cap, sy, cap, 12, x + Math.max(cap, ww - cap), y, cap, h);
  };
  draw(10, w);
  const fw = Math.round(w * clamp01(frac));
  if (fw > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, fw, h); ctx.clip(); draw(26, w); ctx.restore(); }
}

/** Efecte de `uf_FX.png` (24 px), centrat. */
function fx(ctx: CanvasRenderingContext2D, col: number, row: number, x: number, y: number, size = 24) {
  const img = sheet('fx'); if (!img) return;
  ctx.drawImage(img, col * 24, row * 24, 24, 24, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}
/** Efecte de `uf_FX_impact.png` (48 px), centrat. */
function impact(ctx: CanvasRenderingContext2D, col: number, row: number, x: number, y: number, size = 48) {
  const img = sheet('impact'); if (!img) return;
  ctx.drawImage(img, col * 48, row * 48, 48, 48, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

// ── L'escena ─────────────────────────────────────────────────────────────────

interface Foe { name: string; sprite: string | null; img: HTMLCanvasElement | HTMLImageElement | null }

interface Env {
  W: number; H: number;
  /** Nom del boss, en lletres que la lletra del full sap pintar. */
  name: string;
  /** Tots els enemics: el boss primer. */
  foes: Foe[];
  /** «A», «A I B», «A, B I C» (o «A I 3 MES»): el que substitueix `{nom}`. */
  group: string;
  /** Missatge escrit pel DM (sense resoldre) o null. */
  message: string | null;
  party: { name: string; sprite?: string }[];
  seed: number;
  /** La pantalla tal com era en començar (a la resolució virtual), o null. */
  snap: HTMLCanvasElement | null;
  /** Llenç auxiliar per a siluetes. */
  tmp: HTMLCanvasElement;
}

/** Mida de figura que encaixa (múltiple de 48 per sota, almenys 48). */
const fitSize = (maxPx: number) => Math.max(48, Math.floor(maxPx / 48) * 48);
/** Múltiple de 48 més proper (la figura no queda petita quan el lloc fa 90 px). */
const fitRound = (px: number) => Math.max(48, Math.round(px / 48) * 48);

function groupName(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const all = `${names.slice(0, -1).join(', ')} I ${names[names.length - 1]}`;
  return all.length <= 26 ? all : `${names[0]} I ${names.length - 1} MES`;
}

/** El missatge de la cinemàtica: el del DM o el per defecte, amb `{nom}` resolt. */
function say(e: Env, id: PixelIntroId): string {
  const def = PIXEL_INTROS.find(p => p.id === id)?.msg ?? '';
  return pixelText((e.message ?? def).replace(/\{nom\}/gi, e.group));
}

/** Parteix un text per paraules en línies de `maxW` píxels com a molt. */
function wrap(s: string, maxW: number, maxLines = 2): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of s.split(' ').filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (!cur || measure(next) <= maxW) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines).map(l => {
    while (l.length > 1 && measure(l) > maxW) l = l.slice(0, -1);
    return l;
  });
}
/** Amplada fins al començament del caràcter `n` (per pintar un tros d'un altre color). */
const advance = (s: string) => { let w = 0; for (const ch of s) w += ch === ' ' ? 5 : ADV; return w; };

/** Línies que es van escrivint; `done` quan ja hi són totes. */
function typedLines(lines: string[], t: number, start: number, cps = 24): { shown: string[]; done: boolean } {
  const n0 = Math.max(0, Math.floor((t - start) * cps));
  let n = n0;
  const shown = lines.map(l => { const s = l.slice(0, n); n = Math.max(0, n - l.length); return s; });
  return { shown, done: n0 >= lines.reduce((a, l) => a + l.length, 0) };
}

/** Text blanc amb el nom de l'enemic (o del grup) en groc, com als jocs. */
function textHi(ctx: CanvasRenderingContext2D, shown: string, full: string, x: number, y: number, hi: string[]) {
  text(ctx, shown, x, y, { color: '#fff' });
  for (const h of hi) {
    const i = h ? full.indexOf(h) : -1;
    if (i < 0) continue;
    if (i < shown.length) text(ctx, shown.slice(i, i + h.length), x + advance(full.slice(0, i)), y, { color: '#ffd257' });
    return;
  }
}

/** Missatge que s'escriu dins d'una caixa. Retorna si ja s'ha acabat d'escriure. */
function sayLines(ctx: CanvasRenderingContext2D, e: Env, lines: string[], x: number, y: number, t: number, start: number, lh = 12): boolean {
  const { shown, done } = typedLines(lines, t, start);
  shown.forEach((s, i) => textHi(ctx, s, lines[i], x, y + i * lh, [e.group, e.name]));
  return done;
}

/** Fletxa de «continua» (triangle cap avall, 7 px). */
function downArrow(ctx: CanvasRenderingContext2D, x: number, y: number, color = '#fff') {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 1, y + 1, 7, 1); ctx.fillRect(x + 2, y + 2, 5, 1); ctx.fillRect(x + 3, y + 3, 3, 1); ctx.fillRect(x + 4, y + 4, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 7, 1); ctx.fillRect(x + 1, y + 1, 5, 1); ctx.fillRect(x + 2, y + 2, 3, 1); ctx.fillRect(x + 3, y + 3, 1, 1);
}

interface FoeOpt { sil?: string | null; alpha?: number; flip?: boolean; reveal?: number; fromTop?: boolean }

/**
 * Un enemic amb els peus a (x, y). `sil` → silueta d'aquest color; `reveal` (0..1) → només
 * se'n veu la part de sota (sortint de terra, d'un portal…); `fromTop` → la revelació va
 * de dalt a baix (la silueta s'omple de color).
 */
function drawFoe(ctx: CanvasRenderingContext2D, e: Env, f: Foe, x: number, y: number, size: number, t: number, k: number, o: FoeOpt = {}) {
  const rv = o.reveal ?? 1;
  if (rv <= 0) return;
  const tc = e.tmp; tc.width = size; tc.height = size;
  const g = tc.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, size, size);
  const img = f.img;
  const imgOk = img && (!(img instanceof HTMLImageElement) || (img.complete && img.naturalWidth > 0));
  if (f.sprite && hasCreature(f.sprite)) {
    drawCreature(g, f.sprite, creatureFrame(t * 1000, 1.3 + k * 0.7), 0, 0, size, o.flip);
  } else if (img && imgOk) {
    const pw = (img as HTMLCanvasElement).width || (img as HTMLImageElement).naturalWidth || 1;
    const ph = (img as HTMLCanvasElement).height || (img as HTMLImageElement).naturalHeight || 1;
    const s = Math.min(size / pw, size / ph);
    g.drawImage(img, (size - pw * s) / 2, size - ph * s, pw * s, ph * s);
  } else {
    g.fillStyle = '#c33'; g.fillRect(size * 0.2, size * 0.1, size * 0.6, size * 0.85);
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(size * 0.5)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(pixelText(f.name).slice(0, 1), size / 2, size / 2);
  }
  if (o.sil) { g.globalCompositeOperation = 'source-in'; g.fillStyle = o.sil; g.fillRect(0, 0, size, size); g.globalCompositeOperation = 'source-over'; }
  const dx = Math.round(x - size / 2), dy = Math.round(y - size * 0.94);
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  if (rv < 1) {
    ctx.beginPath();
    if (o.fromTop) ctx.rect(dx, dy, size, size * rv);
    else ctx.rect(dx, dy + size * (1 - rv), size, size * rv);
    ctx.clip();
  }
  ctx.drawImage(tc, dx, dy);
  ctx.restore();
}

interface Slot { f: Foe; x: number; y: number; size: number; k: number }
/**
 * On va cada enemic d'un grup, en ordre de dibuix (els del fons primer, el boss l'últim).
 * Per defecte el boss al mig i la resta, més petits, als costats i una mica enrere; `row`
 * → tots iguals en fila (Dragon Quest).
 */
function foeSlots(e: Env, cx: number, floor: number, size: number, row = false): Slot[] {
  const n = e.foes.length;
  if (n <= 1) return [{ f: e.foes[0], x: cx, y: floor, size, k: 0 }];
  if (row) {
    const gap = Math.min(size * 0.85, (e.W - 16) / n), mid = Math.floor((n - 1) / 2);
    const order = [mid, ...Array.from({ length: n }, (_, i) => i).filter(i => i !== mid)];
    return order.map((pos, k) => ({ f: e.foes[k], x: cx + (pos - (n - 1) / 2) * gap, y: floor, size, k })).reverse();
  }
  const sx = size >= 96 ? size - 48 : size;
  const out: Slot[] = [];
  for (let k = n - 1; k >= 1; k--) {
    const side = k % 2 ? 1 : -1, rank = Math.ceil(k / 2);
    const x = cx + side * (size * 0.36 + sx * 0.34 + (rank - 1) * sx * 0.62);
    out.push({ f: e.foes[k], x: Math.max(sx / 2, Math.min(e.W - sx / 2, x)), y: floor - Math.round(size * 0.07 * rank), size: sx, k });
  }
  out.push({ f: e.foes[0], x: cx, y: floor, size, k: 0 });
  return out;
}
function foes(ctx: CanvasRenderingContext2D, e: Env, cx: number, floor: number, size: number, t: number, o: FoeOpt = {}, row = false) {
  for (const s of foeSlots(e, cx, floor, size, row)) drawFoe(ctx, e, s.f, s.x, s.y, s.size, t, s.k, o);
}

/** Un membre de la colla (figureta o, sense, un rombe del seu color). */
function hero(ctx: CanvasRenderingContext2D, p: { name: string; sprite?: string }, x: number, y: number, size: number, t: number, flip = false, sil?: string) {
  if (p.sprite && hasCreature(p.sprite)) {
    if (!sil) { drawCreature(ctx, p.sprite, creatureFrame(t * 1000, p.name.length), Math.round(x - size / 2), Math.round(y - size * 0.94), size, flip); return; }
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
    drawCreature(g, p.sprite, 0, 0, 0, size, flip);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = sil; g.fillRect(0, 0, size, size);
    ctx.drawImage(c, Math.round(x - size / 2), Math.round(y - size * 0.94));
    return;
  }
  ctx.fillStyle = sil ?? '#8ab'; ctx.fillRect(Math.round(x - size / 6), Math.round(y - size / 2), Math.round(size / 3), Math.round(size / 2));
}

function typed(s: string, t: number, start: number, cps = 26): string {
  return s.slice(0, Math.max(0, Math.floor((t - start) * cps)));
}

function flash(ctx: CanvasRenderingContext2D, e: Env, a: number, color = '#fff') {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = color; ctx.fillRect(0, 0, e.W, e.H); ctx.restore();
}
function snapOr(ctx: CanvasRenderingContext2D, e: Env, color = '#000') {
  if (e.snap) ctx.drawImage(e.snap, 0, 0); else { ctx.fillStyle = color; ctx.fillRect(0, 0, e.W, e.H); }
}
/** Nom del boss amb «+N» si en porta més. */
const bossLabel = (e: Env, max: number) => {
  const extra = e.foes.length > 1 ? ` +${e.foes.length - 1}` : '';
  return e.name.slice(0, Math.max(1, max - extra.length)) + extra;
};

// ── Les deu cinemàtiques ──────────────────────────────────────────────────────

type Scene = (ctx: CanvasRenderingContext2D, t: number, e: Env) => void;

/** 1. Pokémon: tres flaixos, franges negres que tanquen la pantalla i escena de combat. */
const wild: Scene = (ctx, t, e) => {
  const { W, H } = e;
  if (t < 1.5) {
    snapOr(ctx, e);
    if (t < 0.75) flash(ctx, e, blink(t, 8) ? 0.85 : 0);
    const n = 14, bh = Math.ceil(H / n);
    for (let i = 0; i < n; i++) {
      const p = easeIn(clamp01((t - 0.75) / 0.55 * 1.25 - i * 0.02));
      ctx.fillStyle = '#000';
      if (i % 2) ctx.fillRect(W - W * p, i * bh, W * p + 1, bh);
      else ctx.fillRect(0, i * bh, W * p, bh);
    }
    if (t < 1.35) return;
  }
  // Escenari de combat
  const box = H - 50;
  ctx.fillStyle = '#f0e8c8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e4d8b0';
  for (let y = 0; y < H * 0.56; y += 6) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = '#c8e0a0'; ctx.fillRect(0, Math.round(H * 0.56), W, H);
  const plat = (cx: number, cy: number, rx: number) => {
    ctx.fillStyle = '#7fb060'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c8c48'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, rx, rx * 0.2, 0, 0, Math.PI); ctx.fill();
  };
  // Figures a la mida del lloc (la de l'enemic, gairebé mitja pantalla, com al joc).
  const size = fitRound(H * 0.46), hs = size;
  const ex = W * 0.69, ey = Math.round(H * 0.5), hx = W * 0.25, hy = box - 2;
  plat(ex, ey, size * (e.foes.length > 1 ? 0.95 : 0.62));
  plat(hx, hy, hs * 0.62);
  const pIn = easeOut(seg(t, 1.35, 2.15));
  const cry = t > 2.7 && t < 3.1 ? Math.round(Math.sin(t * 60) * 2) : 0;
  foes(ctx, e, lerp(-size, ex, pIn) + cry, ey + 2, size, t, { sil: t < 2.2 ? '#303030' : null });
  const lead = e.party[0];
  if (lead) hero(ctx, lead, lerp(W + hs, hx, pIn), hy, hs, t, true, t < 2.2 ? '#303030' : undefined);
  flash(ctx, e, 1 - seg(t, 2.2, 2.45));
  // Requadre d'estat del boss
  const pw = Math.min(190, Math.round(W * 0.5)), sx = Math.round(lerp(-pw - 10, 8, easeOut(seg(t, 2.3, 2.6))));
  panel(ctx, sx, 8, pw, 44);
  text(ctx, bossLabel(e, Math.floor((pw - 60) / ADV)), sx + 9, 17, { color: '#fff' });
  text(ctx, 'NV.??', sx + pw - 9, 17, { align: 'right', color: '#ffd257' });
  text(ctx, 'PV', sx + 9, 31, { color: '#ffd257' });
  hpBar(ctx, sx + 27, 28, pw - 37, seg(t, 2.6, 3.2), 'green');
  // Caixa de text
  if (t > 2.4) {
    panel(ctx, 4, box, W - 8, 46);
    const done = sayLines(ctx, e, wrap(say(e, 'wild'), W - 40), 16, box + 11, t, 2.5);
    if (done && blink(t, 3)) downArrow(ctx, W - 22, box + 34, '#ffd257');
  }
};

/** 2. Pokémon: repte d'un líder. Franja diagonal amb línies de velocitat, silueta i nom. */
const trainer: Scene = (ctx, t, e) => {
  const { W, H } = e;
  snapOr(ctx, e); flash(ctx, e, Math.min(1, t / 0.25) * 0.9, '#000');
  const cy = H * 0.48, bh = H * 0.42, slide = easeOut(seg(t, 0.15, 0.6));
  const skew = H * 0.12;
  ctx.save();
  ctx.translate(lerp(W, 0, slide), 0);
  ctx.beginPath();
  ctx.moveTo(0, cy - bh / 2 + skew); ctx.lineTo(W, cy - bh / 2 - skew); ctx.lineTo(W, cy + bh / 2 - skew); ctx.lineTo(0, cy + bh / 2 + skew); ctx.closePath();
  ctx.fillStyle = '#20306c'; ctx.fill();
  ctx.clip();
  const rnd = mulberry32(e.seed);
  for (let i = 0; i < 40; i++) {
    const y = cy - bh / 2 - skew + rnd() * (bh + skew * 2), len = 20 + rnd() * 70, sp = 260 + rnd() * 260;
    const x = ((rnd() * W * 2 - t * sp) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
    ctx.fillStyle = rnd() < 0.3 ? '#8fb0ff' : '#4e64b0'; ctx.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
  }
  ctx.fillStyle = '#ffd257';
  ctx.fillRect(0, Math.round(cy + bh / 2 - 6), W, 2);
  ctx.restore();
  // El boss sobresurt de la franja (més gran que abans: la franja feia que quedés petit).
  const size = fitRound(bh * 1.15);
  const bx = lerp(W + size, W * 0.72, easeOut(seg(t, 0.5, 1.2)));
  foes(ctx, e, bx, cy + bh / 2 - 8, size, t, { sil: t < 2.4 ? '#05070f' : null });
  flash(ctx, e, 1 - seg(t, 2.4, 2.7));
  const nx = lerp(-W * 0.6, W * 0.06, easeOut(seg(t, 0.7, 1.25)));
  const nm = e.name.slice(0, 14);
  const sc = Math.max(2, Math.floor(Math.min(W * 0.5 / measure(nm), 4)));
  text(ctx, wrap(say(e, 'trainer'), W * 0.6, 1)[0] ?? '', nx, cy - 26, { color: '#ffd257', scale: 1 });
  text(ctx, nm, nx, cy - 14, { kind: 'fancy', scale: sc, color: '#fff' });
  // La colla, petita, a baix a l'esquerra
  e.party.slice(0, 5).forEach((p, i) => hero(ctx, p, lerp(-40, 18 + i * 26, easeOut(seg(t, 1.1 + i * 0.08, 1.5 + i * 0.08))), H - 6, 24, t));
  if (t > 2.7) { const p = backOut(seg(t, 2.7, 3.0)); text(ctx, 'VS', W * 0.5, cy + bh / 2 + 6 - (1 - p) * 20, { kind: 'fancy', scale: 3, color: '#ff5a4a', align: 'center' }); }
};

/**
 * 3. Dragon Quest: pantalla negra, els monstres parpellegen en aparèixer i es juga un tros
 * de torn: el cursor tria MAGIA, repassa les màgies, torna enrere, tria LLUITAR i l'atac
 * no li fa ni pessigolles al boss.
 */
const quest: Scene = (ctx, t, e) => {
  const { W, H } = e;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const party = e.party.slice(0, 4);
  const lead = party[0] ? pixelText(party[0].name).split(' ')[0] : 'LA COLLA';
  // Finestra de la colla a dalt (només si n'hi ha): figureta i nom centrats a cada casella.
  const top = easeOut(seg(t, 0.1, 0.5));
  if (party.length && top > 0) {
    const n = party.length;
    const slot = Math.min(88, Math.floor((W - 28) / n));
    const chars = Math.max(2, Math.floor((slot - 32) / ADV));
    const pw = n * slot + 12, px = Math.round((W - pw) / 2), py = Math.round(lerp(-40, 6, top));
    panel(ctx, px, py, pw, 34);
    party.forEach((p, i) => {
      const nm = pixelText(p.name).split(' ')[0].slice(0, chars);
      const x0 = px + 6 + i * slot + Math.round((slot - (24 + 3 + measure(nm))) / 2);
      hero(ctx, p, x0 + 12, py + 29, 24, t);
      text(ctx, nm, x0 + 27, py + 14, { color: '#fff' });
    });
  }
  // Els monstres, en fila; parpellegen en aparèixer i en rebre el cop.
  const BH = 58, box = H - BH - 4;
  const room = box - 6 - (party.length ? 42 : 8);
  const size = fitSize(Math.min(H * 0.5, room) / 0.94), floor = box - 6;
  const hit = t > 7.75 && t < 8.25 && blink(t, 16);
  if (t > 0.5 && (t > 1.0 || blink(t, 14)) && !hit) foes(ctx, e, W / 2, floor, size, t, {}, true);
  if (t > 7.45 && t < 7.75) impact(ctx, Math.min(2, Math.floor((t - 7.45) / 0.1)), 0, W / 2, floor - size * 0.45, 96);
  if (t < 0.9) return;
  // Finestra de missatges (o, en triar, menú d'ordres a l'esquerra i missatge a la dreta).
  const menu = t >= 3.0 && t < 7.0;
  const mw = 86, mx = 8;
  const tx = menu ? mx + mw + 4 : 8;
  panel(ctx, tx, box, W - tx - 8, BH);
  let lines: string[], start: number;
  if (t < 3.0) {
    lines = wrap(say(e, 'quest'), W - 44);
    if (lines.length < 2) lines.push('QUE FAREU?');
    start = 1.0;
  } else if (t < 7.0) { lines = wrap(`QUE FARA ${lead}?`, W - tx - 30); start = 3.0; }
  else if (t < 8.4) { lines = wrap(`${lead} ATACA!`, W - 44); start = 7.0; }
  else { lines = wrap(`${e.name} NO S'IMMUTA!`, W - 44); start = 8.4; }
  // Amb el submenú de màgies obert, la finestra de màgies tapa el missatge.
  const sub = t > 4.4 && t < 6.1;
  const done = sub || sayLines(ctx, e, lines, tx + 12, box + 12, t, start, 13);
  // Fletxa de «continua» al marge de baix a l'esquerra.
  if (!menu && done && blink(t, 3)) downArrow(ctx, tx + 12, box + BH - 11);
  if (menu) {
    panel(ctx, mx, box, mw, BH);
    const cmds = ['LLUITAR', 'MAGIA', 'OBJECTE', 'FUGIR'];
    // Cursor: LLUITAR → MAGIA (la tria) → màgies → enrere → LLUITAR (la tria).
    const cur = t < 3.8 ? 0 : t < 6.3 ? 1 : 0;
    const chosen = t > 4.3 && t < 6.1 ? 1 : t > 6.7 ? 0 : -1;
    cmds.forEach((c, i) => text(ctx, c, mx + 18, box + 9 + i * 12, { color: i === chosen ? '#ffd257' : '#fff' }));
    if (chosen >= 0 || blink(t, 2.5)) text(ctx, '>', mx + 8, box + 9 + cur * 12);
    if (sub) {
      const sw = 70, sx = mx + mw + 4;
      panel(ctx, sx, box, sw, BH);
      const spells = ['FOC', 'GEL', 'LLAMP', 'CURAR'];
      const sc = t < 4.9 ? 0 : t < 5.3 ? 1 : t < 5.7 ? 2 : 3;
      spells.forEach((s, i) => text(ctx, s, sx + 18, box + 9 + i * 12));
      if (blink(t, 2.5)) text(ctx, '>', sx + 8, box + 9 + sc * 12);
    }
  }
};

// ── 4. Mirall trencat ────────────────────────────────────────────────────────

interface Shard { pts: [number, number][]; cx: number; cy: number; d: number; spin: number; tint: number }
const _glass = { key: '', shards: [] as Shard[], radial: [] as [number, number][][], rings: [] as [number, number][][] };
/** Esquerdes (radials + anells) i els vidres que formen, des del punt d'impacte. */
function glassFor(e: Env, ox: number, oy: number) {
  const key = `${e.W}x${e.H}:${e.seed}`;
  if (_glass.key === key) return _glass;
  const rnd = mulberry32(e.seed ^ 0x51);
  const N = 11, R = Math.hypot(e.W, e.H);
  const rings = [0.05, 0.13, 0.26, 0.45, 1.1].map(r => r * R);
  const P = Array.from({ length: N }, (_, i) => {
    const a = (i + 0.2 + rnd() * 0.6) / N * Math.PI * 2;
    return rings.map(r => {
      const aa = a + (rnd() - 0.5) * 0.2, rr = r * (0.88 + rnd() * 0.24);
      return [ox + Math.cos(aa) * rr, oy + Math.sin(aa) * rr] as [number, number];
    });
  });
  const shards: Shard[] = [];
  for (let i = 0; i < N; i++) {
    const A = P[i], B = P[(i + 1) % N];
    for (let j = 0; j < rings.length; j++) {
      const pts: [number, number][] = j === 0 ? [[ox, oy], A[0], B[0]] : [A[j - 1], A[j], B[j], B[j - 1]];
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      shards.push({ pts, cx, cy, d: Math.hypot(cx - ox, cy - oy) / R, spin: (rnd() - 0.5) * 4, tint: rnd() });
    }
  }
  Object.assign(_glass, {
    key, shards,
    radial: P.map(line => [[ox, oy] as [number, number], ...line]),
    rings: rings.slice(0, -1).map((_, j) => [...P.map(l => l[j]), P[0][j]]),
  });
  return _glass;
}
function polyline(ctx: CanvasRenderingContext2D, pts: [number, number][], upTo = Infinity) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && i - 1 < upTo; i++) {
    const f = Math.min(1, upTo - (i - 1));
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
  }
  ctx.stroke();
}

/**
 * 4. Mirall trencat: dos cops esquerden el mapa des del mig, el vidre esclata en trossos
 * que volen cap a la càmera i, darrere, el boss el travessa; queden vidres surant.
 */
const shatter: Scene = (ctx, t, e) => {
  const { W, H } = e;
  const ox = Math.round(W * 0.5), oy = Math.round(H * 0.46);
  const gl = glassFor(e, ox, oy);
  const size = fitSize(H * 0.72), floor = Math.round(H * 0.9);
  const BREAK = 1.35;
  if (t >= BREAK) {
    // Darrere del vidre: buit fosc amb llum vermella i el boss que el travessa
    const g = ctx.createRadialGradient(ox, oy, 4, ox, oy, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#4a0c1c'); g.addColorStop(0.45, '#18060e'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const step = easeOut(seg(t, BREAK, 2.4));
    foes(ctx, e, ox, floor - Math.round((1 - step) * 10), size, t, { sil: t < 2.35 ? '#f4e8ff' : null, alpha: seg(t, BREAK, BREAK + 0.35) });
  }
  if (t < BREAK) {
    // Dos cops: la pantalla tremola i les esquerdes creixen des del punt d'impacte
    const hit1 = t > 0.35 && t < 0.55, hit2 = t > 0.95 && t < 1.15;
    const shk = hit1 || hit2 ? Math.round(Math.sin(t * 90) * 2) : 0;
    ctx.save(); ctx.translate(shk, Math.round(shk * 0.5));
    snapOr(ctx, e, '#20283a');
    const grow = easeOut(seg(t, 0.35, 0.75)) * 1.6 + easeOut(seg(t, 0.95, 1.3)) * 3.4;
    ctx.lineWidth = 1;
    for (const line of gl.radial) {
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.save(); ctx.translate(1, 1); polyline(ctx, line, grow); ctx.restore();
      ctx.strokeStyle = '#ffffff'; polyline(ctx, line, grow);
    }
    gl.rings.forEach((ring, j) => {
      const a = seg(grow, j + 0.6, j + 1.2);
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,255,255,.85)'; polyline(ctx, ring); ctx.restore();
    });
    ctx.restore();
    if (hit1) impact(ctx, 3 + Math.min(2, Math.floor((t - 0.35) / 0.06)), 1, ox, oy, 72);
    if (hit2) impact(ctx, 3 + Math.min(2, Math.floor((t - 0.95) / 0.06)), 1, ox, oy, 96);
    flash(ctx, e, hit2 ? 0.35 * (1 - seg(t, 0.95, 1.1)) : 0);
  } else if (t < BREAK + 1.9) {
    // Esclat: cada vidre surt cap enfora i cap a la càmera, girant, i cau
    for (const s of gl.shards) {
      const q = seg(t, BREAK + s.d * 0.25, BREAK + 1.2 + s.d * 0.4);
      if (q >= 1) continue;
      const dx = s.cx - ox, dy = s.cy - oy, len = Math.hypot(dx, dy) || 1;
      const out = q * q * Math.max(W, H) * 0.55;
      ctx.save();
      ctx.globalAlpha = 1 - q * 0.9;
      ctx.translate(s.cx + dx / len * out, s.cy + dy / len * out + q * q * H * 0.35);
      ctx.rotate(s.spin * q);
      ctx.scale(1 + q * 1.3, 1 + q * 1.3);
      ctx.translate(-s.cx, -s.cy);
      ctx.beginPath(); s.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.save(); ctx.clip();
      if (e.snap) ctx.drawImage(e.snap, 0, 0); else { ctx.fillStyle = '#2a3040'; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = `rgba(200,220,255,${0.08 + s.tint * 0.14})`; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    flash(ctx, e, 0.7 * (1 - seg(t, BREAK, BREAK + 0.15)));
  }
  flash(ctx, e, t > 2.35 ? 1 - seg(t, 2.35, 2.6) : 0);
  // Vidres que es queden surant al voltant del boss
  if (t > 2.4) {
    const rnd = mulberry32(e.seed ^ 0x99);
    for (let i = 0; i < 9; i++) {
      const bx = rnd() * W, by = rnd() * H * 0.8, r = 3 + rnd() * 5, sp = 0.6 + rnd(), ph = rnd() * 6;
      const x = bx + Math.sin(t * sp + ph) * 4, y = by - ((t - 2.4) * 6 * sp) % H;
      const a = (t * sp + ph);
      ctx.save(); ctx.globalAlpha = seg(t, 2.4, 2.9) * 0.85;
      ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, r * 0.6); ctx.lineTo(-r * 0.8, r * 0.4); ctx.closePath();
      ctx.fillStyle = 'rgba(190,210,255,.35)'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }
  // Missatge i nom, amb una esquerda per subratllat
  if (t > 2.6) {
    const p = backOut(seg(t, 2.6, 3.0));
    text(ctx, wrap(say(e, 'shatter'), W - 20, 1)[0] ?? '', W / 2, 10, { align: 'center', color: '#c8b8ff' });
    const nm = e.name.slice(0, 16);
    const sc = Math.max(2, Math.min(3, Math.floor((W - 20) / Math.max(1, measure(nm)))));
    text(ctx, nm, W / 2, 22 - (1 - p) * 14, { kind: 'fancy', scale: sc, align: 'center', color: '#ffffff', shadow: '#3a0a1a' });
    const uw = (measure(nm) * sc + 10) * easeOut(seg(t, 3.0, 3.5)), uy = 22 + GLYPH * sc + 4;
    if (uw > 1) {
      const r2 = mulberry32(e.seed ^ 0x33);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= uw; x += 6) { const px = W / 2 - uw / 2 + x, py = uy + (r2() - 0.5) * 3; if (x) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    }
  }
};

/** 5. Chrono Trigger: la pantalla ondula, s'obre un portal i el boss en surt. */
const portal: Scene = (ctx, t, e) => {
  const { W, H } = e;
  const amp = 10 * seg(t, 0, 1.2) * (1 - seg(t, 4.2, 5.0));
  if (e.snap) {
    for (let y = 0; y < H; y += 2) ctx.drawImage(e.snap, 0, y, W, 2, Math.round(Math.sin(y * 0.14 + t * 9) * amp), y, W, 2);
  } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  flash(ctx, e, 0.8 * seg(t, 0.2, 1.4), '#05020c');
  const cx = W / 2, cy = H * 0.7;
  const open = easeOut(seg(t, 1.0, 2.2)) * (1 - easeIn(seg(t, 3.4, 4.0)));
  const R = Math.min(W, H) * (e.foes.length > 1 ? 0.42 : 0.3) * open;
  if (R > 1) {
    const cols = ['#2a0a4a', '#5a1a9a', '#9a4ae0', '#40c8ff', '#e8f8ff'];
    for (let k = cols.length - 1; k >= 0; k--) {
      const r = R * (0.35 + k * 0.16) * (1 + 0.04 * Math.sin(t * 6 + k));
      ctx.fillStyle = cols[(k + Math.floor(t * 8)) % cols.length];
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 10; i++) {
      const a = t * 2.4 + i * (Math.PI * 2 / 10);
      fx(ctx, 6 + (i + Math.floor(t * 10)) % 4, 2, cx + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 0.36, 16);
    }
  }
  // Els enemics pugen del portal (només la part de sobre de la vora)
  const rise = easeOut(seg(t, 1.9, 3.1));
  const size = fitSize(H * 0.52);
  if (rise > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cy + 2); ctx.clip();
    foes(ctx, e, cx, cy + size * (1 - rise), size, t, { sil: t < 2.9 ? '#e8f8ff' : null });
    ctx.restore();
    if (t > 3.1) foes(ctx, e, cx, cy, size, t);
  }
  flash(ctx, e, 1 - seg(t, 2.9, 3.2));
  if (t > 3.3) {
    const p = backOut(seg(t, 3.3, 3.7));
    text(ctx, wrap(say(e, 'portal'), W - 20, 1)[0] ?? '', cx, H * 0.12, { align: 'center', color: '#9fd8ff' });
    text(ctx, e.name.slice(0, 16), cx, H * 0.12 + 12 + (1 - p) * -16, { kind: 'fancy', scale: 2, align: 'center', color: '#fff' });
  }
};

/** 6. EarthBound: fons de franges ondulants que canvien de color, boss al mig i caixa de text. */
const _psy = { data: null as ImageData | null };
const psyche: Scene = (ctx, t, e) => {
  const { W, H } = e;
  if (!_psy.data || _psy.data.width !== W || _psy.data.height !== H) _psy.data = ctx.createImageData(W, H);
  const d = _psy.data.data;
  const pal = [[40, 8, 70], [120, 20, 120], [230, 80, 140], [250, 180, 60], [60, 200, 160], [30, 90, 200]];
  const shift = t * 7;
  for (let y = 0; y < H; y++) {
    const layerB = y & 1;   // dues capes entrellaçades (fila sí, fila no), com al joc
    const off = layerB ? Math.sin(y * 0.09 + t * 2.4) * 24 : Math.sin(y * 0.05 - t * 1.7) * 36;
    for (let x = 0; x < W; x++) {
      const v = layerB ? (x + off + y * 0.5) / 10 + shift : (x - off) / 14 + Math.sin(y * 0.07 + t) * 2 - shift;
      const c = pal[((Math.floor(v) % pal.length) + pal.length) % pal.length];
      const i = (y * W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(_psy.data, 0, 0);
  const a = seg(t, 0, 0.5);
  if (a < 1) { ctx.save(); ctx.globalAlpha = 1 - a; snapOr(ctx, e); ctx.restore(); }
  const size = fitSize(H * 0.5);
  foes(ctx, e, W / 2, H * 0.78 + Math.round(Math.sin(t * 3) * 3), size, t, { alpha: seg(t, 0.6, 1.0) });
  if (t > 1.0) {
    // Caixa de text d'EarthBound: negra amb doble vora blanca
    const bx = 14, by = 10, bw = W - 28, bh = 38;
    ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3); ctx.strokeRect(bx + 4.5, by + 4.5, bw - 9, bh - 9);
    sayLines(ctx, e, wrap(say(e, 'psyche'), bw - 24), bx + 12, by + 10, t, 1.1);
  }
};

/** 7. Mega Man: alarma «WARNING», teletransport del boss i barra de vida vertical que s'omple. */
const warning: Scene = (ctx, t, e) => {
  const { W, H } = e;
  snapOr(ctx, e);
  flash(ctx, e, 0.55, '#000');
  if (t < 2.8) flash(ctx, e, 0.18 + 0.16 * Math.sin(t * 14), '#ff1010');
  // Franges d'alarma a dalt i a baix
  const band = (y: number, dir: number) => {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, 14); ctx.clip();
    ctx.fillStyle = '#ffd400'; ctx.fillRect(0, y, W, 14);
    ctx.fillStyle = '#111';
    const off = (t * 50 * dir) % 20;
    for (let x = -40; x < W + 40; x += 20) {
      ctx.beginPath(); ctx.moveTo(x + off, y + 14); ctx.lineTo(x + off + 10, y); ctx.lineTo(x + off + 20, y); ctx.lineTo(x + off + 10, y + 14); ctx.fill();
    }
    ctx.restore();
  };
  const bin = easeOut(seg(t, 0, 0.3)) * (1 - seg(t, 2.6, 3.0));
  if (bin > 0) { band(lerp(-14, H * 0.3, bin), 1); band(lerp(H, H * 0.62, bin), -1); }
  if (t < 2.6 && blink(t, 4)) text(ctx, 'WARNING', W / 2, H * 0.46 - 14, { kind: 'fancy', scale: 4, align: 'center', color: '#ff3a2a' });
  // Teletransport: un raig de llum per enemic i cadascun es materialitza de baix a dalt
  const cx = W * 0.58, floor = H * 0.86, size = fitSize(H * 0.55);
  if (t > 2.6) {
    const down = easeIn(seg(t, 2.6, 2.9)), fade = 1 - seg(t, 3.5, 3.9);
    const slots = foeSlots(e, cx, floor, size);
    for (const s of slots) {
      const bw = s.size >= 96 ? 14 : 10;
      if (fade > 0) {
        ctx.save(); ctx.globalAlpha = fade;
        ctx.fillStyle = '#40d0ff'; ctx.fillRect(Math.round(s.x - bw / 2), 0, bw, Math.round(s.y * down));
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(s.x - bw / 4), 0, Math.round(bw / 2), Math.round(s.y * down));
        ctx.restore();
      }
      const rv = seg(t, 2.9 + s.k * 0.08, 3.6 + s.k * 0.08);
      if (rv > 0) drawFoe(ctx, e, s.f, s.x, s.y, s.size, t, s.k, { reveal: rv, sil: rv < 1 ? '#bfefff' : null });
    }
  }
  // Barra de vida vertical (s'omple a cops)
  if (t > 3.5) {
    const segs = 28, filled = Math.min(segs, Math.floor((t - 3.6) / 0.035));
    const left = Math.min(...foeSlots(e, cx, floor, size).map(s => s.x - s.size / 2));
    const bx = Math.max(4, Math.round(left - 18)), by = Math.round(floor - segs * 4 - 6);
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, by - 2, 12, segs * 4 + 4);
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i < filled ? (i % 2 ? '#ffe9a0' : '#ffd040') : '#3a2a18';
      ctx.fillRect(bx, by + (segs - 1 - i) * 4, 8, 3);
    }
    text(ctx, typed(e.name, t, 3.7, 20), cx, floor + 6, { align: 'center', color: '#fff' });
  }
};

/** 8. Street Fighter: pantalla partida, la colla contra el boss i un «VS» que esclata. */
const versus: Scene = (ctx, t, e) => {
  const { W, H } = e;
  const inL = easeOut(seg(t, 0, 0.45)), inR = easeOut(seg(t, 0.1, 0.55));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // Meitats inclinades
  ctx.save(); ctx.translate(lerp(-W, 0, inL), 0);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.56, 0); ctx.lineTo(W * 0.44, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = '#1f3a8c'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(lerp(W, 0, inR), 0);
  ctx.beginPath(); ctx.moveTo(W * 0.56, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.44, H); ctx.closePath();
  ctx.fillStyle = '#8c1f22'; ctx.fill(); ctx.restore();
  const rnd = mulberry32(e.seed);
  for (let i = 0; i < 26; i++) {
    const y = rnd() * H, len = 10 + rnd() * 40, left = rnd() < 0.5, sp = 200 + rnd() * 200;
    const x = left ? ((rnd() * W - t * sp) % (W * 0.5) + W * 0.5) % (W * 0.5) : W * 0.5 + ((rnd() * W + t * sp) % (W * 0.5));
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
  }
  // La colla a l'esquerra, els enemics (grans) a la dreta
  const hs = fitSize(H * 0.3);
  e.party.slice(0, 4).forEach((p, i) => hero(ctx, p, lerp(-60, W * 0.1 + i * hs * 0.55, easeOut(seg(t, 0.3 + i * 0.06, 0.8 + i * 0.06))), H * 0.5 + (i % 2) * hs * 0.5 + hs * 0.6, hs, t));
  const bs = fitSize(H * 0.78);
  foes(ctx, e, lerp(W + bs, W * 0.76, easeOut(seg(t, 0.4, 0.9))), H * 0.93, bs, t, { flip: true });
  // VS
  if (t > 1.1) {
    const p = seg(t, 1.1, 1.35), sc = Math.round(lerp(9, 5, easeOut(p)));
    const shake = t < 1.5 ? Math.round(Math.sin(t * 80) * 2) : 0;
    impact(ctx, 3 + Math.min(2, Math.floor((t - 1.1) / 0.08)), 1, W / 2, H * 0.45, 96);
    text(ctx, 'VS', W / 2 + shake, H * 0.45 - sc * 3.5, { kind: 'fancy', scale: sc, align: 'center', color: '#ffd257', shadow: '#5a0000' });
  }
  if (t > 1.5) {
    text(ctx, typed('LA COLLA', t, 1.5, 20), 10, H - 14, { color: '#bcd0ff' });
    text(ctx, typed(e.group.length <= 18 ? e.group : e.name, t, 1.6, 20), W - 10, H - 14, { align: 'right', color: '#ffc0b0' });
  }
};

/** 9. Zelda: franges de cinema, el boss entra i el nom cau lletra a lletra sobre una cinta. */
const title: Scene = (ctx, t, e) => {
  const { W, H } = e;
  snapOr(ctx, e);
  flash(ctx, e, 0.45 * seg(t, 0, 0.4), '#000');
  const lb = Math.round(H * 0.16 * easeOut(seg(t, 0, 0.4)));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb);
  const size = fitSize(H * 0.6);
  // Peus una mica per sobre de la franja de baix (no enganxats a terra).
  foes(ctx, e, lerp(W + size, W * 0.72, easeOut(seg(t, 0.4, 1.0))), H - lb - Math.round(H * 0.08), size, t);
  if (t > 0.9) {
    const rw = W * 0.62, rx = lerp(-rw, -6, easeOut(seg(t, 0.9, 1.25))), ry = H * 0.42;
    panel(ctx, rx, ry, rw, 44);
    text(ctx, wrap(say(e, 'title'), rw - 30, 1)[0] ?? '', rx + 16, ry + 8, { color: '#9fd8ff' });
    const nm = pixelText(e.name).slice(0, 14);
    const sc = Math.max(2, Math.min(3, Math.floor((rw - 30) / Math.max(1, measure(nm)))));
    let x = rx + 16;
    for (let i = 0; i < nm.length; i++) {
      const p = backOut(seg(t, 1.3 + i * 0.07, 1.6 + i * 0.07));
      if (p > 0 && nm[i] !== ' ') text(ctx, nm[i], x, ry + 20 - (1 - p) * 24, { kind: 'fancy', scale: sc, color: '#ffe07a' });
      x += (nm[i] === ' ' ? 5 : ADV) * sc;
    }
    const rnd = mulberry32(e.seed);
    for (let i = 0; i < 6; i++) {
      const tt = (t * 1.3 + rnd()) % 1;
      fx(ctx, Math.min(5, Math.floor(tt * 6)), 3, rx + 16 + rnd() * (x - rx - 16), ry + 16 + rnd() * 24, 16);
    }
  }
};

/** 10. Souls: tremolor, pols que cau, una silueta enorme que s'aixeca i es fa visible; nom i barra llarga. */
const shadow: Scene = (ctx, t, e) => {
  const { W, H } = e;
  const shake = t > 0.6 && t < 2.6 ? Math.round(Math.sin(t * 47) * 2 * (1 - seg(t, 2.0, 2.6))) : 0;
  ctx.save(); ctx.translate(shake, Math.round(Math.cos(t * 39) * Math.abs(shake) * 0.5));
  snapOr(ctx, e);
  ctx.restore();
  flash(ctx, e, 0.85 * seg(t, 0, 1.0), '#050305');
  const rnd = mulberry32(e.seed);
  if (t > 0.6 && t < 3.0) for (let i = 0; i < 60; i++) {
    const x = rnd() * W, sp = 30 + rnd() * 60, y = ((rnd() * H + (t - 0.6) * sp) % H);
    ctx.fillStyle = rnd() < 0.5 ? '#6a6058' : '#3a342e'; ctx.fillRect(Math.round(x), Math.round(y), 1, rnd() < 0.3 ? 2 : 1);
  }
  const size = fitSize(H * 0.82), cx = W / 2, floor = H * 0.86;
  const rise = easeOut(seg(t, 1.2, 2.6));
  if (rise > 0) {
    const y = lerp(floor + size, floor, rise);
    for (const s of foeSlots(e, cx, y, size)) {
      drawFoe(ctx, e, s.f, s.x + 1, s.y, s.size, t, s.k, { sil: '#5a0808', alpha: 0.6 + 0.4 * Math.sin(t * 5) });   // aura vermella fosca
      drawFoe(ctx, e, s.f, s.x, s.y, s.size, t, s.k, { sil: '#000000' });
      const fill = seg(t, 2.8, 3.8);
      if (fill > 0) drawFoe(ctx, e, s.f, s.x, s.y, s.size, t, s.k, { reveal: fill, fromTop: true });
    }
  }
  if (t > 3.6) {
    const a = seg(t, 3.6, 4.0);
    ctx.save(); ctx.globalAlpha = a;
    text(ctx, e.name.slice(0, 20), W / 2, H - 34, { scale: 2, align: 'center', color: '#e8e0d0' });
    ctx.restore();
    hpBar(ctx, W * 0.12, H - 14, W * 0.76, seg(t, 3.9, 4.6), 'red', 8);
  }
};

const SCENES: Record<PixelIntroId, Scene> = { wild, trainer, quest, shatter, portal, psyche, warning, versus, title, shadow };

/** Captura del que es veu a l'escenari (fons i canvas), a la resolució virtual. */
function snapshotStage(stage: HTMLElement, W: number, H: number, P: number): HTMLCanvasElement | null {
  try {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const sr = stage.getBoundingClientRect();
    for (const el of Array.from(stage.querySelectorAll('img, video, canvas')) as HTMLElement[]) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
      g.drawImage(el as CanvasImageSource, (r.left - sr.left) / P, (r.top - sr.top) / P, r.width / P, r.height / P);
    }
    return c;
  } catch { return null; }   // un vídeo d'un altre origen no es pot capturar: es fa sense
}

export function playPixelIntro(o: PixelIntroOptions): BossIntro {
  const def = PIXEL_INTROS.find(p => p.id === o.style) ?? PIXEL_INTROS[0];
  const scene = SCENES[def.id];
  const SW = o.stage.clientWidth || window.innerWidth, SH = o.stage.clientHeight || window.innerHeight;
  // Mida del píxel: la pantalla virtual fa uns 200 px d'alt.
  const P = Math.max(2, Math.round(SH / 200));
  const W = Math.ceil(SW / P), H = Math.ceil(SH / P);
  const snap = snapshotStage(o.stage, W, H, P);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.style.cssText = `position:absolute;left:0;top:0;width:${W * P}px;height:${H * P}px;image-rendering:pixelated;pointer-events:none;z-index:60;transition:none`;
  o.stage.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const all: Foe[] = [
    { name: o.bossName || 'BOSS', sprite: o.sprite, img: o.portrait },
    ...(o.extras ?? []).slice(0, MAX_FOES - 1).map(f => ({ name: f.name || '?', sprite: f.sprite ?? null, img: f.img ?? null })),
  ];
  const env: Env = {
    W, H, name: pixelText(o.bossName || 'BOSS'), foes: all, group: groupName(all.map(f => pixelText(f.name))),
    message: o.message?.trim() || null, party: o.party, seed: o.seed, snap, tmp: document.createElement('canvas'),
  };
  const FADE = 0.45;
  let start: number | null = null, done = false, camEnded = false;
  const finish = () => {
    if (done) return;
    done = true;
    cv.remove();
    if (!camEnded) { camEnded = true; o.onCamEnd?.(); }
    o.onDone?.();
  };
  return {
    tick(now: number) {
      if (done) return;
      if (start === null) start = now - (o.offsetMs ?? 0);
      const t = (now - start) / 1000;
      if (!camEnded && t > def.dur - 0.8) { camEnded = true; o.onCamEnd?.(); }
      if (t >= def.dur) { finish(); return; }
      cv.style.opacity = String(clamp01((def.dur - t) / FADE));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      scene(ctx, t, env);
    },
    skip() {
      if (done) return;
      const now = performance.now();
      const t = start === null ? 0 : (now - start) / 1000;
      if (t < def.dur - FADE) start = now - (def.dur - FADE) * 1000;
    },
    dispose() { if (!done) { done = true; cv.remove(); } },
    get done() { return done; },
  };
}
