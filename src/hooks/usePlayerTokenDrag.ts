'use client';
import { useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { DEFAULT_SPEED_FT } from '@/constants';
import type { PosMap, Player, TokenSizeMap } from '@/types';
import type { SyncSocket } from '@/lib/ws';

/**
 * Regió de caselles on el jugador pot moure el token durant el drag.
 * Cost de moviment estil D&D amb diagonal = 10 ft (2 × ortogonal): el cost per
 * arribar a una casella (dc, dr) és `5·(|dc| + |dr|)` peus → distància de Manhattan.
 * Per tant la regió abastable és un rombe (|dc| + |dr| ≤ maxCells), no un quadrat.
 */
export interface MoveRange {
  startCol: number;
  startRow: number;
  maxCells: number;
  gs: number;
  gox: number;
  goy: number;
}

interface DragState {
  id: string;
  ox: number;
  oy: number;
  R: number;
  /** null → sense límit de moviment (grid invàlid) */
  range: MoveRange | null;
}

function getMediaDimensions(media: HTMLElement | null): { mw: number; mh: number } {
  if (!media) return { mw: 1920, mh: 1080 };
  if (media.tagName === 'IMG') {
    const img = media as HTMLImageElement;
    if (img.naturalWidth) return { mw: img.naturalWidth, mh: img.naturalHeight };
  }
  if (media.tagName === 'VIDEO') {
    const vid = media as HTMLVideoElement;
    if (vid.videoWidth) return { mw: vid.videoWidth, mh: vid.videoHeight };
  }
  return { mw: 1920, mh: 1080 };
}

function toMapCoords(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  media: HTMLElement | null,
  zoom: number,
  pan: { x: number; y: number },
): { mx: number; my: number } {
  const r = canvas.getBoundingClientRect();
  const { mw, mh } = getMediaDimensions(media);
  const sc = Math.min(r.width / mw, r.height / mh) * zoom;
  return {
    mx: (clientX - r.left - (r.width - mw * sc) / 2 - pan.x) / sc,
    my: (clientY - r.top - (r.height - mh * sc) / 2 - pan.y) / sc,
  };
}

// La pantalla de jugador només pot moure tokens de JUGADOR (pl_*):
// els enemics (PSD i biblioteca) queden fora del hit-test expressament.
function hitTest(
  mx: number,
  my: number,
  slop: number,
  rPos: RefObject<PosMap>,
  rPlayers: RefObject<Player[]>,
  rTokenSizeOverride: RefObject<TokenSizeMap>,
): { id: string; ox: number; oy: number; R: number; speed: number; startX: number; startY: number } | null {
  const players = rPlayers.current;
  for (let i = players.length - 1; i >= 0; i--) {
    const pl = players[i];
    if (pl.canMove === false) continue; // moviment desactivat pel DM
    const pos = rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
    const R = rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
    if (Math.hypot(mx - (pos.x + R), my - (pos.y + R)) <= R + slop)
      return {
        id: `pl_${pl.id}`, ox: mx - pos.x, oy: my - pos.y, R,
        speed: pl.speed ?? DEFAULT_SPEED_FT, startX: pos.x, startY: pos.y,
      };
  }
  return null;
}

export function usePlayerTokenDrag(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  mediaRef: RefObject<HTMLElement | null>,
  rPos: RefObject<PosMap>,
  rZoom: RefObject<number>,
  rPanOffset: RefObject<{ x: number; y: number }>,
  rPlayers: RefObject<Player[]>,
  rTokenSizeOverride: RefObject<TokenSizeMap>,
  rGridSnap: RefObject<boolean>,
  rGridSize: RefObject<number>,
  rGridOriginX: RefObject<number>,
  rGridOriginY: RefObject<number>,
  rSelectedToken: RefObject<number | string | null>,
  wsRef: RefObject<SyncSocket | null>,
  bcRef: RefObject<BroadcastChannel | null>,
) {
  const dragRef = useRef<DragState | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  function snapPos(np: { x: number; y: number }, id: string): { x: number; y: number } {
    if (!rGridSnap.current || rGridSize.current <= 0) return np;
    const gs = rGridSize.current;
    const gox = ((rGridOriginX.current % gs) + gs) % gs;
    const goy = ((rGridOriginY.current % gs) + gs) % gs;
    const snapCC = (v: number, origin: number) =>
      Math.round((v - origin - gs / 2) / gs) * gs + origin + gs / 2;
    const Rv = rTokenSizeOverride.current[id] ?? 22;
    return { x: snapCC(np.x + Rv, gox) - Rv, y: snapCC(np.y + Rv, goy) - Rv };
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== null) return; // ja hi ha un drag actiu (multi-touch)
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { mx, my } = toMapCoords(e.clientX, e.clientY, canvas, mediaRef.current, rZoom.current, rPanOffset.current);
    // Amb el dit el hit ha de ser més generós que amb el ratolí
    const slop = e.pointerType === 'touch' ? 16 : 4;
    const hit = hitTest(mx, my, slop, rPos, rPlayers, rTokenSizeOverride);
    if (!hit) return;
    // Rang de moviment en caselles a partir de la velocitat en peus del token (1 casella = 5 ft).
    // El límit només s'aplica a la pantalla de jugador: el DM mou sense restriccions.
    let range: MoveRange | null = null;
    const gs = rGridSize.current;
    if (gs > 0) {
      const gox = ((rGridOriginX.current % gs) + gs) % gs;
      const goy = ((rGridOriginY.current % gs) + gs) % gs;
      range = {
        startCol: Math.floor((hit.startX + hit.R - gox) / gs),
        startRow: Math.floor((hit.startY + hit.R - goy) / gs),
        maxCells: Math.max(0, Math.floor(hit.speed / 5)),
        gs, gox, goy,
      };
    }
    dragRef.current = { id: hit.id, ox: hit.ox, oy: hit.oy, R: hit.R, range };
    pointerIdRef.current = e.pointerId;
    rSelectedToken.current = hit.id;
    // Captura: el drag continua encara que el dit surti del canvas
    try { canvas.setPointerCapture(e.pointerId); } catch { /* no crític */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || e.pointerId !== pointerIdRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { mx, my } = toMapCoords(e.clientX, e.clientY, canvas, mediaRef.current, rZoom.current, rPanOffset.current);
    const { id, ox, oy, R, range } = dragRef.current;
    let cx = mx - ox + R, cy = my - oy + R;
    if (range) {
      // Clamp del centre dins del rombe de caselles abastables (Manhattan, diagonal = 10 ft).
      const { startCol, startRow, maxCells, gs, gox, goy } = range;
      const col = Math.floor((cx - gox) / gs);
      const row = Math.floor((cy - goy) / gs);
      const dc = col - startCol, dr = row - startRow;
      const dist = Math.abs(dc) + Math.abs(dr);
      if (dist > maxCells) {
        // Projectem (dc, dr) sobre la vora del rombe conservant la direcció del punter.
        const sc = Math.sign(dc), sr = Math.sign(dr);
        const tdc = (Math.abs(dc) * maxCells) / dist;
        const tdr = (Math.abs(dr) * maxCells) / dist;
        let ndc = Math.floor(tdc), ndr = Math.floor(tdr);
        if (ndc + ndr < maxCells) {
          if (tdc - ndc >= tdr - ndr) ndc++; else ndr++;
        }
        const tcol = startCol + sc * ndc, trow = startRow + sr * ndr;
        // 1px de marge perquè el snap posterior caigui a la casella del perímetre.
        cx = Math.min(Math.max(cx, gox + tcol * gs + 1), gox + (tcol + 1) * gs - 1);
        cy = Math.min(Math.max(cy, goy + trow * gs + 1), goy + (trow + 1) * gs - 1);
      }
    }
    const np = snapPos({ x: cx - R, y: cy - R }, id);
    rPos.current = { ...rPos.current, [id]: np };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || e.pointerId !== pointerIdRef.current) return;
    const { id } = dragRef.current;
    const pos = rPos.current[id];
    if (pos) {
      // També per BroadcastChannel: en el setup de dues finestres al mateix ordinador
      // (sense servidor WS) el moviment ha d'arribar igualment al DM.
      const moveMsg = { type: 'TOKEN_MOVE', id, x: pos.x, y: pos.y };
      bcRef.current?.postMessage(moveMsg);
      wsRef.current?.send(JSON.stringify(moveMsg));
    }
    dragRef.current = null;
    pointerIdRef.current = null;
    rSelectedToken.current = null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { onPointerDown, onPointerMove, onPointerUp, dragRef };
}
