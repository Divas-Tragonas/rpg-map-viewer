import type { BoardView, Player, PosMap, TokenSizeMap } from '@/types';
import { boardCam, type PhysPending } from '@/lib/board';

/**
 * Capa del DM per a les figuretes físiques (`lib/board.ts`), en coordenades de MAPA (dins del
 * `translate/scale` del tick). `sc` = px de pantalla per unitat de mapa (per al gruix de línia).
 * - El rectangle del tauler: el tros de mapa que mostra ara la pantalla del tauler.
 * - Les siluetes dels moviments de figuretes rebutjats: on és la figureta i una fletxa des del
 *   token, del color del jugador (decidir-ho és al panell `PhysPendingPanel`).
 */
export function renderBoardOverlay(ctx: CanvasRenderingContext2D, a: {
  board: BoardView | null;
  table: { w: number; h: number } | null;
  gs: number;
  pending: Record<string, PhysPending>;
  players: Player[];
  pos: PosMap;
  tokenSize: TokenSizeMap;
  sc: number;
  t: number;
}) {
  const px = 1 / Math.max(a.sc, 1e-6);
  const cam = a.table ? boardCam(a.board, a.table.w, a.table.h, a.gs) : null;
  if (cam) {
    ctx.save();
    ctx.strokeStyle = 'rgba(212,160,23,0.85)';
    ctx.lineWidth = 2 * px;
    ctx.setLineDash([10 * px, 6 * px]);
    ctx.strokeRect(cam.cx - cam.w / 2, cam.cy - cam.h / 2, cam.w, cam.h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(212,160,23,0.9)';
    ctx.font = `${12 * px}px system-ui, sans-serif`;
    ctx.fillText('Tauler', cam.cx - cam.w / 2 + 6 * px, cam.cy - cam.h / 2 - 6 * px);
    ctx.restore();
  }
  const ids = Object.keys(a.pending);
  if (ids.length === 0) return;
  const pulse = 0.55 + 0.45 * Math.sin(a.t * 4);
  ctx.save();
  for (const sid of ids) {
    const p = a.pending[sid];
    const pl = a.players.find(q => `pl_${q.id}` === sid);
    const color = pl?.color ?? '#d29922';
    const R = a.tokenSize[sid] ?? 22;
    const to = { x: p.x + R, y: p.y + R };
    const at = a.pos[sid];
    if (at) {
      const from = { x: at.x + R, y: at.y + R };
      ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 2 * px;
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 0.25 + 0.2 * pulse;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(to.x, to.y, R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5 * px;
    ctx.setLineDash([5 * px, 4 * px]);
    ctx.beginPath(); ctx.arc(to.x, to.y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${16 * px}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', to.x, to.y);
  }
  ctx.restore();
}
