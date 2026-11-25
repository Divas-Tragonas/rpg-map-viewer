import type { Monster } from '@/lib/monsters';

/**
 * Invisibilitat (v5.45). Regles de 5e que l'app aplica com a avís a la guia de tirada:
 *  - qui ataca invisible té avantatge (si l'objectiu no veu l'invisible);
 *  - atacar un invisible que no es veu té desavantatge (si l'atacant no veu l'invisible);
 *  - un contornejat (Foc feèric) es veu encara que sigui invisible, i els atacs contra ell tenen avantatge.
 * L'encanteri Invisibilitat s'acaba en atacar o llançar un conjur; la superior i la natural, no.
 */
type Conds = Record<string, readonly string[] | undefined>;

const has = (c: Conds, k: string | undefined, id: string) => !!k && !!c[k]?.includes(id);

/** Invisible i sense contornejar: els altres no el veuen. */
export const isUnseen = (c: Conds, k: string | undefined) => has(c, k, 'invisible') && !has(c, k, 'outlined');

/** Motius d'avantatge i de desavantatge d'un atac per la vista. */
export function sightAdv(c: Conds, attacker: string | undefined, target: string | undefined): { adv: string[]; dis: string[] } {
  const adv: string[] = [], dis: string[] = [];
  if (isUnseen(c, attacker) && !has(c, target, 'see_invisible')) adv.push('atacant invisible');
  if (isUnseen(c, target) && !has(c, attacker, 'see_invisible')) dis.push("no el veu: és invisible");
  if (has(c, target, 'outlined')) adv.push('contornejat');
  return { adv, dis };
}

/** Invisible de natura o amb Invisibilitat superior (caçador invisible, fada): atacar no la trenca. */
export function naturalInvisible(mo: Monster | null | undefined): boolean {
  if (!mo) return false;
  return (mo.traits ?? []).some(t => /^invisib/i.test(t.trim())) || (mo.powers ?? []).some(p => p.id === 'superior_invisibility');
}
