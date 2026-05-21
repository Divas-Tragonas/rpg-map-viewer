'use client';
import { useEffect } from 'react';
import type { DrawTool } from '@/types';
import type { DMRefs } from './useDMRefs';

interface KBOpts {
  setDrawTool: (fn: (t: DrawTool) => DrawTool) => void;
  setCtrlHeld: (v: boolean) => void;
  setRoomsLocked: (v: boolean) => void;
  undoStroke: () => void;
  skipBossIntro: () => void;
}

export function useKeyboardHandlers(R: DMRefs, opts: KBOpts) {
  const { setDrawTool, setCtrlHeld, setRoomsLocked, undoStroke, skipBossIntro } = opts;

  // Ctrl key: unlock rooms + DM private view
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Control') return;
      setCtrlHeld(true); R.ctrlHeldRef.current = true;
      const s = R.rStruct.current;
      if (s && s.roomLayers.some(l => !R.rVis.current[l.id])) {
        setRoomsLocked(false); R.rRoomsLocked.current = false;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'Control') return;
      setCtrlHeld(false); R.ctrlHeldRef.current = false;
      setRoomsLocked(true); R.rRoomsLocked.current = true;
      if (R.dmLocalPan.current.x !== 0 || R.dmLocalPan.current.y !== 0 || R.dmLocalZoom.current !== 1) {
        R.dmPrivateReturnAnim.current = true;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // Shift key: DM private view only (no zone unlock)
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      R.rShiftHeld.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      R.rShiftHeld.current = false;
      if (R.dmLocalPan.current.x !== 0 || R.dmLocalPan.current.y !== 0 || R.dmLocalZoom.current !== 1) {
        R.dmPrivateReturnAnim.current = true;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // Tool shortcuts (1-4) + Ctrl+Z + Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undoStroke(); return; }
      if (e.key === 'Escape' && R.cinematicActiveRef.current) { R.bcRef.current?.postMessage({ type: 'BOSS_INTRO_SKIP' }); skipBossIntro(); return; }
      if (e.ctrlKey) return;
      if (e.key === '1') setDrawTool(t => t === 'pen' ? 'none' : 'pen');
      else if (e.key === '2') setDrawTool(t => t === 'eraser' ? 'none' : 'eraser');
      else if (e.key === '3') setDrawTool(t => t === 'shape' ? 'none' : 'shape');
      else if (e.key === '4') setDrawTool(t => {
        const nt = t === 'pointer' ? 'none' : 'pointer';
        if (nt === 'none') R.bcRef.current?.postMessage({ type: 'POINTER', pos: null });
        return nt;
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStroke, skipBossIntro]);
}
