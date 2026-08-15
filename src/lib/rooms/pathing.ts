import type { Point, Wall } from '@/types';
import { segmentsIntersect } from '@/lib/geometry';

// Límit de seguretat del radi de moviment en caselles (velocitat màx. 995 ft → 199).
const MAX_CELLS_CAP = 220;

export interface CellGridInfo {
  gs: number;   // mida de casella (px de mapa)
  gox: number;  // origen del grid normalitzat (0..gs)
  goy: number;
}

/** Cert si el segment AB creua (encreuament propi) alguna paret. */
export function segmentBlocked(a: Point, b: Point, walls: Wall[]): boolean {
  for (const w of walls) {
    if (segmentsIntersect(a, b, w.a, w.b)) return true;
  }
  return false;
}

/**
 * Punt més llunyà d'A cap a B sense creuar cap paret, amb lliscament: si el tram directe
 * xoca, es prova de projectar sobre cada eix (moviment "resbalant" per la paret). Si tot
 * xoca, es queda a A. Per al drag sense grid a la pantalla de jugador.
 */
export function slideAgainstWalls(a: Point, b: Point, walls: Wall[]): Point {
  if (!segmentBlocked(a, b, walls)) return b;
  const slideX = { x: b.x, y: a.y };
  if (slideX.x !== a.x && !segmentBlocked(a, slideX, walls)) return slideX;
  const slideY = { x: a.x, y: b.y };
  if (slideY.y !== a.y && !segmentBlocked(a, slideY, walls)) return slideY;
  return a;
}

/**
 * Caselles abastables dins del pressupost de moviment tenint en compte les parets.
 *
 * Dijkstra 8-dir sobre caselles amb cost de CAMÍ real (1 ortogonal, √2 diagonal): una
 * casella és abastable si hi ha un camí que no creui cap paret amb cost ≤ maxCells + 0.5.
 * Una paret bloqueja el pas i cal vorejar-la per una obertura (porta) — i el desvium ES
 * COBRA (anar per darrere d'una paret via la porta costa el camí sencer, no la línia
 * recta). Les diagonals no poden "colar-se" per una cantonada: a més del tram diagonal
 * net, cal que almenys un dels dos camins en L també sigui transitable.
 *
 * Retorna un mapa "dc,dr" → cost del camí en caselles (deltes respecte la casella
 * d'origen), o `null` si no hi ha parets (el disc euclidià pur, sense cost extra — el
 * comportament de sempre del clamp).
 */
export function computeReachableCells(
  walls: Wall[],
  startCol: number,
  startRow: number,
  maxCells: number,
  grid: CellGridInfo,
): Map<string, number> | null {
  if (walls.length === 0) return null;
  const mc = Math.min(Math.max(0, maxCells), MAX_CELLS_CAP);
  const budget = mc + 0.5;
  const { gs, gox, goy } = grid;
  const center = (dc: number, dr: number): Point => ({
    x: gox + (startCol + dc + 0.5) * gs,
    y: goy + (startRow + dr + 0.5) * gs,
  });

  // Índex espacial: parets per casella (bbox del segment, eixamplat 1 casella).
  // Fa que el flood fill només comprovi interseccions amb parets properes.
  const index = new Map<string, Wall[]>();
  for (const w of walls) {
    const c0 = Math.floor((Math.min(w.a.x, w.b.x) - gox) / gs) - 1;
    const c1 = Math.floor((Math.max(w.a.x, w.b.x) - gox) / gs) + 1;
    const r0 = Math.floor((Math.min(w.a.y, w.b.y) - goy) / gs) - 1;
    const r1 = Math.floor((Math.max(w.a.y, w.b.y) - goy) / gs) + 1;
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
      const k = `${c},${r}`;
      const arr = index.get(k);
      if (arr) arr.push(w); else index.set(k, [w]);
    }
  }
  const localBlocked = (a: Point, b: Point, dc: number, dr: number): boolean => {
    const nearby = index.get(`${startCol + dc},${startRow + dr}`);
    if (!nearby) return false;
    for (const w of nearby) if (segmentsIntersect(a, b, w.a, w.b)) return true;
    return false;
  };
  // Pas d'una casella a una veïna: bloquejat si el tram centre→centre creua una paret.
  const stepBlocked = (dc: number, dr: number, ndc: number, ndr: number): boolean =>
    localBlocked(center(dc, dr), center(ndc, ndr), dc, dr);

  const SQRT2 = Math.SQRT2;
  const reach = new Map<string, number>([['0,0', 0]]);
  // Min-heap [cost, dc, dr] (Dijkstra): els grafs són petits (radi ≤ MAX_CELLS_CAP).
  const heap: [number, number, number][] = [[0, 0, 0]];
  const heapPush = (item: [number, number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const heapPop = (): [number, number, number] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.length) {
    const [cost, dc, dr] = heapPop();
    if (cost > (reach.get(`${dc},${dr}`) ?? Infinity)) continue;  // entrada obsoleta
    for (const [sx, sy] of DIRS) {
      const ndc = dc + sx, ndr = dr + sy;
      const diag = sx !== 0 && sy !== 0;
      const ncost = cost + (diag ? SQRT2 : 1);
      if (ncost > budget) continue;
      const k = `${ndc},${ndr}`;
      if (ncost >= (reach.get(k) ?? Infinity)) continue;
      if (stepBlocked(dc, dr, ndc, ndr)) continue;
      if (diag) {
        // Diagonal: exigir també un camí en L net (no travessar la punta d'una paret).
        const viaX = !stepBlocked(dc, dr, dc + sx, dr) && !stepBlocked(dc + sx, dr, ndc, ndr);
        const viaY = !stepBlocked(dc, dr, dc, dr + sy) && !stepBlocked(dc, dr + sy, ndc, ndr);
        if (!viaX && !viaY) continue;
      }
      reach.set(k, ncost);
      heapPush([ncost, ndc, ndr]);
    }
  }
  return reach;
}

/**
 * Suavitza una polilínia amb corner-cutting de Chaikin (manté els extrems): converteix
 * l'escala esglaonada del camí per caselles en una corba natural i realista. 2 iteracions
 * arrodoneixen prou les cantonades sense allunyar-se gaire del camí (queda dins ~¼ casella,
 * lluny de les parets, que són a la vora de casella).
 */
export function smoothPath(pts: Point[], iterations = 2): Point[] {
  if (pts.length <= 2) return pts;
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const out: Point[] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const p = cur[i], q = cur[i + 1];
      out.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 });
      out.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

/** Casella [col, fila] que ocupa un token amb cantonada superior esquerra `pos` i radi `R`. */
export function cellOf(pos: Point, R: number, grid: CellGridInfo): [number, number] {
  const { gs, gox, goy } = grid;
  return [Math.floor((pos.x + R - gox) / gs), Math.floor((pos.y + R - goy) / gs)];
}

/**
 * Polilínia suavitzada que ha de recórrer un token per anar de `from` a `to` (coords de
 * cantonada del token, com `rPos`): el camí real vorejant les parets (forma d'L) quan hi
 * ha grid i parets, o la línia recta si no n'hi ha (només amb `straightFallback`).
 * Inclou l'origen i acaba EXACTE al destí. Retorna `null` si no cal animar cap camí
 * (llavors el moviment és el LERP recte de sempre).
 */
export function buildMovePath(
  from: Point,
  to: Point,
  o: { walls: Wall[]; grid: CellGridInfo; R: number; maxCells?: number; straightFallback?: boolean },
): Point[] | null {
  const { walls, grid, R, maxCells = 260, straightFallback = false } = o;
  const straight = (): Point[] | null =>
    straightFallback && (from.x !== to.x || from.y !== to.y) ? [{ ...from }, { ...to }] : null;
  if (grid.gs <= 0 || walls.length === 0) return straight();
  const [sCol, sRow] = cellOf(from, R, grid);
  const [dCol, dRow] = cellOf(to, R, grid);
  const pts = computePath(walls, sCol, sRow, dCol, dRow, grid, maxCells);
  if (!pts || pts.length < 2) return straight();
  const wp = pts.map(p => ({ x: p.x - R, y: p.y - R }));
  wp[wp.length - 1] = { x: to.x, y: to.y };  // acabar exacte al destí
  return smoothPath([from, ...wp], 2);
}

/**
 * Camí més curt (Dijkstra 8-dir amb cost real, mateixes regles de paret que
 * `computeReachableCells`) de la casella d'origen a la de destí. Retorna la llista de
 * **centres de casella** (coords de mapa) des del primer pas fins al destí (exclou
 * l'origen), o `null` si no hi ha parets, no hi ha moviment, o el destí no és abastable.
 * S'usa per animar el moviment del token **vorejant les parets** (forma d'L) en lloc de
 * la línia recta, que travessaria sales fosques que el token no recorre de veritat.
 */
export function computePath(
  walls: Wall[],
  startCol: number, startRow: number,
  destCol: number, destRow: number,
  grid: CellGridInfo,
  maxCells: number,
): Point[] | null {
  if (walls.length === 0) return null;
  const ddc = destCol - startCol, ddr = destRow - startRow;
  if (ddc === 0 && ddr === 0) return null;
  const mc = Math.min(Math.max(0, maxCells), MAX_CELLS_CAP);
  const budget = mc + 0.5;
  const { gs, gox, goy } = grid;
  const center = (dc: number, dr: number): Point => ({
    x: gox + (startCol + dc + 0.5) * gs,
    y: goy + (startRow + dr + 0.5) * gs,
  });
  const index = new Map<string, Wall[]>();
  for (const w of walls) {
    const c0 = Math.floor((Math.min(w.a.x, w.b.x) - gox) / gs) - 1;
    const c1 = Math.floor((Math.max(w.a.x, w.b.x) - gox) / gs) + 1;
    const r0 = Math.floor((Math.min(w.a.y, w.b.y) - goy) / gs) - 1;
    const r1 = Math.floor((Math.max(w.a.y, w.b.y) - goy) / gs) + 1;
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
      const k = `${c},${r}`;
      const arr = index.get(k);
      if (arr) arr.push(w); else index.set(k, [w]);
    }
  }
  const localBlocked = (a: Point, b: Point, dc: number, dr: number): boolean => {
    const nearby = index.get(`${startCol + dc},${startRow + dr}`);
    if (!nearby) return false;
    for (const w of nearby) if (segmentsIntersect(a, b, w.a, w.b)) return true;
    return false;
  };
  const stepBlocked = (dc: number, dr: number, ndc: number, ndr: number): boolean =>
    localBlocked(center(dc, dr), center(ndc, ndr), dc, dr);

  const SQRT2 = Math.SQRT2;
  const dist = new Map<string, number>([['0,0', 0]]);
  const prev = new Map<string, string>();
  const heap: [number, number, number][] = [[0, 0, 0]];
  const heapPush = (item: [number, number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const heapPop = (): [number, number, number] => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const destKey = `${ddc},${ddr}`;
  while (heap.length) {
    const [cost, dc, dr] = heapPop();
    if (cost > (dist.get(`${dc},${dr}`) ?? Infinity)) continue;
    if (dc === ddc && dr === ddr) break;
    for (const [sx, sy] of DIRS) {
      const ndc = dc + sx, ndr = dr + sy;
      const diag = sx !== 0 && sy !== 0;
      const ncost = cost + (diag ? SQRT2 : 1);
      if (ncost > budget) continue;
      const k = `${ndc},${ndr}`;
      if (ncost >= (dist.get(k) ?? Infinity)) continue;
      if (stepBlocked(dc, dr, ndc, ndr)) continue;
      if (diag) {
        const viaX = !stepBlocked(dc, dr, dc + sx, dr) && !stepBlocked(dc + sx, dr, ndc, ndr);
        const viaY = !stepBlocked(dc, dr, dc, dr + sy) && !stepBlocked(dc, dr + sy, ndc, ndr);
        if (!viaX && !viaY) continue;
      }
      dist.set(k, ncost);
      prev.set(k, `${dc},${dr}`);
      heapPush([ncost, ndc, ndr]);
    }
  }
  if (!dist.has(destKey)) return null;
  const cells: [number, number][] = [];
  let cur = destKey;
  while (cur !== '0,0') {
    const [c, r] = cur.split(',').map(Number);
    cells.push([c, r]);
    const p = prev.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  cells.reverse();
  if (cells.length === 0) return null;
  return cells.map(([c, r]) => center(c, r));
}
