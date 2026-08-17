import type { LibEnemy } from '@/types';

/**
 * Nom base d'un token: el nom sense el número que hi hem posat nosaltres al final.
 * "Goblin" → "Goblin"; "Goblin 2" → "Goblin"; "Goblin Cap" → "Goblin Cap" (nom propi
 * del DM, no s'hi toca mai).
 */
export function baseEnemyName(name: string): string {
  return name.replace(/\s+\d+$/, '').trim();
}

/**
 * Afegeix un enemic a la llista numerant els tokens que comparteixen nom base.
 *
 * Regla: el primer Goblin es diu "Goblin" (sense número). En crear-ne un segon, el
 * primer passa a dir-se "Goblin 1" i el nou "Goblin 2", i a partir d'aquí la sèrie va
 * ascendint. Els tokens amb un nom propi que el DM hagi escrit ("Goblin Cap") tenen un
 * nom base diferent i queden fora de la sèrie.
 */
export function addEnemyNumbered(list: LibEnemy[], newEn: LibEnemy): LibEnemy[] {
  const base = baseEnemyName(newEn.name);
  const sameBase = list.filter(e => baseEnemyName(e.name) === base);
  if (sameBase.length === 0) return [...list, { ...newEn, name: base }];
  let n = 0;
  const renumbered = list.map(e => (baseEnemyName(e.name) === base ? { ...e, name: `${base} ${++n}` } : e));
  return [...renumbered, { ...newEn, name: `${base} ${n + 1}` }];
}
