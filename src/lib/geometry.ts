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

function sqSegDist(p: Point, p1: Point, p2: Point): number {
  let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = p2.x; y = p2.y; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p.x - x; dy = p.y - y;
  return dx * dx + dy * dy;
}

// Ramer-Douglas-Peucker: drops points that deviate less than `tolerance` (world units)
// from the simplified outline. Keeps freehand-drawn zones from accumulating thousands
// of points on large drags, which otherwise get re-walked every frame/render.
export function simplifyPolygon(points: Point[], tolerance: number): Point[] {
  const n = points.length;
  if (n <= 4 || tolerance <= 0) return points;
  const sqTolerance = tolerance * tolerance;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = sqTolerance, idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > maxDist) { maxDist = d; idx = i; }
    }
    if (idx !== -1) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

export function pathLen(pts: Point[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

function ccw(a: Point, b: Point, c: Point): number {
  return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
}

// True if segment p1-p2 crosses segment p3-p4 (proper crossing, shared endpoints don't count).
export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (d === 0) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
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
