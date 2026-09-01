/**
 * Primitives de la cua d'iniciativa (sistema per torns).
 *
 * Viuen aquí, i no dins de `DMView`, perquè `useDMActions` també les necessita: en
 * eliminar un token cal treure'l de la cua, i abans això només ho sabia fer `DMView`.
 * El resultat era un token fantasma a la barra d'iniciativa (nom «?», aro daurat pintat
 * enlloc quan li arribava el torn).
 */
import { DEFAULT_SPEED_FT } from '@/constants';
import type { DefeatedMap, Player, TurnState } from '@/types';

/** Saldo de peus dels tokens sense velocitat (enemics): sentinella de «sense límit». */
export const NO_MOVE_LIMIT_FT = 100000;

/** Peus de moviment amb què un token comença el seu torn. */
export function budgetFor(id: number | string, players: Player[]): number {
  const s = String(id);
  if (s.startsWith('pl_')) return players.find(p => `pl_${p.id}` === s)?.speed ?? DEFAULT_SPEED_FT;
  return NO_MOVE_LIMIT_FT;
}

/**
 * Índex del següent token que encara juga a partir de `from` (exclòs), saltant-se els
 * derrotats. `wraps` diu quantes voltes s'han donat a la cua (el qui crida hi suma les
 * rondes). Si tots són derrotats, torna al mateix `from` després d'una volta: mai un
 * bucle infinit.
 */
export function nextActive(
  order: (number | string)[], from: number, defeated: DefeatedMap,
): { index: number; wraps: number } {
  const n = order.length;
  if (n === 0) return { index: 0, wraps: 0 };
  let index = from, wraps = 0;
  for (let step = 0; step < n; step++) {
    index += 1;
    if (index >= n) { index = 0; wraps += 1; }
    if (!defeated[String(order[index])]) break;
  }
  return { index, wraps };
}

/** Índex del primer token de la cua que encara juga (0 si tots són derrotats). */
export function firstActive(order: (number | string)[], defeated: DefeatedMap): number {
  const i = order.findIndex(id => !defeated[String(id)]);
  return i < 0 ? 0 : i;
}

/**
 * Treu un token de la cua d'iniciativa. Retorna el nou `TurnState`, o `null` si no hi
 * havia res a fer (combat inactiu o token que no hi era).
 */
export function removeFromTurn(
  t: TurnState, key: string, players: Player[], defeated: DefeatedMap,
): TurnState | null {
  if (!t.active) return null;
  const idx = t.order.findIndex(o => String(o) === key);
  if (idx < 0) return null;

  const order = t.order.filter((_, i) => i !== idx);
  if (order.length === 0) return { active: false, order: [], turnIndex: 0, round: 1, activeRemainingFt: 0 };

  const remaining = { ...(t.remaining ?? {}) };
  delete remaining[key];

  // Esborrar un token ANTERIOR al del torn desplaça l'índex per seguir el mateix token
  // actiu. Esborrar el token que TENIA el torn deixa l'índex apuntant al següent de la cua
  // (i al principi si era l'últim). La ronda no s'incrementa mai per una eliminació: qui la
  // fa avançar és el DM amb «⏭ Ronda».
  let turnIndex = idx < t.turnIndex ? t.turnIndex - 1 : t.turnIndex;
  let activeRemainingFt = t.activeRemainingFt;
  if (idx === t.turnIndex) {
    if (turnIndex >= order.length) turnIndex = 0;
    if (defeated[String(order[turnIndex])]) turnIndex = nextActive(order, turnIndex, defeated).index;
    activeRemainingFt = budgetFor(order[turnIndex], players);
  }

  return { ...t, order, turnIndex, remaining, activeRemainingFt };
}
