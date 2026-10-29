/**
 * Pinzells de l'editor de caselles. Funcions pures sobre una còpia del mapa
 * (`cloneTileMap`): el desfer guarda el mapa d'abans per referència.
 */
import {
  type TileMap, EMPTY, WORLD_BASE, cellOf, inMap, isWall,
} from './model';
import { FLOOR_BY_ID, WATERS, WALL_BY_ID, objectDef, variantFor } from './palette';

export type TileBrush =
  /** Rectangle: terra a dins i paret a la vora. La manera ràpida de fer una masmorra. */
  | { kind: 'room'; floor: string; wall: string }
  | { kind: 'floor'; floor: string }
  | { kind: 'water'; water: string }
  | { kind: 'wall'; wall: string }
  /** Converteix una casella de paret (entre dues parets) en porta. */
  | { kind: 'door' }
  | { kind: 'decor'; tile: number }
  | { kind: 'object'; key: string }
  /** Peça del mapa del món (`uf_map.png`) com a terra. */
  | { kind: 'world'; tile: number }
  | { kind: 'erase' };

/** El pinzell es pinta arrossegant (casella a casella) o com a rectangle. */
export const isRectBrush = (b: TileBrush) => b.kind === 'room';

export type Cell = { c: number; r: number };

/** Caselles del rectangle entre dues cantonades (incloses). */
export function rectCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++)
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) out.push({ c, r });
  return out;
}

/** Caselles de la línia entre dues (per no deixar forats quan el ratolí va de pressa). */
export function lineCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  const n = Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r), 1);
  for (let i = 0; i <= n; i++) out.push({ c: Math.round(a.c + (b.c - a.c) * i / n), r: Math.round(a.r + (b.r - a.r) * i / n) });
  return out;
}

/** El terra que es veu a la meitat de dalt d'una paret: el de la casella veïna, si no en té. */
function groundUnder(m: TileMap, c: number, r: number): number {
  for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (!inMap(m, c + dc, r + dr)) continue;
    const g = m.ground[cellOf(m, c + dc, r + dr)];
    if (g >= 0 && g < WORLD_BASE) return g;
  }
  return EMPTY;
}

function setFloor(m: TileMap, c: number, r: number, tile: number) {
  const i = cellOf(m, c, r);
  m.ground[i] = tile; m.wallSet[i] = ''; m.wallRaw[i] = EMPTY; delete m.doors[i];
}
function setWall(m: TileMap, c: number, r: number, set: string) {
  const i = cellOf(m, c, r);
  if (i in m.doors) return;  // una porta ja feta no es torna paret per repintar la vora
  m.wallSet[i] = set; m.wallRaw[i] = EMPTY;
  if (m.ground[i] < 0) m.ground[i] = groundUnder(m, c, r);
}
function removeObjectsAt(m: TileMap, c: number, r: number): boolean {
  const before = m.objects.length;
  m.objects = m.objects.filter(o => !(objectDef(o.k)?.parts ?? [{ dx: 0, dy: 0 }]).some(p => o.c + p.dx === c && o.r + p.dy === r));
  return m.objects.length !== before;
}

/**
 * Aplica el pinzell a les caselles (la còpia `m` es modifica). Retorna els índexs tocats
 * (per repintar només aquells al cuinat).
 */
export function applyBrush(m: TileMap, brush: TileBrush, cells: Cell[]): number[] {
  const touched: number[] = [];
  const valid = cells.filter(p => inMap(m, p.c, p.r));
  if (brush.kind === 'room') {
    if (!valid.length) return touched;
    const c0 = Math.min(...valid.map(p => p.c)), c1 = Math.max(...valid.map(p => p.c));
    const r0 = Math.min(...valid.map(p => p.r)), r1 = Math.max(...valid.map(p => p.r));
    const floor = FLOOR_BY_ID.get(brush.floor)?.tiles ?? [];
    // Primer el terra de dins (així les parets de la vora tenen terra per mostrar a dalt).
    for (const p of valid) if (p.c > c0 && p.c < c1 && p.r > r0 && p.r < r1 && floor.length) setFloor(m, p.c, p.r, variantFor(floor, p.c, p.r));
    for (const p of valid) if (!(p.c > c0 && p.c < c1 && p.r > r0 && p.r < r1)) setWall(m, p.c, p.r, brush.wall);
    return valid.map(p => cellOf(m, p.c, p.r));
  }
  for (const { c, r } of valid) {
    const i = cellOf(m, c, r);
    switch (brush.kind) {
      case 'floor': {
        const tiles = FLOOR_BY_ID.get(brush.floor)?.tiles; if (!tiles) break;
        setFloor(m, c, r, variantFor(tiles, c, r)); break;
      }
      case 'water': {
        const w = WATERS.find(x => x.id === brush.water); if (!w) break;
        setFloor(m, c, r, w.base); break;
      }
      case 'world': setFloor(m, c, r, brush.tile); break;
      case 'wall': if (WALL_BY_ID.has(brush.wall)) { delete m.doors[i]; setWall(m, c, r, brush.wall); } break;
      case 'door': {
        const set = m.wallSet[i] || (m.wallRaw[i] >= 0 ? 'dungeon' : '');
        // Només dins d'una paret recta: amb paret als dos costats (E-O o N-S).
        const straight = (isWall(m, c - 1, r) && isWall(m, c + 1, r)) || (isWall(m, c, r - 1) && isWall(m, c, r + 1));
        if (!set || !straight) continue;
        m.doors[i] = set; m.wallSet[i] = ''; m.wallRaw[i] = EMPTY;
        if (m.ground[i] < 0) m.ground[i] = groundUnder(m, c, r);
        break;
      }
      case 'decor': m.overlays[0][i] = brush.tile; break;
      case 'object': removeObjectsAt(m, c, r); m.objects.push({ c, r, k: brush.key }); break;
      case 'erase': {
        // De dalt a baix: objecte → decorat → porta (torna a paret) → paret → terra.
        if (removeObjectsAt(m, c, r)) break;
        let ov = -1;
        for (let k = m.overlays.length - 1; k >= 0 && ov < 0; k--) if (m.overlays[k][i] >= 0) ov = k;
        if (ov >= 0) { m.overlays[ov][i] = EMPTY; break; }
        if (i in m.doors) { m.wallSet[i] = m.doors[i]; delete m.doors[i]; break; }
        if (m.wallSet[i] || m.wallRaw[i] >= 0) { m.wallSet[i] = ''; m.wallRaw[i] = EMPTY; break; }
        m.ground[i] = EMPTY;
        break;
      }
    }
    touched.push(i);
  }
  return touched;
}
