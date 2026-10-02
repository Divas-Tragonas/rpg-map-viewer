import type { Point } from '@/types';

/**
 * Limita el destí `p` d'una màgia al seu abast (peus) mesurat des d'`origin`. Sense
 * graella no hi ha mida de casella per passar de peus a píxels: no es limita.
 */
export function clampToRange(origin: Point, p: Point, rangeFt: number | undefined, gridSize: number): Point {
  if (rangeFt === undefined || gridSize <= 0) return p;
  const max = (rangeFt / 5) * gridSize;
  const dx = p.x - origin.x, dy = p.y - origin.y, d = Math.hypot(dx, dy);
  if (d <= max || d === 0) return p;
  return { x: origin.x + dx / d * max, y: origin.y + dy / d * max };
}
