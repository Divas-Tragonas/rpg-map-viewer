import type { Point, Wall, Room } from '@/types';
import { getBBox, segmentsIntersect, segmentIntersection } from '@/lib/geometry';

// Tolerància (px de mapa) per fusionar vèrtexs propers en un mateix node del graf.
const NODE_TOL = 7;
// Cares més petites que això (px²) s'ignoren: soroll, triangles accidentals, trams penjants.
const MIN_AREA = 400;

function findOrAddNode(nodes: Point[], p: Point, tol: number): number {
  for (let i = 0; i < nodes.length; i++) {
    if (Math.hypot(nodes[i].x - p.x, nodes[i].y - p.y) <= tol) return i;
  }
  nodes.push({ x: p.x, y: p.y });
  return nodes.length - 1;
}

function signedArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Detecció de cares planars: a partir del conjunt de parets (segments) construeix un graf
 * (fusionant vèrtexs propers, partint als encreuaments i a les unions en T) i n'extreu les
 * cares tancades mínimes. Cada cara acotada és una sala.
 *
 * Retorna els polígons (en coordenades de mapa, sentit consistent) de les sales detectades.
 */
export function detectRooms(walls: Wall[]): Point[][] {
  if (walls.length < 3) return [];
  const tol = NODE_TOL;
  const nodes: Point[] = [];
  const segs: [number, number][] = [];
  for (const w of walls) {
    const ia = findOrAddNode(nodes, w.a, tol);
    const ib = findOrAddNode(nodes, w.b, tol);
    if (ia !== ib) segs.push([ia, ib]);
  }

  // Encreuaments X (no compten els contactes per extrem): afegim el punt d'intersecció com a node.
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const [a1, a2] = segs[i], [b1, b2] = segs[j];
      if (segmentsIntersect(nodes[a1], nodes[a2], nodes[b1], nodes[b2])) {
        const ix = segmentIntersection(nodes[a1], nodes[a2], nodes[b1], nodes[b2]);
        if (ix) findOrAddNode(nodes, ix, tol);
      }
    }
  }

  // Arestes atòmiques: per cada segment, tots els nodes que hi cauen a sobre (extrems,
  // encreuaments i unions en T), ordenats, generen arestes consecutives.
  const edgeSet = new Set<string>();
  const adj: Set<number>[] = nodes.map(() => new Set<number>());
  const addEdge = (u: number, v: number) => {
    if (u === v) return;
    const k = u < v ? `${u}_${v}` : `${v}_${u}`;
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    adj[u].add(v); adj[v].add(u);
  };
  for (const [ia, ib] of segs) {
    const A = nodes[ia], B = nodes[ib];
    const dx = B.x - A.x, dy = B.y - A.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) continue;
    const on: { idx: number; t: number }[] = [];
    for (let k = 0; k < nodes.length; k++) {
      const P = nodes[k];
      const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
      if (t < -0.001 || t > 1.001) continue;
      const px = A.x + t * dx, py = A.y + t * dy;
      if (Math.hypot(P.x - px, P.y - py) <= tol) on.push({ idx: k, t: Math.max(0, Math.min(1, t)) });
    }
    on.sort((m, n) => m.t - n.t);
    for (let k = 1; k < on.length; k++) {
      if (on[k].idx !== on[k - 1].idx) addEdge(on[k - 1].idx, on[k].idx);
    }
  }

  // Darts (arestes dirigides) ordenats per angle a cada node.
  const outgoing: { to: number; angle: number }[][] = nodes.map((_, u) => {
    const arr = [...adj[u]].map(v => ({ to: v, angle: Math.atan2(nodes[v].y - nodes[u].y, nodes[v].x - nodes[u].x) }));
    arr.sort((a, b) => a.angle - b.angle);
    return arr;
  });

  // Recorregut de cares: a cada node, el "next" del dart entrant és el veí immediatament
  // en sentit horari → les cares acotades queden en sentit horari (àrea > 0 en coords de
  // pantalla, y avall) i la cara exterior de cada component queda en sentit contrari (< 0).
  const visited = new Set<string>();
  const dartKey = (u: number, v: number) => `${u}>${v}`;
  const faces: Point[][] = [];
  for (let u = 0; u < nodes.length; u++) {
    for (const d0 of outgoing[u]) {
      if (visited.has(dartKey(u, d0.to))) continue;
      const face: number[] = [];
      let cu = u, cv = d0.to, guard = 0;
      while (!visited.has(dartKey(cu, cv)) && guard++ < 100000) {
        visited.add(dartKey(cu, cv));
        face.push(cu);
        const arr = outgoing[cv];
        const idx = arr.findIndex(d => d.to === cu);
        if (idx < 0) break;
        const nextIdx = (idx - 1 + arr.length) % arr.length;
        cu = cv; cv = arr[nextIdx].to;
      }
      if (face.length >= 3) {
        const poly = face.map(i => ({ x: nodes[i].x, y: nodes[i].y }));
        if (signedArea(poly) > MIN_AREA) faces.push(poly);
      }
    }
  }
  return faces;
}

let roomSeq = 0;

/**
 * Reconcilia les cares detectades amb les sales existents perquè `id`, nom i estat
 * (fosca/revelada) es preservin entre recàlculs. L'aparellament és per proximitat de
 * centroide i similitud d'àrea.
 */
export function reconcileRooms(prev: Room[], faces: Point[][]): Room[] {
  const used = new Set<number>();
  const out: Room[] = [];
  for (const poly of faces) {
    const bbox = getBBox(poly);
    const areaNew = Math.max(1, bbox.w * bbox.h);
    let match = -1, bestD = Infinity;
    for (let i = 0; i < prev.length; i++) {
      if (used.has(i)) continue;
      const ob = prev[i].bbox;
      const d = Math.hypot(ob.cx - bbox.cx, ob.cy - bbox.cy);
      const areaOld = Math.max(1, ob.w * ob.h);
      const ratio = Math.min(areaOld, areaNew) / Math.max(areaOld, areaNew);
      const tol = Math.max(bbox.w, bbox.h) * 0.4 + 24;
      if (d < tol && ratio > 0.55 && d < bestD) { bestD = d; match = i; }
    }
    if (match >= 0) {
      used.add(match);
      out.push({ ...prev[match], points: poly, bbox });
    } else {
      const n = ++roomSeq;
      out.push({ id: `room_${Date.now()}_${n.toString(36)}`, points: poly, bbox, name: `Sala ${n}`, dark: false, revealed: false });
    }
  }
  return out;
}
