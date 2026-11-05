/**
 * Desfer / refer únic del DM (v4.87). Abans hi havia tres piles (traços, mapa i moviments de
 * combat) i un registre que només en recordava l'ordre; no hi havia refer i moltes accions
 * (moure un token el DM, obrir una porta, estats, PV…) no es podien desfer.
 *
 * Ara és una sola pila d'ORDRES REVERSIBLES (`past`/`future`). Cada ordre guarda només el que
 * toca (els tokens afectats, la porta, la geometria del mapa…), mai una instantània de tota la
 * partida: així desfer un moviment del DM no desfà el moviment que un jugador ha fet després.
 *
 * La manera habitual de fer-ne una és `snapCmd`: es crea ABANS del canvi amb una funció que
 * captura l'estat que tocarà i una que el restaura. L'estat «després» es captura en el moment
 * de desfer (llavors l'actual ÉS el després), i refer el torna a posar.
 *
 * La pila és només del DM: no es desa a la partida ni es sincronitza. Desfer i refer passen
 * per les mateixes funcions que l'acció, o sigui que el jugador rep l'estat resultant pel
 * camí de sempre (`STATE`, `UNDO_DRAW`).
 */
export type UndoDir = 'undo' | 'redo';

export interface UndoCmd {
  /** Què es desfarà, per al `title` del botó («afegir paret», «moure Liriandor»…). */
  label: string;
  undo(): void;
  redo(): void;
  /** Encara té sentit en aquesta direcció? Les caducades se salten (i es descarten). */
  alive?(dir: UndoDir): boolean;
  /** Ordres seguides amb la mateixa clau i en menys de `MERGE_MS` s'agrupen en una. */
  mergeKey?: string;
  /** Marca de temps de l'última vegada que s'hi ha agrupat res. */
  at: number;
}

export interface UndoHistory { past: UndoCmd[]; future: UndoCmd[] }

/** Entrades màximes de la pila de desfer (les més antigues es descarten). */
export const UNDO_MAX = 100;
/** Finestra per agrupar clics seguits (−1 PV cinc cops = un sol desfer). */
export const MERGE_MS = 1500;

export const emptyHistory = (): UndoHistory => ({ past: [], future: [] });

/** Buida les dues piles (carregar partida, canviar d'escena…). */
export function clearHistory(h: UndoHistory): void { h.past = []; h.future = []; }

/**
 * Apila una ordre ja feta. Qualsevol acció nova buida el refer. Si té la mateixa `mergeKey`
 * que l'última i és recent, s'hi agrupa: es conserva l'«abans» de la primera.
 */
export function pushUndo(h: UndoHistory, cmd: UndoCmd): void {
  h.future = [];
  const last = h.past[h.past.length - 1];
  if (cmd.mergeKey && last && last.mergeKey === cmd.mergeKey && cmd.at - last.at < MERGE_MS) {
    last.at = cmd.at;
    return;
  }
  h.past.push(cmd);
  if (h.past.length > UNDO_MAX) h.past.splice(0, h.past.length - UNDO_MAX);
}

/** La propera ordre viva de la pila (les caducades de dalt es descarten). No l'executa. */
export function peekUndo(h: UndoHistory, dir: UndoDir = 'undo'): UndoCmd | null {
  const st = dir === 'undo' ? h.past : h.future;
  while (st.length) {
    const c = st[st.length - 1];
    if (!c.alive || c.alive(dir)) return c;
    st.pop();
  }
  return null;
}

/** Desfà o refà la propera ordre viva i la passa a l'altra pila. Retorna l'ordre, o null. */
export function stepUndo(h: UndoHistory, dir: UndoDir): UndoCmd | null {
  const c = peekUndo(h, dir);
  if (!c) return null;
  (dir === 'undo' ? h.past : h.future).pop();
  if (dir === 'undo') c.undo(); else c.redo();
  // Una ordre desfeta no s'ha d'agrupar amb la següent acció nova.
  c.at = 0;
  (dir === 'undo' ? h.future : h.past).push(c);
  return c;
}

/**
 * Ordre per instantània: `capture` llegeix l'estat que tocarà l'acció i `restore` el torna a
 * posar. Es crea ABANS del canvi (captura l'«abans»); l'«després» es captura en desfer.
 */
export function snapCmd<S>(label: string, capture: () => S, restore: (s: S) => void,
  opts: { mergeKey?: string; alive?: (dir: UndoDir) => boolean } = {}): UndoCmd {
  const before = capture();
  let after: S | undefined;
  return {
    label, at: Date.now(), mergeKey: opts.mergeKey, alive: opts.alive,
    undo() { after = capture(); restore(before); },
    redo() { if (after !== undefined) restore(after); },
  };
}
