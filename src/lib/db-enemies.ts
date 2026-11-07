/**
 * Enemics de la BD (back office) vistos des del joc (v5 snapshot 7): el bloc de 5e i les defenses
 * d'un token surten, per ordre, de:
 *   1. la llista de la BD carregada ara (`rememberDbEnemies`): si el DM l'edita, el token ho veu;
 *   2. la còpia que es va fer en afegir-lo (`LibEnemy.block`/`defenses`): sense connexió i a les partides desades;
 *   3. el bestiari de l'app (`monsterForTemplate`) per a les plantilles pròpies i les figuretes.
 */
import type { ApiEnemy } from '@/lib/api';
import type { LibEnemy } from '@/types';
import { ABILITY_ORDER, type Monster } from '@/lib/monsters';
import { monsterForTemplate } from '@/lib/bestiary';

let cache = new Map<string, ApiEnemy>();

/** Desa la llista de la BD que s'acaba de carregar (Biblioteca o arrencada del DM). */
export function rememberDbEnemies(list: ApiEnemy[]) { cache = new Map(list.map(e => [e.id, e])); }

export const dbEnemy = (templateId: string | undefined) => (templateId ? cache.get(templateId) : undefined);

/** Bloc de 5e d'un enemic de la BD, o null si no en té res d'omplert. */
export function monsterFromApi(e: ApiEnemy): Monster | null {
  const ab = e.abilities;
  const full = !!ab && ABILITY_ORDER.every(k => typeof ab[k] === 'number');
  const has = e.ac !== undefined || full || !!e.attacks?.length || !!e.traits?.length || !!e.cr;
  if (!has) return null;
  return {
    name: e.name, cr: e.cr || '—', hp: e.hpMax, ac: e.ac ?? 10, speed: e.speedFt ?? 30, move: e.move || undefined,
    abilities: full ? (ABILITY_ORDER.map(k => ab![k]!) as unknown as Monster['abilities']) : undefined,
    saves: e.saves, attacks: e.attacks ?? [], traits: e.traits,
  };
}

/** Bloc de 5e d'un enemic al mapa (veure l'ordre a dalt). */
export function monsterForEnemy(en: Pick<LibEnemy, 'templateId' | 'block'>): Monster | null {
  const db = dbEnemy(en.templateId);
  if (db) return monsterFromApi(db);
  return en.block ?? monsterForTemplate(en.templateId);
}
