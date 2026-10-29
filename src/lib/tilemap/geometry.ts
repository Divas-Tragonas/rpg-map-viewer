/**
 * D'un mapa de caselles a la geometria de joc de sempre: parets (`Wall[]`), portes
 * (`Door[]`), llums (`LightSource[]`) i el filtre de sales. Així les sales fosques, la
 * llum per línia de visió, la boira i les col·lisions funcionen igual que amb parets
 * dibuixades a mà, sense que el DM n'hagi de dibuixar cap.
 */
import type { Wall, Door, LightSource, Point } from '@/types';
import { TILE, type TileMap, cellOf, isWall, isVoid, inMap } from './model';
import { objectDef } from './palette';
import { doorAxis } from './render';

/**
 * Parets: una aresta a cada costat entre una casella de paret i una que no ho és. Les que
 * toquen el buit (sense terra) no, perquè una sala envoltada de buit no tingui una segona
 * «sala» exterior que l'abraci. Els trams contigus de la mateixa línia s'uneixen (menys
 * segments → detecció de sales més ràpida). Les portes afegeixen un tram pel mig de la seva
 * casella, d'una paret a l'altra: parteix la sala en dues i hi va la `Door`.
 */
export function tileWalls(m: TileMap): { walls: Wall[]; doorSegs: Map<number, { a: Point; b: Point }> } {
  const open = (c: number, r: number) => inMap(m, c, r) && !isWall(m, c, r) && !isVoid(m, cellOf(m, c, r));
  // Arestes unitàries agrupades per línia: horitzontals per y, verticals per x.
  const hLines = new Map<number, number[]>(), vLines = new Map<number, number[]>();
  const push = (map: Map<number, number[]>, k: number, v: number) => { const a = map.get(k); if (a) a.push(v); else map.set(k, [v]); };
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    if (!isWall(m, c, r)) continue;
    if (open(c, r - 1)) push(hLines, r, c);          // vora de dalt de la paret
    if (open(c, r + 1)) push(hLines, r + 1, c);      // vora de baix
    if (open(c - 1, r)) push(vLines, c, r);          // vora esquerra
    if (open(c + 1, r)) push(vLines, c + 1, r);      // vora dreta
  }
  const walls: Wall[] = [];
  const merge = (lines: Map<number, number[]>, horiz: boolean) => {
    for (const [k, list] of lines) {
      const s = [...new Set(list)].sort((a, b) => a - b);
      let start = s[0], prev = s[0];
      const flush = () => {
        if (horiz) walls.push({ a: { x: start * TILE, y: k * TILE }, b: { x: (prev + 1) * TILE, y: k * TILE } });
        else walls.push({ a: { x: k * TILE, y: start * TILE }, b: { x: k * TILE, y: (prev + 1) * TILE } });
      };
      for (let i = 1; i < s.length; i++) {
        if (s[i] === prev + 1) { prev = s[i]; continue; }
        flush(); start = prev = s[i];
      }
      if (s.length) flush();
    }
  };
  merge(hLines, true); merge(vLines, false);

  const doorSegs = new Map<number, { a: Point; b: Point }>();
  for (const k of Object.keys(m.doors)) {
    const i = +k, c = i % m.cols, r = Math.floor(i / m.cols);
    const seg = doorAxis(m, c, r) === 'h'
      ? { a: { x: c * TILE, y: (r + 0.5) * TILE }, b: { x: (c + 1) * TILE, y: (r + 0.5) * TILE } }
      : { a: { x: (c + 0.5) * TILE, y: r * TILE }, b: { x: (c + 0.5) * TILE, y: (r + 1) * TILE } };
    walls.push(seg);
    doorSegs.set(i, seg);
  }
  return { walls, doorSegs };
}

/** Portes del mapa (`td_<casella>`), conservant si estaven obertes. Neixen tancades. */
export function tileDoors(doorSegs: Map<number, { a: Point; b: Point }>, prev: Door[]): Door[] {
  const was = new Map(prev.map(d => [d.id, d]));
  return [...doorSegs].map(([i, s]) => ({ id: `td_${i}`, a: s.a, b: s.b, open: was.get(`td_${i}`)?.open ?? false }));
}

/** Llums dels objectes que en fan (torxes): `tl_<columna>_<fila>`. */
export function tileLights(m: TileMap): LightSource[] {
  const out: LightSource[] = [];
  for (const o of m.objects) {
    const ft = objectDef(o.k)?.lightFt;
    if (ft) out.push({ id: `tl_${o.c}_${o.r}`, x: (o.c + 0.5) * TILE, y: (o.r + 1) * TILE, radiusFt: ft });
  }
  return out;
}

/**
 * Filtre de sales: la detecció de cares no resta forats, o sigui que el contorn exterior
 * d'un bloc de paret també surt com a «sala» (que conté parets). Es descarten les cares on
 * més d'un 15% de les caselles de dins són paret; un pilar enmig d'una sala no hi arriba.
 */
export function keepRoomFace(m: TileMap, poly: Point[]): boolean {
  let xs = Infinity, xe = -Infinity, ys = Infinity, ye = -Infinity;
  for (const p of poly) { xs = Math.min(xs, p.x); xe = Math.max(xe, p.x); ys = Math.min(ys, p.y); ye = Math.max(ye, p.y); }
  let inside = 0, walls = 0;
  for (let r = Math.floor(ys / TILE); r <= Math.ceil(ye / TILE); r++) for (let c = Math.floor(xs / TILE); c <= Math.ceil(xe / TILE); c++) {
    if (!inMap(m, c, r)) continue;
    if (!pointIn(poly, (c + 0.5) * TILE, (r + 0.5) * TILE)) continue;
    inside++;
    if (isWall(m, c, r)) walls++;
  }
  return inside > 0 && walls / inside <= 0.15;
}

function pointIn(poly: Point[], x: number, y: number): boolean {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}
