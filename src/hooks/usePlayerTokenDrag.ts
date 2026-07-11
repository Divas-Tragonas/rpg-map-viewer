'use client';
import { useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { DEFAULT_SPEED_FT } from '@/constants';
import type { PosMap, Player, TokenSizeMap, TurnState } from '@/types';
import type { SyncSocket } from '@/lib/ws';

/**
 * Regió de caselles on el jugador pot moure el token durant el drag.
 * Distància euclidiana real (la diagonal costa ~7 ft = √2·5, com a la realitat):
 * una casella (dc, dr) és abastable si `dc² + dr² ≤ (maxCells + 0.5)²`.
 * Per tant la regió abastable és un **disc rasteritzat** (cercle pixelat), no un
 * quadrat ni un rombe — la forma coherent de moviment.
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
  rTurn: RefObject<TurnState>,
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
    // Durant un combat per torns, des de /player només es pot moure el token que té el
    // torn actiu, i el seu abast és el saldo de moviment restant (no la velocitat sencera).
    const turn = rTurn.current;
    let speedFt = hit.speed;
    if (turn?.active) {
      const activeId = turn.order[turn.turnIndex];
      if (String(hit.id) !== String(activeId)) return; // no és el seu torn
      speedFt = turn.activeRemainingFt;
    }
    // Rang de moviment en caselles a partir dels peus disponibles (1 casella = 5 ft).
    // El límit només s'aplica a la pantalla de jugador: el DM mou sense restriccions.
    let range: MoveRange | null = null;
    const gs = rGridSize.current;
    if (gs > 0) {
      const gox = ((rGridOriginX.current % gs) + gs) % gs;
      const goy = ((rGridOriginY.current % gs) + gs) % gs;
      range = {
        startCol: Math.floor((hit.startX + hit.R - gox) / gs),
        startRow: Math.floor((hit.startY + hit.R - goy) / gs),
        maxCells: Math.max(0, Math.floor(speedFt / 5)),
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
      // Clamp del centre dins del cercle de caselles abastables (distància euclidiana).
      const { startCol, startRow, maxCells, gs, gox, goy } = range;
      const r2 = (maxCells + 0.5) * (maxCells + 0.5);
      const col = Math.floor((cx - gox) / gs);
      const row = Math.floor((cy - goy) / gs);
      let dc = col - startCol, dr = row - startRow;
      if (dc * dc + dr * dr > r2) {
        // Caminem la casella cap endins fins entrar al disc, reduint primer l'eix dominant
        // (així la casella final sempre és una de les pintades i segueix la direcció del punter).
        while (dc * dc + dr * dr > r2) {
          if (Math.abs(dc) >= Math.abs(dr)) dc -= Math.sign(dc);
          else dr -= Math.sign(dr);
        }
        const tcol = startCol + dc, trow = startRow + dr;
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
