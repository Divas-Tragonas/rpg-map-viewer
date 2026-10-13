'use client';
import React, { useCallback, useEffect, useRef } from 'react';

interface Props {
  children: React.ReactNode;
  /** Estils del contenidor exterior (mida, flex…). */
  style?: React.CSSProperties;
  /** Estils del viewport que fa scroll (p. ex. `maxHeight`, `padding`). */
  viewportStyle?: React.CSSProperties;
}

/** Temps que la barra es queda visible després de l'últim scroll. */
const HIDE_MS = 900;
/** Alçada mínima del polze, perquè en una llista molt llarga encara es pugui agafar. */
const MIN_THUMB = 24;
/** Marge del polze respecte de dalt i de baix del carril. */
const PAD = 2;

/** Carril útil, alçada del polze i recorregut de scroll d'un viewport. */
function metrics(vp: HTMLDivElement) {
  const track = vp.clientHeight - PAD * 2;
  const h = Math.max(MIN_THUMB, track * vp.clientHeight / vp.scrollHeight);
  return { vp, track, h, range: vp.scrollHeight - vp.clientHeight };
}

/**
 * Zona amb scroll i barra de desplaçament pròpia. La del navegador ocupava espai fix i
 * era una franja sempre visible que no lligava amb la resta del lateral. Aquesta va per
 * sobre del contingut (no li treu amplada), és invisible en repòs, surt molt suau en passar
 * el cursor per la zona, es veu mentre fas scroll i s'eixampla en apropar-t'hi. El polze es
 * pot arrossegar i un clic al carril hi salta.
 *
 * La posició del polze s'escriu directament al DOM (no és estat de React): fer scroll no
 * re-renderitza res. Els estils de hover/visibilitat són a `globals.css` (`.sa-*`).
 */
export function ScrollArea({ children, style, viewportStyle }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ pointerId: number; y: number; scrollTop: number } | null>(null);

  const update = useCallback(() => {
    const vp = vpRef.current, th = thumbRef.current, root = rootRef.current;
    if (!vp || !th || !root) return;
    const overflow = vp.scrollHeight > vp.clientHeight + 1;
    root.dataset.overflow = overflow ? 'true' : 'false';
    if (!overflow) return;
    const { track, h, range } = metrics(vp);
    th.style.height = `${h}px`;
    th.style.transform = `translateY(${PAD + (track - h) * (vp.scrollTop / range)}px)`;
  }, []);

  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    if (vpRef.current) ro.observe(vpRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => { ro.disconnect(); window.clearTimeout(hideTimer.current); };
  }, [update]);

  const onScroll = () => {
    update();
    const root = rootRef.current; if (!root) return;
    root.dataset.scrolling = '';
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { delete root.dataset.scrolling; }, HIDE_MS);
  };

  // Arrossegar el polze: el desplaçament del cursor es tradueix a scroll en proporció.
  const onThumbDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, y: e.clientY, scrollTop: vpRef.current!.scrollTop };
    rootRef.current!.dataset.dragging = '';
  };
  const onThumbMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.pointerId !== e.pointerId) return;
    const { vp, track, h, range } = metrics(vpRef.current!);
    vp.scrollTop = d.scrollTop + (e.clientY - d.y) * range / Math.max(1, track - h);
  };
  const onThumbUp = (e: React.PointerEvent) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    delete rootRef.current!.dataset.dragging;
  };

  // Clic al carril (fora del polze): hi salta, centrant el polze on s'ha clicat.
  const onRailDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    const { vp, track, h, range } = metrics(vpRef.current!);
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top - PAD - h / 2;
    vp.scrollTo({ top: (y / Math.max(1, track - h)) * range, behavior: 'smooth' });
  };

  // El carril és germà del viewport (no fill): la roda a sobre seu no faria scroll sola.
  const onRailWheel = (e: React.WheelEvent) => { vpRef.current?.scrollBy({ top: e.deltaY }); };

  return (
    <div ref={rootRef} className="sa-root" data-overflow="false"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, ...style }}>
      <div ref={vpRef} className="sa-viewport" onScroll={onScroll}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', ...viewportStyle }}>
        <div ref={contentRef}>{children}</div>
      </div>
      <div className="sa-rail" aria-hidden="true" onPointerDown={onRailDown} onWheel={onRailWheel}>
        <div ref={thumbRef} className="sa-thumb"
          onPointerDown={onThumbDown} onPointerMove={onThumbMove}
          onPointerUp={onThumbUp} onPointerCancel={onThumbUp} />
      </div>
    </div>
  );
}
