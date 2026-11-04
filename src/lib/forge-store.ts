/**
 * Figuretes desades de la Forja (`ForgeSection`): plantilles del DM, a localStorage (com els mòduls
 * de la història). Entren al bestiari de la Biblioteca, al grup «Forja».
 */
import { createJsonStore } from '@/lib/localStore';
import { parseKit } from '@/lib/sprites/kit';
import type { EnemyTemplate } from '@/lib/bestiary';

export interface ForgedFigure { id: string; name: string; sprite: string; hpMax: number; xp: number; ally: boolean }

function revive(raw: unknown): ForgedFigure[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((f): ForgedFigure[] => {
    if (!f || typeof f !== 'object') return [];
    const o = f as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.name !== 'string' || !parseKit(o.sprite as string)) return [];
    return [{
      id: o.id, name: o.name.slice(0, 60), sprite: o.sprite as string,
      hpMax: Math.max(1, Math.round(Number(o.hpMax) || 1)), xp: Math.max(0, Math.round(Number(o.xp) || 0)), ally: !!o.ally,
    }];
  });
}

export const forgeStore = createJsonStore<ForgedFigure[]>('rpg_forja_v1', [], revive);

export function saveForged(f: Omit<ForgedFigure, 'id'>): ForgedFigure {
  const nf = { ...f, id: `forja_${Date.now().toString(36)}` };
  forgeStore.update(list => [...list, nf]);
  return nf;
}
export function removeForged(id: string) {
  forgeStore.update(list => list.filter(f => f.id !== id));
}

/** Plantilla per afegir-la a l'escena (mateix camí que les del bestiari: `addLibEnemy`). */
export function forgedTemplate(f: Pick<ForgedFigure, 'name' | 'sprite' | 'hpMax' | 'xp' | 'ally'> & { id?: string }): EnemyTemplate {
  return {
    id: f.id ?? 'forja', name: f.name, color: f.ally ? '#5a8ac0' : '#8a5a4a', hpMax: f.hpMax, R: 35, sm: 1,
    sprite: f.sprite, xp: f.ally ? 0 : f.xp, group: 'Bestiari', ...(f.ally ? { ally: true } : {}),
  };
}
