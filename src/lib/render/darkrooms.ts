import type { FrameContext } from './types';
import type { Room } from '@/types';
import { C } from '@/constants';

const REVEAL_LERP = 0.09;

function roomPath(ctx: CanvasRenderingContext2D, room: Room): void {
  ctx.beginPath();
  room.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
}

// Ull (obert/tancat) dibuixat en coords de mapa però a mida constant de pantalla (÷ sc).
function drawEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, sc: number, open: boolean): void {
  const s = 1 / sc;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = open ? 'rgba(255,255,255,0.92)' : 'rgba(28,28,28,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = open ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5; ctx.stroke();
  const col = open ? '#111' : '#eee';
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.bezierCurveTo(-8, -5, 8, -5, 8, 0); ctx.bezierCurveTo(8, 5, -8, 5, -8, 0); ctx.stroke();
  if (open) { ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(8, -5); ctx.stroke(); }
  ctx.restore();
}

/**
 * Sales detectades. Al jugador: foscor opaca a les sales fosques no revelades (fade suau
 * en revelar). Al DM: overlay semitransparent (per veure-hi a través) + contorn + nom +
 * ull en passar-hi per sobre. Les sales normals (no fosques) només es marquen al DM.
 * Es dibuixa dins de la transformació de mapa (ctx ja translladat/escalat).
 */
export function renderRooms(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const rRooms = fc.rRooms; if (!rRooms) return;
  const rooms = rRooms.current;
  if (!rooms || rooms.length === 0) return;
  const { isDM, sc } = fc;
  const anim = fc.roomRevealAnimRef?.current ?? {};
  const hovId = fc.rHoveredRoomId?.current ?? null;

  for (const room of rooms) {
    const tgt = room.dark && !room.revealed ? 1 : 0;
    const prev = anim[room.id] ?? tgt;
    const next = prev + (tgt - prev) * REVEAL_LERP;
    if (fc.roomRevealAnimRef) fc.roomRevealAnimRef.current[room.id] = Math.abs(next - tgt) < 0.004 ? tgt : next;
    const a = fc.roomRevealAnimRef ? fc.roomRevealAnimRef.current[room.id] : tgt;

    // Farcir amb el polígon exacte + contorn del mateix color eixampla la foscor uns
    // píxels cap enfora, de manera que dues sales contigües se solapin i no quedi cap
    // fil visible del mapa a la paret compartida.
    const seamW = Math.max(2, 2.5 / sc);

    if (!isDM) {
      // Jugador: només importa la foscor de les sales fosques.
      if (room.dark && a > 0.004) {
        ctx.save();
        ctx.fillStyle = `rgba(3,4,7,${a})`;
        ctx.strokeStyle = `rgba(3,4,7,${a})`;
        ctx.lineJoin = 'round'; ctx.lineWidth = seamW; ctx.setLineDash([]);
        roomPath(ctx, room); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      continue;
    }

    // DM
    const isHov = hovId === room.id;
    if (room.dark) {
      ctx.save();
      ctx.fillStyle = `rgba(3,4,7,${0.14 + a * 0.5})`;
      ctx.strokeStyle = `rgba(3,4,7,${0.14 + a * 0.5})`;
      ctx.lineJoin = 'round'; ctx.lineWidth = seamW; ctx.setLineDash([]);
      roomPath(ctx, room); ctx.fill(); ctx.stroke();
      ctx.restore();
      roomPath(ctx, room);
      ctx.strokeStyle = isHov ? 'rgba(255,255,255,0.85)' : `rgba(88,166,255,${0.55 + a * 0.25})`;
      ctx.lineWidth = (isHov ? 2.4 : 1.6) / sc; ctx.setLineDash([]);
      ctx.stroke();
    } else {
      roomPath(ctx, room);
      ctx.strokeStyle = isHov ? 'rgba(255,255,255,0.7)' : `${C.room}77`;
      ctx.lineWidth = (isHov ? 2 : 1.4) / sc;
      ctx.setLineDash([7 / sc, 5 / sc]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `${C.room}0d`; ctx.fill();
    }

    // Nom (o ull en hover) al centroide.
    const { cx, cy } = room.bbox;
    if (isHov) {
      drawEye(ctx, cx, cy, sc, room.dark ? tgt === 0 : true);
    } else {
      ctx.font = `600 ${12 / sc}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = room.dark ? (room.revealed ? 'rgba(255,255,255,0.4)' : 'rgba(180,205,255,0.7)') : `${C.room}cc`;
      const label = room.dark ? (room.revealed ? `${room.name} · obert` : `${room.name} · fosc`) : room.name;
      ctx.fillText(label, cx, cy);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }
}

/** Parets dibuixades pel DM (no es mostren al jugador). Dins de la transformació de mapa. */
export function renderWalls(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const rWalls = fc.rWalls; if (!rWalls) return;
  const walls = rWalls.current;
  if (!walls || walls.length === 0) return;
  const { sc } = fc;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(214,160,23,0.85)';
  ctx.lineWidth = Math.max(1.5 / sc, 3 / sc);
  ctx.beginPath();
  for (const w of walls) { ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); }
  ctx.stroke();
  // Vèrtexs
  ctx.fillStyle = 'rgba(255,220,90,0.95)';
  const r = 3 / sc;
  for (const w of walls) {
    ctx.beginPath(); ctx.arc(w.a.x, w.a.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w.b.x, w.b.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/**
 * Paret en curs (eina "Parets") en espai de pantalla: línia elàstica de l'últim vèrtex al
 * cursor, distància en peus i anell d'imant quan el cursor s'enganxa a un vèrtex existent
 * (tancament). Es crida després de ctx.restore() (com la regla de mesura).
 */
export function renderWallDraft(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  if (fc.rDrawTool?.current !== 'wall') return;
  const last = fc.rWallPenLast?.current ?? null;
  const cur = fc.rWallCursor?.current ?? null;
  const { sc, ox, oy, rGridSize } = fc;
  ctx.save();
  if (cur) {
    const cx = ox + cur.x * sc, cy = oy + cur.y * sc;
    if (last) {
      const lx = ox + last.x * sc, ly = oy + last.y * sc;
      ctx.strokeStyle = 'rgba(255,210,0,0.7)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.setLineDash([]);
      const gs = rGridSize.current > 0 ? rGridSize.current : 70;
      const ft = Math.round((Math.hypot(cur.x - last.x, cur.y - last.y) / gs) * 5);
      const mx = (lx + cx) / 2, my = (ly + cy) / 2;
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const text = `${ft}ft`; const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(10,13,18,0.82)'; ctx.fillRect(mx - tw / 2 - 6, my - 19, tw + 12, 16);
      ctx.fillStyle = '#ffd200'; ctx.fillText(text, mx, my - 11);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
    // Punt del cursor / anell d'imant de tancament
    ctx.fillStyle = cur.onVertex ? '#3fb950' : 'rgba(255,220,60,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
    if (cur.onVertex) {
      ctx.strokeStyle = 'rgba(63,185,80,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (last) {
    const lx = ox + last.x * sc, ly = oy + last.y * sc;
    ctx.fillStyle = 'rgba(255,210,0,0.95)';
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
