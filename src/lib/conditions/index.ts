import { CONDITIONS_BY_ID } from '@/constants';
import { ICON_BOX, conditionPaths } from './icons';
import type { Condition } from '@/types';

export { ICON_BOX, CONDITION_ICONS, conditionPaths } from './icons';
export type { IconPart } from './icons';

/**
 * Tinta llegible damunt d'un color de badge: blanc sobre colors foscos, gairebé
 * negre sobre els clars (groc, cian, gris). Sense això, els estats de color clar
 * mostraven un isotip blanc sobre blanc i no es veia res.
 */
export function conditionInk(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.42 ? '#0b0f14' : '#ffffff';
}

/**
 * Pinta l'isotip vectorial d'un estat centrat a (x,y), inscrit en un quadrat de
 * costat `size`. Es re-rasteritza a cada crida des dels `Path2D` del path SVG, o
 * sigui que **manté la resolució màxima a qualsevol zoom** (no és cap bitmap).
 */
export function drawConditionIcon(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, id: string,
  ink = '#fff', bg = '#000',
): void {
  const parts = conditionPaths(id);
  if (!parts) return;
  const k = size / ICON_BOX;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const part of parts) {
    const c = part.bg ? bg : ink;
    ctx.fillStyle = c; ctx.strokeStyle = c;
    if (part.w) {
      ctx.lineWidth = part.w;
      if (part.dash) ctx.setLineDash(part.dash); else ctx.setLineDash([]);
      ctx.stroke(part.p);
    } else {
      ctx.fill(part.p, 'evenodd');
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Distintiu dels estats damunt del token ───────────────────────────────────

const TAU = Math.PI * 2;
/** Arc màxim (en radians) que poden ocupar els badges abans d'haver-los d'encongir. */
const MAX_SPAN = TAU * 0.94;

/** Separació angular mínima entre dos badges de radi `br` sobre una circumferència `Rb`. */
function stepFor(br: number, Rb: number): number {
  return 2 * Math.asin(Math.min(0.999, (br * 1.1) / Rb));
}

/**
 * Anell segmentat: un tram de circumferència per estat, amb el seu color.
 * És la lectura "d'un cop d'ull" — encara que els isotips quedin petits perquè el
 * token n'acumula molts, els colors del contorn ja diuen quants estats té i quins.
 */
function drawConditionRing(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, Rr: number, list: Condition[], lw: number,
): void {
  const n = list.length;
  const slice = TAU / n;
  // Amb un sol estat l'anell és continu (sense osca); amb més, cada tram es
  // separa del següent perquè es puguin comptar els colors.
  const gap = n === 1 ? 0 : Math.min(slice * 0.16, 0.16);
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineWidth = lw * 1.7;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TAU); ctx.stroke();
  ctx.lineWidth = lw;
  list.forEach((cond, i) => {
    const a0 = -Math.PI / 2 + i * slice + gap / 2;
    const a1 = a0 + slice - gap;
    ctx.strokeStyle = cond.color;
    ctx.beginPath(); ctx.arc(cx, cy, Rr, a0, a1); ctx.stroke();
  });
  ctx.restore();
}

/**
 * Distintius dels estats d'un token.
 *
 * Repartits en un **arc simètric respecte del capdamunt** del token (i no en una
 * fila recta com abans): amb pocs estats queden centrats sobre el cap, i a mesura
 * que se n'acumulen s'obren cap als costats fins a envoltar-lo. Si l'arc s'omple,
 * els badges s'encongeixen fins a un mínim llegible i, només si encara no hi caben,
 * l'últim es converteix en un «+N».
 *
 * A sota hi va l'**anell segmentat** de colors (`drawConditionRing`), que és el que
 * permet intuir els estats encara que els isotips quedin petits.
 */
export function drawConditionBadges(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, condIds: string[], sc: number,
): void {
  if (!condIds || condIds.length === 0) return;
  const list: Condition[] = [];
  for (const id of condIds) { const c = CONDITIONS_BY_ID.get(id); if (c) list.push(c); }
  if (list.length === 0) return;

  // L'anell va per DINS de la vora del token: fora hi viuen l'aro daurat del torn,
  // el de ressaltar enemics i el blau de selecció, i s'hi trepitjarien.
  const ringW = Math.max(3 / sc, R * 0.11);
  const Rring = Math.max(ringW, R - ringW / 2);
  drawConditionRing(ctx, cx, cy, Rring, list, ringW);

  // Mida del badge: la ideal es va reduint fins que tots caben dins de l'arc.
  const brIdeal = Math.max(9 / sc, R * 0.32);
  const brMin   = Math.max(7 / sc, R * 0.19);
  const orbit = (b: number) => R + b + 4 / sc;
  let br = brIdeal;
  let Rb = orbit(br);
  let step = stepFor(br, Rb);
  while (list.length * step > MAX_SPAN && br > brMin) {
    br = Math.max(brMin, br * 0.93);
    Rb = orbit(br);
    step = stepFor(br, Rb);
  }

  // Si ni encongits hi caben tots (només passaria amb un token diminut), l'últim
  // lloc mostra quants n'han quedat fora.
  const capacity = Math.max(1, Math.floor(MAX_SPAN / step));
  const overflow = list.length > capacity ? list.length - capacity + 1 : 0;
  const shown = overflow > 0 ? list.slice(0, capacity - 1) : list;
  const slots = shown.length + (overflow > 0 ? 1 : 0);

  const iconSize = br * 1.42;
  const a0 = -Math.PI / 2 - ((slots - 1) * step) / 2;

  ctx.save();
  for (let i = 0; i < slots; i++) {
    const a = a0 + i * step;
    const bx = cx + Math.cos(a) * Rb;
    const by = cy + Math.sin(a) * Rb;
    const cond = i < shown.length ? shown[i] : null;

    // Ombra: desenganxa el badge del mapa, sigui quin sigui el terreny de sota.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by + 1.2 / sc, br * 1.06, 0, TAU); ctx.fill();

    ctx.fillStyle = cond ? cond.color : '#1f2530';
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();

    if (cond) {
      drawConditionIcon(ctx, bx, by, iconSize, cond.id, conditionInk(cond.color), cond.color);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${br * 1.05}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`+${overflow}`, bx, by);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 1.6 / sc;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.9 / sc;
    ctx.beginPath(); ctx.arc(bx, by, br - 1.2 / sc, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
