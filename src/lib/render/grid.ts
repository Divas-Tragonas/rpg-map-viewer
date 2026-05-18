import type { FrameContext } from './types';

export function renderGrid(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { sc, ox, oy, mw, mh, isDM, rGridVisible, rGridSize, rGridLineWidth, rGridOriginX, rGridOriginY, rGridDmAlpha, rGridCalibrating } = fc;
  const _gridAlpha = isDM ? rGridDmAlpha.current : 1;
  if (rGridVisible.current && rGridSize.current > 0 && !rGridCalibrating.current && _gridAlpha > 0.005) {
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
