import type { FrameContext } from './types';
import type { PaintedZone } from '@/types';
import { ELEMENTS_BY_ID, TSCALE } from '@/constants';
import { TX_FN } from '@/lib/textures/elements';

export function renderZoneOverlays(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { sc, ox, oy, s, v, pp, isDM, rLayerImages, rHoveredZone, zoneAnimRef } = fc;
  const hovZ = rHoveredZone.current;
  s.zonasLayers.forEach(l => {
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
        ctx.save(); ctx.translate(scx, scy);
        ctx.fillStyle = isVis ? 'rgba(255,255,255,0.9)' : 'rgba(30,30,30,0.85)';
        ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = isVis ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5; ctx.stroke();
        const eyeColor = isVis ? '#111' : '#eee';
        ctx.strokeStyle = eyeColor; ctx.lineWidth = 2; ctx.fillStyle = eyeColor;
        if (isVis) {
          ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-9, -6, 9, -6, 9, 0); ctx.bezierCurveTo(9, 6, -9, 6, -9, 0); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-9, -6, 9, -6, 9, 0); ctx.bezierCurveTo(9, 6, -9, 6, -9, 0); ctx.stroke();
          ctx.strokeStyle = isVis ? '#111' : '#eee'; ctx.lineWidth = 2.5;
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
      const ZONE_LERP = 0.07;
      const prev = zoneAnimRef.current[l.id] ?? (isVis ? 1 : 0);
      const tgt  = isVis ? 1 : 0;
      const next = prev + (tgt - prev) * ZONE_LERP;
      zoneAnimRef.current[l.id] = Math.abs(next - tgt) < 0.004 ? tgt : next;
      const animAlpha = zoneAnimRef.current[l.id];
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

export function drawFlatZone(ctx: CanvasRenderingContext2D, zone: PaintedZone): void {
  const el = ELEMENTS_BY_ID.get(zone.element);
  const color = el ? el.color : '#ffffff';
  ctx.save();
  ctx.beginPath();
  zone.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fillStyle = color + '55'; ctx.fill();
  ctx.strokeStyle = color + 'cc'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.lineJoin = 'round';
  ctx.beginPath();
  zone.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath(); ctx.stroke();
  if (el) {
    const { cx, cy, w, h } = zone.bbox;
    const fontSize = Math.max(12, Math.min(w, h) * 0.18);
    ctx.font = `${fontSize}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.7; ctx.fillText(el.emoji, cx, cy); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawPaintedZone(ctx: CanvasRenderingContext2D, zone: PaintedZone, t: number, txCache: Record<string, HTMLCanvasElement>): void {
  const { left, top, w, h, cx, cy } = zone.bbox;
  const tQ = Math.floor(t * 20) / 20;
  const cacheKey = zone.id + ':' + tQ;
  let cachedCanvas = txCache[cacheKey];
  if (!cachedCanvas) {
    for (const k of Object.keys(txCache)) { if (k.startsWith(zone.id + ':')) delete txCache[k]; }
    const pixelFn = TX_FN[zone.element] || TX_FN.fire;
    const RS = Math.max(4, Math.ceil(Math.max(w, h) / 120));
    const tw = Math.ceil(w / RS), th = Math.ceil(h / RS);
    const oc = document.createElement('canvas'); oc.width = tw; oc.height = th;
    const octx = oc.getContext('2d')!;
    const img = octx.createImageData(tw, th);
    const data = img.data;
    const tcx = cx / TSCALE, tcy = cy / TSCALE;
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const wx = (left + px * RS) / TSCALE, wy = (top + py * RS) / TSCALE;
        const [r, g, b, a = 255] = pixelFn(wx, wy, tQ, tcx, tcy);
        const idx = (py * tw + px) * 4;
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
      }
    }
    octx.putImageData(img, 0, 0);
    cachedCanvas = txCache[cacheKey] = oc;
  }
  ctx.save();
  ctx.beginPath();
  zone.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath(); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(cachedCanvas, left, top, w, h);
  const el = ELEMENTS_BY_ID.get(zone.element);
  ctx.strokeStyle = el ? el.color + 'aa' : '#ffffff88';
  ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.lineJoin = 'round';
  ctx.beginPath();
  zone.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

export function renderPaintedZones(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { isDM, rPaintedZones, txCache, zoneAppearRef } = fc;
  const t = performance.now() / 1000;
  for (const zone of rPaintedZones.current) {
    if (isDM) {
      drawFlatZone(ctx, zone);
    } else {
      drawPaintedZone(ctx, zone, t, txCache);
      const appearT = zoneAppearRef.current[zone.id];
      if (appearT) {
        const elapsed = (performance.now() - appearT) / 1000;
        if (elapsed < 1.2) {
          const el = ELEMENTS_BY_ID.get(zone.element);
          if (el) {
            const alpha = Math.max(0, 1 - elapsed / 1.2) * 0.65;
            ctx.save();
            ctx.beginPath();
            zone.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.closePath();
            ctx.strokeStyle = el.color; ctx.lineWidth = 3; ctx.globalAlpha = alpha; ctx.stroke();
            ctx.restore();
          }
        } else {
          delete zoneAppearRef.current[zone.id];
        }
      }
    }
  }
}

export function renderShapePreview(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { isShapeDrawingRef, shapePointsRef } = fc;
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
  ctx.restore();
}
