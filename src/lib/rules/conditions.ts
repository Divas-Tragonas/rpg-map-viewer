/**
 * Efecte mecànic dels estats sobre el moviment.
 *
 * Fins ara els 16 estats eren purament visuals: només `blinded` feia alguna cosa
 * (encongia el radi de llum a `render/darkrooms.ts`). Un token Agafat o Paralitzat es
 * movia els seus 30 peus com si res i el DM ho havia de vigilar de memòria.
 *
 * ⚠️ Aquesta funció ha de ser l'**única** font dels tres llocs que han de coincidir sobre
 * quant es pot moure un token — el clamp del drag (`usePlayerTokenDrag`), la pintura groga
 * (`renderMoveRange`) i la validació autoritzada del DM (`handlePlayerTokenMove`) —
 * exactament com `buildMovePath` va unificar el càlcul del camí. Si divergeixen, el jugador
 * veu un rang que el DM després li rebutja.
 *
 * S'aplica sobre el pressupost que ja tingui el qui crida (velocitat sencera fora de
 * combat, saldo restant del torn dins), i **no** toca `TurnState.activeRemainingFt`: així,
 * si el DM treu l'estat a mig torn, els peus que quedaven tornen a estar disponibles a
 * l'instant en lloc d'haver-se consumit.
 */
import { CONDITIONS } from '@/constants';

/** Estats que deixen la velocitat a 0 (D&D 5e). */
const IMMOBILISING = new Set([
  'grappled',      // Agafat
  'restrained',    // Retingut
  'paralyzed',     // Paralitzat
  'petrified',     // Petrificat
  'stunned',       // Atordit
  'incapacitated', // Incapacitat
  'unconscious',   // Inconscient
]);

/** Estats que redueixen el moviment a la meitat (aixecar-se costa mig moviment). */
const HALVING = new Set(['prone']);

const LABEL = new Map(CONDITIONS.map(c => [c.id, c.label]));

export interface MovementLimit {
  /** Peus que pot moure realment (mai més que el pressupost d'entrada). */
  ft: number;
  /** Estat en català que limita el moviment, per poder dir-ho a la pantalla. */
  reason: string | null;
  /** true si no es pot moure gens. */
  immobile: boolean;
}

/**
 * Peus de moviment efectius d'un token, donats el seu pressupost i els seus estats.
 * Sense estats limitadors retorna el pressupost sencer i `reason: null`.
 */
export function movementLimit(baseFt: number, conds: readonly string[] | undefined): MovementLimit {
  if (!conds || conds.length === 0) return { ft: baseFt, reason: null, immobile: false };
  const blocker = conds.find(c => IMMOBILISING.has(c));
  if (blocker) return { ft: 0, reason: LABEL.get(blocker) ?? blocker, immobile: true };
  const halver = conds.find(c => HALVING.has(c));
  if (halver) {
    // A passos de 5 ft: mig moviment de 30 són 15, i de 25 en són 10 (mai una casella a mitges).
    const ft = Math.floor(baseFt / 2 / 5) * 5;
    return { ft, reason: LABEL.get(halver) ?? halver, immobile: ft <= 0 };
  }
  return { ft: baseFt, reason: null, immobile: false };
}
