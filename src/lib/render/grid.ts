import type { FrameContext } from './types';
import type { MoveRange } from '@/hooks/usePlayerTokenDrag';

/**
 * Caselles on el jugador pot moure el token durant el drag (pantalla de jugador).
 * Es dibuixa en espai de mapa (ctx ja translladat/escalat); selecció suau en groc.
 * Cercle de moviment (distància euclidiana): abastable si dc² + dr² ≤ (maxCells + 0.5)².
 * Dóna un disc rasteritzat (cercle pixelat) igual que les taules de cercles pixel-art.
 * Amb parets, la regió és `range.reach` (caselles amb camí transitable, cost de camí
 * real), amb la MATEIXA condició que el clamp del drag perquè pintura i límit coincideixin.
 */
export function renderMoveRange(ctx: CanvasRenderingContext2D, range: MoveRange, mw: number, mh: number, sc: number): void {
  const { startCol, startRow, maxCells, gs, gox, goy, reach } = range;
  const r2 = (maxCells + 0.5) * (maxCells + 0.5);
  const inRange = (dc: number, dr: number) => reach ? reach.has(`${dc},${dr}`) : dc * dc + dr * dr <= r2;
  const cellX = (dc: number) => gox + (startCol + dc) * gs;
  const cellY = (dr: number) => goy + (startRow + dr) * gs;
  const lim = maxCells + 1;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, mw, mh); ctx.clip();
  // farciment de les caselles del disc + línies de cel·la molt subtils
  ctx.fillStyle = 'rgba(255,214,64,0.13)';
  ctx.strokeStyle = 'rgba(255,214,64,0.22)';
  ctx.lineWidth = Math.max(0.5 / sc, 1 / sc);
  for (let dr = -lim; dr <= lim; dr++) {
    for (let dc = -lim; dc <= lim; dc++) {
      if (!inRange(dc, dr)) continue;
      const x = cellX(dc), y = cellY(dr);
      ctx.fillRect(x, y, gs, gs);
      ctx.strokeRect(x, y, gs, gs);
    }
  }
  // perímetre esglaonat: només les arestes que toquen fora del disc
  ctx.strokeStyle = 'rgba(255,214,64,0.55)';
  ctx.lineWidth = 2 / sc;
  ctx.beginPath();
  for (let dr = -lim; dr <= lim; dr++) {
    for (let dc = -lim; dc <= lim; dc++) {
      if (!inRange(dc, dr)) continue;
      const x = cellX(dc), y = cellY(dr);
      if (!inRange(dc - 1, dr)) { ctx.moveTo(x, y); ctx.lineTo(x, y + gs); }
      if (!inRange(dc + 1, dr)) { ctx.moveTo(x + gs, y); ctx.lineTo(x + gs, y + gs); }
      if (!inRange(dc, dr - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + gs, y); }
      if (!inRange(dc, dr + 1)) { ctx.moveTo(x, y + gs); ctx.lineTo(x + gs, y + gs); }
    }
  }
  ctx.stroke();
  ctx.restore();
}

export function renderGrid(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { sc, ox, oy, mw, mh, isDM, rGridVisible, rGridSize, rGridLineWidth, rGridOriginX, rGridOriginY, rGridDmAlpha, rGridCalibrating, rDrawTool } = fc;
  // The DM gets the grid as a reference while measuring (tool 4), even if it's not
  // toggled on for players.
  const measuring = isDM && (rDrawTool?.current === 'pointer' || rDrawTool?.current === 'wall');
  const _gridAlpha = isDM ? rGridDmAlpha.current : 1;
  if ((rGridVisible.current || measuring) && rGridSize.current > 0 && !rGridCalibrating.current && _gridAlpha > 0.005) {
    const gs = rGridSize.current, lw = rGridLineWidth.current;
    const gox = ((rGridOriginX.current % gs) + gs) % gs;
    const goy = ((rGridOriginY.current % gs) + gs) % gs;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.strokeStyle = `rgba(255,255,255,${0.30 * _gridAlpha})`;
    ctx.lineWidth = Math.max(0.5 / sc, lw / sc);
    ctx.beginPath();
    for (let x = gox; x <= mw; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, mh); }
    for (let y = goy; y <= mh; y += gs) { ctx.moveTo(0, y); ctx.lineTo(mw, y); }
    ctx.stroke(); ctx.restore();
  }
}

export function renderGridCalib(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { sc, ox, oy, mw, mh, isDM, rGridLineWidth, rGridCalibrating, gridCalibRef, gridCalibCurrRef, gridCalibHoverRef } = fc;
  if (!isDM || !rGridCalibrating.current) return;
  const calib = gridCalibRef.current, calibCurr = gridCalibCurrRef.current, hover = gridCalibHoverRef.current;
  const lw = rGridLineWidth.current;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);

  if (!calib && hover) {
    ctx.strokeStyle = 'rgba(255,210,0,0.50)'; ctx.lineWidth = Math.max(0.8 / sc, lw * 0.6 / sc); ctx.setLineDash([10 / sc, 5 / sc]);
    ctx.beginPath(); ctx.moveTo(hover.hx, 0); ctx.lineTo(hover.hx, mh); ctx.moveTo(0, hover.hy); ctx.lineTo(mw, hover.hy); ctx.stroke(); ctx.setLineDash([]);
    const ms = 14 / sc;
    ctx.strokeStyle = 'rgba(255,220,60,0.85)'; ctx.lineWidth = 1.5 / sc;
    ctx.beginPath();
    ctx.moveTo(hover.hx - ms, hover.hy); ctx.lineTo(hover.hx - ms * 0.35, hover.hy);
    ctx.moveTo(hover.hx + ms * 0.35, hover.hy); ctx.lineTo(hover.hx + ms, hover.hy);
    ctx.moveTo(hover.hx, hover.hy - ms); ctx.lineTo(hover.hx, hover.hy - ms * 0.35);
    ctx.moveTo(hover.hx, hover.hy + ms * 0.35); ctx.lineTo(hover.hx, hover.hy + ms);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(hover.hx, hover.hy, ms * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,60,0.95)'; ctx.beginPath(); ctx.arc(hover.hx, hover.hy, 2.5 / sc, 0, Math.PI * 2); ctx.fill();
  } else if (calib && calibCurr) {
    const dx = calibCurr.cx - calib.sx, dy = calibCurr.cy - calib.sy;
    const sz = Math.max(8, Math.max(Math.abs(dx), Math.abs(dy)));
    const qx = dx >= 0 ? calib.sx : calib.sx - sz, qy = dy >= 0 ? calib.sy : calib.sy - sz;
    const gox2 = ((qx % sz) + sz) % sz, goy2 = ((qy % sz) + sz) % sz;
    ctx.strokeStyle = 'rgba(255,210,0,0.20)'; ctx.lineWidth = Math.max(0.5 / sc, lw * 0.5 / sc);
    ctx.beginPath();
    for (let x = gox2; x <= mw; x += sz) { ctx.moveTo(x, 0); ctx.lineTo(x, mh); }
    for (let y = goy2; y <= mh; y += sz) { ctx.moveTo(0, y); ctx.lineTo(mw, y); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,0,0.07)'; ctx.fillRect(qx, qy, sz, sz);
    ctx.strokeStyle = 'rgba(255,220,60,0.92)'; ctx.lineWidth = 2.5 / sc; ctx.setLineDash([6 / sc, 3 / sc]);
    ctx.strokeRect(qx, qy, sz, sz); ctx.setLineDash([]);
    ctx.font = `bold ${11 / sc}px system-ui`; ctx.fillStyle = 'rgba(255,220,60,0.95)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(sz)}px`, qx + sz / 2, qy + sz / 2);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** Ruler tool (tool 4/"Senyal"): draws the line + "Xft" label between the click points. */
export function renderMeasureRuler(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { sc, ox, oy, rMeasure, rPointerPos, rGridSize } = fc;
  const m = rMeasure?.current;
  if (!m?.a) return;
  const end = m.b ?? rPointerPos.current;
  const sxA = ox + m.a.x * sc, syA = oy + m.a.y * sc;
  if (!end) {
    // Només hi ha el punt A (sense posició de cursor viva, p. ex. tap en tablet):
    // marcar-lo igualment perquè el click sempre sigui visible.
    ctx.save();
    ctx.fillStyle = 'rgba(255,220,60,0.95)';
    ctx.beginPath(); ctx.arc(sxA, syA, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,0,0.55)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(sxA, syA, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  const gs = rGridSize.current > 0 ? rGridSize.current : 70;
  const distPx = Math.hypot(end.x - m.a.x, end.y - m.a.y);
  const ft = Math.round((distPx / gs) * 5);
  const sx0 = ox + m.a.x * sc, sy0 = oy + m.a.y * sc;
  const sx1 = ox + end.x * sc, sy1 = oy + end.y * sc;
  const fixed = !!m.b;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = fixed ? 'rgba(255,210,0,0.85)' : 'rgba(255,210,0,0.55)';
  ctx.lineWidth = fixed ? 2.5 : 1.8;
  if (!fixed) ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,220,60,0.95)';
  ctx.beginPath(); ctx.arc(sx0, sy0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx1, sy1, 4, 0, Math.PI * 2); ctx.fill();

  const mx = (sx0 + sx1) / 2, my = (sy0 + sy1) / 2;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = `📏 ${ft}ft`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10,13,18,0.82)';
  ctx.fillRect(mx - tw / 2 - 6, my - 19, tw + 12, 16);
  ctx.fillStyle = '#ffd200';
  ctx.fillText(text, mx, my - 11);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

export function renderDMPointer(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { sc, ox, oy, isDM, rPointerPos } = fc;
  if (!rPointerPos.current) return;
  const ptr = rPointerPos.current, pT = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(pT * 5.5);
  ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
  ctx.strokeStyle = `rgba(255,210,0,${0.18 + 0.12 * pulse})`; ctx.lineWidth = 8 / sc;
  ctx.beginPath(); ctx.arc(ptr.x, ptr.y, (28 + 6 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `rgba(255,210,0,${0.55 + 0.35 * pulse})`; ctx.lineWidth = 2.5 / sc;
  ctx.beginPath(); ctx.arc(ptr.x, ptr.y, (14 + 5 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(255,230,80,${0.9 + 0.1 * pulse})`;
  ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 3.5 / sc, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(255,210,0,${0.5 + 0.3 * pulse})`; ctx.lineWidth = 1.5 / sc;
  const ch = 8 / sc;
  ctx.beginPath(); ctx.moveTo(ptr.x - ch, ptr.y); ctx.lineTo(ptr.x + ch, ptr.y); ctx.moveTo(ptr.x, ptr.y - ch); ctx.lineTo(ptr.x, ptr.y + ch); ctx.stroke();
  ctx.restore();
}
