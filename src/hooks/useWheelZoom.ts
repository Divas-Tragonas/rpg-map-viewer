'use client';
import { useEffect } from 'react';
import type { DMRefs } from './useDMRefs';

export function useWheelZoom(R: DMRefs, setZoom: (v: number) => void, setDmPrivateActive: (v: boolean) => void, _broadcastState: (extra?: Record<string, unknown>) => void) {
  useEffect(() => {
    const canvas = R.canvasRef.current; if (!canvas) return;
    // Un gest de roda dispara desenes d'events seguits; broadcastegem a ~20Hz amb un
    // enviament final (trailing) garantit perquè el jugador acabi exactament on el DM.
    // El jugador ja suavitza zoom i pan amb LERP, així que 20Hz es veu igual de fluid.
    let lastBcast = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;
    const throttledBroadcast = () => {
      const now = Date.now();
      if (trailing) { clearTimeout(trailing); trailing = null; }
      if (now - lastBcast > 48) { lastBcast = now; _broadcastState({}); }
      else trailing = setTimeout(() => { trailing = null; lastBcast = Date.now(); _broadcastState({}); }, 60);
    };
    // Trackpad: dos dits = desplaçar el mapa, pinça = zoom. Roda del ratolí = zoom (com sempre).
    // El navegador no diu d'on ve una roda, així que ho decideix el PRIMER esdeveniment de
    // cada ràfega i es manté fins que s'atura (GESTURE_GAP ms sense esdeveniments):
    //  · ctrlKey            → pinça del trackpad (o Ctrl+roda): zoom
    //  · deltaMode ≠ píxels → roda per línies (Firefox): zoom
    //  · hi ha deltaX, o un deltaY petit → dos dits del trackpad: desplaçar
    //  · la resta (osques de 100/120 px) → roda del ratolí: zoom
    const GESTURE_GAP = 220;
    let gesture: 'zoom' | 'pan' | null = null;
    let lastWheel = 0;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheel > GESTURE_GAP) gesture = null;
      lastWheel = now;
      if (!gesture) {
        gesture = e.ctrlKey || e.deltaMode !== 0 ? 'zoom'
          : (e.deltaX !== 0 || Math.abs(e.deltaY) < 50) ? 'pan'
          : 'zoom';
      }
      if (gesture === 'pan' && !e.ctrlKey) {
        if (R.rShiftPanToggle.current) {
          R.dmLocalPan.current = { x: R.dmLocalPan.current.x - e.deltaX, y: R.dmLocalPan.current.y - e.deltaY };
          setDmPrivateActive(true);
        } else {
          R.rPanOffset.current = { x: R.rPanOffset.current.x - e.deltaX, y: R.rPanOffset.current.y - e.deltaY };
        }
        throttledBroadcast(); return;
      }
      // La pinça envia molts deltas petits: zoom continu. La roda, un graó fix per osca.
      const factor = e.ctrlKey && Math.abs(e.deltaY) < 50
        ? Math.exp(-e.deltaY * 0.01)
        : (e.deltaY < 0 ? 1.12 : 1 / 1.12);
      const m = R.mediaRef.current;
      const r = canvas.getBoundingClientRect();
      const W = r.width, H = r.height;
      let mw = 1920, mh = 1080;
      if (m?.tagName === 'IMG' && (m as HTMLImageElement).naturalWidth) { mw = (m as HTMLImageElement).naturalWidth; mh = (m as HTMLImageElement).naturalHeight; }
      if (m?.tagName === 'VIDEO' && (m as HTMLVideoElement).videoWidth) { mw = (m as HTMLVideoElement).videoWidth; mh = (m as HTMLVideoElement).videoHeight; }

      if (R.rShiftPanToggle.current) {
        const newPrivZoom = Math.min(5, Math.max(0.2, R.dmLocalZoom.current * factor));
        const scOld = Math.min(W / mw, H / mh) * R.rZoom.current * R.dmLocalZoom.current;
        const scNew = Math.min(W / mw, H / mh) * R.rZoom.current * newPrivZoom;
        const totalPanX = R.rPanOffset.current.x + R.dmLocalPan.current.x;
        const totalPanY = R.rPanOffset.current.y + R.dmLocalPan.current.y;
        const cxOld = (W - mw * scOld) / 2 + totalPanX, cyOld = (H - mh * scOld) / 2 + totalPanY;
        const mxc = (e.clientX - r.left - cxOld) / scOld, myc = (e.clientY - r.top - cyOld) / scOld;
        R.dmLocalPan.current = {
          x: (e.clientX - r.left - mxc * scNew) - (W - mw * scNew) / 2 - R.rPanOffset.current.x,
          y: (e.clientY - r.top - myc * scNew) - (H - mh * scNew) / 2 - R.rPanOffset.current.y,
        };
        R.dmLocalZoom.current = newPrivZoom;
        setDmPrivateActive(true); throttledBroadcast(); return;
      }

      const newZoom = Math.min(10, Math.max(0.2, R.rZoom.current * factor));
      if (newZoom === R.rZoom.current) return;
      const scOld = Math.min(W / mw, H / mh) * R.rZoom.current;
      const scNew = Math.min(W / mw, H / mh) * newZoom;
      const pan = R.rPanOffset.current;
      const cxOld = (W - mw * scOld) / 2 + pan.x, cyOld = (H - mh * scOld) / 2 + pan.y;
      const mx = (e.clientX - r.left - cxOld) / scOld, my = (e.clientY - r.top - cyOld) / scOld;
      R.rPanOffset.current = {
        x: (e.clientX - r.left - mx * scNew) - (W - mw * scNew) / 2,
        y: (e.clientY - r.top - my * scNew) - (H - mh * scNew) / 2,
      };
      R.rZoom.current = newZoom; setZoom(newZoom); throttledBroadcast();
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => { canvas.removeEventListener('wheel', handler); if (trailing) clearTimeout(trailing); };
  }, [setZoom, setDmPrivateActive, _broadcastState]);
}
