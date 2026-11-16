'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BC_CHANNEL } from '@/constants';
import type { BoardView, CamRect, Player, PosMap, TokenSizeMap } from '@/types';

/**
 * Connexió del tracker de figuretes (`/tracker`) amb el DM pel `BroadcastChannel`.
 *
 * El tracker es comporta com una pantalla de jugador sense pantalla: demana l'estat
 * (`PLAYER_READY`), n'escolta els camps que li calen (jugadors, posicions, graella,
 * enquadrament `cam`), veu les pantalles de jugador que hi ha (`VIEWPORT`) per saber la
 * mida de la del tauler, i mou tokens de jugador amb `TOKEN_MOVE`, com el drag de
 * `/player`. El DM valida el moviment (torn, parets, peus) i contesta amb `TOKEN_RELAY`:
 * a la posició nova si l'accepta, a la vella si el rebutja.
 *
 * Només BroadcastChannel: el tracker ha d'anar al mateix PC que el DM (la càmera només
 * s'obre per `localhost` o `https`). No envia `VIEWPORT`: el DM no el compta com a pantalla.
 */

export interface ScreenInfo { id: string; w: number; h: number; seen: number; tauler: boolean }

export interface TrackerWorld {
  players: Player[];
  pos: PosMap;
  cam: CamRect | null;
  /** Mode tauler (`lib/board.ts`): si està encès, la pantalla del tauler no mostra `cam`. */
  board: BoardView | null;
  gridSize: number;
  gridOriginX: number;
  gridOriginY: number;
  gridSnap: boolean;
  tokenSize: TokenSizeMap;
}

export type MoveResult = 'ok' | 'rebutjat' | 'sense resposta';

const noSubscribe = () => () => {};

const EMPTY: TrackerWorld = { players: [], pos: {}, cam: null, board: null, gridSize: 0, gridOriginX: 0, gridOriginY: 0, gridSnap: false, tokenSize: {} };

export function useTrackerSync(onResult: (id: string, result: MoveResult) => void) {
  const world = useRef<TrackerWorld>({ ...EMPTY });
  const bcRef = useRef<BroadcastChannel | null>(null);
  const screensRef = useRef<Record<string, ScreenInfo>>({});
  const pending = useRef<Record<string, { x: number; y: number; t: number }>>({});
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  // Sense BroadcastChannel (Safari antic) el tracker no pot parlar amb el DM.
  const available = useSyncExternalStore(noSubscribe, () => typeof BroadcastChannel !== 'undefined', () => true);

  useEffect(() => {
    let bc: BroadcastChannel;
    try { bc = new BroadcastChannel(BC_CHANNEL); } catch { return; }
    bcRef.current = bc;
    let gotStruct = false;

    const publishScreens = () => {
      const now = Date.now();
      for (const [id, s] of Object.entries(screensRef.current)) if (now - s.seen > 50_000) delete screensRef.current[id];
      setScreens(Object.values(screensRef.current).sort((a, b) => b.w * b.h - a.w * a.h));
    };

    bc.onmessage = (e: MessageEvent) => {
      const m = e.data as Record<string, unknown> | null;
      if (!m || typeof m.type !== 'string') return;
      const w = world.current;
      if (m.type === 'STRUCT' || m.type === 'STATE') {
        if (m.type === 'STRUCT') { gotStruct = true; setConnected(true); }
        if (m.pos) w.pos = { ...(m.pos as PosMap) };
        if (m.cam) w.cam = m.cam as CamRect;
        if (m.board !== undefined) w.board = (m.board as BoardView | null) ?? null;
        if (Array.isArray(m.players)) { w.players = m.players as Player[]; setPlayers(w.players); }
        if (typeof m.gridSize === 'number') w.gridSize = m.gridSize;
        if (typeof m.gridOriginX === 'number') w.gridOriginX = m.gridOriginX;
        if (typeof m.gridOriginY === 'number') w.gridOriginY = m.gridOriginY;
        if (typeof m.gridSnap === 'boolean') w.gridSnap = m.gridSnap;
        if (m.tokenSizeOverride) w.tokenSize = m.tokenSizeOverride as TokenSizeMap;
      } else if (m.type === 'TOKEN_RELAY' && m.id !== undefined) {
        const id = String(m.id), x = Number(m.x), y = Number(m.y);
        w.pos = { ...w.pos, [id]: { x, y } };
        const p = pending.current[id];
        if (p) {
          delete pending.current[id];
          onResultRef.current(id, Math.hypot(p.x - x, p.y - y) < 1 ? 'ok' : 'rebutjat');
        }
      } else if (m.type === 'VIEWPORT' && typeof m.id === 'string' && Number(m.w) > 0 && Number(m.h) > 0) {
        screensRef.current[m.id] = { id: m.id, w: Number(m.w), h: Number(m.h), seen: Date.now(), tauler: m.tauler === true };
        publishScreens();
      }
    };

    // Demanar l'estat fins que arribi (el DM pot obrir-se després del tracker).
    bc.postMessage({ type: 'PLAYER_READY' });
    const ask = setInterval(() => { if (!gotStruct) bc.postMessage({ type: 'PLAYER_READY' }); }, 3000);
    // Moviments sense resposta (DM tancat) i pantalles que ja no diuen res.
    const tick = setInterval(() => {
      const now = Date.now();
      for (const [id, p] of Object.entries(pending.current)) {
        if (now - p.t > 2500) { delete pending.current[id]; onResultRef.current(id, 'sense resposta'); }
      }
      publishScreens();
    }, 1000);
    return () => { clearInterval(ask); clearInterval(tick); bc.close(); bcRef.current = null; };
  }, []);

  /** Mou un token de jugador (`pl_*`), com el drag de la pantalla de jugador. */
  const moveToken = useCallback((id: string, x: number, y: number) => {
    const bc = bcRef.current;
    if (!bc) return;
    pending.current[id] = { x, y, t: Date.now() };
    // `src`: el DM sap que és una figureta (si el rebutja, no pot rebotar: queda pendent).
    bc.postMessage({ type: 'TOKEN_MOVE', id, x, y, src: 'figureta' });
  }, []);

  return { world, connected, players, screens, available, moveToken };
}
