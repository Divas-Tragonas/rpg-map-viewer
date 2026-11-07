import type { FrameContext } from './types';
import type { PaintedZone } from '@/types';
import { ELEMENTS_BY_ID } from '@/constants';
import { blit } from '@/lib/sprites/draw';
import { elementIcon, uiIconCell } from '@/lib/sprites/uiicon';
import { drawZoneFx } from './zonefx';
import { drawZonePixelAccents } from './zonepixel';
import { reducedMotion } from '@/lib/sprites/states';

// Cached per zone object so per-frame drawing doesn't re-walk `points` in JS every frame.
// A dragged/edited zone gets a new points array (see useMouseHandlers), which naturally
// invalidates the cache since the WeakMap key changes with it.
const zonePathCache = new WeakMap<PaintedZone, Path2D>();
export function getZonePath(zone: PaintedZone): Path2D {
  let path = zonePathCache.get(zone);
  if (!path) {
    path = new Path2D();
    zone.points.forEach((p, i) => i === 0 ? path!.moveTo(p.x, p.y) : path!.lineTo(p.x, p.y));
    path.closePath();
    zonePathCache.set(zone, path);
  }
  return path;
}

export function drawFlatZone(ctx: CanvasRenderingContext2D, zone: PaintedZone): void {
  const el = ELEMENTS_BY_ID.get(zone.element);
  const color = el ? el.color : '#ffffff';
  const path = getZonePath(zone);
  ctx.save();
  ctx.fillStyle = color + '55'; ctx.fill(path);
  ctx.strokeStyle = color + 'cc'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.lineJoin = 'round';
  ctx.stroke(path);
  if (el) {
    const { cx, cy, w, h } = zone.bbox;
    const fontSize = Math.max(12, Math.min(w, h) * 0.18);
    ctx.font = `${fontSize}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.85;
    // Icona de pixel art de l'element (múltiple de 16 px); l'emoji només si el full no hi és.
    const ic = elementIcon(el.id);
    const s = Math.max(16, Math.round(fontSize * 1.4 / 16) * 16);
    const cell = ic ? uiIconCell(ic) : null;
    if (!cell || !blit(ctx, 'icons', cell.col * 16, cell.row * 16, 16, 16, cx - s / 2, cy - s / 2, s, s)) ctx.fillText(el.emoji, cx, cy);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function renderPaintedZones(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { isDM, rPaintedZones, zoneAppearRef, rGridSize } = fc;
  const t = performance.now() / 1000;
  // App Píxel: detalls de pixel art dins de les zones (`zonepixel.ts`), damunt del camp de sempre.
  const pixel = fc.rAppStyle?.current === 'pixel';
  const calm = pixel && reducedMotion();
  for (const zone of rPaintedZones.current) {
    if (isDM) {
      drawFlatZone(ctx, zone);
      const isDragged = fc.zoneDragRef?.current?.zoneId === zone.id;
      const isHovered = fc.rHoveredPaintedZoneId?.current === zone.id;
      const isSelected = fc.rSelectedPaintedZoneId?.current === zone.id;
      if (isDragged || isHovered) {
        const zEl = ELEMENTS_BY_ID.get(zone.element);
        const glowColor = zEl ? zEl.color : '#ffffff';
        const path = getZonePath(zone);
        ctx.save();
        ctx.fillStyle = glowColor + (isDragged ? '44' : '28');
        ctx.fill(path);
        ctx.strokeStyle = glowColor + (isDragged ? 'ff' : 'bb');
        ctx.lineWidth = isDragged ? 2.5 : 1.8;
        ctx.setLineDash([]);
        ctx.stroke(path);
        ctx.restore();
      }
      if (isSelected) {
        const fsc = fc.sc;
        const t2 = performance.now() / 500;
        const dash = 8 / fsc, gap = 5 / fsc;
        const path = getZonePath(zone);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2 / fsc;
        ctx.setLineDash([dash, gap]);
        ctx.lineDashOffset = -(t2 % (dash + gap)) * (dash + gap);
        ctx.stroke(path);
        ctx.setLineDash([]);
        ctx.restore();
      }
    } else {
      const appearT = zoneAppearRef.current[zone.id];
      const elapsed = appearT ? (performance.now() - appearT) / 1000 : Infinity;
      const FADE_IN = 0.75;
      const fadeAlpha = elapsed < FADE_IN ? elapsed / FADE_IN : 1;
      drawZoneFx(ctx, zone, t, rGridSize.current, fadeAlpha);
      if (pixel) drawZonePixelAccents(ctx, zone, rGridSize.current, fadeAlpha, calm);
      if (appearT && elapsed > 1.5) delete zoneAppearRef.current[zone.id];
    }
  }
}

export function renderShapePreview(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { isShapeDrawingRef, shapePointsRef, sc, rGridSize } = fc;
  if (!isShapeDrawingRef.current) return;
  const pts = shapePointsRef.current;
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,210,0,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash([8, 4]);
  ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,210,0,0.6)';
  ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 5, 0, Math.PI * 2); ctx.fill();

  // Live "shortest distance" readout while casting: start→end diagonal, not path length.
  const first = pts[0], last = pts[pts.length - 1];
  const gs = rGridSize.current > 0 ? rGridSize.current : 70;
  const ft = Math.round((Math.hypot(last.x - first.x, last.y - first.y) / gs) * 5);
  const mx = (first.x + last.x) / 2, my = (first.y + last.y) / 2;
  ctx.font = `bold ${12 / sc}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = `📏 ${ft}ft`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10,13,18,0.82)';
  ctx.fillRect(mx - tw / 2 - 5 / sc, my - 17 / sc, tw + 10 / sc, 14 / sc);
  ctx.fillStyle = '#ffd200';
  ctx.fillText(text, mx, my - 10 / sc);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
