import type { Door, Player, PosMap, TokenSizeMap, TurnState, Wall } from '@/types';
import type { MoveRange } from '@/hooks/usePlayerTokenDrag';
import type { TileLive } from '@/lib/tilemap/render';
import { tileBlocker } from '@/lib/tilemap/render';
import { computeReachableCells } from '@/lib/rooms/pathing';
import { effectiveWalls } from '@/lib/rooms/doors';
import { movementLimit } from '@/lib/rules/conditions';
import { terrainCost } from '@/lib/rules/terrain';
import { isTurnToken } from '@/lib/turn';
import { renderMoveRange } from './grid';

/**
 * Capa de la **pantalla de figures** (`/player?tauler=1`), en coordenades de mapa (dins del
 * `translate/scale` del tick de `PlayerView`). Ajuda els jugadors amb les figuretes físiques:
 * - **Rang de moviment** del jugador que té el torn (mateixa regla que el drag de `/player` i
 *   que la validació del DM: peus que queden, estats, parets, terreny difícil).
 * - **«Torna-la aquí»**: el DM no ha permès el moviment d'una figureta (`figBack` del STATE).
 * - **«Posa-la aquí» / marca**: mode recol·locació del tracker (`FIG_PLACE`).
 * - **Pols** quan un moviment s'ha confirmat (`TOKEN_RELAY` a una posició nova).
 *
 * ⚠️ **Tot en blanc o gris**: la càmera classifica les bases per color saturat; res d'aquesta
 * capa no pot tenir color, o el tracker el podria prendre per una figureta.
 */
export interface FigOverlay {
  turn: TurnState | undefined;
  players: Player[];
  pos: PosMap;
  tokenSize: TokenSizeMap;
  conditions: Record<string, string[]>;
  walls: Wall[];
  doors: Door[];
  tileLive: TileLive | null;
  difficult: readonly string[] | undefined;
  gs: number; gox: number; goy: number;
  back: readonly string[];
  place: { off: readonly string[]; ok: readonly string[] } | null;
  pulses: Record<string, number>;
  now: number;
  sc: number; mw: number; mh: number;
}

export const PULSE_MS = 700;

let _rangeKey = '';
let _range: MoveRange | null = null;
let _rangeRefs: unknown[] = [];

/** Rang del token de jugador que té el torn (`null` fora de combat o si no és un jugador). Cachejat. */
function activeRange(o: FigOverlay): MoveRange | null {
  const t = o.turn;
  if (!t?.active || !(o.gs > 0)) return null;
  const pl = o.players.find(p => isTurnToken(t, `pl_${p.id}`) && p.visible !== false);
  if (!pl) return null;
  const sid = `pl_${pl.id}`, at = o.pos[sid];
  if (!at) return null;
  const R = o.tokenSize[sid] ?? 22;
  const lim = movementLimit(t.activeRemainingFt, o.conditions[sid]);
  if (lim.immobile || lim.ft <= 0) return null;
  const key = `${sid}|${at.x},${at.y}|${lim.ft}|${o.gs},${o.gox},${o.goy}|${R}`;
  const refs = [o.walls, o.doors, o.tileLive, o.difficult];
  if (key === _rangeKey && refs.every((r, i) => r === _rangeRefs[i])) return _range;
  const startCol = Math.floor((at.x + R - o.gox) / o.gs), startRow = Math.floor((at.y + R - o.goy) / o.gs);
  const maxCells = Math.max(0, Math.floor(lim.ft / 5));
  const reach = computeReachableCells(effectiveWalls(o.walls, o.doors), startCol, startRow, maxCells,
    { gs: o.gs, gox: o.gox, goy: o.goy }, tileBlocker(o.tileLive, o.doors), terrainCost(o.difficult, o.gs, o.gox, o.goy));
  _range = { startCol, startRow, maxCells, gs: o.gs, gox: o.gox, goy: o.goy, reach };
  _rangeKey = key; _rangeRefs = refs;
  return _range;
}

/** Hi ha alguna cosa animada (per al ritme del bucle). */
export function figOverlayAnimating(o: Pick<FigOverlay, 'back' | 'place' | 'pulses' | 'now'>): boolean {
  return o.back.length > 0 || (o.place?.off.length ?? 0) > 0
    || Object.values(o.pulses).some(t => o.now - t < PULSE_MS);
}

export function renderFigOverlay(ctx: CanvasRenderingContext2D, o: FigOverlay): void {
  const px = 1 / Math.max(o.sc, 1e-6);
  const range = activeRange(o);
  if (range) renderMoveRange(ctx, range, o.mw, o.mh, o.sc, '255,255,255');

  const center = (sid: string) => {
    const at = o.pos[sid];
    if (!at) return null;
    const R = o.tokenSize[sid] ?? 22;
    return { x: at.x + R, y: at.y + R, R };
  };
  const label = (text: string, x: number, y: number) => {
    ctx.font = `bold ${15 * px}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 4 * px; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = '#ffffff'; ctx.fillText(text, x, y);
  };
  const beat = 0.5 + 0.5 * Math.sin(o.now / 180);
  ctx.save();

  // Torna-la aquí (DM) i posa-la aquí (recol·locació): anella discontínua que batega.
  const wantHere = new Set([...o.back, ...(o.place?.off ?? [])]);
  for (const sid of wantHere) {
    const c = center(sid);
    if (!c) continue;
    const r = c.R * (1.25 + 0.15 * beat);
    ctx.globalAlpha = 0.55 + 0.45 * beat;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * px;
    ctx.setLineDash([9 * px, 6 * px]);
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    label(o.back.includes(sid) ? 'Torna-la aquí' : 'Posa-la aquí', c.x, c.y + r + 4 * px);
  }

  // Ja és al seu lloc (recol·locació): marca de validació a dalt a la dreta.
  for (const sid of o.place?.ok ?? []) {
    const c = center(sid);
    if (!c) continue;
    const s = c.R * 0.5, x = c.x + c.R * 0.75, y = c.y - c.R * 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * px; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 0.45, y); ctx.lineTo(x - s * 0.1, y + s * 0.35); ctx.lineTo(x + s * 0.5, y - s * 0.35); ctx.stroke();
  }

  // Moviment confirmat: una ona que surt de la rodona.
  for (const [sid, t0] of Object.entries(o.pulses)) {
    const k = (o.now - t0) / PULSE_MS;
    if (k < 0 || k >= 1) continue;
    const c = center(sid);
    if (!c) continue;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (5 - 3 * k) * px;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.R * (1 + 1.2 * k), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
