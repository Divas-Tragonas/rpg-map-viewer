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
import { mulberry32 } from '@/lib/render/fxsprites';
import type { BossIntro } from './bossIntro';

export type PixelIntroId =
  | 'wild' | 'quest' | 'warning' | 'versus' | 'shatter'
  | 'portal' | 'psyche' | 'trainer' | 'shadow' | 'title';

/** Catàleg (ordre del selector). `hint`: d'on ve la idea, en una línia. */
export const PIXEL_INTROS: { id: PixelIntroId; label: string; hint: string; dur: number }[] = [
  { id: 'wild',    label: 'Encontre salvatge', hint: 'Pokémon: flaixos, franges i combat',          dur: 5.6 },
  { id: 'trainer', label: 'Repte del líder',   hint: 'Pokémon: franja amb línies de velocitat',     dur: 5.2 },
  { id: 'quest',   label: 'Apareix un monstre', hint: 'Dragon Quest: finestres i menú de combat',   dur: 5.2 },
  { id: 'shatter', label: 'Vidre trencat',     hint: 'Final Fantasy: la pantalla esclata a trossos', dur: 5.6 },
  { id: 'portal',  label: 'Portal del temps',  hint: 'Chrono Trigger: ona, portal i aparició',      dur: 5.8 },
  { id: 'psyche',  label: 'Fons psicodèlic',   hint: 'EarthBound: fons ondulant de colors',         dur: 5.2 },
  { id: 'warning', label: 'WARNING',           hint: 'Mega Man: alarma, teletransport i barra',     dur: 5.4 },
  { id: 'versus',  label: 'Versus',            hint: 'Street Fighter: la colla contra el boss',     dur: 5.0 },
  { id: 'title',   label: 'Rètol del boss',    hint: 'Zelda: franges de cinema i nom que cau',      dur: 5.2 },
  { id: 'shadow',  label: "L'ombra",           hint: 'Souls: terratrèmol, silueta i barra llarga',  dur: 6.0 },
];
/** Estil d'una cinemàtica de boss: la de sempre o una de les de pixel art. */
export type BossIntroStyle = 'classic' | PixelIntroId;
export const isPixelIntro = (s: unknown): s is PixelIntroId => PIXEL_INTROS.some(p => p.id === s);

export interface PixelIntroOptions {
  stage: HTMLElement;
  style: PixelIntroId;
  bossName: string;
  /** Criatura del paquet Oryx (si el token en té). */
  sprite: string | null;
  /** Sense figureta: el retrat (o la imatge del token), ampliat. */
  portrait: HTMLCanvasElement | HTMLImageElement | null;
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
const FONT_X = 584, ADV = 8, GLYPH = 7;
const SYMBOLS = '1234567890!#$%&*()-+=[]:;"\'<>.,?/';
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
      if (sh) ctx.drawImage(sh, g[0], g[1], GLYPH, GLYPH, cx + scale, y0 + scale, GLYPH * scale, GLYPH * scale);
      ctx.drawImage(fg, g[0], g[1], GLYPH, GLYPH, cx, y0, GLYPH * scale, GLYPH * scale);
    }
    cx += ADV * scale;
  }
}

// ── Finestra fosca i barres de vida del full d'interfície ────────────────────
/** Finestra (9 trossos de la finestra fosca del full, x 8, y 88, 72×32). */
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const img = sheet('interface');
  if (!img || w < 16 || h < 16) {
    ctx.fillStyle = '#1b1d2e'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#9aa0b4'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    return;
  }
  const SX = 8, SY = 88, SW = 72, SH = 32, c = 8, m = 16;
  ctx.drawImage(img, SX, SY, c, c, x, y, c, c);
  ctx.drawImage(img, SX + SW - c, SY, c, c, x + w - c, y, c, c);
  ctx.drawImage(img, SX, SY + SH - c, c, c, x, y + h - c, c, c);
  ctx.drawImage(img, SX + SW - c, SY + SH - c, c, c, x + w - c, y + h - c, c, c);
  ctx.drawImage(img, SX + c, SY, m, c, x + c, y, w - 2 * c, c);
  ctx.drawImage(img, SX + c, SY + SH - c, m, c, x + c, y + h - c, w - 2 * c, c);
  ctx.drawImage(img, SX, SY + c, c, m, x, y + c, c, h - 2 * c);
  ctx.drawImage(img, SX + SW - c, SY + c, c, m, x + w - c, y + c, c, h - 2 * c);
  ctx.drawImage(img, SX + c, SY + c, m, m, x + c, y + c, w - 2 * c, h - 2 * c);
}
/** Barra de vida del full (blava, vermella o verda), estirada a `w` i plena fins a `frac`. */
function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: 'blue' | 'red' | 'green', h = 12) {
  const img = sheet('interface');
  x = Math.round(x); y = Math.round(y); w = Math.round(w);
  if (!img) { ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, 6); ctx.fillStyle = '#e33'; ctx.fillRect(x, y, w * frac, 6); return; }
  const off = color === 'blue' ? 0 : color === 'red' ? 168 : 336, cap = 4, BW = 52;
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

interface Env {
  W: number; H: number;
  name: string;
  sprite: string | null;
  portrait: HTMLCanvasElement | HTMLImageElement | null;
  party: { name: string; sprite?: string }[];
  seed: number;
  /** La pantalla tal com era en començar (a la resolució virtual), o null. */
  snap: HTMLCanvasElement | null;
  /** Llenç auxiliar per a siluetes. */
  tmp: HTMLCanvasElement;
}

/** Mida de figura que encaixa (múltiple de 48, almenys 48). */
const fitSize = (maxPx: number) => Math.max(48, Math.floor(maxPx / 48) * 48);

/**
 * El boss amb els peus a (x, y). `sil` → silueta d'aquest color; `reveal` (0..1) → només
 * se'n veu la part de sota (sortint de terra, d'un portal…); `fromTop` → la revelació va
 * de dalt a baix (la silueta s'omple de color).
 */
function boss(ctx: CanvasRenderingContext2D, e: Env, x: number, y: number, size: number, t: number,
  o: { sil?: string | null; alpha?: number; flip?: boolean; reveal?: number; fromTop?: boolean } = {}) {
  const tc = e.tmp; tc.width = size; tc.height = size;
  const g = tc.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, size, size);
  if (e.sprite && hasCreature(e.sprite)) {
    drawCreature(g, e.sprite, creatureFrame(t * 1000, 1.3), 0, 0, size, o.flip);
  } else if (e.portrait) {
    const pw = (e.portrait as HTMLCanvasElement).width || (e.portrait as HTMLImageElement).naturalWidth || 1;
    const ph = (e.portrait as HTMLCanvasElement).height || (e.portrait as HTMLImageElement).naturalHeight || 1;
    const k = Math.min(size / pw, size / ph);
    g.drawImage(e.portrait, (size - pw * k) / 2, size - ph * k, pw * k, ph * k);
  } else {
    g.fillStyle = '#c33'; g.fillRect(size * 0.2, size * 0.1, size * 0.6, size * 0.85);
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(size * 0.5)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(pixelText(e.name).slice(0, 1), size / 2, size / 2);
  }
  if (o.sil) { g.globalCompositeOperation = 'source-in'; g.fillStyle = o.sil; g.fillRect(0, 0, size, size); g.globalCompositeOperation = 'source-over'; }
  const dx = Math.round(x - size / 2), dy = Math.round(y - size * 0.94);
  const rv = o.reveal ?? 1;
  if (rv <= 0) return;
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
  ctx.fillStyle = '#f0e8c8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e4d8b0';
  for (let y = 0; y < H * 0.6; y += 6) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = '#c8e0a0'; ctx.fillRect(0, Math.round(H * 0.6), W, H);
  const plat = (cx: number, cy: number, rx: number) => {
    ctx.fillStyle = '#7fb060'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c8c48'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, rx, rx * 0.2, 0, 0, Math.PI); ctx.fill();
  };
  const ex = W * 0.7, ey = H * 0.5;
  plat(ex, ey, Math.min(80, W * 0.18)); plat(W * 0.26, H * 0.78, Math.min(90, W * 0.2));
  const pIn = easeOut(seg(t, 1.35, 2.15));
  const size = fitSize(H * 0.45);
  const cry = t > 2.7 && t < 3.1 ? Math.round(Math.sin(t * 60) * 2) : 0;
  boss(ctx, e, lerp(-size, ex, pIn) + cry, ey + 4, size, t, { sil: t < 2.2 ? '#303030' : null });
  const lead = e.party[0];
  if (lead) hero(ctx, lead, lerp(W + size, W * 0.26, pIn), H * 0.8, fitSize(H * 0.34), t, true, t < 2.2 ? '#303030' : undefined);
  flash(ctx, e, 1 - seg(t, 2.2, 2.45));
  // Requadre d'estat del boss
  const pw = Math.min(170, W * 0.42), sx = lerp(-pw - 10, 8, easeOut(seg(t, 2.3, 2.6)));
  panel(ctx, sx, 8, pw, 40);
  text(ctx, e.name.slice(0, 16), sx + 8, 15, { color: '#fff' });
  text(ctx, 'NV.??', sx + pw - 8, 15, { align: 'right', color: '#ffd257' });
  text(ctx, 'PV', sx + 8, 29, { color: '#ffd257' });
  hpBar(ctx, sx + 26, 26, pw - 36, seg(t, 2.6, 3.2), 'green', 10);
  // Caixa de text
  if (t > 2.4) {
    panel(ctx, 4, H - 50, W - 8, 46);
    const msg = `HA APAREGUT ${e.name}!`;
    text(ctx, typed(msg, t, 2.5, 24), 16, H - 38, { color: '#fff' });
    if (t > 2.5 + msg.length / 24 && blink(t, 3)) text(ctx, '>', W - 20, H - 18, { color: '#ffd257' });
  }
};

/** 2. Pokémon: repte d'un líder. Franja diagonal amb línies de velocitat, silueta i nom. */
const trainer: Scene = (ctx, t, e) => {
  const { W, H } = e;
  snapOr(ctx, e); flash(ctx, e, Math.min(1, t / 0.25) * 0.9, '#000');
  const cy = H * 0.48, bh = H * 0.42, slide = easeOut(seg(t, 0.15, 0.5));
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
  const size = fitSize(bh * 1.05);
  const bx = lerp(W + size, W * 0.72, easeOut(seg(t, 0.4, 1.0)));
  boss(ctx, e, bx, cy + bh / 2 - 8, size, t, { sil: t < 2.0 ? '#05070f' : null });
  flash(ctx, e, 1 - seg(t, 2.0, 2.3));
  const nx = lerp(-W * 0.6, W * 0.06, easeOut(seg(t, 0.6, 1.1)));
  const sc = Math.max(2, Math.floor(Math.min(W * 0.5 / measure(e.name.slice(0, 14)), 4)));
  text(ctx, 'REPTE DE', nx, cy - 26, { color: '#ffd257', scale: 1 });
  text(ctx, e.name.slice(0, 14), nx, cy - 14, { kind: 'fancy', scale: sc, color: '#fff' });
  // La colla, petita, a baix a l'esquerra
  e.party.slice(0, 5).forEach((p, i) => hero(ctx, p, lerp(-40, 18 + i * 26, easeOut(seg(t, 1.0 + i * 0.08, 1.4 + i * 0.08))), H - 6, 24, t));
  if (t > 2.3) { const p = backOut(seg(t, 2.3, 2.6)); text(ctx, 'VS', W * 0.5, cy + bh / 2 + 6 - (1 - p) * 20, { kind: 'fancy', scale: 3, color: '#ff5a4a', align: 'center' }); }
};

/** 3. Dragon Quest: pantalla negra, el monstre parpelleja, finestres i menú de combat. */
const quest: Scene = (ctx, t, e) => {
  const { W, H } = e;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // Finestra de la colla a dalt
  const top = easeOut(seg(t, 0.1, 0.5));
  if (top > 0) {
    const n = Math.min(4, e.party.length);
    // Cada membre: figureta + primer nom, retallat perquè no trepitgi el del costat.
    const slot = Math.min(84, Math.floor((W - 28) / Math.max(1, n)));
    const chars = Math.max(2, Math.floor((slot - 28) / ADV));
    const pw = n * slot + 12;
    panel(ctx, (W - pw) / 2, lerp(-40, 6, top), pw, 34);
    e.party.slice(0, 4).forEach((p, i) => {
      const x = (W - pw) / 2 + 8 + i * slot;
      hero(ctx, p, x + 8, lerp(-40, 6, top) + 30, 24, t);
      text(ctx, pixelText(p.name).split(' ')[0].slice(0, chars), x + 22, lerp(-40, 6, top) + 13, { color: '#fff' });
    });
  }
  // El monstre parpelleja en aparèixer
  const size = fitSize(H * 0.5);
  const on = t > 0.5 && (t > 1.0 || blink(t, 14));
  if (on) boss(ctx, e, W / 2, H * 0.66, size, t);
  // Finestra de missatges
  if (t > 0.9) {
    const by = H - 56;
    panel(ctx, 8, by, W - 16, 50);
    const l1 = `APAREIX ${e.name}!`;
    text(ctx, typed(l1, t, 1.0, 22), 20, by + 12);
    if (t > 2.4) text(ctx, typed('QUE FAREU?', t, 2.4, 22), 20, by + 28);
    if (t > 3.2 && blink(t, 3)) text(ctx, '>', W / 2, by + 40, { align: 'center', color: '#fff' });
  }
  // Menú de combat
  if (t > 3.0) {
    const mx = W - 92, my = H - 128;
    panel(ctx, mx, my, 82, 66);
    ['LLUITAR', 'MAGIA', 'OBJECTE', 'FUGIR'].forEach((s, i) => text(ctx, s, mx + 18, my + 10 + i * 13));
    if (blink(t, 2.5)) text(ctx, '>', mx + 8, my + 10, { color: '#ffd257' });
  }
};

/** 4. Final Fantasy: la pantalla es trenca en vidres que giren i cauen; el boss surt del blanc. */
const shatter: Scene = (ctx, t, e) => {
  const { W, H } = e;
  // Fons de combat: cel de nit amb estrelles i terra
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b0f2a'); sky.addColorStop(0.62, '#2b1e4e'); sky.addColorStop(0.63, '#1a2a1c'); sky.addColorStop(1, '#0d1610');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const rnd = mulberry32(e.seed ^ 77);
  for (let i = 0; i < 60; i++) { const x = rnd() * W, y = rnd() * H * 0.6; if (blink(t + rnd(), 2)) { ctx.fillStyle = '#c8d0ff'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); } }
  if (t > 1.7) boss(ctx, e, W * 0.32, H * 0.72, fitSize(H * 0.55), t, { sil: t < 2.3 ? '#ffffff' : null, alpha: seg(t, 1.7, 2.0) });
  flash(ctx, e, 1 - seg(t, 2.25, 2.6));
  // Vidres
  if (t < 2.0 && e.snap) {
    const cols = 10, rows = 7, cw = W / cols, ch = H / rows, p = seg(t, 0.25, 1.9);
    const r2 = mulberry32(e.seed);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const vx = (r2() - 0.5) * 220, vy = -40 - r2() * 80, rot = (r2() - 0.5) * 6, delay = r2() * 0.25;
      const q = clamp01((p - delay) / (1 - delay));
      const x = i * cw + cw / 2 + vx * q, y = j * ch + ch / 2 + vy * q + 420 * q * q;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot * q); ctx.globalAlpha = 1 - q * 0.3;
      ctx.drawImage(e.snap, i * cw, j * ch, cw, ch, -cw / 2, -ch / 2, cw, ch);
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.strokeRect(-cw / 2 + 0.5, -ch / 2 + 0.5, cw - 1, ch - 1);
      ctx.restore();
    }
  }
  flash(ctx, e, t < 0.25 ? 1 - t / 0.25 : 0);
  // Finestres blaves de combat (FF): enemic a l'esquerra, la colla amb PV a la dreta
  if (t > 2.4) {
    const by = H - 54, a = easeOut(seg(t, 2.4, 2.7));
    ctx.save(); ctx.globalAlpha = a;
    panel(ctx, 6, by, W * 0.38, 48);
    text(ctx, e.name.slice(0, 12), 16, by + 12, { color: '#fff' });
    panel(ctx, W * 0.38 + 10, by, W * 0.62 - 16, 48);
    e.party.slice(0, 3).forEach((p, i) => {
      text(ctx, p.name.slice(0, 9), W * 0.38 + 20, by + 8 + i * 13, { color: '#fff' });
      hpBar(ctx, W * 0.38 + 100, by + 7 + i * 13, Math.max(30, W * 0.62 - 126), 1, 'blue', 8);
    });
    ctx.restore();
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
  const R = Math.min(W, H) * 0.3 * open;
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
  // El boss puja del portal (només la part de sobre de la vora)
  const rise = easeOut(seg(t, 1.9, 3.1));
  const size = fitSize(H * 0.52);
  if (rise > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cy + 2); ctx.clip();
    boss(ctx, e, cx, cy + size * (1 - rise), size, t, { sil: t < 2.9 ? '#e8f8ff' : null });
    ctx.restore();
    if (t > 3.1) boss(ctx, e, cx, cy, size, t);
  }
  flash(ctx, e, 1 - seg(t, 2.9, 3.2));
  if (t > 3.3) {
    const p = backOut(seg(t, 3.3, 3.7));
    text(ctx, 'DES D\'UNA ALTRA ERA...', cx, H * 0.12, { align: 'center', color: '#9fd8ff' });
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
  boss(ctx, e, W / 2, H * 0.78 + Math.round(Math.sin(t * 3) * 3), size, t, { alpha: seg(t, 0.6, 1.0) });
  if (t > 1.0) {
    // Caixa de text d'EarthBound: negra amb doble vora blanca
    const bx = 14, by = 10, bw = W - 28, bh = 38;
    ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3); ctx.strokeRect(bx + 4.5, by + 4.5, bw - 9, bh - 9);
    text(ctx, typed(`T'HAS TROBAT AMB`, t, 1.1, 24), bx + 12, by + 10, { shadow: null });
    if (t > 1.8) text(ctx, typed(`${e.name}!`, t, 1.8, 24), bx + 12, by + 22, { shadow: null, color: '#ffd257' });
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
  // Teletransport: raig de llum que baixa i el boss que es materialitza de baix a dalt
  const cx = W * 0.58, floor = H * 0.86, size = fitSize(H * 0.55);
  if (t > 2.6) {
    const down = easeIn(seg(t, 2.6, 2.9)), fade = 1 - seg(t, 3.5, 3.9);
    if (fade > 0) {
      ctx.save(); ctx.globalAlpha = fade;
      ctx.fillStyle = '#40d0ff'; ctx.fillRect(Math.round(cx - 7), 0, 14, Math.round(floor * down));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(cx - 3), 0, 6, Math.round(floor * down));
      ctx.restore();
    }
    const rv = seg(t, 2.9, 3.6);
    if (rv > 0) boss(ctx, e, cx, floor, size, t, { reveal: rv, sil: t < 3.6 ? '#bfefff' : null });
  }
  // Barra de vida vertical (s'omple a cops)
  if (t > 3.5) {
    const segs = 28, filled = Math.min(segs, Math.floor((t - 3.6) / 0.035));
    const bx = Math.round(cx - size / 2 - 22), by = Math.round(floor - segs * 4 - 6);
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
  // La colla a l'esquerra, el boss a la dreta
  const hs = fitSize(H * 0.3);
  e.party.slice(0, 4).forEach((p, i) => hero(ctx, p, lerp(-60, W * 0.1 + i * hs * 0.55, easeOut(seg(t, 0.3 + i * 0.06, 0.8 + i * 0.06))), H * 0.5 + (i % 2) * hs * 0.5 + hs * 0.6, hs, t));
  const bs = fitSize(H * 0.62);
  boss(ctx, e, lerp(W + bs, W * 0.76, easeOut(seg(t, 0.4, 0.9))), H * 0.9, bs, t, { flip: true });
  // VS
  if (t > 1.1) {
    const p = seg(t, 1.1, 1.35), sc = Math.round(lerp(9, 5, easeOut(p)));
    const shake = t < 1.5 ? Math.round(Math.sin(t * 80) * 2) : 0;
    impact(ctx, 3 + Math.min(2, Math.floor((t - 1.1) / 0.08)), 1, W / 2, H * 0.45, 96);
    text(ctx, 'VS', W / 2 + shake, H * 0.45 - sc * 3.5, { kind: 'fancy', scale: sc, align: 'center', color: '#ffd257', shadow: '#5a0000' });
  }
  if (t > 1.5) {
    text(ctx, typed('LA COLLA', t, 1.5, 20), 10, H - 14, { color: '#bcd0ff' });
    text(ctx, typed(e.name, t, 1.6, 20), W - 10, H - 14, { align: 'right', color: '#ffc0b0' });
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
  boss(ctx, e, lerp(W + size, W * 0.72, easeOut(seg(t, 0.4, 1.0))), H - lb + 6, size, t);
  if (t > 0.9) {
    const rw = W * 0.62, rx = lerp(-rw, -6, easeOut(seg(t, 0.9, 1.25))), ry = H * 0.42;
    panel(ctx, rx, ry, rw, 44);
    text(ctx, 'ENEMIC TERRIBLE', rx + 16, ry + 8, { color: '#9fd8ff' });
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
    boss(ctx, e, cx + 1, y, size, t, { sil: '#5a0808', alpha: 0.6 + 0.4 * Math.sin(t * 5) });   // aura vermella fosca
    boss(ctx, e, cx, y, size, t, { sil: '#000000' });
    const fill = seg(t, 2.8, 3.8);
    if (fill > 0) boss(ctx, e, cx, y, size, t, { reveal: fill, fromTop: true });
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
  const env: Env = {
    W, H, name: pixelText(o.bossName || 'BOSS'), sprite: o.sprite, portrait: o.portrait,
    party: o.party, seed: o.seed, snap, tmp: document.createElement('canvas'),
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
