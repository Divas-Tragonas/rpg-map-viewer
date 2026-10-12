import type { ApiEnemy } from '@/lib/api';

/**
 * Agrupació dels enemics de la BD (back office i Biblioteca del DM) per projecte o per
 * categoria. Tots dos camps són text lliure a la API (`''` = sense projecte/categoria):
 * els grups es treuen de la mateixa llista d'enemics, no hi ha cap col·lecció de grups.
 */
export type EnemyGroupField = 'project' | 'category';
export type EnemyGroupBy = EnemyGroupField | 'none';

export const GROUP_BY_OPTIONS: { by: EnemyGroupBy; label: string }[] = [
  { by: 'project', label: 'Projecte' },
  { by: 'category', label: 'Categoria' },
  { by: 'none', label: 'Cap' },
];

const EMPTY_LABEL: Record<EnemyGroupField, string> = {
  project: 'Sense projecte',
  category: 'Sense categoria',
};

export interface EnemyGroup {
  /** Clau estable del grup (la que es desa per recordar si està plegat). `''` = sense valor. */
  key: string;
  label: string;
  items: ApiEnemy[];
}

/** Sense majúscules ni espais de més: «Cripta» i «cripta » van al mateix grup. */
export function groupKey(value: string | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('ca');
}

/** Grups en ordre alfabètic; el dels que no en tenen, sempre l'últim. */
export function groupEnemies(enemies: ApiEnemy[], field: EnemyGroupField): EnemyGroup[] {
  const groups = new Map<string, EnemyGroup>();
  for (const en of enemies) {
    const raw = (en[field] ?? '').trim();
    const key = groupKey(raw);
    let g = groups.get(key);
    if (!g) { g = { key, label: raw || EMPTY_LABEL[field], items: [] }; groups.set(key, g); }
    g.items.push(en);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.key !== !b.key) return a.key ? -1 : 1;
    return a.label.localeCompare(b.label, 'ca');
  });
}

/** Valors ja fets servir en un camp, per suggerir-los al formulari (sense repetir-ne la grafia). */
export function distinctValues(enemies: ApiEnemy[], field: EnemyGroupField): string[] {
  const seen = new Map<string, string>();
  for (const en of enemies) {
    const raw = (en[field] ?? '').trim();
    if (raw && !seen.has(groupKey(raw))) seen.set(groupKey(raw), raw);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'ca'));
}

/**
 * Una API anterior a projecte/categoria no retorna aquests camps (la nova els retorna
 * sempre, `''` si no en tenen) i descarta en silenci els que se li envien. Amb la llista
 * buida no es pot saber: es dona per bona.
 */
export function apiSupportsGroups(enemies: ApiEnemy[]): boolean {
  return enemies.length === 0 || enemies.some(en => 'project' in en || 'category' in en);
}
