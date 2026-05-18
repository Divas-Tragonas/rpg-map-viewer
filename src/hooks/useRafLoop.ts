'use client';
import { useEffect } from 'react';
import { renderZoneOverlays, renderExtras, renderPaintedZones, renderShapePreview } from '@/lib/render/zones';
import { advanceStrokeAnim } from '@/lib/render/drawing';
import { renderSpells } from '@/lib/render/spells';
import { renderEnemyTokens, renderPlayerTokens, renderLibEnemyTokens } from '@/lib/render/tokens';
import { renderGrid, renderGridCalib, renderDMPointer } from '@/lib/render/grid';
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
        broadcastDmPreview();
        if (Math.abs(R.dmLocalPan.current.x) < 0.4 && Math.abs(R.dmLocalPan.current.y) < 0.4 && Math.abs(R.dmLocalZoom.current - 1) < 0.002) {
          R.dmLocalPan.current = { x: 0, y: 0 }; R.dmLocalZoom.current = 1;
          R.dmPrivateReturnAnim.current = false; setDmPrivateActive(false);
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
        if (ns !== prevBgStyle) {
          media.style.width = bgW + 'px'; media.style.height = bgH + 'px';
          media.style.left = bgL + 'px'; media.style.top = bgT + 'px';
          prevBgStyle = ns;
        }
      }

      if (!s) return;

      const fc = {
        sc, ox, oy, mw, mh, isDM: true, s, v, pp,
        rLayerImages: R.rLayerImages, rHoveredZone: R.rHoveredZone, zoneAnimRef: R.zoneAnimRef,
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
        rPointerPos: R.rPointerPos, rSelectedToken: R.rSelectedToken,
        rLibEnemies: R.rLibEnemies,
        rPsdEnemyOverrides: R.rPsdEnemyOverrides,
        rPsdEnemyImgCache: R.rPsdEnemyImgCache,
      };

      ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
      renderZoneOverlays(ctx, fc);
      renderExtras(ctx, fc);
      renderPaintedZones(ctx, fc);
      renderShapePreview(ctx, fc);
      advanceStrokeAnim(fc);
      renderSpells(ctx, fc);

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
      ctx.restore();

      // Grid DM alpha
      if (R.rGridVisible.current) {
        const isDragging = !!R.dragRef.current;
        const tgt = (isDragging || R.rGridCalibrating.current) ? 1 : 0;
        R.rGridDmAlpha.current += (tgt - R.rGridDmAlpha.current) * 0.25;
        if (Math.abs(tgt - R.rGridDmAlpha.current) < 0.004) R.rGridDmAlpha.current = tgt;
      }

      renderGrid(ctx, fc);
      renderGridCalib(ctx, fc);
      renderDMPointer(ctx, fc);

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
