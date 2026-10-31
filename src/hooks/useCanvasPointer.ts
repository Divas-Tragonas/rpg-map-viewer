'use client';
/**
 * Ratolí i dit al canvas del DM amb pointer events (un sol camí per als dos).
 *
 * Els gestors de sempre (`useMouseHandlers`) reben els `PointerEvent` com si fossin del ratolí
 * (un `PointerEvent` és un `MouseEvent`): amb el ratolí no canvia res. Amb el dit (mòbil,
 * tauleta) s'hi afegeix el que el ratolí fa amb botons que el dit no té:
 *   - **un dit**: el mateix que el botó esquerre (arrossegar un token, moure el mapa en buit, dibuixar…);
 *   - **dos dits**: pinça = zoom i arrossegar = moure el mapa (la vista compartida o, en Privada, la teva);
 *   - **mantenir premut** (0,5 s quiet): el clic dret (menú del token, de la sala…);
 *   - **doble toc**: el doble clic (seleccionar el grup, entrar a una porta d'un lloc de la missió).
 * El canvas porta `touch-action: none` perquè el navegador no s'emporti el gest.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { DMRefs } from './useDMRefs';
import { mediaSize } from '@/lib/camera';

type Ev = React.PointerEvent<HTMLCanvasElement>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (e: any) => void;

const LONG_MS = 500;
const SLOP = 10;
const DOUBLE_MS = 320;

export function useCanvasPointer(R: DMRefs, h: {
  down: Handler; move: Handler; up: () => void; leave: () => void; context: Handler; dbl: Handler;
  setZoom: (z: number) => void; setDmPrivateActive: (v: boolean) => void; broadcast: () => void;
}) {
  const refs = useRef(R);
  useEffect(() => { refs.current = R; });
  const hRef = useRef(h);
  useEffect(() => { hRef.current = h; });

  const touches = useRef(new Map<number, { x: number; y: number; x0: number; y0: number }>());
  // Dit que ja no ha de fer res fins que s'aixequi (després d'una pinça o d'un menú).
  const muted = useRef(new Set<number>());
  const long = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const pinch = useRef<{ d0: number; mx0: number; my0: number; zoom0: number; pan0: { x: number; y: number }; priv: boolean } | null>(null);
  const lastSend = useRef(0);

  const clearLong = () => { if (long.current) { clearTimeout(long.current); long.current = null; } };

  /** Para el gest d'un dit sense que compti com un clic (no revela sales ni deselecciona). */
  const abortSingle = () => {
    const pd = refs.current.panDragRef.current;
    if (pd) pd.onClick = undefined;
    hRef.current.up();
  };

  const synth = (canvas: HTMLCanvasElement, x: number, y: number, button: number) => ({
    clientX: x, clientY: y, button, buttons: 0, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
    currentTarget: canvas, target: canvas, preventDefault() {}, stopPropagation() {},
  });

  const sendThrottled = (final = false) => {
    const now = Date.now();
    if (final || now - lastSend.current > 48) { lastSend.current = now; hRef.current.broadcast(); }
  };

  const applyPinch = (canvas: HTMLCanvasElement) => {
    const p = pinch.current; if (!p) return;
    const [a, b] = [...touches.current.values()];
    if (!a || !b) return;
    const Rf = refs.current;
    const r = canvas.getBoundingClientRect();
    const W = r.width, H = r.height;
    const { mw, mh } = mediaSize(Rf.mediaRef.current);
    const base = Math.min(W / mw, H / mh);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    const k = d / Math.max(p.d0, 1);
    if (p.priv) {
      // Vista privada: zoom i pan locals, damunt de la vista compartida.
      const z = Math.min(5, Math.max(0.2, p.zoom0 * k));
      const sc0 = base * Rf.rZoom.current * p.zoom0, sc1 = base * Rf.rZoom.current * z;
      const tx0 = Rf.rPanOffset.current.x + p.pan0.x, ty0 = Rf.rPanOffset.current.y + p.pan0.y;
      const ux = (p.mx0 - ((W - mw * sc0) / 2 + tx0)) / sc0, uy = (p.my0 - ((H - mh * sc0) / 2 + ty0)) / sc0;
      Rf.dmLocalZoom.current = z;
      Rf.dmLocalPan.current = {
        x: mx - ux * sc1 - (W - mw * sc1) / 2 - Rf.rPanOffset.current.x,
        y: my - uy * sc1 - (H - mh * sc1) / 2 - Rf.rPanOffset.current.y,
      };
      hRef.current.setDmPrivateActive(true);
    } else {
      const z = Math.min(10, Math.max(0.2, p.zoom0 * k));
      const sc0 = base * p.zoom0, sc1 = base * z;
      const ux = (p.mx0 - ((W - mw * sc0) / 2 + p.pan0.x)) / sc0, uy = (p.my0 - ((H - mh * sc0) / 2 + p.pan0.y)) / sc0;
      Rf.rZoom.current = z;
      Rf.rPanOffset.current = { x: mx - ux * sc1 - (W - mw * sc1) / 2, y: my - uy * sc1 - (H - mh * sc1) / 2 };
      hRef.current.setZoom(z);
    }
    sendThrottled();
  };

  const onPointerDown = useCallback((e: Ev) => {
    if (e.pointerType !== 'touch') { hRef.current.down(e); return; }
    const canvas = e.currentTarget;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* el navegador no ho permet: igual funciona */ }
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (touches.current.size === 2) {
      // Segon dit: el gest d'un dit s'atura i comença la pinça.
      clearLong();
      abortSingle();
      for (const id of touches.current.keys()) muted.current.add(id);
      const [a, b] = [...touches.current.values()];
      const r = canvas.getBoundingClientRect();
      const Rf = refs.current;
      const priv = Rf.rShiftPanToggle.current;
      pinch.current = {
        d0: Math.hypot(a.x - b.x, a.y - b.y), mx0: (a.x + b.x) / 2 - r.left, my0: (a.y + b.y) / 2 - r.top,
        zoom0: priv ? Rf.dmLocalZoom.current : Rf.rZoom.current,
        pan0: priv ? { ...Rf.dmLocalPan.current } : { ...Rf.rPanOffset.current }, priv,
      };
      return;
    }
    if (touches.current.size > 2) { muted.current.add(e.pointerId); return; }
    // Mantenir premut = clic dret.
    clearLong();
    const x = e.clientX, y = e.clientY, id = e.pointerId;
    long.current = setTimeout(() => {
      long.current = null;
      const t = touches.current.get(id);
      if (!t || Math.hypot(t.x - t.x0, t.y - t.y0) > SLOP) return;
      abortSingle();
      muted.current.add(id);
      navigator.vibrate?.(12);
      hRef.current.context(synth(canvas, x, y, 2));
    }, LONG_MS);
    hRef.current.down(e);
  }, []);

  const onPointerMove = useCallback((e: Ev) => {
    if (e.pointerType !== 'touch') { hRef.current.move(e); return; }
    const t = touches.current.get(e.pointerId);
    if (t) { t.x = e.clientX; t.y = e.clientY; if (Math.hypot(t.x - t.x0, t.y - t.y0) > SLOP) clearLong(); }
    if (pinch.current) { applyPinch(e.currentTarget); return; }
    if (muted.current.has(e.pointerId)) return;
    hRef.current.move(e);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const endTouch = (e: Ev, cancelled: boolean) => {
    const t = touches.current.get(e.pointerId);
    touches.current.delete(e.pointerId);
    clearLong();
    if (pinch.current) {
      if (touches.current.size < 2) { pinch.current = null; sendThrottled(true); }
      muted.current.delete(e.pointerId);
      return;
    }
    if (muted.current.has(e.pointerId)) { muted.current.delete(e.pointerId); return; }
    if (cancelled) { abortSingle(); return; }
    hRef.current.up();
    // Doble toc = doble clic (dos tocs curts i quiets al mateix lloc).
    if (t && Math.hypot(t.x - t.x0, t.y - t.y0) <= SLOP) {
      const now = performance.now(), lt = lastTap.current;
      if (lt && now - lt.t < DOUBLE_MS && Math.hypot(lt.x - t.x, lt.y - t.y) < 30) {
        lastTap.current = null;
        hRef.current.dbl(synth(e.currentTarget, t.x, t.y, 0));
      } else lastTap.current = { t: now, x: t.x, y: t.y };
    } else lastTap.current = null;
  };

  const onPointerUp = useCallback((e: Ev) => {
    if (e.pointerType !== 'touch') { hRef.current.up(); return; }
    endTouch(e, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerCancel = useCallback((e: Ev) => {
    if (e.pointerType !== 'touch') { hRef.current.leave(); return; }
    endTouch(e, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Amb el dit, el canvas captura el punter: en sortir no cal fer res (ho fa el pointerup).
  const onPointerLeave = useCallback((e: Ev) => {
    if (e.pointerType !== 'touch') hRef.current.leave();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave };
}
