import type { Spell } from '@/types';
import type { FrameContext } from './types';
import { pathAt } from '@/lib/geometry';

const SPELL_DURATIONS: Record<string, number> = {
  fireball:   2.8,
  lightning:  2.2,
  magic_beam: 3.0,
};

export function drawSpellFireball(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], elapsed: number, dur: number, sc: number): void {
  ctx.save();
  const TRAVEL = dur * 0.72, IMPACT = dur - TRAVEL;
  if (elapsed <= TRAVEL) {
    const t = elapsed / TRAVEL, pos = pathAt(pts, t), tN = performance.now() / 1000;
    for (let i = 1; i <= 14; i++) {
      const tt = Math.max(0, t - 0.13 * (1 - i / 14)), tp = pathAt(pts, tt);
      ctx.globalAlpha = (i / 14) * 0.5;
      ctx.fillStyle = i > 9 ? '#cc3300' : '#ff8800';
      ctx.beginPath(); ctx.arc(tp.x, tp.y, (2 + 8 * (i / 14)) / sc, 0, Math.PI * 2); ctx.fill();
    }
    const pulse = 0.5 + 0.5 * Math.sin(tN * 20), bR = (8 + 3 * pulse) / sc;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 14 / sc; ctx.shadowColor = '#ff8800';
    ctx.fillStyle = '#ffbb00'; ctx.beginPath(); ctx.arc(pos.x, pos.y, bR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffeeaa'; ctx.beginPath(); ctx.arc(pos.x, pos.y, bR * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT, end = pts[pts.length - 1], fade = Math.max(0, 1 - imp), mxR = 48 / sc;
    ctx.lineCap = 'round';
    ctx.globalAlpha = fade * 0.65; ctx.strokeStyle = '#ff6600'; ctx.lineWidth = (5 * fade) / sc;
    ctx.beginPath(); ctx.arc(end.x, end.y, mxR * Math.min(1, imp * 1.8), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = fade * 0.45; ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = (3 * fade) / sc;
    ctx.beginPath(); ctx.arc(end.x, end.y, mxR * Math.min(0.65, imp * 2.6) * 0.65, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = fade * 0.3; ctx.strokeStyle = '#ffeeaa'; ctx.lineWidth = (2 * fade) / sc;
    ctx.beginPath(); ctx.arc(end.x, end.y, mxR * Math.min(0.35, imp * 3.5) * 0.35, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellLightning(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], elapsed: number, dur: number, sc: number): void {
  ctx.save();
  const tN = performance.now();
  const fade = elapsed < 0.18 ? elapsed / 0.18 : elapsed > dur - 0.28 ? Math.max(0, (dur - elapsed) / 0.28) : 1;
  if (fade < 0.01) { ctx.restore(); return; }
  const layers = [{ lw: 9, col: '#cc8800', a: 0.25 }, { lw: 4, col: '#ffd200', a: 0.60 }, { lw: 1.5, col: '#ffffff', a: 0.95 }];
  layers.forEach(({ lw, col, a }, li) => {
    const jitter = (2 - li) * 7 / sc, pulse = Math.max(0.2, 0.5 + 0.5 * Math.sin(tN * 0.013 + li * 1.7));
    ctx.globalAlpha = a * fade * pulse;
    ctx.strokeStyle = col; ctx.lineWidth = lw / sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => {
      const jx = (i > 0 && i < pts.length - 1) ? Math.sin(tN * 0.09 + i * 17.3 + li * 5.1) * jitter : 0;
      const jy = (i > 0 && i < pts.length - 1) ? Math.cos(tN * 0.09 + i * 13.7 + li * 3.9) * jitter : 0;
      i === 0 ? ctx.moveTo(p.x + jx, p.y + jy) : ctx.lineTo(p.x + jx, p.y + jy);
    });
    ctx.stroke();
  });
  for (let s2 = 0; s2 < 5; s2++) {
    const sP = ((tN * 0.0025 + s2 * 0.19) % 1 + 1) % 1, sp = pathAt(pts, sP);
    ctx.globalAlpha = Math.sin(sP * Math.PI) * fade * 0.9; ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 3 / sc, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellMagicBeam(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], elapsed: number, dur: number, sc: number): void {
  ctx.save();
  const BU = 0.55, FD = 0.42, HOLD = dur - FD;
  const phase = elapsed < BU ? elapsed / BU : 1;
  const alpha = elapsed < BU ? elapsed / BU : elapsed > HOLD ? Math.max(0, (dur - elapsed) / FD) : 1;
  if (alpha < 0.01) { ctx.restore(); return; }
  const steps = Math.max(2, Math.ceil(pts.length * phase) + 1);
  const subPts: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i++) subPts.push(pathAt(pts, Math.min(phase, i / (steps - 1))));
  const drawBeamPath = (lw: number, col: string, a: number) => {
    ctx.globalAlpha = a * alpha; ctx.strokeStyle = col; ctx.lineWidth = lw / sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); subPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
  };
  drawBeamPath(22, '#3311aa', 0.20); drawBeamPath(11, '#5533ee', 0.40);
  drawBeamPath(4.5, '#8866ff', 0.75); drawBeamPath(1.5, '#ddd8ff', 0.95);
  const tN = performance.now() / 1000;
  for (let i2 = 0; i2 < 7; i2++) {
    const sT = ((tN * 0.6 + i2 * 0.14) % Math.max(0.01, phase) + Math.max(0.01, phase)) % Math.max(0.01, phase);
    const sP2 = pathAt(pts, sT);
    ctx.globalAlpha = Math.sin(sT / Math.max(0.01, phase) * Math.PI) * alpha * 0.85; ctx.fillStyle = '#ffffff';
    const sr = (1.2 + 2.5 * Math.abs(Math.sin(tN * 5.1 + i2))) / sc;
    ctx.beginPath(); ctx.arc(sP2.x, sP2.y, sr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function renderSpells(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { rActiveSpells, setActiveSpells, sc } = fc;
  const now = performance.now();
  const alive: Spell[] = [];
  for (const sp of rActiveSpells.current) {
    const elapsed = (now - sp.startTime) / 1000;
    const dur = SPELL_DURATIONS[sp.type] ?? 2.5;
    if (elapsed > dur) continue;
    alive.push(sp);
    if (sp.type === 'fireball')   drawSpellFireball(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'lightning')  drawSpellLightning(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'magic_beam') drawSpellMagicBeam(ctx, sp.points, elapsed, dur, sc);
  }
  if (alive.length !== rActiveSpells.current.length) {
    rActiveSpells.current = alive;
    setActiveSpells(alive);
  }
}
