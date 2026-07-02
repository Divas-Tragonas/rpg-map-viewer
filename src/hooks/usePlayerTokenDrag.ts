'use client';
import { useRef, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import type { PosMap, Player, MapStructure, TokenSizeMap, LibEnemy } from '@/types';
import type { SyncSocket } from '@/lib/ws';

interface DragState {
  id: number | string;
  ox: number;
  oy: number;
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

function hitTest(
  mx: number,
  my: number,
  rPos: RefObject<PosMap>,
  rPlayers: RefObject<Player[]>,
  rLibEnemies: RefObject<LibEnemy[]>,
  rStruct: RefObject<MapStructure | null>,
  rTokenSizeOverride: RefObject<TokenSizeMap>,
): DragState | null {
  // Lib enemies (highest priority, last added = top)
  const libs = rLibEnemies.current;
  for (let i = libs.length - 1; i >= 0; i--) {
    const en = libs[i];
    const pos = rPos.current[`lib_${en.id}`] || { x: 0, y: 0 };
    const R = rTokenSizeOverride.current[`lib_${en.id}`] ?? en.R;
    if (Math.hypot(mx - pos.x, my - pos.y) <= R)
      return { id: `lib_${en.id}`, ox: mx - pos.x, oy: my - pos.y };
  }
  // Players
  const players = rPlayers.current;
  for (let i = players.length - 1; i >= 0; i--) {
    const pl = players[i];
    const pos = rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
    const R = rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
    if (Math.hypot(mx - (pos.x + R), my - (pos.y + R)) <= R + 4)
      return { id: `pl_${pl.id}`, ox: mx - pos.x, oy: my - pos.y };
  }
  // PSD enemies
  const s = rStruct.current;
  if (s) {
    for (const room of s.enemyRooms) {
      for (let i = room.enemies.length - 1; i >= 0; i--) {
        const en = room.enemies[i];
        const pos = rPos.current[en.id];
        if (!pos) continue;
        const R = rTokenSizeOverride.current[en.id] ?? Math.max(Math.min(en.w, en.h) / 2, 22);
        if (Math.hypot(mx - pos.x, my - pos.y) <= R)
          return { id: en.id, ox: mx - pos.x, oy: my - pos.y };
      }
    }
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
  rLibEnemies: RefObject<LibEnemy[]>,
  rStruct: RefObject<MapStructure | null>,
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

  function snapPos(np: { x: number; y: number }, id: number | string): { x: number; y: number } {
    if (!rGridSnap.current || rGridSize.current <= 0) return np;
    const gs = rGridSize.current;
    const gox = ((rGridOriginX.current % gs) + gs) % gs;
    const goy = ((rGridOriginY.current % gs) + gs) % gs;
    const snapCC = (v: number, origin: number) =>
      Math.round((v - origin - gs / 2) / gs) * gs + origin + gs / 2;
    if (String(id).startsWith('pl_')) {
      const Rv = rTokenSizeOverride.current[id] ?? 22;
      return { x: snapCC(np.x + Rv, gox) - Rv, y: snapCC(np.y + Rv, goy) - Rv };
    }
    return { x: snapCC(np.x, gox), y: snapCC(np.y, goy) };
  }

  function onDown(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { mx, my } = toMapCoords(clientX, clientY, canvas, mediaRef.current, rZoom.current, rPanOffset.current);
    const hit = hitTest(mx, my, rPos, rPlayers, rLibEnemies, rStruct, rTokenSizeOverride);
    dragRef.current = hit;
    rSelectedToken.current = hit ? hit.id : null;
  }

  function onMove(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { mx, my } = toMapCoords(clientX, clientY, canvas, mediaRef.current, rZoom.current, rPanOffset.current);
    const { id, ox, oy } = dragRef.current;
    const np = snapPos({ x: mx - ox, y: my - oy }, id);
    rPos.current = { ...rPos.current, [id]: np };
  }

  function onUp() {
    if (!dragRef.current) return;
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
    rSelectedToken.current = null;
  }

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    onDown(e.clientX, e.clientY);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch handlers (iPad)
  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) onDown(t.clientX, t.clientY);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onTouchEnd = useCallback(() => {
    onUp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Global mouse move/up (so drag works outside the canvas too)
  useEffect(() => {
    const handleMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const handleUp = () => onUp();
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { onMouseDown, onTouchStart, onTouchMove, onTouchEnd, dragRef };
}
