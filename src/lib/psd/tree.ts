import type { PSDLayer, MapStructure, EnemyRoom } from '@/types';

export function buildTree(flat: PSDLayer[]): PSDLayer[] {
  const stack: (PSDLayer & { children: PSDLayer[]; isGroup: boolean })[] = [];
  const roots: PSDLayer[] = [];
  for (const l of flat) {
    if (l.secType === 3) {
      stack.push({ ...l, children: [], isGroup: true });
    } else if (l.secType === 1 || l.secType === 2) {
      const g = stack.pop();
      if (g) {
        g.name = l.name; g.visible = l.visible;
        (stack[stack.length - 1]?.children ?? roots).push(g);
      }
    } else {
      (stack[stack.length - 1]?.children ?? roots).push({ ...l, children: [], isGroup: false });
    }
  }
  return roots;
}

export function validateStructure(tree: PSDLayer[]): { warnings: string[]; structure: MapStructure } {
  const fg = (n: string) => tree.find(x => x.isGroup && x.name.trim().toUpperCase() === n);
  const findBG = (ns: PSDLayer[]): PSDLayer | null => {
    for (const n of ns) {
      if (!n.isGroup && n.name.trim().toUpperCase() === 'BG') return n;
      if (n.children) { const f = findBG(n.children); if (f) return f; }
    }
    return null;
  };

  const extras = fg('EXTRAS'), zonas = fg('ZONAS');
  const warnings: string[] = [];
  if (!extras) warnings.push('Sin carpeta EXTRAS');
  if (!zonas)  warnings.push('Sin carpeta ZONAS');
  if (!findBG(tree)) warnings.push('Sin capa BG de referencia');

  const extrasNode = (extras || { id: -1, name: 'EXTRAS', children: [], isGroup: true }) as PSDLayer & { children: PSDLayer[]; isGroup: true };
  const roomLayers = zonas ? (zonas.children || []).filter(n => !n.isGroup) : [];
  const RESERVED = new Set(['EXTRAS', 'ZONAS', 'BG']);
  const ezFromZonas = zonas ? (zonas.children || []).filter(n => n.isGroup) : [];
  const ezFromRoot  = tree.filter(n => n.isGroup && !RESERVED.has(n.name.trim().toUpperCase()));
  const seen = new Set<number>();
  const enemyRooms: EnemyRoom[] = [...ezFromZonas, ...ezFromRoot]
    .filter(z => { if (seen.has(z.id)) return false; seen.add(z.id); return true; })
    .map(z => {
      const directEnemies = z.children ? z.children.filter(n => !n.isGroup) : [];
      const subGroups = z.children ? z.children.filter(n => n.isGroup).map(sg => ({
        id: sg.id, name: sg.name,
        enemies: sg.children ? sg.children.filter(n => !n.isGroup) : [],
      })) : [];
      const allEnemies = [...directEnemies, ...subGroups.flatMap(sg => sg.enemies)];
      return { id: z.id, name: z.name, enemies: allEnemies, directEnemies, subGroups };
    });

  return { warnings, structure: { extras: extrasNode, roomLayers, enemyRooms } };
}
