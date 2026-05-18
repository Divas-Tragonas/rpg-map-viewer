'use client';
import { useCallback } from 'react';
import { CinematicTimeline, cpBurst, cpUpdate, cpDraw, cpKill } from '@/lib/cinematic';
import type { DMRefs } from './useDMRefs';

export function useCinematic(R: DMRefs) {
  const {
    stageRef, canvasRef, mediaRef, rZoom, rPanOffset, dmLocalPan, dmLocalZoom,
    rLayerImages, cinematicActiveRef, cinematicDataRef, cinematicStartRef,
    cinematicCamRef, cinematicOrigZoomRef, cinematicOrigPanRef,
    cinematicTimelineRef, triggerBossIntroRef, skipBossIntroRef,
  } = R;

  const triggerBossIntro = useCallback((data: Record<string, unknown>) => {
    if (cinematicActiveRef.current) return;
    const { tokenId, bossName, portrait, tokenPos } = data as {
      tokenId: number | string; bossName: string;
      portrait: HTMLCanvasElement | HTMLImageElement | null;
      tokenPos: { x: number; y: number } | null;
    };
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
    if (portrait) {
      if (portrait instanceof HTMLCanvasElement) {
        const pc = document.createElement('canvas');
        pc.width = portrait.width; pc.height = portrait.height;
        pc.getContext('2d')!.drawImage(portrait, 0, 0);
        pc.style.cssText = IMG_CSS; prtWrap.appendChild(pc);
      } else {
        const pi = document.createElement('img');
        pi.src = (portrait as HTMLImageElement).src;
        pi.style.cssText = IMG_CSS; prtWrap.appendChild(pi);
      }
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:${Math.round(prtH*0.42)}px;font-weight:900;color:${PRIMARY};text-shadow:0 0 80px ${GLOW};${MASK}`;
      ph.textContent = ((bossName || '?') as string).slice(0, 1).toUpperCase();
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

    cinematicDataRef.current = { cinCanvas, dim, vig, tint, lbTop, lbBot, accTop, accBot, prtWrap, prtGlow, txtWrap, nmEl, nmBar, tokenPos } as unknown as Record<string, Element | null>;
    cinematicStartRef.current = performance.now();

    const _cinCam = () => {
      if (!tokenPos) return;
      const cvs = canvasRef.current; if (!cvs) return;
      const r2 = cvs.getBoundingClientRect();
      const W2 = r2.width || SW, H2 = r2.height || SH;
      const m2 = mediaRef.current;
      let mw2 = 1920, mh2 = 1080;
      if (m2?.tagName === 'IMG' && (m2 as HTMLImageElement).naturalWidth) { mw2 = (m2 as HTMLImageElement).naturalWidth; mh2 = (m2 as HTMLImageElement).naturalHeight; }
      if (m2?.tagName === 'VIDEO' && (m2 as HTMLVideoElement).videoWidth) { mw2 = (m2 as HTMLVideoElement).videoWidth; mh2 = (m2 as HTMLVideoElement).videoHeight; }
      const tZ = Math.min(4, Math.max(rZoom.current * 2.0, 1.8));
      const sc2 = Math.min(W2 / mw2, H2 / mh2) * tZ;
      const tp = tokenPos as { x: number; y: number };
      cinematicCamRef.current = {
        active: true, tgtZoom: tZ, tgtPan: { x: W2*0.5 - tp.x*sc2 - (W2-mw2*sc2)/2, y: H2*0.5 - tp.y*sc2 - (H2-mh2*sc2)/2 },
        curZoom: rZoom.current * dmLocalZoom.current,
        curPan: { x: rPanOffset.current.x + dmLocalPan.current.x, y: rPanOffset.current.y + dmLocalPan.current.y },
      };
    };

    const tl = new CinematicTimeline();
    tl
      .add(60, () => {
        dim.style.opacity = '0.52'; vig.style.opacity = '1'; tint.style.opacity = '1';
        lbTop.style.transform = 'translateY(0)'; lbBot.style.transform = 'translateY(0)';
        setTimeout(() => { accTop.style.opacity = '1'; accBot.style.opacity = '1'; }, 500);
        _cinCam();
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
        // Restore original pre-cinematic camera position
        rZoom.current = cinematicOrigZoomRef.current;
        rPanOffset.current = { ...cinematicOrigPanRef.current };
        cinematicCamRef.current.active = false;
      })
      .add(5100, () => {
        [cinCanvas, dim, vig, tint, lbTop, lbBot, prtWrap, txtWrap].forEach(el => { if (el.parentNode) el.parentNode.removeChild(el); });
        cpKill(); cinematicActiveRef.current = false; cinematicDataRef.current = null;
      })
      .play();

    cinematicTimelineRef.current = tl;
  }, []);

  const skipBossIntro = useCallback(() => {
    if (!cinematicActiveRef.current) return;
    cinematicTimelineRef.current?.skip();
    const cd = cinematicDataRef.current as Record<string, HTMLElement> | null;
    if (cd) {
      const { cinCanvas, dim, vig, tint, lbTop, lbBot, prtWrap, txtWrap } = cd;
      if (prtWrap) { prtWrap.style.animation = ''; prtWrap.style.transition = 'transform 0.28s cubic-bezier(.4,0,1,1),opacity 0.25s ease'; prtWrap.style.transform = 'translate(120%,-50%)'; prtWrap.style.opacity = '0'; }
      if (txtWrap) { txtWrap.style.animation = ''; txtWrap.style.transition = 'transform 0.25s cubic-bezier(.4,0,1,1),opacity 0.22s ease'; txtWrap.style.transform = 'translateX(-60px)'; txtWrap.style.opacity = '0'; }
      [dim, vig, tint].forEach(el => { if (el) { el.style.transition = 'opacity 0.22s ease'; el.style.opacity = '0'; } });
      [lbTop, lbBot].forEach((el, i) => {
        if (!el) return;
        el.style.transition = 'transform 0.28s ease';
        el.style.transform = i === 0 ? 'translateY(-100%)' : 'translateY(100%)';
      });
      setTimeout(() => {
        [cinCanvas, dim, vig, tint, lbTop, lbBot, prtWrap, txtWrap].forEach(el => { if (el?.parentNode) el.parentNode.removeChild(el); });
        cpKill(); cinematicDataRef.current = null;
      }, 320);
    }
    rZoom.current = cinematicOrigZoomRef.current;
    rPanOffset.current = { ...cinematicOrigPanRef.current };
    cinematicCamRef.current.active = false;
    cinematicActiveRef.current = false;
  }, []);

  triggerBossIntroRef.current = triggerBossIntro;
  skipBossIntroRef.current = skipBossIntro;

  return { triggerBossIntro, skipBossIntro };
}
