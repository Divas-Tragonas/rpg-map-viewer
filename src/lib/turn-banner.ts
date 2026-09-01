/**
 * Dades del rètol de torn que es pinta a les pantalles de jugador (TV i tablet).
 *
 * El `TurnState` viu en una ref (`rTurn`) que arriba dins de CADA missatge STATE, també
 * els de pan/zoom a ~20 Hz. Si la pantalla de jugador el passés a estat de React tal com
 * arriba, es re-renderitzaria vint cops per segon. Per això es projecta a aquest objecte
 * pla, només amb el que es veu al rètol, i es compara amb `sameBanner`: mentre el que es
 * veu no canviï, React no re-renderitza res.
 */
import type { ConditionsMap, LibEnemy, MapStructure, Player, PsdEnemyOverrides, TurnState } from '@/types';
import { budgetFor, NO_MOVE_LIMIT_FT } from '@/lib/turn';
import { movementLimit } from '@/lib/rules/conditions';

export interface TurnBanner {
  active: boolean;
  round: number;
  /** Nom del token que té el torn. */
  name: string;
  color: string;
  img: string | null;
  /** Peus restants i pressupost del torn; -1 als enemics (no en tenen, de límit). */
  remainingFt: number;
  totalFt: number;
  /** Estat que li impedeix moure's (Agafat, Paralitzat…), o null. */
  blockedBy: string | null;
}

export const EMPTY_BANNER: TurnBanner = {
  active: false, round: 1, name: '', color: '#888', img: null,
  remainingFt: -1, totalFt: -1, blockedBy: null,
};

export function sameBanner(a: TurnBanner, b: TurnBanner): boolean {
  return a.active === b.active && a.round === b.round && a.name === b.name
    && a.color === b.color && a.img === b.img
    && a.remainingFt === b.remainingFt && a.totalFt === b.totalFt
    && a.blockedBy === b.blockedBy;
}

interface Sources {
  turn: TurnState;
  players: Player[];
  libEnemies: LibEnemy[];
  struct: MapStructure | null;
  psdEnemyOverrides: PsdEnemyOverrides;
  conditions: ConditionsMap;
}

/** Projecta l'estat de combat al que s'ha de veure al rètol. */
export function buildTurnBanner({ turn, players, libEnemies, struct, psdEnemyOverrides, conditions }: Sources): TurnBanner {
  if (!turn.active || turn.order.length === 0) return EMPTY_BANNER;
  const id = turn.order[turn.turnIndex];
  if (id === undefined) return EMPTY_BANNER;
  const sid = String(id);

  let name = '?', color = '#b0424a', img: string | null = null;
  if (sid.startsWith('pl_')) {
    const p = players.find(pl => `pl_${pl.id}` === sid);
    name = p?.name ?? '?';
    color = p?.color ?? '#888';
  } else if (sid.startsWith('lib_')) {
    const e = libEnemies.find(en => `lib_${en.id}` === sid);
    name = e?.name ?? '?';
    color = e?.color ?? '#b0424a';
    img = e?.imageData ?? null;
  } else {
    const en = struct?.enemyRooms.flatMap(r => r.enemies).find(e => e.id === Number(id));
    const ov = psdEnemyOverrides[Number(id)];
    name = ov?.name ?? en?.name ?? 'Enemic';
    img = ov?.imageData ?? null;
  }

  // Els enemics no tenen límit de moviment des de /player (sentinella): res de peus.
  const totalFt = budgetFor(id, players);
  if (totalFt >= NO_MOVE_LIMIT_FT) {
    return { active: true, round: turn.round, name, color, img, remainingFt: -1, totalFt: -1, blockedBy: null };
  }
  const limit = movementLimit(turn.activeRemainingFt, conditions[sid]);
  return {
    active: true, round: turn.round, name, color, img,
    remainingFt: limit.ft, totalFt,
    blockedBy: limit.immobile ? limit.reason : null,
  };
}
