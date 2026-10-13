/**
 * Un sol «Desfer» per a tot el que es pot desfer al DM. Abans n'hi havia tres (traços de
 * dibuix, canvis del mapa i moviments de combat), cadascun amb el seu botó en un lloc
 * diferent, i el Ctrl+Z en triava un o un altre segons l'eina activa sense dir quin.
 *
 * Les tres piles d'abans (`strokeHistoryRef`, `rMapHistory`, `rMoveHistory`) no canvien:
 * aquest registre només en recorda l'ORDRE. Cada entrada apunta a l'objecte que s'ha
 * apilat; si aquell objecte ja no és a la seva pila (s'ha desfet pel seu camí, s'ha
 * esborrat el dibuix, ha canviat el torn, s'ha eliminat el token…), l'entrada ha caducat i
 * se salta. Així cap camí que buidi una pila pel seu compte no pot desordenar el desfer.
 */
export type UndoKind = 'stroke' | 'map' | 'move';

export interface UndoEntry { kind: UndoKind; ref: object }

export type UndoStacks = Record<UndoKind, readonly object[]>;

/** Prou per a una sessió llarga; les més antigues ja haurien caducat de la seva pila. */
const LOG_MAX = 500;

/** Apunta una acció desfeible just després d'apilar-la a la seva pila. Les entrades més
 *  antigues de `LOG_MAX` es descarten (a aquelles altures ja han caducat de la seva pila). */
export function logUndo(log: UndoEntry[], kind: UndoKind, ref: object): void {
  log.push({ kind, ref });
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
}

/**
 * L'acció que desfaria el proper «Desfer»: l'última del registre que encara és a la seva
 * pila (les que ja no hi són han caducat). No modifica res.
 */
export function peekUndo(log: readonly UndoEntry[], stacks: UndoStacks): UndoEntry | null {
  for (let i = log.length - 1; i >= 0; i--) {
    if (stacks[log[i].kind].includes(log[i].ref)) return log[i];
  }
  return null;
}
