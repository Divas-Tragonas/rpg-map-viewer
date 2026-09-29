// Raig elèctric — com un llamp de videojoc, no una línia que tremola:
//
//   1. LÍDER     un traç prim i tènue avança a salts del conjurador a l'objectiu (0,1 s).
//   2. DESCÀRREGA el llamp principal esclata: flaix que il·lumina el mapa, sacsejada
//                curta, arcs que ballen al voltant de l'impacte i espurnes.
//   3. RE-DESCÀRREGUES el llamp torna a caure amb geometria nova a intervals IRREGULARS
//                (com els llamps de veritat, que parpellegen), cadascun amb el seu pic de
//                brillantor i una caiguda ràpida.
//   4. POSTLLUM  l'últim traç queda ionitzat (violeta tènue) i s'esvaeix; a terra hi
//                queda una marca socarrimada (passada 'ground').
//
// Geometria: desplaçament recursiu del punt mig amb branques que surten dels punts mitjos
// (fractal de debò, no soroll perpendicular per punt). Determinista per (llavor, índex de
// descàrrega): totes les pantalles veuen el mateix llamp.

import type { Point } from '@/types';
import { pathAt } from '@/lib/geometry';
import {
  mulberry32, scorchSprite, blit,
  TAU, smoothstep, dragged, glow, fxCell, type RGB3,
} from './fxsprites';

export const LIGHTNING_DUR = 2.2;
const LEADER = 0.1;         // s que triga el líder a arribar a l'objectiu
const LAST_STRIKE = 1.65;   // no hi ha descàrregues noves a partir d'aquí
const AFTER = LIGHTNING_DUR - LAST_STRIKE;

const WHITE: RGB3 = [236, 244, 255];
const BLUE: RGB3 = [110, 160, 255];
const DEEP: RGB3 = [60, 90, 255];
const ION: RGB3 = [150, 120, 255];

interface Seg { ax: number; ay: number; bx: number; by: number; w: number; }
interface Bolt { segs: Seg[]; main: Point[]; }

/** Instants (s) de cada descàrrega: el primer en arribar el líder, després irregulars. */
function strikeTimes(seed: number): number[] {
  const rnd = mulberry32(seed ^ 0x57121e);
  const out = [LEADER];
  let t = LEADER;
  while (true) {
    t += 0.045 + rnd() * rnd() * 0.22; // majoria ràpides, alguna pausa llarga
    if (t > LAST_STRIKE) break;
    out.push(t);
  }
  return out;
}
const _times = new Map<number, number[]>();
function timesFor(seed: number): number[] {
  let t = _times.get(seed);
  if (!t) { t = strikeTimes(seed); _times.set(seed, t); if (_times.size > 64) _times.delete(_times.keys().next().value!); }
  return t;
}

function fractal(out: Seg[], main: Point[] | null, ax: number, ay: number, bx: number, by: number,
  disp: number, depth: number, w: number, rnd: () => number): void {
  if (depth === 0) {
    out.push({ ax, ay, bx, by, w });
    if (main) main.push({ x: bx, y: by });
    return;
  }
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const off = (rnd() - 0.5) * disp;
  const mx = (ax + bx) / 2 - (dy / len) * off, my = (ay + by) / 2 + (dx / len) * off;
  // Branca: surt del punt mig, desviada, més curta i més prima
  // (Només als nivells grossos i amb fondària limitada: si no, el fractal fa milers de segments.)
  if (w > 0.2 && depth >= 3 && rnd() < 0.2 * w + 0.04) {
    const side = rnd() < 0.5 ? -1 : 1, ang = Math.atan2(my - ay, mx - ax) + side * (0.35 + rnd() * 0.6);
    const bl = len * (0.35 + rnd() * 0.45);
    fractal(out, null, mx, my, mx + Math.cos(ang) * bl, my + Math.sin(ang) * bl, bl * 0.45, Math.min(depth - 1, 4), w * 0.5, rnd);
  }
  // (0.58 en lloc de 0.5: més rugositat a escala petita, el traç es veu esquerdat i no ondulat)
  fractal(out, main, ax, ay, mx, my, disp * 0.58, depth - 1, w, rnd);
  fractal(out, main, mx, my, bx, by, disp * 0.58, depth - 1, w, rnd);
}

function makeBolt(pts: Point[], seed: number, idx: number): Bolt {
  const rnd = mulberry32((seed ^ Math.imul(idx + 1, 0x85ebca6b)) >>> 0);
  const segs: Seg[] = [], main: Point[] = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
    const depth = Math.max(4, Math.min(8, Math.round(Math.log2(L / 6))));
    fractal(segs, main, a.x, a.y, b.x, b.y, L * 0.26, depth, 1, rnd);
  }
  return { segs, main };
}

const _bolts = new Map<string, Bolt>();
function boltFor(spellId: string, pts: Point[], seed: number, idx: number): Bolt {
  const k = `${spellId}:${idx}`;
  let b = _bolts.get(k);
  if (!b) {
    b = makeBolt(pts, seed, idx); _bolts.set(k, b);
    if (_bolts.size > 48) _bolts.delete(_bolts.keys().next().value!);
  }
  return b;
}
export function pruneLightningFx(aliveIds: Set<string>): void {
  for (const k of _bolts.keys()) if (!aliveIds.has(k.slice(0, k.lastIndexOf(':')))) _bolts.delete(k);
}

/** Traça els segments agrupats per gruix (un sol path per gruix: pocs strokes). */
function strokeBolt(ctx: CanvasRenderingContext2D, segs: Seg[], width: number, rgb: RGB3, alpha: number, upTo = Infinity): void {
  if (alpha <= 0.004) return;
  ctx.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  for (const lvl of [1, 0.5, 0.25, 0.125]) {
    ctx.beginPath();
    let any = false;
    for (let i = 0; i < segs.length && i < upTo; i++) {
      const s = segs[i];
      if (s.w > lvl * 1.5 || s.w <= lvl * 0.75) continue;
      ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); any = true;
    }
    if (!any) continue;
    ctx.globalAlpha = Math.min(1, alpha * (0.45 + 0.55 * lvl));
    ctx.lineWidth = width * lvl;
    ctx.stroke();
  }
}

/** Estat de la descàrrega en curs: índex, instant i intensitat (pic + caiguda). */
function strikeState(e: number, seed: number): { idx: number; ts: number; I: number; next: number } {
  const times = timesFor(seed);
  let idx = -1;
  for (let i = 0; i < times.length; i++) if (times[i] <= e) idx = i;
  if (idx < 0) return { idx: -1, ts: 0, I: 0, next: times[0] };
  const ts = times[idx], age = e - ts;
  const peak = idx === 0 ? 1.35 : 0.75 + 0.35 * mulberry32(seed + idx * 977)();
  // Pic brillant, caiguda ràpida, i un fons que manté el llamp visible entre descàrregues
  const I = peak * Math.exp(-age * 22) + 0.42;
  return { idx, ts, I, next: times[idx + 1] ?? Infinity };
}

export function drawLightningGround(ctx: CanvasRenderingContext2D, pts: Point[], e: number, sc: number, gridSize: number, seed: number): void {
  if (e < LEADER || pts.length < 2) return;
  const end = pts[pts.length - 1], cell = fxCell(sc, gridSize);
  const fade = 1 - smoothstep(e, LIGHTNING_DUR - 0.5, LIGHTNING_DUR);
  ctx.save();
  ctx.globalAlpha = 0.5 * smoothstep(e, LEADER, LEADER + 0.1) * fade;
  blit(ctx, scorchSprite(), end.x, end.y, cell * 0.9, (seed % 628) / 100);
  ctx.restore();
}

export function drawSpellLightning(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number, spellId: string): void {
  if (pts.length < 2) return;
  const cell = fxCell(sc, gridSize), px = 1 / sc;
  const coreW = Math.max(1.7 * px, cell * 0.05);
  const O = pts[0], end = pts[pts.length - 1];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ── 1. Líder: el primer llamp es revela a salts ──
  if (e < LEADER) {
    const bolt = boltFor(spellId, pts, seed, 0);
    const k = e / LEADER, stepped = Math.floor(k * 9) / 9 + 0.04;
    const upTo = Math.floor(bolt.segs.length * stepped);
    strokeBolt(ctx, bolt.segs, coreW * 2.5, BLUE, 0.35, upTo);
    strokeBolt(ctx, bolt.segs, coreW * 0.7, WHITE, 0.55, upTo);
    const tipI = Math.min(bolt.main.length - 1, Math.floor(bolt.main.length * stepped));
    const tip = bolt.main[tipI];
    glow(ctx, BLUE, tip.x, tip.y, cell * 0.6, 0.7);
    glow(ctx, BLUE, O.x, O.y, cell * 0.7, 0.6 * k);
    ctx.restore();
    return;
  }

  const { idx, ts, I: rawI } = strikeState(e, seed);
  const striking = e <= LAST_STRIKE + 0.05;
  const after = Math.max(0, (e - LAST_STRIKE) / AFTER);
  const fade = striking ? 1 : 1 - smoothstep(after, 0, 1);
  const I = striking ? rawI : rawI * (1 - after) ** 2;
  const bolt = boltFor(spellId, pts, seed, idx);
  const age = e - ts;

  // ── Llum dinàmica: el llamp il·lumina el mapa ──
  const mid = pathAt(pts, 0.5), L = Math.hypot(end.x - O.x, end.y - O.y);
  glow(ctx, DEEP, mid.x, mid.y, L * 0.75 + cell * 3, 0.22 * Math.max(0, I - 0.4) * fade);
  const stepN = Math.max(3, Math.min(24, Math.round(L / (cell * 1.6))));
  for (let k = 0; k <= stepN; k++) {
    const p = bolt.main[Math.round((k / stepN) * (bolt.main.length - 1))];
    glow(ctx, BLUE, p.x, p.y, cell * 1.3, 0.1 * I * fade);
  }

  // ── Llamp: halo ample → cos blau → nucli blanc (postllum ionitzat en violeta) ──
  const col = after > 0 ? ION : BLUE;
  strokeBolt(ctx, bolt.segs, coreW * 7, DEEP, 0.16 * I * fade);
  strokeBolt(ctx, bolt.segs, coreW * 2.8, col, 0.5 * I * fade);
  strokeBolt(ctx, bolt.segs, coreW * (1 + 0.3 * Math.max(0, I - 0.42)), WHITE, Math.min(1, I) * fade);

  // ── Impacte i mà del conjurador ──
  const flick = 0.8 + 0.2 * Math.sin(e * 63 + seed);
  glow(ctx, BLUE, end.x, end.y, cell * 2.6, 0.55 * I * flick * fade);
  glow(ctx, WHITE, end.x, end.y, cell * 0.75, 0.9 * Math.min(1, I) * fade);
  glow(ctx, BLUE, O.x, O.y, cell * 1.1, 0.5 * I * fade);
  glow(ctx, WHITE, O.x, O.y, cell * 0.35, 0.8 * Math.min(1, I) * fade);
  // Flaix de la descàrrega principal
  if (idx === 0 && age < 0.12) glow(ctx, WHITE, end.x, end.y, cell * (1.5 + 3 * age / 0.12), 0.8 * (1 - age / 0.12));

  // Arcs que ballen al voltant de l'impacte i de la mà (nova forma cada 40 ms)
  if (striking) {
    const sub = Math.floor(e / 0.04);
    const rnd = mulberry32((seed ^ Math.imul(sub + 7, 0x9e3779b1)) >>> 0);
    const arcs: Seg[] = [];
    for (let i = 0; i < 6; i++) {
      const at = i < 4 ? end : O, rr = cell * (i < 4 ? 0.6 + rnd() * 0.8 : 0.35 + rnd() * 0.35);
      const a0 = rnd() * TAU, a1 = a0 + (rnd() - 0.5) * 2.2;
      const x0 = at.x + Math.cos(a0) * rr * 0.25, y0 = at.y + Math.sin(a0) * rr * 0.25;
      const x1 = at.x + Math.cos(a1) * rr, y1 = at.y + Math.sin(a1) * rr;
      fractal(arcs, null, x0, y0, x1, y1, rr * 0.5, 3, 0.5, rnd);
    }
    strokeBolt(ctx, arcs, coreW * 3, BLUE, 0.5 * I);
    strokeBolt(ctx, arcs, coreW * 0.9, WHITE, 0.9 * Math.min(1, I));
  }

  // Espurnes de les últimes descàrregues (ratlles amb fricció i una mica de caiguda)
  const times = timesFor(seed);
  for (let s = Math.max(0, idx - 3); s <= idx; s++) {
    const rnd = mulberry32(seed ^ Math.imul(s + 3, 0x27d4eb2f));
    const n = s === 0 ? 22 : 8;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, sp = cell * (3 + rnd() * 7), life = 0.18 + rnd() * 0.3, hot = rnd();
      const sa = e - times[s];
      if (sa < 0 || sa > life) continue;
      const lf = sa / life;
      const at = (t: number) => { const d = dragged(sp, 6, t); return { x: end.x + Math.cos(a) * d, y: end.y + Math.sin(a) * d + cell * 2 * t * t }; };
      const p = at(sa), q = at(Math.max(0, sa - 0.03));
      ctx.globalAlpha = (1 - lf) * fade;
      ctx.strokeStyle = hot > 0.4 ? 'rgb(235,244,255)' : 'rgb(140,180,255)';
      ctx.lineWidth = (1 + hot * 1.4) * px;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/** Sacsejada curta (px de pantalla) a la primera descàrrega. */
export function lightningShake(tau: number, s: number): Point {
  if (tau < 0 || tau > 0.3) return { x: 0, y: 0 };
  const amp = 5 * (1 - tau / 0.3) ** 2;
  return { x: amp * Math.sin(tau * 97 + s), y: amp * Math.cos(tau * 89 + s * 2) };
}
export const LIGHTNING_FIRST_STRIKE = LEADER;
