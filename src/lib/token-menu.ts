import type { DMRefs } from '@/hooks/useDMRefs';
import type { ContextMenuState } from '@/types';

/**
 * Estat del menú del clic dret d'un token (jugador `pl_*` o biblioteca `lib_*`). Un sol lloc per construir-lo: el fan servir el clic dret al mapa i el clic
 * dret a una fila del lateral, i tots dos han d'obrir exactament el mateix menú.
 */
export function tokenMenuFor(R: DMRefs, id: string | number, x: number, y: number, anchor?: ContextMenuState['anchor']): ContextMenuState | null {
  const key = String(id);
  const existingGroupId = R.rTokenGroups.current.get(id);
  if (key.startsWith('lib_')) {
    const en = R.rLibEnemies.current.find(e => `lib_${e.id}` === key);
    if (!en) return null;
    return { id: key, name: en.name, x, y, isLibEnemy: true, libEnemyId: en.id, tokenPos: R.rPos.current[key] || { x: 0, y: 0 }, existingGroupId, anchor, canAttack: true };
  }
  if (key.startsWith('pl_')) {
    const pl = R.rPlayers.current.find(p => `pl_${p.id}` === key);
    if (!pl) return null;
    // La posició d'un jugador és la cantonada; el centre (origen dels conjurs) és a +R.
    const pos = R.rPos.current[key] || { x: pl.x, y: pl.y };
    const r = R.rTokenSizeOverride.current[key] ?? 22;
    return { id: key, name: pl.name, x, y, existingGroupId, casterPos: { x: pos.x + r, y: pos.y + r }, anchor, canAttack: true };
  }
  return null;
}
