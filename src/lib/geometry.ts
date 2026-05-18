import type { Point, BBox } from '@/types';

export function getBBox(points: Point[]): BBox {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of points) {
    if (p.x < left)   left   = p.x;
    if (p.x > right)  right  = p.x;
    if (p.y < top)    top    = p.y;
    if (p.y > bottom) bottom = p.y;
  }
  return { left, top, right, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2, w: right - left, h: bottom - top };
}

export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false, j = polygon.length - 1;
  for (let i = 0; i < polygon.length; i++) {
    const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    j = i;
  }
  return inside;
}

export function pathLen(pts: Point[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

export function pathAt(pts: Point[], t: number): Point {
  const total = pathLen(pts);
  let target = Math.max(0, Math.min(1, t)) * total, covered = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (covered + d >= target) {
      const f = d > 0 ? (target - covered) / d : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f };
    }
    covered += d;
  }
  return pts[pts.length - 1];
}
