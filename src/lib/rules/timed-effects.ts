/**
 * Durades en combat (v5 snapshot 5): els estats que posa una màgia (Dormir, Riure horrible) i els
 * beneficis (Escut, Beneït) s'acaben sols quan toca segons les regles de 5e.
 *
 * El rellotge és el **torn del llançador**: «1 minut» = 10 rondes = l'efecte s'acaba quan el seu
 * torn torna a començar per 10a vegada; Escut, «fins al principi del seu proper torn», a la 1a.
 * Només en combat: fora de torns no hi ha rondes i els estats queden fins que el DM els treu.
 * Viu al DM (no viatja als jugadors) i es desa amb la partida.
 */
export interface TimedEffect {
  id: string;
  /** Token afectat (`pl_*`/`lib_*`) i estats que li va posar l'efecte. */
  target: string;
  conditions: string[];
  /** Per als avisos: «Escut (Liriandor)». */
  label: string;
  /** Token del rellotge (el llançador) i inicis del seu torn que falten. */
  clock: string;
  turnsLeft: number;
  /** S'acaba si l'afectat rep dany (Dormir). */
  endsOnDamage?: boolean;
}

/** Comença el torn de `key`: torna els efectes que s'acaben ara i els que continuen. */
export function tickTurnStart(effects: readonly TimedEffect[], key: string): { ended: TimedEffect[]; left: TimedEffect[] } {
  const ended: TimedEffect[] = [], left: TimedEffect[] = [];
  for (const e of effects) {
    if (e.clock !== key) { left.push(e); continue; }
    const n = e.turnsLeft - 1;
    if (n <= 0) ended.push(e); else left.push({ ...e, turnsLeft: n });
  }
  return { ended, left };
}

/** `key` rep dany: s'acaben els efectes que ho diuen (Dormir). */
export function onDamaged(effects: readonly TimedEffect[], key: string): { ended: TimedEffect[]; left: TimedEffect[] } {
  const ended = effects.filter(e => e.target === key && e.endsOnDamage);
  return { ended, left: ended.length ? effects.filter(e => !ended.includes(e)) : [...effects] };
}

/** Rondes que li queden a un efecte, per ensenyar-ho («3 rondes»). */
export const roundsText = (e: TimedEffect) => e.turnsLeft === 1 ? "fins al pròxim torn de qui l'ha llançat" : `${e.turnsLeft} rondes`;
