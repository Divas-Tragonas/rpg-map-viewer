'use client';
import { useEffect } from 'react';
import { renderRoomOverlays, renderExtras, renderPaintedZones, renderShapePreview } from '@/lib/render/zones';
import { advanceStrokeAnim } from '@/lib/render/drawing';
import { renderSpells } from '@/lib/render/spells';
import { renderEnemyTokens, renderPlayerTokens, renderLibEnemyTokens } from '@/lib/render/tokens';
import { renderGrid, renderGridCalib, renderMeasureRuler } from '@/lib/render/grid';
import { cpBurst, cpUpdate, cpDraw } from '@/lib/cinematic';
import type { DMRefs } from './useDMRefs';
import type { Spell } from '@/types';

interface RafLoopOpts {
  setActiveSpells: (s: Spell[]) => void;
  setDmPrivateActive: (v: boolean) => void;
  broadcastDmPreview: () => void;
}

export function useRafLoop(R: DMRefs, opts: RafLoopOpts) {
  const { setActiveSpells, setDmPrivateActive, broadcastDmPreview } = opts;

  useEffect(() => {
    const canvas = R.canvasRef.current; if (!canvas) return;
    let alive = true;
    let prevBgStyle = '';
    let prevBgEl: HTMLElement | null = null;
    const txCache: Record<string, HTMLCanvasElement> = {};

    const tick = () => {
      if (!alive) return;
      R.rafRef.current = requestAnimationFrame(tick);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; R._ctx2dRef.current = null; }
      if (!R._ctx2dRef.current) R._ctx2dRef.current = canvas.getContext('2d');
      const ctx = R._ctx2dRef.current!;
      ctx.clearRect(0, 0, W, H);

      const s = R.rStruct.current;
      const v = R.rVis.current, pp = R.rPos.current;
      const media = R.mediaRef.current;
      let mw = 1920, mh = 1080;
      if (media?.tagName === 'IMG' && (media as HTMLImageElement).naturalWidth) { mw = (media as HTMLImageElement).naturalWidth; mh = (media as HTMLImageElement).naturalHeight; }
      if (media?.tagName === 'VIDEO' && (media as HTMLVideoElement).videoWidth) { mw = (media as HTMLVideoElement).videoWidth; mh = (media as HTMLVideoElement).videoHeight; }

      // DM private view return animation
      if (R.dmPrivateReturnAnim.current) {
        const RL = 0.12;
        R.dmLocalPan.current.x *= (1 - RL);
        R.dmLocalPan.current.y *= (1 - RL);
        R.dmLocalZoom.current += (1 - R.dmLocalZoom.current) * RL;
        // Throttle a ~20Hz: broadcastejar l'estat sencer a 60Hz durant l'animació era el
        // cas més car de tots. L'estat final exacte s'envia sempre en acabar.
        const nowB = Date.now();
        if (nowB - R.dmPreviewBcastRef.current > 48) { R.dmPreviewBcastRef.current = nowB; broadcastDmPreview(); }
        if (Math.abs(R.dmLocalPan.current.x) < 0.4 && Math.abs(R.dmLocalPan.current.y) < 0.4 && Math.abs(R.dmLocalZoom.current - 1) < 0.002) {
          R.dmLocalPan.current = { x: 0, y: 0 }; R.dmLocalZoom.current = 1;
          R.dmPrivateReturnAnim.current = false; setDmPrivateActive(false);
          broadcastDmPreview();
        }
      }

      // Zoom & pan (DM: cinematic cam or local+shared)
      let z: number, pan: { x: number; y: number };
      const cinCam = R.cinematicCamRef.current;
      if (cinCam.active) {
        const CL = 0.035;
        const dz = cinCam.tgtZoom - cinCam.curZoom;
        const dx = cinCam.tgtPan.x - cinCam.curPan.x, dy = cinCam.tgtPan.y - cinCam.curPan.y;
        if (Math.abs(dz) < 0.0005 && Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) {
          cinCam.curZoom = cinCam.tgtZoom; cinCam.curPan.x = cinCam.tgtPan.x; cinCam.curPan.y = cinCam.tgtPan.y;
        } else { cinCam.curZoom += dz * CL; cinCam.curPan.x += dx * CL; cinCam.curPan.y += dy * CL; }
        z = cinCam.curZoom; pan = cinCam.curPan;
      } else {
        z = R.rZoom.current * R.dmLocalZoom.current;
        pan = { x: R.rPanOffset.current.x + R.dmLocalPan.current.x, y: R.rPanOffset.current.y + R.dmLocalPan.current.y };
      }
      const sc = Math.min(W / mw, H / mh) * z;
      const ox = (W - mw * sc) / 2 + pan.x, oy = (H - mh * sc) / 2 + pan.y;

      // Sync background DOM element position
      if (media) {
        const bgW = Math.round(mw * sc), bgH = Math.round(mh * sc);
        const bgL = Math.round(ox), bgT = Math.round(oy);
        const ns = `${bgW},${bgH},${bgL},${bgT}`;
        // Comparar també l'element: si s'ha carregat un fons nou amb la mateixa
        // geometria, el <img>/<video> nou neix sense estils i cal reposicionar-lo.
        if (ns !== prevBgStyle || media !== prevBgEl) {
          media.style.width = bgW + 'px'; media.style.height = bgH + 'px';
          media.style.left = bgL + 'px'; media.style.top = bgT + 'px';
          prevBgStyle = ns;
          prevBgEl = media;
        }
      }

      if (!s) {
        const oc2pre = R.drawCanvasRef.current;
        if (oc2pre && oc2pre.width > 1) {
          ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
          ctx.globalAlpha = 0.92; ctx.drawImage(oc2pre, 0, 0); ctx.globalAlpha = 1; ctx.restore();
        }
        const toolPre = R.rDrawTool.current;
        if ((toolPre === 'pen' || toolPre === 'eraser') && R.rCursorScreenPos.current) {
          const { x: cx, y: cy } = R.rCursorScreenPos.current;
          const ds = R.rDrawSize.current;
          const radius = Math.max(3, (toolPre === 'eraser' ? ds * 4 : ds / 2) * sc);
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          if (toolPre === 'eraser') { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
          else { ctx.fillStyle = R.rDrawColor.current + '55'; ctx.strokeStyle = R.rDrawColor.current + 'ee'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); }
          ctx.restore();
        }
        return;
      }

      const fc = {
        sc, ox, oy, mw, mh, isDM: true, s, v, pp,
        rLayerImages: R.rLayerImages, rHoveredRoom: R.rHoveredRoom, roomAnimRef: R.roomAnimRef,
        rPaintedZones: R.rPaintedZones, rContextMenu: R.rContextMenu, zoneAppearRef: R.zoneAppearRef, txCache,
        isShapeDrawingRef: R.isShapeDrawingRef, shapePointsRef: R.shapePointsRef,
        activeStrokeAnim: R.activeStrokeAnim, strokeQueueRef: R.strokeQueueRef, drawCanvasRef: R.drawCanvasRef,
        rActiveSpells: R.rActiveSpells, setActiveSpells,
        rConditions: R.rConditions, rDefeated: R.rDefeated, rDeathCanvas: R.rDeathCanvas,
        defeatedAnimRef: R.defeatedAnimRef, invisAlphaRef: R.invisAlphaRef,
        rEnemyHighlight: R.rEnemyHighlight, rHighlightAlpha: R.rHighlightAlpha,
        rHighlightLocked: R.rHighlightLocked, highlightStartRef: R.highlightStartRef,
        visualPosRef: R.visualPosRef, rPlayers: R.rPlayers, rTokenSizeOverride: R.rTokenSizeOverride,
        rGridVisible: R.rGridVisible, rGridSize: R.rGridSize, rGridLineWidth: R.rGridLineWidth,
        rGridOriginX: R.rGridOriginX, rGridOriginY: R.rGridOriginY,
        rGridCalibrating: R.rGridCalibrating, rGridDmAlpha: R.rGridDmAlpha,
        gridCalibRef: R.gridCalibRef, gridCalibCurrRef: R.gridCalibCurrRef, gridCalibHoverRef: R.gridCalibHoverRef,
        rPointerPos: R.rPointerPos, rMeasure: R.rMeasure, rDrawTool: R.rDrawTool, rSelectedToken: R.rSelectedToken, rMultiSelected: R.rMultiSelected,
        rLibEnemies: R.rLibEnemies,
        rPsdEnemyOverrides: R.rPsdEnemyOverrides,
        rPsdEnemyImgCache: R.rPsdEnemyImgCache,
        zoneDragRef: R.zoneDragRef,
        rHoveredPaintedZoneId: R.rHoveredPaintedZoneId,
        rSelectedPaintedZoneId: R.rSelectedPaintedZoneId,
        rSpellPreview: R.rSpellPreview,
      };

      ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
      renderRoomOverlays(ctx, fc);
      renderExtras(ctx, fc);
      renderPaintedZones(ctx, fc);
      renderShapePreview(ctx, fc);
      advanceStrokeAnim(fc);
      renderSpells(ctx, fc, 'ground');

      const oc2 = R.drawCanvasRef.current;
      if (oc2) { ctx.globalAlpha = 0.92; ctx.drawImage(oc2, 0, 0); ctx.globalAlpha = 1; }

      // Highlight alpha animation
      {
        const FADE = 0.35, TOTAL = 3.5;
        if (R.rEnemyHighlight.current) {
          if (R.rHighlightLocked.current) {
            R.rHighlightAlpha.current = Math.min(1, R.rHighlightAlpha.current + 0.08);
          } else {
            const el = R.highlightStartRef.current ? (performance.now() - R.highlightStartRef.current) / 1000 : 0;
            if (el < FADE) R.rHighlightAlpha.current = el / FADE;
            else if (el < TOTAL - FADE) R.rHighlightAlpha.current = 1;
            else R.rHighlightAlpha.current = Math.max(0, 1 - (el - (TOTAL - FADE)) / FADE);
          }
        } else {
          R.rHighlightAlpha.current = Math.max(0, R.rHighlightAlpha.current - 0.08);
        }
      }

      renderEnemyTokens(ctx, fc);
      renderLibEnemyTokens(ctx, fc);
      renderPlayerTokens(ctx, fc);
      renderSpells(ctx, fc, 'air');  // projectiles/bolts/cones fly OVER the tokens
      ctx.restore();

      // Grid DM alpha — also surfaces while measuring (tool 4) so the DM has a grid
      // reference, even if the grid isn't toggled on ("Activar") for players.
      {
        const isDragging = !!R.dragRef.current;
        const measuring = R.rDrawTool.current === 'pointer';
        const tgt = (R.rGridVisible.current && (isDragging || R.rGridCalibrating.current)) || measuring ? 1 : 0;
        R.rGridDmAlpha.current += (tgt - R.rGridDmAlpha.current) * 0.25;
        if (Math.abs(tgt - R.rGridDmAlpha.current) < 0.004) R.rGridDmAlpha.current = tgt;
      }

      renderGrid(ctx, fc);
      renderGridCalib(ctx, fc);

      // Area (marquee) selection rectangle — drawn in screen space so it stays crisp at any zoom
      if (R.rAreaSelectRect.current) {
        const r = R.rAreaSelectRect.current;
        const x0 = ox + Math.min(r.x0, r.x1) * sc, y0 = oy + Math.min(r.y0, r.y1) * sc;
        const x1 = ox + Math.max(r.x0, r.x1) * sc, y1 = oy + Math.max(r.y0, r.y1) * sc;
        ctx.save();
        ctx.fillStyle = 'rgba(88,166,255,0.12)';
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.strokeStyle = 'rgba(88,166,255,0.9)';
        ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        ctx.setLineDash([]);
        ctx.restore();
      }

      // DM cursors — rendered last so they appear above everything
      {
        const tool = R.rDrawTool.current;
        if ((tool === 'pen' || tool === 'eraser') && R.rCursorScreenPos.current) {
          const { x: cx, y: cy } = R.rCursorScreenPos.current;
          const ds = R.rDrawSize.current;
          const radius = Math.max(3, (tool === 'eraser' ? ds * 4 : ds / 2) * sc);
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          if (tool === 'eraser') { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
          else { ctx.fillStyle = R.rDrawColor.current + '55'; ctx.strokeStyle = R.rDrawColor.current + 'ee'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); }
          ctx.restore();
        }
        if (tool === 'pointer' && R.rPointerPos.current) {
          const ptr = R.rPointerPos.current;
          const sx = ox + ptr.x * sc, sy = oy + ptr.y * sc;
          const pT = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(pT * 5.5);
          ctx.save();
          ctx.strokeStyle = `rgba(255,60,80,${0.75 + 0.2 * pulse})`; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.arc(sx, sy, 22 + 5 * pulse, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = `rgba(255,80,100,${0.85 + 0.15 * pulse})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx, sy, 11 + 2 * pulse, 0, Math.PI * 2); ctx.stroke();
          const ch = 13;
          ctx.strokeStyle = `rgba(255,60,80,0.9)`; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx - ch, sy); ctx.lineTo(sx - 5, sy); ctx.moveTo(sx + 5, sy); ctx.lineTo(sx + ch, sy);
          ctx.moveTo(sx, sy - ch); ctx.lineTo(sx, sy - 5); ctx.moveTo(sx, sy + 5); ctx.lineTo(sx, sy + ch);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,60,80,${0.9 + 0.1 * pulse})`;
          ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        renderMeasureRuler(ctx, fc);
        if (tool === 'shape' && R.rCursorScreenPos.current) {
          const { x: cx, y: cy } = R.rCursorScreenPos.current;
          const pT = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(pT * 4.5);
          ctx.save();
          ctx.strokeStyle = `rgba(168,85,247,${0.12 + 0.08 * pulse})`; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.arc(cx, cy, 26 + 6 * pulse, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = `rgba(168,85,247,${0.60 + 0.30 * pulse})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, 13 + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
          const ch = 13;
          ctx.strokeStyle = `rgba(192,132,252,0.85)`; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - ch, cy); ctx.lineTo(cx - 5, cy); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + ch, cy);
          ctx.moveTo(cx, cy - ch); ctx.lineTo(cx, cy - 5); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + ch);
          ctx.stroke();
          ctx.fillStyle = `rgba(192,132,252,${0.9 + 0.1 * pulse})`;
          ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }

      // Cinematic tick
      if (R.cinematicActiveRef.current) {
        R.cinematicTimelineRef.current?.tick();
        const cd = R.cinematicDataRef.current as Record<string, HTMLCanvasElement> | null;
        if (cd?.cinCanvas) {
          const cc = cd.cinCanvas;
          if (cc.width !== W || cc.height !== H) { cc.width = W; cc.height = H; cc.style.width = W + 'px'; cc.style.height = H + 'px'; }
          const pCtx = cc.getContext('2d')!;
          pCtx.clearRect(0, 0, W, H);
          const elapsed = performance.now() - R.cinematicStartRef.current;
          if (elapsed > 700 && elapsed < 5400 && Math.random() < 0.28) cpBurst(W, H, 2);
          cpUpdate(1 / 60); cpDraw(pCtx);
        }
      }
    };

    R.rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(R.rafRef.current); };
  }, []);
}
