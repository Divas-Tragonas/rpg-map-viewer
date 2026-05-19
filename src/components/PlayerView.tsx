'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers } from '@/components/icons';
import {
  BC_CHANNEL, TOKEN_LERP,
} from '@/constants';
import {
  renderZoneOverlays, renderExtras, renderPaintedZones, renderShapePreview,
} from '@/lib/render/zones';
import { advanceStrokeAnim as _advStroke, replayStroke as _replayStroke } from '@/lib/render/drawing';
import { renderSpells } from '@/lib/render/spells';
import { renderEnemyTokens, renderPlayerTokens, renderLibEnemyTokens } from '@/lib/render/tokens';
import { renderGrid, renderDMPointer } from '@/lib/render/grid';
import { CinematicTimeline, cpBurst, cpUpdate, cpDraw, cpKill } from '@/lib/cinematic';
import type { MapStructure, VisMap, PosMap, Player, PaintedZone, Spell, ConditionsMap, DefeatedMap, TokenSizeMap, LibEnemy, PsdEnemyOverride, PsdEnemyOverrides } from '@/types';

export function PlayerView() {
  const [bgLoaded,   setBgLoaded]   = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const stageRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef  = useRef<HTMLElement | null>(null);
  const bgTransitionRef = useRef<HTMLDivElement>(null);

  const rStruct      = useRef<MapStructure | null>(null);
  const rVis         = useRef<VisMap>({});
  const rPos         = useRef<PosMap>({});
  const rZoom        = useRef(1);
  const rPlayers     = useRef<Player[]>([]);
  const rLibEnemies  = useRef<LibEnemy[]>([]);
  const rLayerImages = useRef<Record<number, HTMLCanvasElement>>({});
  const rConditions  = useRef<ConditionsMap>({});
  const rDefeated    = useRef<DefeatedMap>({});
  const rPaintedZones = useRef<PaintedZone[]>([]);
  const rActiveSpells = useRef<Spell[]>([]);
  const rGridVisible  = useRef(false);
  const rGridSize     = useRef(70);
  const rGridLineWidth = useRef(1.5);
  const rGridOriginX  = useRef(0);
  const rGridOriginY  = useRef(0);
  const rEnemyHighlight = useRef(false);
  const rTokenSizeOverride = useRef<TokenSizeMap>({});
  const rPointerPos   = useRef<{ x: number; y: number } | null>(null);
  const rHoveredZone  = useRef<{ id: number; lx: number; ly: number; lw: number; lh: number } | null>(null);
  const rSelectedToken = useRef<number | string | null>(null);

  const rPanOffset    = useRef({ x: 0, y: 0 });
  const visualZoomRef = useRef(1);
  const visualPanRef  = useRef({ x: 0, y: 0 });
  const visualPosRef  = useRef<PosMap>({});
  const zoneAnimRef   = useRef<Record<string, number>>({});
  const zoneAppearRef = useRef<Record<string, number>>({});

  const drawCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const strokeQueueRef   = useRef<import('@/types').StrokeAnimState[]>([]);
  const activeStrokeAnim = useRef<import('@/types').StrokeAnimState | null>(null);

  const rDeathCanvas     = useRef<HTMLCanvasElement | null>(null);
  const defeatedAnimRef  = useRef<Record<string, number>>({});
  const invisAlphaRef    = useRef<Record<string, number>>({});
  const rHighlightAlpha  = useRef(0);
  const rHighlightLocked = useRef(false);
  const highlightStartRef = useRef<number | null>(null);
  const rGridCalibrating  = useRef(false);
  const rGridDmAlpha      = useRef(0);
  const gridCalibRef      = useRef(null);
  const gridCalibCurrRef  = useRef(null);
  const gridCalibHoverRef = useRef(null);
  const rContextMenu      = useRef(null);
  const rPsdEnemyOverrides = useRef<PsdEnemyOverrides>({});
  const rPsdEnemyImgCache  = useRef<Record<number, HTMLCanvasElement>>({});
  const txCache           = useRef<Record<string, HTMLCanvasElement>>({});

  const rDMPreviewActive = useRef(false);
  const rDMPreviewZoom   = useRef(1);
  const rDMPreviewPan    = useRef({ x: 0, y: 0 });

  const cinematicActiveRef   = useRef(false);
  const cinematicDataRef     = useRef<Record<string, HTMLElement | HTMLCanvasElement> | null>(null);
  const cinematicStartRef    = useRef(0);
  const cinematicCamRef      = useRef({ active: false, tgtZoom: 1, tgtPan: { x: 0, y: 0 }, curZoom: 1, curPan: { x: 0, y: 0 } });
  const cinematicOrigZoomRef = useRef(1);
  const cinematicOrigPanRef  = useRef({ x: 0, y: 0 });
  const cinematicTimelineRef = useRef<CinematicTimeline | null>(null);
  const triggerBossIntroRef  = useRef<((data: Record<string, unknown>) => void) | null>(null);
  const skipBossIntroRef     = useRef<(() => void) | null>(null);

  const bcRef = useRef<BroadcastChannel | null>(null);
  const rafRef = useRef<number>(0);
  const _ctx2dRef = useRef<CanvasRenderingContext2D | null>(null);
  const isShapeDrawingRef = useRef(false);
  const shapePointsRef    = useRef<{ x: number; y: number }[]>([]);

  const [activeSpells, setActiveSpells] = useState<Spell[]>([]);

  const [expositorVisible, setExpositorVisible] = useState(false);
  const [expositorFading, setExpositorFading] = useState(false);
  const [expositorSrc, setExpositorSrc] = useState<string | null>(null);
  const [expositorType, setExpositorType] = useState<'image' | 'video' | null>(null);
  const expositorObjectUrl = useRef<string | null>(null);
  const expositorInnerRef = useRef<HTMLDivElement | null>(null);
  const expTgt = useRef({ zoom: 1, panX: 0, panY: 0, kbTx: 0, kbTy: 0 });
  const expCur = useRef({ zoom: 1, panX: 0, panY: 0, kbTx: 0, kbTy: 0 });

  const _loadBgFromUrl = useCallback((url: string, mimeType: string, withFade: boolean) => {
    const stage = stageRef.current; if (!stage) return;
    const overlay = bgTransitionRef.current;
    const doLoad = () => {
      if (mediaRef.current) { mediaRef.current.remove(); mediaRef.current = null; }
      const isVid = mimeType && mimeType.startsWith('video/');
      const el = document.createElement(isVid ? 'video' : 'img') as HTMLVideoElement & HTMLImageElement;
      el.style.cssText = 'position:absolute;pointer-events:none;display:block;top:0;left:0;';
      if (isVid) { el.autoplay = true; el.loop = true; el.muted = true; el.playsInline = true; }
      el.src = url;
      stage.appendChild(el);
      mediaRef.current = el;
      setBgLoaded(true);
      if (overlay) setTimeout(() => { overlay.style.opacity = '0'; }, 80);
    };
    if (withFade && overlay) { overlay.style.opacity = '1'; setTimeout(doLoad, 520); }
    else doLoad();
  }, []);

  const triggerBossIntro = useCallback((data: Record<string, unknown>) => {
    if (cinematicActiveRef.current) return;
    const { bossName, portrait, tokenPos } = data;
    const stage = stageRef.current; if (!stage) return;

    if (!document.getElementById('cin-style')) {
      const st = document.createElement('style');
      st.id = 'cin-style';
      st.textContent = `
        @keyframes cinFlick{0%,100%{opacity:1}12%{opacity:.5}14%{opacity:1}72%{opacity:.7}74%{opacity:1}}
        @keyframes cinGlitch{0%,94%,100%{transform:translateX(0) scale(1)}95%{transform:translateX(-3px) skewX(-1deg)}97%{transform:translateX(3px) skewX(1deg)}}
        @keyframes cinGlow{0%,100%{text-shadow:0 0 35px #d4a017,0 0 70px rgba(212,160,23,.6),0 5px 12px rgba(0,0,0,.9)}50%{text-shadow:0 0 60px #d4a017,0 0 130px rgba(212,160,23,.8),0 0 220px rgba(212,160,23,.4),0 5px 12px rgba(0,0,0,.9)}}
        @keyframes cinParallaxPrt{0%,100%{transform:translate(0,-50%) translateX(0px) scale(1)}50%{transform:translate(0,-50%) translateX(-32px) scale(1.018)}}
        @keyframes cinParallaxTxt{0%,100%{transform:translateX(0px)}50%{transform:translateX(18px)}}
      `;
      document.head.appendChild(st);
    }

    const PRIMARY = '#d4a017', SECONDARY = '#ff9900', GLOW = 'rgba(212,160,23,0.6)', BGTINT = 'rgba(30,20,0,0.3)';
    cinematicOrigZoomRef.current = rZoom.current;
    cinematicOrigPanRef.current = { ...rPanOffset.current };
    cinematicActiveRef.current = true;
    cpKill();

    const SW = window.innerWidth, SH = window.innerHeight;
    const lbH = Math.round(SH * 0.105);

    const cinCanvas = document.createElement('canvas');
    cinCanvas.width = SW; cinCanvas.height = SH;
    cinCanvas.style.cssText = `position:absolute;top:0;left:0;width:${SW}px;height:${SH}px;pointer-events:none;z-index:58`;
    stage.appendChild(cinCanvas);

    const dim = document.createElement('div');
    dim.style.cssText = `position:absolute;inset:0;background:#000;opacity:0;transition:opacity 0.65s ease;pointer-events:none;z-index:59`;
    stage.appendChild(dim);

    const vig = document.createElement('div');
    vig.style.cssText = `position:absolute;inset:0;background:radial-gradient(ellipse at 30% 60%,transparent 15%,rgba(0,0,0,0.88) 100%);opacity:0;transition:opacity 0.75s ease;pointer-events:none;z-index:59`;
    stage.appendChild(vig);

    const tint = document.createElement('div');
    tint.style.cssText = `position:absolute;inset:0;background:${BGTINT};opacity:0;transition:opacity 0.7s ease;pointer-events:none;z-index:59`;
    stage.appendChild(tint);

    const lbTop = document.createElement('div');
    lbTop.style.cssText = `position:absolute;top:0;left:0;right:0;height:${lbH}px;background:#000;transform:translateY(-100%);transition:transform 0.5s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:61;overflow:hidden`;
    const accTop = document.createElement('div');
    accTop.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,${PRIMARY} 30%,${SECONDARY} 70%,transparent 100%);opacity:0;transition:opacity 0.4s ease 0.5s`;
    lbTop.appendChild(accTop); stage.appendChild(lbTop);

    const lbBot = document.createElement('div');
    lbBot.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:${lbH}px;background:#000;transform:translateY(100%);transition:transform 0.5s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:61;overflow:hidden`;
    const accBot = document.createElement('div');
    accBot.style.cssText = `position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,${PRIMARY} 30%,${SECONDARY} 70%,transparent 100%);opacity:0;transition:opacity 0.4s ease 0.5s`;
    lbBot.appendChild(accBot); stage.appendChild(lbBot);

    const prtH = Math.round(SH * 0.92), prtW = Math.round(prtH * 0.72);
    const prtWrap = document.createElement('div');
    prtWrap.style.cssText = `position:absolute;right:5%;top:50%;width:${prtW}px;height:${prtH}px;transform:translate(120%,-50%);transition:transform 0.6s cubic-bezier(.16,1,.3,1);pointer-events:none;z-index:60`;
    const prtGlow = document.createElement('div');
    prtGlow.style.cssText = `position:absolute;inset:-50px;background:radial-gradient(ellipse at 40% 55%,${GLOW} 0%,transparent 65%);filter:blur(30px);opacity:0;transition:opacity 1s ease`;
    prtWrap.appendChild(prtGlow);
    const MASK = `-webkit-mask-image:linear-gradient(to left,rgba(0,0,0,1) 45%,rgba(0,0,0,.6) 72%,transparent 100%),linear-gradient(to bottom,rgba(0,0,0,1) 60%,transparent 100%);mask-image:linear-gradient(to left,rgba(0,0,0,1) 45%,rgba(0,0,0,.6) 72%,transparent 100%),linear-gradient(to bottom,rgba(0,0,0,1) 60%,transparent 100%);-webkit-mask-composite:intersect;mask-composite:intersect`;
    const IMG_CSS = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;${MASK}`;
    const portraitEl = portrait as (HTMLCanvasElement | HTMLImageElement | null);
    if (portraitEl) {
      if (portraitEl instanceof HTMLCanvasElement) {
        const pc = document.createElement('canvas');
        pc.width = portraitEl.width; pc.height = portraitEl.height;
        pc.getContext('2d')!.drawImage(portraitEl, 0, 0);
        pc.style.cssText = IMG_CSS; prtWrap.appendChild(pc);
      } else {
        const pi = document.createElement('img') as HTMLImageElement;
        pi.src = (portraitEl as HTMLImageElement).src;
        pi.style.cssText = IMG_CSS; prtWrap.appendChild(pi);
      }
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:${Math.round(prtH*0.42)}px;font-weight:900;color:${PRIMARY};text-shadow:0 0 80px ${GLOW};${MASK}`;
      ph.textContent = ((bossName as string) || '?').slice(0, 1).toUpperCase();
      prtWrap.appendChild(ph);
    }
    stage.appendChild(prtWrap);

    const txtWrap = document.createElement('div');
    txtWrap.style.cssText = `position:absolute;left:10%;bottom:${lbH + Math.round(SH*0.07)}px;transform:translateX(-60px);opacity:0;transition:transform 0.42s cubic-bezier(.16,1,.3,1),opacity 0.42s ease;pointer-events:none;z-index:62`;
    stage.appendChild(txtWrap);

    const nmFS = Math.max(46, Math.min(110, Math.round(SW / 8)));
    const nmEl = document.createElement('div');
    nmEl.style.cssText = `font-family:Georgia,serif;font-size:${nmFS}px;font-weight:900;text-transform:uppercase;letter-spacing:0.10em;color:#fff;text-shadow:0 0 35px ${PRIMARY},0 0 70px ${GLOW},0 5px 12px rgba(0,0,0,0.9);line-height:1.05;max-width:${Math.round(SW*0.52)}px`;
    nmEl.textContent = (bossName as string) || 'BOSS';
    txtWrap.appendChild(nmEl);

    const barW = Math.min(Math.round(nmFS * ((bossName as string || 'BOSS').length) * 0.58), Math.round(SW * 0.5));
    const nmBar = document.createElement('div');
    nmBar.style.cssText = `height:3px;width:${barW}px;margin-top:${Math.round(SH*0.008)}px;background:linear-gradient(90deg,${PRIMARY},${SECONDARY},transparent);transform:scaleX(0);transform-origin:left;transition:transform 0.5s cubic-bezier(.16,1,.3,1) 0.1s`;
    txtWrap.appendChild(nmBar);

    cinematicDataRef.current = { cinCanvas, dim, vig, tint, lbTop, lbBot, accTop, accBot, prtWrap, prtGlow, txtWrap, nmEl, nmBar } as unknown as Record<string, HTMLElement | HTMLCanvasElement>;
    cinematicStartRef.current = performance.now();

    const cinCam = cinematicCamRef.current;
    if (tokenPos) {
      const tp = tokenPos as { x: number; y: number };
      const cvs = canvasRef.current;
      if (cvs) {
        const r2 = cvs.getBoundingClientRect();
        const W2 = r2.width || SW, H2 = r2.height || SH;
        const m2 = mediaRef.current as HTMLImageElement & HTMLVideoElement | null;
        let mw2 = 1920, mh2 = 1080;
        if (m2?.tagName === 'IMG'   && m2.naturalWidth)  { mw2 = m2.naturalWidth;  mh2 = m2.naturalHeight; }
        if (m2?.tagName === 'VIDEO' && m2.videoWidth)    { mw2 = m2.videoWidth;    mh2 = m2.videoHeight; }
        const tZ = Math.min(4, Math.max(rZoom.current * 2.0, 1.8));
        const sc2 = Math.min(W2 / mw2, H2 / mh2) * tZ;
        cinCam.active  = true;
        cinCam.tgtZoom = tZ;
        cinCam.tgtPan  = { x: W2*0.5 - tp.x*sc2 - (W2-mw2*sc2)/2, y: H2*0.5 - tp.y*sc2 - (H2-mh2*sc2)/2 };
        cinCam.curZoom = rZoom.current;
        cinCam.curPan  = { ...rPanOffset.current };
      }
    }

    const tl = new CinematicTimeline();
    tl
      .add(60, () => {
        dim.style.opacity = '0.52'; vig.style.opacity = '1'; tint.style.opacity = '1';
        lbTop.style.transform = 'translateY(0)'; lbBot.style.transform = 'translateY(0)';
        setTimeout(() => { accTop.style.opacity = '1'; accBot.style.opacity = '1'; }, 500);
      })
      .add(500, () => {
        prtWrap.style.transform = 'translate(0,-50%)'; prtWrap.style.transition = 'transform 0.6s cubic-bezier(.16,1,.3,1)';
        setTimeout(() => { prtGlow.style.opacity = '1'; }, 280);
        setTimeout(() => { prtWrap.style.animation = 'cinParallaxPrt 9s ease-in-out infinite'; }, 700);
      })
      .add(1100, () => {
        txtWrap.style.transform = 'translateX(0)'; txtWrap.style.opacity = '1';
        setTimeout(() => { nmBar.style.transform = 'scaleX(1)'; }, 120);
        setTimeout(() => { txtWrap.style.animation = 'cinParallaxTxt 9s ease-in-out infinite'; }, 650);
        const flash = document.createElement('div');
        flash.style.cssText = `position:absolute;inset:0;background:#fff;opacity:0.88;transition:opacity 0.12s linear;pointer-events:none;z-index:63`;
        stage.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 180); }, 16);
        const flash2 = document.createElement('div');
        flash2.style.cssText = `position:absolute;inset:0;background:${PRIMARY};opacity:0.28;transition:opacity 0.5s ease;pointer-events:none;z-index:63`;
        stage.appendChild(flash2);
        setTimeout(() => { flash2.style.opacity = '0'; setTimeout(() => flash2.remove(), 520); }, 200);
        setTimeout(() => { nmEl.style.animation = 'cinGlitch 5s ease 2s infinite, cinGlow 2.5s ease 0.8s infinite'; }, 500);
      })
      .add(4200, () => {
        prtWrap.style.animation = ''; prtWrap.style.transition = 'transform 0.65s cubic-bezier(.4,0,1,1),opacity 0.65s ease';
        prtWrap.style.transform = 'translate(120%,-50%)'; prtWrap.style.opacity = '0';
        txtWrap.style.animation = ''; txtWrap.style.transition = 'transform 0.55s cubic-bezier(.4,0,1,1),opacity 0.55s ease';
        txtWrap.style.transform = 'translateX(-60px)'; txtWrap.style.opacity = '0';
        [dim, vig, tint].forEach(el => { el.style.transition = 'opacity 0.75s ease'; el.style.opacity = '0'; });
        lbTop.style.transition = 'transform 0.6s cubic-bezier(.4,0,1,1)'; lbTop.style.transform = 'translateY(-100%)';
        lbBot.style.transition = 'transform 0.6s cubic-bezier(.4,0,1,1)'; lbBot.style.transform = 'translateY(100%)';
        rZoom.current = cinematicOrigZoomRef.current;
        rPanOffset.current = { ...cinematicOrigPanRef.current };
        cinCam.active = false;
      })
      .add(5100, () => {
        [cinCanvas, dim, vig, tint, lbTop, lbBot, prtWrap, txtWrap].forEach(el => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        cpKill();
        cinematicDataRef.current = null;
        cinematicActiveRef.current = false;
      })
      .play();

    cinematicTimelineRef.current = tl;
  }, []);

  const skipBossIntro = useCallback(() => {
    if (!cinematicActiveRef.current) return;
    const tl = cinematicTimelineRef.current;
    if (tl) tl.skip();
    const cd = cinematicDataRef.current;
    if (cd) {
      const { cinCanvas, dim, vig, tint, lbTop, lbBot, prtWrap, txtWrap } = cd as Record<string, HTMLElement & HTMLCanvasElement>;
      if (prtWrap) { prtWrap.style.animation = ''; prtWrap.style.transition = 'transform 0.28s cubic-bezier(.4,0,1,1),opacity 0.25s ease'; prtWrap.style.transform = 'translate(120%,-50%)'; prtWrap.style.opacity = '0'; }
      if (txtWrap) { txtWrap.style.animation = ''; txtWrap.style.transition = 'transform 0.25s cubic-bezier(.4,0,1,1),opacity 0.22s ease'; txtWrap.style.transform = 'translateX(-60px)'; txtWrap.style.opacity = '0'; }
      [dim, vig, tint].forEach(el => { if (el) { el.style.transition = 'opacity 0.22s ease'; el.style.opacity = '0'; } });
      [lbTop, lbBot].forEach((el, i) => {
        if (!el) return;
        el.style.transition = 'transform 0.28s ease';
        el.style.transform = i === 0 ? 'translateY(-100%)' : 'translateY(100%)';
      });
      setTimeout(() => {
        [cinCanvas, dim, vig, tint, lbTop, lbBot, prtWrap, txtWrap].forEach(el => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        cpKill();
        cinematicDataRef.current = null;
      }, 320);
    }
    rZoom.current = cinematicOrigZoomRef.current;
    rPanOffset.current = { ...cinematicOrigPanRef.current };
    cinematicCamRef.current.active = false;
    cinematicActiveRef.current = false;
  }, []);

  triggerBossIntroRef.current = triggerBossIntro;
  skipBossIntroRef.current    = skipBossIntro;

  useEffect(() => {
    const oc = document.createElement('canvas');
    oc.width = 1; oc.height = 1;
    drawCanvasRef.current = oc;
  }, []);

  useEffect(() => {
    const bc = new BroadcastChannel(BC_CHANNEL);
    bcRef.current = bc;

    bc.onmessage = async (ev) => {
      const msg = ev.data;

      if (msg.type === 'BG') {
        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        const url  = URL.createObjectURL(blob);
        _loadBgFromUrl(url, msg.mimeType, !!msg.withFade);
      } else if (msg.type === 'STRUCT') {
        rStruct.current = msg.struct;
        rVis.current    = msg.vis   || {};
        rPos.current    = msg.pos   || {};
        rZoom.current   = msg.zoom  ?? 1;
        rPlayers.current = msg.players || [];
        if (msg.conditions)    rConditions.current    = msg.conditions;
        if (msg.defeated)      rDefeated.current      = msg.defeated;
        if (msg.paintedZones)  rPaintedZones.current  = msg.paintedZones;
        if (msg.panOffset)     rPanOffset.current     = msg.panOffset;
        if (msg.gridVisible   !== undefined) rGridVisible.current   = msg.gridVisible;
        if (msg.gridSize      !== undefined) rGridSize.current      = msg.gridSize;
        if (msg.gridOriginX   !== undefined) rGridOriginX.current   = msg.gridOriginX;
        if (msg.gridOriginY   !== undefined) rGridOriginY.current   = msg.gridOriginY;
        if (msg.gridLineWidth !== undefined) rGridLineWidth.current = msg.gridLineWidth;
        if (msg.enemyHighlight !== undefined) {
          rEnemyHighlight.current = msg.enemyHighlight;
          if (msg.enemyHighlight) highlightStartRef.current = performance.now();
          else highlightStartRef.current = null;
        }
        if (msg.tokenSizeOverride !== undefined) rTokenSizeOverride.current = msg.tokenSizeOverride;
        if (msg.libEnemies) rLibEnemies.current = msg.libEnemies;
        if (msg.psdEnemyOverrides) {
          rPsdEnemyOverrides.current = msg.psdEnemyOverrides;
          await Promise.all((Object.entries(msg.psdEnemyOverrides) as [string, PsdEnemyOverride][]).map(([id, ov]) => new Promise<void>(res => {
            if (!ov.imageData) { res(); return; }
            const img = new Image();
            img.onload = () => {
              const oc = document.createElement('canvas');
              oc.width = img.naturalWidth; oc.height = img.naturalHeight;
              oc.getContext('2d')!.drawImage(img, 0, 0);
              rPsdEnemyImgCache.current[Number(id)] = oc;
              res();
            };
            img.onerror = () => res();
            img.src = ov.imageData!;
          })));
        }

        const urls = msg.layerImageUrls || {};
        const imgs: Record<number, HTMLCanvasElement> = {};
        await Promise.all(Object.keys(urls).map(id => new Promise<void>(res => {
          const img = new Image();
          img.onload = () => {
            const oc = document.createElement('canvas');
            oc.width = img.naturalWidth; oc.height = img.naturalHeight;
            oc.getContext('2d')!.drawImage(img, 0, 0);
            imgs[Number(id)] = oc;
            res();
          };
          img.onerror = () => res();
          img.src = urls[id];
        })));
        rLayerImages.current = imgs;

        zoneAnimRef.current  = {};
        visualPosRef.current = {};
        strokeQueueRef.current  = [];
        activeStrokeAnim.current = null;
        Object.entries(msg.vis || {}).forEach(([id, active]) => {
          zoneAnimRef.current[id] = active ? 1 : 0;
        });
        Object.entries(msg.pos || {}).forEach(([id, p]) => {
          visualPosRef.current[id] = { ...(p as { x: number; y: number }) };
        });

        if (msg.psdInfo) {
          const oc = drawCanvasRef.current;
          if (oc && (oc.width !== msg.psdInfo.width || oc.height !== msg.psdInfo.height)) {
            oc.width = msg.psdInfo.width; oc.height = msg.psdInfo.height;
          }
        }
        setPlayerReady(true);
        setBgLoaded(true);
      } else if (msg.type === 'STATE') {
        if (msg.vis)   rVis.current = msg.vis;
        if (msg.pos)   rPos.current = msg.pos;
        if (msg.zoom  !== undefined) rZoom.current = msg.zoom;
        if (msg.panOffset) rPanOffset.current = msg.panOffset;
        if (msg.players)   rPlayers.current = msg.players;
        if (msg.conditions)  rConditions.current = msg.conditions;
        if (msg.defeated) {
          const prev = rDefeated.current || {};
          Object.keys(msg.defeated).forEach(id => { if (!prev[id]) defeatedAnimRef.current[id] = 0; });
          Object.keys(prev).forEach(id => { if (!msg.defeated[id]) delete defeatedAnimRef.current[id]; });
          rDefeated.current = msg.defeated;
        }
        if (msg.paintedZones) {
          const existingIds = new Set(rPaintedZones.current.map((z: PaintedZone) => z.id));
          msg.paintedZones.forEach((z: PaintedZone) => { if (!existingIds.has(z.id)) zoneAppearRef.current[z.id] = performance.now(); });
          rPaintedZones.current = msg.paintedZones;
        }
        if (msg.gridVisible   !== undefined) rGridVisible.current   = msg.gridVisible;
        if (msg.gridSize      !== undefined) rGridSize.current      = msg.gridSize;
        if (msg.gridOriginX   !== undefined) rGridOriginX.current   = msg.gridOriginX;
        if (msg.gridOriginY   !== undefined) rGridOriginY.current   = msg.gridOriginY;
        if (msg.gridLineWidth !== undefined) rGridLineWidth.current = msg.gridLineWidth;
        if (msg.enemyHighlight !== undefined) {
          const prev = rEnemyHighlight.current;
          rEnemyHighlight.current = msg.enemyHighlight;
          if (msg.enemyHighlight && !prev) highlightStartRef.current = performance.now();
          else if (!msg.enemyHighlight) highlightStartRef.current = null;
        }
        if (msg.tokenSizeOverride !== undefined) rTokenSizeOverride.current = msg.tokenSizeOverride;
        if (msg.libEnemies) rLibEnemies.current = msg.libEnemies;
        if (msg.dmPreviewActive !== undefined) {
          rDMPreviewActive.current = msg.dmPreviewActive;
          if (msg.dmPreviewZoom != null) rDMPreviewZoom.current = msg.dmPreviewZoom;
          if (msg.dmPreviewPan  != null) rDMPreviewPan.current  = msg.dmPreviewPan;
        }
        if (msg.psdEnemyOverrides) {
          rPsdEnemyOverrides.current = msg.psdEnemyOverrides;
          (Object.entries(msg.psdEnemyOverrides) as [string, PsdEnemyOverride][]).forEach(([id, ov]) => {
            if (!ov.imageData) return;
            const img = new Image();
            img.onload = () => {
              const oc = document.createElement('canvas');
              oc.width = img.naturalWidth; oc.height = img.naturalHeight;
              oc.getContext('2d')!.drawImage(img, 0, 0);
              rPsdEnemyImgCache.current[Number(id)] = oc;
            };
            img.src = ov.imageData!;
          });
        }
      } else if (msg.type === 'STROKE') {
        const pts = msg.points;
        if (pts && pts.length > 1) {
          const ANIM_FRAMES = 60;
          strokeQueueRef.current.push({
            points: pts, color: msg.color, size: msg.size, tool: msg.tool,
            idx: 1, ptsPerFrame: Math.max(1, Math.ceil(pts.length / ANIM_FRAMES)),
          });
        }
      } else if (msg.type === 'CLEAR_DRAW') {
        strokeQueueRef.current = []; activeStrokeAnim.current = null;
        const oc = drawCanvasRef.current;
        if (oc) oc.getContext('2d')!.clearRect(0, 0, oc.width, oc.height);
      } else if (msg.type === 'UNDO_DRAW') {
        strokeQueueRef.current = []; activeStrokeAnim.current = null;
        const oc = drawCanvasRef.current; if (!oc) return;
        const ctx2 = oc.getContext('2d')!;
        ctx2.clearRect(0, 0, oc.width, oc.height);
        for (const stroke of (msg.strokeHistory || [])) _replayStroke(ctx2, stroke);
      } else if (msg.type === 'POINTER') {
        rPointerPos.current = msg.pos;
      } else if (msg.type === 'SPELL') {
        const sp = { ...msg.spell, startTime: performance.now() };
        rActiveSpells.current = [...rActiveSpells.current, sp];
        setActiveSpells([...rActiveSpells.current]);
      } else if (msg.type === 'BOSS_INTRO') {
        if (triggerBossIntroRef.current) {
          const _run = (portrait: unknown) => triggerBossIntroRef.current!({ ...msg, portrait });
          if (msg.portraitDataUrl) {
            const img = new Image();
            img.onload  = () => _run(img);
            img.onerror = () => _run(rLayerImages.current[msg.tokenId] || null);
            img.src = msg.portraitDataUrl;
          } else {
            _run(rLayerImages.current[msg.tokenId] || null);
          }
        }
      } else if (msg.type === 'BOSS_INTRO_SKIP') {
        if (skipBossIntroRef.current) skipBossIntroRef.current();
      } else if (msg.type === 'EXPOSITOR_SHOW') {
        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        const url = URL.createObjectURL(blob);
        const newType = msg.mimeType.startsWith('video/') ? 'video' : 'image';
        const doShow = (u: string) => {
          if (expositorObjectUrl.current) URL.revokeObjectURL(expositorObjectUrl.current);
          expositorObjectUrl.current = u;
          setExpositorSrc(u);
          setExpositorType(newType);
          setExpositorFading(false);
          setExpositorVisible(true);
        };
        if (expositorVisible) {
          setExpositorFading(true);
          setTimeout(() => doShow(url), 350);
        } else {
          doShow(url);
        }
      } else if (msg.type === 'EXPOSITOR_HIDE') {
        setExpositorVisible(false);
      } else if (msg.type === 'EXPOSITOR_SYNC') {
        expTgt.current = {
          zoom: msg.zoom,
          panX: msg.panXNorm * window.innerWidth,
          panY: msg.panYNorm * window.innerHeight,
          kbTx: msg.kbTxPct,
          kbTy: msg.kbTyPct,
        };
      }
    };

    bc.postMessage({ type: 'PLAYER_READY' });
    return () => bc.close();
  }, [_loadBgFromUrl]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let alive = true;
    let prevBgStyle = '';

    const tick = () => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(tick);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; _ctx2dRef.current = null; }
      if (!_ctx2dRef.current) _ctx2dRef.current = canvas.getContext('2d');
      const ctx = _ctx2dRef.current!;
      ctx.clearRect(0, 0, W, H);
      const s = rStruct.current;
      const v = rVis.current, pp = rPos.current;
      const media = mediaRef.current as HTMLImageElement & HTMLVideoElement | null;

      let mw = 1920, mh = 1080;
      if (media?.tagName === 'IMG'   && media.naturalWidth)  { mw = media.naturalWidth;  mh = media.naturalHeight; }
      if (media?.tagName === 'VIDEO' && media.videoWidth)    { mw = media.videoWidth;    mh = media.videoHeight; }

      const cinCam = cinematicCamRef.current;
      const _tgtZ   = cinCam.active ? cinCam.tgtZoom  : rZoom.current;
      const _tgtPan = cinCam.active ? cinCam.tgtPan   : rPanOffset.current;
      const dzP = _tgtZ - visualZoomRef.current;
      const dxP = _tgtPan.x - visualPanRef.current.x;
      const dyP = _tgtPan.y - visualPanRef.current.y;
      if (cinCam.active) {
        if (Math.abs(dzP) < 0.0005 && Math.abs(dxP) < 0.3 && Math.abs(dyP) < 0.3) {
          visualZoomRef.current = _tgtZ; visualPanRef.current.x = _tgtPan.x; visualPanRef.current.y = _tgtPan.y;
        } else { visualZoomRef.current += dzP * 0.032; visualPanRef.current.x += dxP * 0.032; visualPanRef.current.y += dyP * 0.032; }
      } else {
        const totalDist = Math.abs(dzP) * 40 + Math.sqrt(dxP * dxP + dyP * dyP) / 35;
        const lerpF = Math.min(0.13, 0.05 + 0.045 / (totalDist + 0.05));
        if (Math.abs(dzP) < 0.002 && Math.abs(dxP) < 0.5 && Math.abs(dyP) < 0.5) {
          visualZoomRef.current = _tgtZ; visualPanRef.current.x = _tgtPan.x; visualPanRef.current.y = _tgtPan.y;
        } else { visualZoomRef.current += dzP * lerpF; visualPanRef.current.x += dxP * lerpF; visualPanRef.current.y += dyP * lerpF; }
      }
      const z = visualZoomRef.current, pan = visualPanRef.current;
      const sc = Math.min(W / mw, H / mh) * z;
      const ox = (W - mw * sc) / 2 + pan.x, oy = (H - mh * sc) / 2 + pan.y;

      if (media) {
        const bgW = Math.round(mw * sc), bgH = Math.round(mh * sc);
        const bgL = Math.round(ox), bgT = Math.round(oy);
        const newStyle = `${bgW},${bgH},${bgL},${bgT}`;
        if (newStyle !== prevBgStyle) {
          (media as HTMLElement).style.width  = bgW + 'px';
          (media as HTMLElement).style.height = bgH + 'px';
          (media as HTMLElement).style.left   = bgL + 'px';
          (media as HTMLElement).style.top    = bgT + 'px';
          prevBgStyle = newStyle;
        }
      }

      if (!s) return;

      const fc = {
        sc, ox, oy, mw, mh, isDM: false, s, v, pp,
        rLayerImages, rHoveredZone, zoneAnimRef,
        rPaintedZones, rContextMenu, zoneAppearRef, txCache: txCache.current,
        isShapeDrawingRef, shapePointsRef,
        activeStrokeAnim, strokeQueueRef, drawCanvasRef,
        rActiveSpells, setActiveSpells,
        rConditions, rDefeated, rDeathCanvas,
        defeatedAnimRef, invisAlphaRef,
        rEnemyHighlight, rHighlightAlpha, rHighlightLocked, highlightStartRef,
        visualPosRef, rPlayers, rTokenSizeOverride,
        rGridVisible, rGridSize, rGridLineWidth, rGridOriginX, rGridOriginY,
        rGridCalibrating, rGridDmAlpha,
        gridCalibRef, gridCalibCurrRef, gridCalibHoverRef,
        rPointerPos, rSelectedToken,
        rLibEnemies, rPsdEnemyOverrides, rPsdEnemyImgCache,
      };

      ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);

      renderZoneOverlays(ctx, fc);
      renderExtras(ctx, fc);
      renderPaintedZones(ctx, fc);
      renderShapePreview(ctx, fc);
      _advStroke(fc);
      renderSpells(ctx, fc);

      const oc = drawCanvasRef.current;
      if (oc) { ctx.globalAlpha = 0.92; ctx.drawImage(oc, 0, 0); ctx.globalAlpha = 1; }

      {
        const FADE = 0.35, TOTAL = 3.5;
        if (rEnemyHighlight.current) {
          const el = highlightStartRef.current ? (performance.now() - highlightStartRef.current) / 1000 : 0;
          if      (el < FADE)          rHighlightAlpha.current = el / FADE;
          else if (el < TOTAL - FADE)  rHighlightAlpha.current = 1;
          else                         rHighlightAlpha.current = Math.max(0, 1 - (el - (TOTAL - FADE)) / FADE);
        } else {
          rHighlightAlpha.current = Math.max(0, rHighlightAlpha.current - 0.08);
        }
      }

      renderEnemyTokens(ctx, fc);
      renderLibEnemyTokens(ctx, fc);
      renderPlayerTokens(ctx, fc);

      ctx.restore();

      renderGrid(ctx, fc);
      renderDMPointer(ctx, fc);

      if (cinematicActiveRef.current) {
        const tl2 = cinematicTimelineRef.current;
        if (tl2) tl2.tick();
        const cd2 = cinematicDataRef.current;
        if (cd2) {
          const { cinCanvas: cc } = cd2 as { cinCanvas: HTMLCanvasElement };
          if (cc && (cc.width !== W || cc.height !== H)) { cc.width = W; cc.height = H; (cc as HTMLElement).style.width = W + 'px'; (cc as HTMLElement).style.height = H + 'px'; }
          if (cc) {
            const pCtx = cc.getContext('2d')!;
            pCtx.clearRect(0, 0, W, H);
            const elapsed2 = performance.now() - cinematicStartRef.current;
            if (elapsed2 > 700 && elapsed2 < 5400) { if (Math.random() < 0.28) cpBurst(W, H, 2); }
            cpUpdate(1 / 60);
            cpDraw(pCtx);
          }
        }
      }

      // Expositor smooth LERP
      if (expositorInnerRef.current) {
        const tgt = expTgt.current, cur = expCur.current;
        const EL = 0.1;
        cur.zoom += (tgt.zoom - cur.zoom) * EL;
        cur.panX += (tgt.panX - cur.panX) * EL;
        cur.panY += (tgt.panY - cur.panY) * EL;
        cur.kbTx += (tgt.kbTx - cur.kbTx) * EL;
        cur.kbTy += (tgt.kbTy - cur.kbTy) * EL;
        expositorInnerRef.current.style.transform =
          `translate(calc(-50% + ${cur.panX}px), calc(-50% + ${cur.panY}px)) scale(${cur.zoom}) translate(${cur.kbTx}%, ${cur.kbTy}%)`;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cinematicActiveRef.current) {
        if (skipBossIntroRef.current) skipBossIntroRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      <div ref={stageRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent' }}
      />
      <div
        ref={bgTransitionRef}
        style={{ position: 'absolute', inset: 0, background: '#000', zIndex: 8, opacity: 0, transition: 'opacity 0.5s ease', pointerEvents: 'none' }}
      />
      {!playerReady && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', color: '#8b949e', flexDirection: 'column', gap: 16 }}>
          <Layers size={40} color="#21262d" />
          <div style={{ fontSize: 18, color: '#e6edf3', fontWeight: 600 }}>RPG Map Viewer</div>
          <div style={{ fontSize: 13 }}>Esperant al Dungeon Master...</div>
        </div>
      )}

      {/* Expositor overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: '#080604',
          opacity: (expositorVisible && !expositorFading) ? 1 : 0,
          pointerEvents: expositorVisible ? 'auto' : 'none',
          transition: expositorFading ? 'opacity 0.3s ease-in-out' : 'opacity 1.4s ease-in-out',
          overflow: 'hidden',
        }}
      >
        {/* blurred background */}
        {expositorSrc && expositorType === 'image' && (
          <div style={{ position: 'absolute', inset: -60, backgroundImage: `url(${expositorSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(36px) brightness(0.22) saturate(0.45)', transform: 'scale(1.12)', pointerEvents: 'none' }} />
        )}
        {/* main media — transform driven by EXPOSITOR_SYNC */}
        <div ref={expositorInnerRef} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', transformOrigin: 'center center', userSelect: 'none', pointerEvents: 'none' }}>
          {expositorSrc && expositorType === 'image' && (
            <img src={expositorSrc} alt="" draggable={false} style={{ maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', display: 'block', userSelect: 'none' }} />
          )}
          {expositorSrc && expositorType === 'video' && (
            <video src={expositorSrc} autoPlay loop muted playsInline draggable={false} style={{ maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', display: 'block' }} />
          )}
        </div>
      </div>
    </div>
  );
}
