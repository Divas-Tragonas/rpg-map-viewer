import type { FrameContext } from './types';
import type { PaintedZone } from '@/types';
import { ELEMENTS_BY_ID } from '@/constants';
import { drawZoneFx } from './zonefx';

export function renderRoomOverlays(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { sc, ox, oy, s, v, pp, isDM, rLayerImages, rHoveredRoom, roomAnimRef } = fc;
  const hovZ = rHoveredRoom.current;
  s.roomLayers.forEach(l => {
    const lp = pp[l.id] || { x: l.left + l.w / 2, y: l.top + l.h / 2 };
    const lx = lp.x - l.w / 2, ly = lp.y - l.h / 2;
    const isVis = !!v[l.id];
    const isHov = isDM && hovZ && hovZ.id === l.id;
    const layerImg = rLayerImages.current[l.id];

    if (isDM) {
      if (isVis) {
        if (layerImg) {
          ctx.globalAlpha = l.opacity / 255;
          ctx.drawImage(layerImg, lx, ly, l.w, l.h);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(0,0,0,${(l.opacity / 255) * 0.93})`;
          ctx.fillRect(lx, ly, l.w, l.h);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5 / sc;
        ctx.strokeRect(lx + 0.5 / sc, ly + 0.5 / sc, l.w - 1 / sc, l.h - 1 / sc);
      } else {
        ctx.setLineDash([8 / sc, 4 / sc]);
        ctx.strokeStyle = 'rgba(88,166,255,0.5)'; ctx.lineWidth = 2 / sc;
        ctx.strokeRect(lx, ly, l.w, l.h); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(88,166,255,0.05)'; ctx.fillRect(lx, ly, l.w, l.h);
      }

      if (isHov) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(lx, ly, l.w, l.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 / sc; ctx.setLineDash([]); ctx.strokeRect(lx, ly, l.w, l.h);
        const cxC = lx + l.w / 2, cyC = ly + l.h / 2;
        ctx.restore();
        const scx = ox + cxC * sc, scy = oy + cyC * sc;
        const eyeR = 22;
        // L'ull respon a «ho veuen els jugadors?», com a les sales dibuixades i als enemics.
        // `isVis` vol dir que la COBERTA es veu, o sigui que la zona està amagada: ull tancat.
        const seen = !isVis;
        ctx.save(); ctx.translate(scx, scy);
        ctx.fillStyle = seen ? 'rgba(255,255,255,0.9)' : 'rgba(30,30,30,0.85)';
        ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = seen ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5; ctx.stroke();
        const eyeColor = seen ? '#111' : '#eee';
        ctx.strokeStyle = eyeColor; ctx.lineWidth = 2; ctx.fillStyle = eyeColor;
        if (seen) {
          ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-9, -6, 9, -6, 9, 0); ctx.bezierCurveTo(9, 6, -9, 6, -9, 0); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-9, -6, 9, -6, 9, 0); ctx.bezierCurveTo(9, 6, -9, 6, -9, 0); ctx.stroke();
          ctx.strokeStyle = eyeColor; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(9, -6); ctx.stroke();
        }
        ctx.restore();
        ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
      } else {
        ctx.font = `bold ${12 / sc}px system-ui`; ctx.textAlign = 'center';
        ctx.fillStyle = isVis ? 'rgba(255,255,255,0.25)' : 'rgba(88,166,255,0.55)';
        ctx.fillText(l.name, lx + l.w / 2, ly + l.h / 2 + 4 / sc);
        ctx.textAlign = 'left';
      }
    } else {
      const ROOM_LERP = 0.07;
      const prev = roomAnimRef.current[l.id] ?? (isVis ? 1 : 0);
      const tgt  = isVis ? 1 : 0;
      const next = prev + (tgt - prev) * ROOM_LERP;
      roomAnimRef.current[l.id] = Math.abs(next - tgt) < 0.004 ? tgt : next;
      const animAlpha = roomAnimRef.current[l.id];
      if (animAlpha > 0.004) {
        if (layerImg) {
          ctx.globalAlpha = animAlpha * (l.opacity / 255);
          ctx.drawImage(layerImg, lx, ly, l.w, l.h);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(0,0,0,${animAlpha})`;
          ctx.fillRect(lx, ly, l.w, l.h);
        }
      }
    }
  });
}

export function renderExtras(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { s, pp, rLayerImages } = fc;
  s.extras.children.forEach(l => {
    const lp = pp[l.id] || { x: l.left + l.w / 2, y: l.top + l.h / 2 };
    const lx = lp.x - l.w / 2, ly = lp.y - l.h / 2;
    const layerImg = rLayerImages.current[l.id];
    if (layerImg) {
      ctx.globalAlpha = l.opacity / 255;
      ctx.drawImage(layerImg, lx, ly, l.w, l.h);
      ctx.globalAlpha = 1;
    }
  });
}

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
    ctx.globalAlpha = 0.7; ctx.fillText(el.emoji, cx, cy); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function renderPaintedZones(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { isDM, rPaintedZones, zoneAppearRef, sc, rGridSize } = fc;
  const t = performance.now() / 1000;
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
      drawZoneFx(ctx, zone, t, sc, rGridSize.current, fadeAlpha);
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
