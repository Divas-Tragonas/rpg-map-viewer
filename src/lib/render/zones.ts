import type { FrameContext } from './types';
import type { PaintedZone } from '@/types';
import { ELEMENTS_BY_ID, TSCALE } from '@/constants';
import { TX_FN } from '@/lib/textures/elements';

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

// Lower cap = fewer texels for the noise loop to fill (quadratic saving). The result is
// heavily blurred/alpha-masked and drawn upscaled anyway, so detail loss is not visible.
const TEXTURE_MAX_DIM = 70;
const ZONE_PAD = 12; // texture-pixel padding per side so blur never cuts at canvas edge
// Regen rate: each full regen re-evaluates every texel's noise function, which is the
// expensive part (tens of ms for a zone at the resolution cap). A small zone has far
// fewer texels and is cheap regardless, so it keeps the original smooth rate (HZ_MAX);
// only zones large enough to hit the resolution cap get throttled down towards HZ_MIN —
// that's what actually protects fps once zones are large or several overlap on screen.
const HZ_MAX = 20;
const HZ_MIN = 8;
const TEXELS_AT_HZ_MIN = (TEXTURE_MAX_DIM + 2 * ZONE_PAD) ** 2;

function zonePhaseFrac(zone: PaintedZone): number {
  // Deterministic per-zone offset (as a fraction of one regen period) so multiple zones
  // don't all regenerate on the same frame — spreads the noise-loop cost across frames
  // instead of bursting together.
  let h = 0;
  for (let i = 0; i < zone.id.length; i++) h = (h * 31 + zone.id.charCodeAt(i)) >>> 0;
  return (h % 997) / 997;
}

interface ZoneMask { canvas: HTMLCanvasElement; ptw: number; pth: number; padLeft: number; padTop: number; RS: number; hz: number; }
// The blurred shape mask only depends on zone.points (not on time), but used to be
// rebuilt — CSS `blur()` filter and all — on every ~50ms texture regen. Caching it per
// zone object (invalidated automatically when a drag/edit produces a new points array,
// same pattern as getZonePath) removes the single most expensive step from the hot path,
// which matters a lot once zones are large or several of them overlap on screen.
const zoneMaskCache = new WeakMap<PaintedZone, ZoneMask>();
function getZoneMask(zone: PaintedZone): ZoneMask {
  let mask = zoneMaskCache.get(zone);
  if (mask) return mask;
  const { left, top, w, h } = zone.bbox;
  // Texel resolution capped independent of zone size (keeps the per-pixel noise loop
  // affordable even for huge zones); the final draw upsamples via drawImage.
  const RS = Math.max(4, Math.ceil(Math.max(w, h) / TEXTURE_MAX_DIM));
  const padLeft = left - ZONE_PAD * RS, padTop = top - ZONE_PAD * RS;
  const tw = Math.ceil(w / RS), th = Math.ceil(h / RS);
  const ptw = tw + 2 * ZONE_PAD, pth = th + 2 * ZONE_PAD;
  const hz = Math.min(HZ_MAX, Math.max(HZ_MIN, (HZ_MIN * TEXELS_AT_HZ_MIN) / (ptw * pth)));
  // High-res alpha mask at 4× resolution; PAD ensures blur fades inside canvas bounds
  const maskW = ptw * 4, maskH = pth * 4;
  const mScale = 4 / RS;
  const blurPx = Math.max(4, Math.min(maskW, maskH) * 0.028);
  const mc = document.createElement('canvas'); mc.width = maskW; mc.height = maskH;
  const mctx = mc.getContext('2d')!;
  mctx.filter = `blur(${blurPx}px)`;
  mctx.fillStyle = 'white';
  mctx.beginPath();
  zone.points.forEach((p, i) => {
    const ppx = (p.x - padLeft) * mScale, ppy = (p.y - padTop) * mScale;
    if (i === 0) mctx.moveTo(ppx, ppy); else mctx.lineTo(ppx, ppy);
  });
  mctx.closePath(); mctx.fill();
  mask = { canvas: mc, ptw, pth, padLeft, padTop, RS, hz };
  zoneMaskCache.set(zone, mask);
  return mask;
}

export function drawPaintedZone(ctx: CanvasRenderingContext2D, zone: PaintedZone, t: number, txCache: Record<string, HTMLCanvasElement>): void {
  const { cx, cy } = zone.bbox;
  const { canvas: maskCanvas, ptw, pth, padLeft, padTop, RS, hz } = getZoneMask(zone);
  const tQ = Math.floor((t + zonePhaseFrac(zone) / hz) * hz) / hz;
  const cacheKey = zone.id + ':' + tQ;

  let cachedCanvas = txCache[cacheKey];
  if (!cachedCanvas) {
    for (const k of Object.keys(txCache)) { if (k.startsWith(zone.id + ':')) delete txCache[k]; }
    const pixelFn = TX_FN[zone.element] || TX_FN.fire;
    const oc = document.createElement('canvas'); oc.width = ptw; oc.height = pth;
    const octx = oc.getContext('2d')!;
    const img = octx.createImageData(ptw, pth);
    const data = img.data;
    const tcx = cx / TSCALE, tcy = cy / TSCALE;
    for (let py = 0; py < pth; py++) {
      for (let px = 0; px < ptw; px++) {
        const wx = (padLeft + px * RS) / TSCALE, wy = (padTop + py * RS) / TSCALE;
        const [r, g, b, a = 255] = pixelFn(wx, wy, tQ, tcx, tcy);
        const idx = (py * ptw + px) * 4;
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
      }
    }
    octx.putImageData(img, 0, 0);
    octx.globalCompositeOperation = 'destination-in';
    octx.drawImage(maskCanvas, 0, 0, ptw, pth);
    octx.globalCompositeOperation = 'source-over';
    cachedCanvas = txCache[cacheKey] = oc;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(cachedCanvas, padLeft, padTop, ptw * RS, pth * RS);
  ctx.restore();
}

export function renderPaintedZones(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { isDM, rPaintedZones, txCache, zoneAppearRef } = fc;
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
      ctx.save();
      if (fadeAlpha < 0.999) ctx.globalAlpha = fadeAlpha;
      drawPaintedZone(ctx, zone, t, txCache);
      ctx.restore();
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
