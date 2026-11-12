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
import { objectLightPoint } from './objects';

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
    if (!ft) continue;
    // Dues torxes poden compartir l'àncora (una moguda fora de la graella a la casella de l'altra).
    let id = `tl_${o.c}_${o.r}`;
    for (let n = 2; out.some(l => l.id === id); n++) id = `tl_${o.c}_${o.r}_${n}`;
    out.push({ id, ...objectLightPoint(o), radiusFt: ft });
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

/**
 * Sala fosca + les CARES de paret que hi miren (v5.20; des de la v5.21 només la meitat de baix). La
 * paret es veu en perspectiva: la casella de paret que té la sala just a sota té a la meitat de dalt
 * la paret vista des de dalt (que no és de cap sala i es veu sempre, com les parets laterals) i a la
 * de baix la paret vertical, la cara (maó, estendards, teranyines, el que hi hagi posat), que mira
 * cap a dins d'aquella sala, però les parets (`tileWalls`) van a l'aresta paret/terra i
 * la cara quedava fora del polígon: amb la sala fosca, la cara i el que hi havia a sobre es veien.
 * Aquí s'hi afegeix aquesta meitat: el polígon passa a ser «sala ∪ cares», així la foscor, la llum del token de
 * dins (la sala pròpia), la memòria d'explorat i el clic de la sala les inclouen sense tocar res més.
 * Les parets i les col·lisions no canvien (la cara continua sent paret per moure's).
 *
 * Es fa en una graella de mitja casella (les portes parteixen la seva casella pel mig). Només per a
 * polígons sobre aquesta graella (les sales de parets dibuixades a mà es tornen igual). No es
 * compta la cara que hi ha sobre una porta (la porta es pinta per sobre de la foscor i és de dues sales).
 * Idempotent: una sala ja estesa no en canvia.
 */
export function extendRoomFace(m: TileMap, poly: Point[]): Point[] {
  const n = poly.length;
  if (n < 3) return poly;
  const H = TILE / 2;
  if (poly.some(p => p.x % H !== 0 || p.y % H !== 0)) return poly;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  // Mitges caselles del rectangle de la sala més una fila de caselles a dalt (on hi ha les cares).
  const c0 = Math.floor(minX / TILE), c1 = Math.ceil(maxX / TILE), r0 = Math.floor(minY / TILE) - 1, r1 = Math.ceil(maxY / TILE);
  const gx0 = 2 * c0, gy0 = 2 * r0, W = 2 * (c1 - c0), Hh = 2 * (r1 - r0);
  if (W <= 0 || Hh <= 0) return poly;
  const inside = new Uint8Array(W * Hh);
  // Rasteritzat per files (centre de cada mitja casella; regla parell-senar com `pointIn`).
  for (let j = 0; j < Hh; j++) {
    const y = (gy0 + j + 0.5) * H;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / H - 0.5) - gx0), i1 = Math.min(W - 1, Math.floor(xs[k + 1] / H - 0.5) - gx0);
      for (let i = i0; i <= i1; i++) inside[j * W + i] = 1;
    }
  }
  const sub = (gx: number, gy: number) => gx >= gx0 && gy >= gy0 && gx < gx0 + W && gy < gy0 + Hh && inside[(gy - gy0) * W + (gx - gx0)] === 1;
  // Cada cara: la meitat de baix (la paret vertical) a dins; la de dalt (la paret vista des de dalt)
  // a fora. Si ja hi és tal qual, no es toca (idempotent). La v5.20 hi posava la casella sencera:
  // es torna a deixar només la meitat de baix. Una casella de paret amb la sala també a sobre és
  // un pilar de dins de la sala i es queda com és.
  let changed = false;
  const set = (gx: number, gy: number, v: 0 | 1) => {
    const k = (gy - gy0) * W + (gx - gx0);
    if (inside[k] !== v) { inside[k] = v; changed = true; }
  };
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    if (!inMap(m, c, r) || !isWall(m, c, r) || !inMap(m, c, r + 1)) continue;
    if (isWall(m, c, r + 1) || cellOf(m, c, r + 1) in m.doors) continue;
    if (!sub(2 * c, 2 * r + 2) || !sub(2 * c + 1, 2 * r + 2)) continue;
    if (sub(2 * c, 2 * r - 1) || sub(2 * c + 1, 2 * r - 1)) continue;
    set(2 * c, 2 * r, 0); set(2 * c + 1, 2 * r, 0);
    set(2 * c, 2 * r + 1, 1); set(2 * c + 1, 2 * r + 1, 1);
  }
  if (!changed) return poly;

  // Contorn de les mitges caselles: arestes dirigides amb l'interior a la dreta (sentit horari a la
  // pantalla), encadenades en voltes; es queda la més gran (la de fora) sense els vèrtexs alineats.
  const K = W + Hh + 4;
  const key = (x: number, y: number) => (y + 1) * (K + 1) + (x + 1);
  const out = new Map<number, [number, number][]>();
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const k = key(ax, ay), l = out.get(k);
    if (l) l.push([bx, by]); else out.set(k, [[bx, by]]);
  };
  const at = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < Hh && inside[j * W + i] === 1;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    if (!at(i, j)) continue;
    if (!at(i, j - 1)) edge(i, j, i + 1, j);
    if (!at(i + 1, j)) edge(i + 1, j, i + 1, j + 1);
    if (!at(i, j + 1)) edge(i + 1, j + 1, i, j + 1);
    if (!at(i - 1, j)) edge(i, j + 1, i, j);
  }
  let best: [number, number][] = [], bestArea = 0;
  for (const [k0, list] of out) {
    while (list.length) {
      const sx = (k0 % (K + 1)) - 1, sy = Math.floor(k0 / (K + 1)) - 1;
      const loop: [number, number][] = [[sx, sy]];
      let cur = list.pop()!;
      for (let guard = 0; guard < 4 * W * Hh + 8; guard++) {
        if (cur[0] === sx && cur[1] === sy) break;
        loop.push(cur);
        const nx = out.get(key(cur[0], cur[1]));
        if (!nx || !nx.length) break;
        cur = nx.pop()!;
      }
      let area = 0;
      for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length]; area += a[0] * b[1] - b[0] * a[1]; }
      if (Math.abs(area) > bestArea) { bestArea = Math.abs(area); best = loop; }
    }
  }
  if (best.length < 4) return poly;
  const pts: Point[] = [];
  for (let i = 0; i < best.length; i++) {
    const p = best[(i + best.length - 1) % best.length], q = best[i], r = best[(i + 1) % best.length];
    if ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) === 0) continue;   // alineat
    pts.push({ x: (q[0] + gx0) * H, y: (q[1] + gy0) * H });
  }
  // Mateix sentit que el polígon original.
  const signed = (ps: Point[]) => ps.reduce((s, a, i) => { const b = ps[(i + 1) % ps.length]; return s + a.x * b.y - b.x * a.y; }, 0);
  if (Math.sign(signed(pts)) !== Math.sign(signed(poly))) pts.reverse();
  return pts;
}

function pointIn(poly: Point[], x: number, y: number): boolean {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}
