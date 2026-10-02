'use client';
import { useEffect } from 'react';
import type { DrawTool } from '@/types';
import type { DMRefs } from './useDMRefs';
import { toggleLightDebug } from '@/lib/render/darkrooms';

/**
 * true si l'esdeveniment ve d'un camp on l'usuari està escrivint. TOTS els escoltadors
 * de teclat d'aquest hook hi han de passar: sense això, escriure una majúscula a l'editor
 * del revelador de text o reanomenar un jugador commutava la vista privada del DM a cada
 * pulsació de Maj (i un Ctrl+A/Ctrl+V dins d'un camp, la vista compartida).
 */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement
    || (t instanceof HTMLElement && t.isContentEditable);
}

interface KBOpts {
  setDrawTool: (fn: (t: DrawTool) => DrawTool) => void;
  undoStroke: () => void;
  undoTokenMove: () => void;
  /** Desfà l'últim canvi al mapa (parets, sales, portes, llums). */
  undoMapEdit: () => string | null;
  skipBossIntro: () => void;
  /** Modes compartits amb els botons de la barra d'eines (definits a DMView). */
  toggleCtrlPan: () => void;
  toggleShiftPan: () => void;
  toggleAreaSelect: () => void;
  onDeleteSelection?: () => void;
  removeLastWall?: () => void;
  cancelWallChain?: () => void;
  /** Passa el torn al següent (Enter, amb combat actiu). El mateix que el botó «Següent». */
  advanceTurn?: () => void;
  /** Obre/tanca la finestra de dreceres (tecla ?). */
  toggleShortcuts?: () => void;
  /** Espai premut/deixat anar (el DM hi posa el cursor de mà). */
  setSpaceHeld?: (held: boolean) => void;
}

/** Temps màxim entre prémer i deixar anar Ctrl/Maj perquè compti com a toc (i no com a combinació). */
const TAP_MS = 450;

export function useKeyboardHandlers(R: DMRefs, opts: KBOpts) {
  const { setDrawTool, undoStroke, undoTokenMove, undoMapEdit, skipBossIntro, toggleCtrlPan, toggleShiftPan, toggleAreaSelect, onDeleteSelection, removeLastWall, cancelWallChain, advanceTurn, toggleShortcuts, setSpaceHeld } = opts;

  // CTRL i MAJ commuten els modes de vista (CTRL: vista compartida; MAJ: vista privada del DM)
  // només amb un TOC NET: prémer i deixar anar la tecla sola, sense cap altra tecla ni clic
  // pel mig i en menys de TAP_MS. Abans commutaven en PRÉMER-la, o sigui que tot Ctrl+Z
  // encenia el mode CTRL (i el segon l'apagava tornant la càmera de tothom enrere), i el
  // «Maj+clic» de les portes o de les màgies encenia la vista privada.
  // `rShiftHeld` segueix sent la tecla física premuda (la fan servir les màgies i les portes).
  useEffect(() => {
    let pending: { key: 'Control' | 'Shift'; t: number } | null = null;
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !isTyping(e)) R.rShiftHeld.current = true;
      if (e.repeat) return;
      if ((e.key === 'Control' || e.key === 'Shift') && !pending && !isTyping(e)) {
        pending = { key: e.key, t: performance.now() };
        return;
      }
      pending = null;  // qualsevol altra tecla (o un segon modificador) la converteix en combinació
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') R.rShiftHeld.current = false;
      const p = pending;
      if (!p || e.key !== p.key) return;
      pending = null;
      if (performance.now() - p.t > TAP_MS) return;
      if (p.key === 'Control') toggleCtrlPan(); else toggleShiftPan();
    };
    const cancel = () => { pending = null; };
    const onBlur = () => { pending = null; R.rShiftHeld.current = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousedown', cancel, true);
    window.addEventListener('wheel', cancel, { capture: true, passive: true });
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('mousedown', cancel, true);
      window.removeEventListener('wheel', cancel, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [toggleCtrlPan, toggleShiftPan]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESPAI mantingut: la mà per arrossegar el mapa amb qualsevol eina (com a Photoshop, que
  // és el model de la barra d'eines). Sense això, sense botó central de ratolí (trackpad) no
  // hi havia manera de moure el mapa.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e)) return;
      e.preventDefault();  // ni scroll de pàgina ni «clic» del botó que tingui el focus
      if (e.repeat || R.rSpaceHeld.current) return;
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
      R.rSpaceHeld.current = true; setSpaceHeld?.(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !R.rSpaceHeld.current) return;
      R.rSpaceHeld.current = false; setSpaceHeld?.(false);
    };
    const onBlur = () => { if (R.rSpaceHeld.current) { R.rSpaceHeld.current = false; setSpaceHeld?.(false); } };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [setSpaceHeld]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tool shortcuts (1-6, V) + Ctrl+Z + Escape + Enter (torn) + ? (dreceres)
  useEffect(() => {
    // En deixar l'eina Senyal, el punter i la regla desapareixen també de la pantalla del jugador.
    const clearPointer = () => {
      R.bcRef.current?.postMessage({ type: 'POINTER', pos: null }); R.wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: null }));
      R.bcRef.current?.postMessage({ type: 'MEASURE', a: null, b: null }); R.wsRef.current?.send(JSON.stringify({ type: 'MEASURE', a: null, b: null }));
    };
    const toSelection = () => setDrawTool(t => { if (t === 'pointer') clearPointer(); return 'none'; });
    const handler = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      // Ctrl+Z segons l'eina, perquè cada context desfaci el seu:
      //  · Parets i Llums  → l'últim canvi al mapa (paret, sala, porta, llum).
      //  · Dibuix          → l'últim traç.
      //  · Selecció        → l'últim moviment del torn actiu; si no n'hi ha cap (fora de
      //    combat, o ja desfets tots), cau al canvi de mapa: així el Ctrl+Z d'un canvi fet
      //    des del panell de sales funciona sense haver de canviar d'eina abans.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        const tool = R.rDrawTool.current;
        if (tool === 'wall' || tool === 'light') undoMapEdit();
        else if (tool === 'none') {
          if (R.rMoveHistory.current.length > 0) undoTokenMove();
          else undoMapEdit();
        } else undoStroke();
        return;
      }
      if (e.key === 'Escape' && R.cinematicActiveRef.current) { R.bcRef.current?.postMessage({ type: 'BOSS_INTRO_SKIP' }); R.wsRef.current?.send(JSON.stringify({ type: 'BOSS_INTRO_SKIP' })); skipBossIntro(); return; }
      // Màgia triada que espera el destí (roda o grimori d'un token): Esc la cancel·la.
      if (e.key === 'Escape' && R.rAreaPlacementPending.current) {
        R.rAreaPlacementPending.current = null; R.rSpellPreview.current = null;
        return;
      }
      if (e.key === 'Escape' && (R.rAreaSelectMode.current || R.rAreaSelectRect.current)) {
        if (R.rAreaSelectMode.current) toggleAreaSelect();
        R.rAreaSelectRect.current = null;
        return;
      }
      if (e.key === 'Escape' && R.rDrawTool.current === 'pointer' && (R.rMeasure.current.a || R.rMeasure.current.b)) {
        R.rMeasure.current = { a: null, b: null };
        R.bcRef.current?.postMessage({ type: 'MEASURE', a: null, b: null });
        R.wsRef.current?.send(JSON.stringify({ type: 'MEASURE', a: null, b: null }));
        return;
      }
      // Eina Parets: Esc en mode porta. Si ja s'ha fet el primer clic (inici marcat),
      // el desfà per tornar a triar-lo; si no, omet la col·locació de porta pendent.
      // (Després, Esc cancel·la la cadena de parets; Backspace/Delete desfà l'última paret.)
      if (e.key === 'Escape' && R.rDoorPlacement.current) {
        const dp = R.rDoorPlacement.current;
        if (dp.anchor) {
          R.rDoorPlacement.current = { roomId: dp.roomId };
          R.rDoorPreview.current = null;
        } else {
          R.rDoorPlacement.current = null;
          R.rDoorPreview.current = null;
        }
        return;
      }
      if (e.key === 'Escape' && R.rDrawTool.current === 'wall' && (R.rWallPenLast.current || R.rWallChain.current.length > 0 || R.rWallCursor.current)) {
        cancelWallChain?.();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && R.rDrawTool.current === 'wall') {
        e.preventDefault(); removeLastWall?.(); return;
      }
      if (e.key === 'Escape' && R.rMultiSelected.current.size > 0) { R.rMultiSelected.current = new Set(); return; }
      // Esc sense res més a cancel·lar: torna a l'eina de selecció (com la V).
      if (e.key === 'Escape' && R.rDrawTool.current !== 'none') { toSelection(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && R.rMultiSelected.current.size > 0) { e.preventDefault(); onDeleteSelection?.(); return; }
      if (e.ctrlKey || e.metaKey) return;
      // Enter passa el torn. Si el focus és en un botó, Enter ja el prem: no ho fem dos cops.
      if (e.key === 'Enter' && R.rTurn.current.active && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement)) {
        e.preventDefault(); advanceTurn?.(); return;
      }
      if (e.key === '?') { toggleShortcuts?.(); return; }
      // Sense mapa carregat les eines no fan res: les dreceres tampoc.
      if (!R.rStruct.current) return;
      if (e.key === 'v' || e.key === 'V') { toSelection(); return; }
      if (e.key === 'a' || e.key === 'A') { toggleAreaSelect(); return; }
      // Tecla L: mode debug de llum (parets efectives + polígon de visió + radi).
      if (e.key === 'l' || e.key === 'L') { toggleLightDebug(); return; }
      if (e.key === '1') setDrawTool(t => t === 'pen' ? 'none' : 'pen');
      else if (e.key === '2') setDrawTool(t => t === 'eraser' ? 'none' : 'eraser');
      else if (e.key === '3') setDrawTool(t => t === 'shape' ? 'none' : 'shape');
      else if (e.key === '4') setDrawTool(t => {
        const nt = t === 'pointer' ? 'none' : 'pointer';
        if (nt === 'none') clearPointer();
        return nt;
      });
      else if (e.key === '5') setDrawTool(t => t === 'wall' ? 'none' : 'wall');
      else if (e.key === '6') setDrawTool(t => t === 'light' ? 'none' : 'light');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStroke, undoTokenMove, undoMapEdit, skipBossIntro, onDeleteSelection, toggleAreaSelect, removeLastWall, cancelWallChain, advanceTurn, toggleShortcuts]); // eslint-disable-line react-hooks/exhaustive-deps
}
