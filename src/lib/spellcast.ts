import type { Point, SpellPreview, ReachHover } from '@/types';
import { edgeDistanceFt, isOutOfRange } from '@/lib/rules/reach';
import { tokenAt, type TokenRefs } from '@/lib/render/token-geom';

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
  if (!p || !p.hover) return p;
  const { hover: _h, ...rest } = p; void _h;
  return rest as SpellPreview;
}
