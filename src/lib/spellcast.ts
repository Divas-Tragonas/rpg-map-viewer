import type { Point, SpellPreview, ReachHover, ReachZone, AttackPending } from '@/types';
import { edgeDistanceFt, isOutOfRange } from '@/lib/rules/reach';
import { tokenAt, tokenSlots, type TokenRefs } from '@/lib/render/token-geom';

/**
 * Previsualització d'una màgia que espera el destí. L'abast és un AVÍS: el destí és
 * sempre el cursor (mai es talla) i, si és fora d'abast, `outOfRange` pinta tot en vermell.
 * Sense graella no hi ha mida de casella: mai «fora».
 *  - Raig (`line`): si el cursor és sobre un token, es mesura fins a la seva vora i es
 *    ressalta (només aquest, només al DM: `hover`); si no, fins al cursor.
 *  - Àrea (`area`): l'abast és fins al centre de l'àrea (el cursor).
 */
export function aimSpell(
  refs: TokenRefs, pend: { mode?: 'line' | 'area'; origin: Point; type: string },
  cursor: Point, rangeFt: number | undefined, gridSize: number, sc: number,
): SpellPreview {
  const slot = tokenAt(refs, cursor.x, cursor.y, sc);
  // El llançador mateix (el seu centre és l'origen) no compta com a objectiu.
  const tok = slot && Math.hypot(slot.x - pend.origin.x, slot.y - pend.origin.y) > 1 ? slot : null;
  const hoverFt = tok ? edgeDistanceFt(pend.origin, 0, tok, tok.R, gridSize) : null;
  const hover: ReachHover | undefined = tok
    ? { x: tok.x, y: tok.y, R: tok.R, ft: hoverFt, out: isOutOfRange(hoverFt, rangeFt) } : undefined;
  if (pend.mode === 'line') {
    const out = hover ? hover.out : isOutOfRange(edgeDistanceFt(pend.origin, 0, cursor, 0, gridSize), rangeFt);
    return { mode: 'line', start: pend.origin, end: cursor, rangeFt, outOfRange: out, hover };
  }
  const out = isOutOfRange(edgeDistanceFt(pend.origin, 0, cursor, 0, gridSize), rangeFt);
  return { mode: 'area_place', origin: pend.origin, center: cursor, spellType: pend.type, outOfRange: out, hover };
}

/** El que veuen les pantalles de jugador: sense el ressaltat del token (podria delatar un enemic amagat). */
export function previewForPlayers(p: SpellPreview | null): SpellPreview | null {
  // L'apuntat d'un atac és una eina del DM: la línia s'enganxa al token assenyalat (podria
  // delatar un enemic amagat) i a la taula ja es veu qui ataca a qui.
  if (p?.mode === 'attack') return null;
  if (!p || !p.hover) return p;
  const { hover: _h, ...rest } = p; void _h;
  return rest as SpellPreview;
}

/** Zona segons la distància: dins, abast llarg (desavantatge) o fora. Sense graella: «dins». */
export function reachZone(ft: number | null, normalFt: number, longFt?: number): ReachZone {
  if (ft === null || ft <= normalFt) return 'in';
  return longFt !== undefined && ft <= longFt ? 'long' : 'out';
}

/**
 * Previsualització d'un atac del menú d'un token. Tot vora a vora (radi del token atacant i de
 * l'objectiu). Amb el cursor sobre un token, es mesura fins a ell i només ell es ressalta (només
 * al DM); si no, fins al cursor. Mai bloqueja: fora d'abast es pinta en vermell.
 */
export function aimAttack(refs: TokenRefs, pend: AttackPending, cursor: Point, gridSize: number, sc: number): SpellPreview | null {
  const me = tokenSlots(refs).find(s => s.key === pend.key);
  if (!me) return null;   // el token ja no hi és
  const from = { x: me.x, y: me.y }, fromR = me.R;
  const slot = tokenAt(refs, cursor.x, cursor.y, sc);
  const tok = slot && slot.key !== pend.key ? slot : null;
  const ft = tok
    ? edgeDistanceFt(from, fromR, tok, tok.R, gridSize)
    : edgeDistanceFt(from, fromR, cursor, 0, gridSize);
  const zone = reachZone(ft, pend.normalFt, pend.longFt);
  const hover: ReachHover | undefined = tok
    ? { x: tok.x, y: tok.y, R: tok.R, ft, out: zone === 'out', long: zone === 'long' } : undefined;
  return {
    mode: 'attack', start: from, startR: fromR, end: tok ? { x: tok.x, y: tok.y } : cursor,
    label: pend.label, normalFt: pend.normalFt, longFt: pend.longFt, zone, ft, hover,
  };
}
