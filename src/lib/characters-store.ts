/**
 * Còpia local de les fitxes (v4.68): perquè funcionin sense connexió amb la API o el back office.
 *
 *  - **Còpia** (`rpg_characters_v1`): l'última llista que ha tornat la API. Si no n'hi ha mai
 *    hagut cap, les fitxes de Notion (`CHARACTER_SEED`) amb ids locals (`local-…`).
 *  - **Pendents** (`rpg_characters_pending_v1`): els canvis fets sense connexió (experiència i
 *    nivell), en ordre. Es pugen en tornar a connectar (`useCharacters.sync`). L'experiència porta
 *    sempre el seu `awardId`, o sigui que pujar-la dues vegades no la compta doble.
 *
 * localStorage (no IndexedDB): són uns quants KB de text. Tot dins de try/catch: en mode privat o
 * amb la quota plena, l'app funciona igual però no recorda res.
 */
import type { ApiCharacter, ApiCharacterInput } from '@/lib/api';
import { CHARACTER_SEED } from '@/lib/characters-seed';

const CACHE_KEY = 'rpg_characters_v1';
const PENDING_KEY = 'rpg_characters_pending_v1';

export type PendingOp =
  | { kind: 'xp'; id: string; name: string; amount: number; reason: string; source: string; awardId: string }
  | { kind: 'update'; id: string; name: string; patch: Partial<ApiCharacterInput> };

export const isLocalId = (id: string) => id.startsWith('local-');

function read<T>(key: string): T | null {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) as T : null; } catch { return null; }
}
function write(key: string, v: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; }
}

/** Les fitxes desades en aquest navegador (o les de Notion si encara no n'hi ha cap). */
export function loadCachedCharacters(): ApiCharacter[] {
  const c = read<{ characters: ApiCharacter[] }>(CACHE_KEY);
  if (c?.characters?.length) return c.characters;
  return CHARACTER_SEED.map(sd => ({
    ...sd, id: `local-${sd.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}`,
    xp: sd.xp ?? 0, portrait: '', createdAt: '', updatedAt: '',
  }));
}

export function saveCachedCharacters(list: ApiCharacter[]) {
  if (write(CACHE_KEY, { characters: list, savedAt: Date.now() })) return;
  // Quota plena: els retrats són el que pesa (dataURL). Sense ells, la resta hi cap segur.
  write(CACHE_KEY, { characters: list.map(c => ({ ...c, portrait: '' })), savedAt: Date.now() });
}

export function loadPending(): PendingOp[] {
  return read<PendingOp[]>(PENDING_KEY) ?? [];
}

export function savePending(ops: PendingOp[]) {
  if (ops.length) write(PENDING_KEY, ops);
  else { try { localStorage.removeItem(PENDING_KEY); } catch { /* res */ } }
}

/** Aplica un canvi pendent a la còpia local (la UI el veu a l'instant, abans de pujar-lo). */
export function applyLocally(list: ApiCharacter[], op: PendingOp): ApiCharacter[] {
  return list.map(c => {
    if (c.id !== op.id) return c;
    if (op.kind === 'xp') return { ...c, xp: Math.max(0, c.xp + op.amount) };
    return { ...c, ...op.patch } as ApiCharacter;
  });
}
