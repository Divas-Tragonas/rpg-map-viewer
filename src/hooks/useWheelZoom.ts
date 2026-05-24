'use client';
import { useEffect } from 'react';
import type { DMRefs } from './useDMRefs';

export function useWheelZoom(R: DMRefs, setZoom: (v: number) => void, setDmPrivateActive: (v: boolean) => void, _broadcastState: (extra?: Record<string, unknown>) => void) {
  useEffect(() => {
    const canvas = R.canvasRef.current; if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
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
        setDmPrivateActive(true); _broadcastState({}); return;
      }

      const newZoom = Math.min(5, Math.max(0.2, R.rZoom.current * factor));
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
      R.rZoom.current = newZoom; setZoom(newZoom); _broadcastState({});
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [setZoom, setDmPrivateActive, _broadcastState]);
}
