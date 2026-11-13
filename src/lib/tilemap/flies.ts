/**
 * Mosques animades dels decorats bruts (femta, restes de menjar, peix podrit, munt d'escombraries).
 * L'art de la peça ja no les porta pintades (`scripts/oryx-style-props.py`, `flies()`): el full només
 * té els punts (`PackPiece.flies`, px de la casella) i el joc hi pinta mosques que voleten cada
 * fotograma, com les parts vives (`TileLive.flies`, `drawTileLive`).
 */
import { PACK_BASE, TILE } from './model';
import { PACK_PIECES } from './packs';
import { rotVec } from './objects';

export interface FlySpot { x: number; y: number }

/** Codi de casella (`PACK_BASE` + casella) → punts de les mosques. Només peces d'una casella. */
const FLY_TILES = new Map<number, [number, number][]>();
for (const p of PACK_PIECES) if (p.flies && p.w === 1 && p.h === 1) FLY_TILES.set(PACK_BASE + p.cell, p.flies);

/**
 * Punts de mosques d'una casella (codi de terra) posada a (x, y) (cantonada, px de mapa) i girada `rot`
 * quarts de volta; buit si no en porta. El gir és al voltant del centre de la casella, com el de la peça.
 */
export function flySpotsOf(tile: number, x: number, y: number, rot = 0): FlySpot[] {
  const pts = FLY_TILES.get(tile); if (!pts) return [];
  return pts.map(([px, py]) => {
    const [dx, dy] = rotVec(px - TILE / 2, py - TILE / 2, rot);
    return { x: x + TILE / 2 + dx, y: y + TILE / 2 + dy };
  });
}

/** Pseudoaleatori estable (0–1) per a cada mosca: que no voletegin totes a l'uníson. */
const rnd = (n: number) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

/**
 * Pinta les mosques: cada una gira i s'esmuny al voltant del seu punt (dos moviments de freqüència
 * diferent, a vegades eixamplats) i bat les ales, amb l'estil de l'art d'abans (cos fosc de 2 px
 * i ales blanques que s'alcen i baixen), sempre a píxels sencers perquè no es vegi borrós.
 */
export function drawFlies(ctx: CanvasRenderingContext2D, flies: readonly FlySpot[] | undefined, now: number) {
  if (!flies?.length) return;
  ctx.save();
  for (const f of flies) {
    const seed = f.x * 0.37 + f.y * 0.91;
    const t = now / 1000, a = rnd(seed), b = rnd(seed + 5);
    const rx = 3 + a * 4, ry = 2 + b * 3;
    const x = Math.round(f.x + Math.cos(t * (2.2 + a) + seed) * rx + Math.sin(t * (5.1 + b) + seed * 2) * 1.5);
    const y = Math.round(f.y + Math.sin(t * (1.8 + b) + seed * 3) * ry + Math.cos(t * (4.3 + a) + seed) * 1.2);
    ctx.fillStyle = '#17120f';
    ctx.fillRect(x, y, 2, 2);
    // Ales: es veuen i s'amaguen molt de pressa (cada mosca amb la seva fase).
    if (Math.floor(now / 60 + seed * 7) % 2 === 0) {
      ctx.fillStyle = 'rgba(235,240,245,0.9)';
      ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1);
    }
  }
  ctx.restore();
}
