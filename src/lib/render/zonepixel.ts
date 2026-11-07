/**
 * Detalls de pixel art dins de les zones màgiques, només a l'app Píxel (v5 snapshot 10): flametes
 * arran de terra al foc, cristalls i neu al gel, bassals que bullen al verí, espurnes al llamp,
 * esquitxos a l'aigua i fonts d'espurnes a la màgia (`fx_anims.png`).
 *
 * Van **damunt del camp de sempre** (`zonefx.ts`, que no es toca) i respecten el que l'usuari ja va
 * rebutjar a les zones de la Clàssica: res a la vora (cada detall queda a més de mitja casella del
 * contorn), res que llisqui (cada un és quiet al seu lloc i s'hi anima), i pocs i escampats (un per
 * cada ~1,3 caselles com a molt). A l'app Clàssica no es pinten.
 *
 * La disposició és determinista (llavor de l'`id` de la zona) i relativa a la zona: totes les
 * pantalles la veuen igual i arrossegar la zona l'emporta sencera.
 */
import type { PaintedZone, Point } from '@/types';
import { pointInPolygon } from '@/lib/geometry';
import { PAL } from './fxsprites';
import { animFrame, drawAnim, FX_ANIMS, type FxAnimId } from '@/lib/sprites/fxanim';
import { sheet } from '@/lib/sprites/pack';

interface Accent { anim: FxAnimId; k: number; anchor?: 'foot'; tint?: typeof PAL[keyof typeof PAL];
  /** Les d'un sol cop es tornen a fer cada `every` ms; les de bucle, si en tenen, només hi són `on` ms de cada `every`. */
  every?: number; on?: number; alpha?: number }

const ACCENTS: Record<string, Accent[]> = {
  fire:      [{ anim: 'burning_ground', k: 1.6, anchor: 'foot' }],
  ice:       [{ anim: 'frost_crystal', k: 1.1, anchor: 'foot' }, { anim: 'snow_swirl', k: 1.3, alpha: 0.8 }],
  water:     [{ anim: 'water_splash', k: 1.4, every: 1800 }],
  poison:    [{ anim: 'acid_puddle', k: 1.3, anchor: 'foot' }, { anim: 'poison_puff', k: 1.1, alpha: 0.75 }],
  lightning: [{ anim: 'crackle', k: 1.2, every: 1500, on: 560 }],
  magic:     [{ anim: 'spark_fountain', k: 1.2, anchor: 'foot', tint: PAL.arcane }],
};

interface Spot { dx: number; dy: number; a: Accent; phase: number; flip: boolean }
const _spots = new WeakMap<PaintedZone, { grid: number; spots: Spot[] }>();

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rnd(seed: number, i: number, j: number): number {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(i + 1, 668265263) + Math.imul(j + 7, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function edgeDist(p: Point, poly: Point[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], vx = b.x - a.x, vy = b.y - a.y;
    const l2 = vx * vx + vy * vy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t));
  }
  return best;
}

/** Llocs dels detalls (relatius a la cantonada de la zona), un cop per zona i mida de casella. */
function spotsOf(zone: PaintedZone, grid: number): Spot[] {
  const hit = _spots.get(zone);
  if (hit && hit.grid === grid) return hit.spots;
  const accents = ACCENTS[zone.element] ?? [];
  const spots: Spot[] = [];
  const { left, top, w, h } = zone.bbox;
  const seed = hashStr(zone.id);
  // Pas d'~1,3 caselles; les zones enormes s'aclareixen perquè no passin de 60 detalls.
  const step = Math.max(grid * 1.3, Math.sqrt((w * h) / 60));
  const cols = Math.ceil(w / step), rows = Math.ceil(h / step);
  if (accents.length) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const p = { x: left + (c + 0.2 + rnd(seed, i, 0) * 0.6) * step, y: top + (r + 0.2 + rnd(seed, i, 1) * 0.6) * step };
      if (!pointInPolygon(p.x, p.y, zone.points) || edgeDist(p, zone.points) < grid * 0.55) continue;
      spots.push({ dx: p.x - left, dy: p.y - top, a: accents[Math.floor(rnd(seed, i, 2) * accents.length)], phase: rnd(seed, i, 3) * 5000, flip: rnd(seed, i, 4) < 0.5 });
    }
  }
  _spots.set(zone, { grid, spots });
  return spots;
}

/** Pinta els detalls d'una zona (després del camp de `drawZoneFx`). `alpha`: el fos d'entrada de la zona. */
export function drawZonePixelAccents(ctx: CanvasRenderingContext2D, zone: PaintedZone, gridSize: number, alpha: number, calm: boolean): void {
  if (!sheet('anims') || !(zone.element in ACCENTS)) return;
  const grid = gridSize > 0 ? gridSize : 70;
  const spots = spotsOf(zone, grid);
  if (!spots.length) return;
  const px = grid / 40;
  const now = calm ? 0 : performance.now();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const s of spots) {
    const t = now + s.phase;
    const a = s.a;
    let frame: number;
    if (a.every) {
      const local = t % a.every;
      frame = a.on ? (local < a.on ? animFrame(a.anim, local, true) : -1) : animFrame(a.anim, local, false);
    } else frame = animFrame(a.anim, t, true);
    if (frame < 0) continue;
    ctx.globalAlpha = alpha * (a.alpha ?? 0.92);
    const x = zone.bbox.left + s.dx, y = zone.bbox.top + s.dy;
    drawAnim(ctx, a.anim, Math.min(frame, FX_ANIMS[a.anim].n - 1), x, y, px * a.k, { anchor: a.anchor, flip: s.flip, tint: a.tint, bright: true });
  }
  ctx.restore();
}
