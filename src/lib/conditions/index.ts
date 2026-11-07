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

// ── Distintiu dels estats al token ───────────────────────────────────────────

const TAU = Math.PI * 2;

/**
 * Anell segmentat: un tram de circumferència per estat, amb el seu color.
 * És la lectura "d'un cop d'ull" — encara que els isotips quedin petits perquè el
 * token n'acumula molts, els colors del contorn ja diuen quants estats té i quins.
 */
function drawConditionRing(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, Rr: number, list: Condition[], lw: number, flat = 1, ry = Rr * flat,
): void {
  // `flat` < 1 o `ry` → el·lipse (aureola en perspectiva als peus d'una figureta de l'app Píxel).
  const seg = (a0: number, a1: number) => { ctx.beginPath(); ctx.ellipse(cx, cy, Rr, ry, 0, a0, a1); ctx.stroke(); };
  const n = list.length;
  const slice = TAU / n;
  // Amb un sol estat l'anell és continu (sense osca); amb més, cada tram es
  // separa del següent perquè es puguin comptar els colors.
  const gap = n === 1 ? 0 : Math.min(slice * 0.16, 0.16);
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineWidth = lw * 1.7;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  seg(0, TAU);
  ctx.lineWidth = lw;
  list.forEach((cond, i) => {
    const a0 = -Math.PI / 2 + i * slice + gap / 2;
    const a1 = a0 + slice - gap;
    ctx.strokeStyle = cond.color;
    seg(a0, a1);
  });
  ctx.restore();
}

/**
 * Distintiu dels estats d'un token: només l'**anell segmentat** de colors (`drawConditionRing`).
 * Les bombolles amb l'isotip sobre el cap es van treure a la v5 snapshot 12 (decisió del propietari):
 * tapaven les animacions dels estats (estrelles, cors, verí…) i amb l'anell n'hi ha prou. Els isotips
 * continuen al menú (`ConditionPicker`) i a la barra de torns.
 */
export function drawConditionRingFor(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, condIds: string[], sc: number,
  /**
   * App Píxel: l'anell va als peus (`footY`), aplanat (`flat`). `rx, ry`:
   * semieixos de l'anell (els dona `render/tokens.ts` perquè quedi a la mateixa distància de l'ombra).
   */
  foot?: { footY: number; flat: number; rx?: number; ry?: number },
): void {
  if (!condIds || condIds.length === 0) return;
  const list: Condition[] = [];
  for (const id of condIds) { const c = CONDITIONS_BY_ID.get(id); if (c) list.push(c); }
  if (list.length === 0) return;

  // L'anell va per DINS de la vora del token: fora hi viuen l'aro de color (que també marca
  // el torn i el ressaltar enemics) i el blau de selecció, i s'hi trepitjarien.
  const ringW = Math.max(3 / sc, R * 0.11);
  const Rring = Math.max(ringW, R - ringW / 2);
  if (foot) drawConditionRing(ctx, cx, foot.footY, foot.rx ?? R * 0.98, list, ringW * 0.9, foot.flat, foot.ry);
  else drawConditionRing(ctx, cx, cy, Rring, list, ringW);
}
