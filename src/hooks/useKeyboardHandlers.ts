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
  broadcastState: () => void;
  setCtrlPanActive: (v: boolean) => void;
  setShiftPanActive: (v: boolean) => void;
}

export function useKeyboardHandlers(R: DMRefs, opts: KBOpts) {
  const { setDrawTool, setCtrlHeld, setRoomsLocked, undoStroke, skipBossIntro, broadcastState, setCtrlPanActive, setShiftPanActive } = opts;

  // CTRL key: toggle shared pan mode (DM + Player). Tap once to activate, tap again to deactivate + restore camera.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Control' || e.repeat) return;
      if (!R.rCtrlPanToggle.current) {
        // Activate: save current shared pan position
        R.rCtrlPanToggle.current = true;
        R.rCtrlPanSnapshot.current = { ...R.rPanOffset.current };
        setCtrlPanActive(true);
        setCtrlHeld(true); R.ctrlHeldRef.current = true;
        // Unlock rooms if any are hidden
        const s = R.rStruct.current;
        if (s && s.roomLayers.some((l: { id: number }) => !R.rVis.current[l.id])) {
          setRoomsLocked(false); R.rRoomsLocked.current = false;
        }
      } else {
        // Deactivate: restore saved pan position and broadcast to player
        R.rCtrlPanToggle.current = false;
        if (R.rCtrlPanSnapshot.current) {
          R.rPanOffset.current = { ...R.rCtrlPanSnapshot.current };
          broadcastState();
        }
        R.rCtrlPanSnapshot.current = null;
        setCtrlPanActive(false);
        setCtrlHeld(false); R.ctrlHeldRef.current = false;
        setRoomsLocked(true); R.rRoomsLocked.current = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'Control') return;
      // Only update ctrlHeld if not in toggle mode (toggle manages its own state)
      if (!R.rCtrlPanToggle.current) {
        setCtrlHeld(false); R.ctrlHeldRef.current = false;
        setRoomsLocked(true); R.rRoomsLocked.current = true;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [broadcastState]);

  // SHIFT key: toggle DM-only private pan mode. Tap once to activate, tap again to deactivate + return camera.
  // In shape mode, SHIFT still works for spell line drawing (rShiftHeld physical hold).
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Shift' || e.repeat) return;
      R.rShiftHeld.current = true;
      // Toggle DM pan mode only when not in shape tool (shape uses SHIFT for spell lines)
      if (R.rDrawTool.current !== 'shape') {
        if (!R.rShiftPanToggle.current) {
          R.rShiftPanToggle.current = true;
          setShiftPanActive(true);
        } else {
          // Deactivate: trigger smooth return to origin
          R.rShiftPanToggle.current = false;
          R.rShiftHeld.current = false;
          setShiftPanActive(false);
          if (R.dmLocalPan.current.x !== 0 || R.dmLocalPan.current.y !== 0 || R.dmLocalZoom.current !== 1) {
            R.dmPrivateReturnAnim.current = true;
          }
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
