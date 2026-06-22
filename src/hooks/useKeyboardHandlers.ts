'use client';
import { useEffect } from 'react';
import type { DrawTool } from '@/types';
import type { DMRefs } from './useDMRefs';

interface KBOpts {
  setDrawTool: (fn: (t: DrawTool) => DrawTool) => void;
  undoStroke: () => void;
  skipBossIntro: () => void;
  broadcastState: () => void;
  setCtrlPanActive: (v: boolean) => void;
  setShiftPanActive: (v: boolean) => void;
  setZoom: (v: number) => void;
  onDeleteSelection?: () => void;
}

export function useKeyboardHandlers(R: DMRefs, opts: KBOpts) {
  const { setDrawTool, undoStroke, skipBossIntro, broadcastState, setCtrlPanActive, setShiftPanActive, setZoom, onDeleteSelection } = opts;

  // CTRL key: toggle shared pan/zoom mode (DM + Player). Tap once to activate, tap again to deactivate + restore camera.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Control' || e.repeat) return;
      if (!R.rCtrlPanToggle.current) {
        R.rCtrlPanToggle.current = true;
        R.rCtrlPanSnapshot.current = { ...R.rPanOffset.current, zoom: R.rZoom.current };
        setCtrlPanActive(true);
      } else {
        R.rCtrlPanToggle.current = false;
        if (R.rCtrlPanSnapshot.current) {
          const { x, y, zoom } = R.rCtrlPanSnapshot.current;
          R.rPanOffset.current = { x, y };
          R.rZoom.current = zoom; setZoom(zoom);
          broadcastState();
        }
        R.rCtrlPanSnapshot.current = null;
        setCtrlPanActive(false);
      }
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [broadcastState, setZoom, setCtrlPanActive]);

  // SHIFT key: toggle DM-only private pan/zoom mode. Tap once to activate, tap again to deactivate + return camera.
  // In shape mode, SHIFT is used for spell line drawing (rShiftHeld physical hold) — no toggle.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Shift' || e.repeat) return;
      R.rShiftHeld.current = true;
      if (R.rDrawTool.current === 'shape') return;
      if (!R.rShiftPanToggle.current) {
        R.rShiftPanToggle.current = true;
        setShiftPanActive(true);
      } else {
        R.rShiftPanToggle.current = false;
        R.rShiftHeld.current = false;
        setShiftPanActive(false);
        if (R.dmLocalPan.current.x !== 0 || R.dmLocalPan.current.y !== 0 || R.dmLocalZoom.current !== 1) {
          R.dmPrivateReturnAnim.current = true;
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      R.rShiftHeld.current = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [setShiftPanActive]);

  // Tool shortcuts (1-4) + Ctrl+Z + Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undoStroke(); return; }
      if (e.key === 'Escape' && R.cinematicActiveRef.current) { R.bcRef.current?.postMessage({ type: 'BOSS_INTRO_SKIP' }); R.wsRef.current?.send(JSON.stringify({ type: 'BOSS_INTRO_SKIP' })); skipBossIntro(); return; }
      if (e.key === 'Escape' && R.rMultiSelected.current.size > 0) { R.rMultiSelected.current = new Set(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && R.rMultiSelected.current.size > 0) { e.preventDefault(); onDeleteSelection?.(); return; }
      if (e.ctrlKey) return;
      if (e.key === '1') setDrawTool(t => t === 'pen' ? 'none' : 'pen');
      else if (e.key === '2') setDrawTool(t => t === 'eraser' ? 'none' : 'eraser');
      else if (e.key === '3') setDrawTool(t => t === 'shape' ? 'none' : 'shape');
      else if (e.key === '4') setDrawTool(t => {
        const nt = t === 'pointer' ? 'none' : 'pointer';
        if (nt === 'none') { R.bcRef.current?.postMessage({ type: 'POINTER', pos: null }); R.wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: null })); }
        return nt;
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStroke, skipBossIntro, onDeleteSelection]);
}
