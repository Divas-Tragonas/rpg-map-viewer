import type { Spell, SpellPreview, Point } from '@/types';
import type { FrameContext } from './types';
import { pathAt } from '@/lib/geometry';
import { AREA_SPELL_DATA, SPELL_TYPES } from '@/constants';

const SPELL_DURATIONS: Record<string, number> = {
  fireball:         2.8,
  lightning:        2.2,
  magic_beam:       3.0,
  magic_missile:    1.5,
  hideous_laughter: 2.0,
  burning_hands:    2.5,
  sleep:            3.0,
  grease:           3.5,
};

// Convert feet to world units: N ft → N/5 squares × gridSize px
function ftToWorld(ft: number, gridSize: number): number {
  return (ft / 5) * gridSize;
}

export function drawSpellFireball(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number): void {
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

export function drawSpellLightning(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number): void {
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

export function drawSpellMagicBeam(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number): void {
  ctx.save();
  const BU = 0.55, FD = 0.42, HOLD = dur - FD;
  const phase = elapsed < BU ? elapsed / BU : 1;
  const alpha = elapsed < BU ? elapsed / BU : elapsed > HOLD ? Math.max(0, (dur - elapsed) / FD) : 1;
  if (alpha < 0.01) { ctx.restore(); return; }
  const steps = Math.max(2, Math.ceil(pts.length * phase) + 1);
  const subPts: Point[] = [];
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

export function drawSpellMagicMissile(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const TRAVEL = dur * 0.65, IMPACT = dur - TRAVEL;
  if (elapsed <= TRAVEL) {
    const t = elapsed / TRAVEL;
    const pos = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
    for (let i = 5; i >= 1; i--) {
      const tt = Math.max(0, t - 0.06 * i);
      const tp = { x: A.x + (B.x - A.x) * tt, y: A.y + (B.y - A.y) * tt };
      ctx.globalAlpha = (1 - i / 6) * 0.5;
      ctx.fillStyle = '#c084fc';
      ctx.beginPath(); ctx.arc(tp.x, tp.y, (2 + 4 * (1 - i / 6)) / sc, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 10 / sc; ctx.shadowColor = '#c084fc';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 4 / sc, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT, fade = Math.max(0, 1 - imp);
    const armLen = (20 * Math.min(1, imp * 3)) / sc;
    ctx.globalAlpha = fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 / sc; ctx.lineCap = 'round';
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(B.x, B.y);
      ctx.lineTo(B.x + Math.cos(angle) * armLen, B.y + Math.sin(angle) * armLen); ctx.stroke();
    }
    ctx.globalAlpha = fade * 0.6; ctx.fillStyle = '#c084fc';
    ctx.beginPath(); ctx.arc(B.x, B.y, (8 * Math.min(1, imp * 2)) / sc, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellHideousLaughter(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const TRAVEL = dur * 0.60, IMPACT = dur - TRAVEL;
  const tN = performance.now();
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  if (elapsed <= TRAVEL) {
    const t = elapsed / TRAVEL;
    const pos = { x: A.x + dx * t, y: A.y + dy * t };
    const steps = Math.max(2, Math.floor(t * 12));
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2.5 / sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(A.x, A.y);
    for (let i = 1; i <= steps; i++) {
      const st = i / steps * t;
      const px = A.x + dx * st, py = A.y + dy * st;
      const wobble = Math.sin(i * 2.7 + tN * 0.005) * 6 / sc;
      ctx.lineTo(px + nx * wobble, py + ny * wobble);
    }
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 4 / sc, 0, Math.PI * 2); ctx.fill();
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT, fade = Math.max(0, 1 - imp);
    for (let r = 0; r < 3; r++) {
      const rProgress = Math.min(1, (imp * 3 - r * 0.4));
      if (rProgress <= 0) continue;
      ctx.globalAlpha = fade * (1 - r * 0.25) * 0.8;
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = (2 - r * 0.4) / sc;
      ctx.beginPath(); ctx.arc(B.x, B.y, (rProgress * (18 + r * 10)) / sc, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellBurningHands(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const dx = B.x - A.x, dy = B.y - A.y;
  const range = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const HALF_ANGLE = Math.PI / 6;
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.20, FADE_START = dur * 0.70;
  const phase = elapsed < APPEAR ? elapsed / APPEAR : elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (dur - FADE_START)) : 1;
  if (phase < 0.01) { ctx.restore(); return; }
  const effectRange = range * phase;
  ctx.globalAlpha = 0.22 * phase; ctx.fillStyle = '#ff6600';
  ctx.beginPath(); ctx.moveTo(A.x, A.y);
  ctx.arc(A.x, A.y, effectRange, angle - HALF_ANGLE, angle + HALF_ANGLE);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.7 * phase; ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 1.5 / sc;
  ctx.beginPath(); ctx.moveTo(A.x, A.y);
  ctx.arc(A.x, A.y, effectRange, angle - HALF_ANGLE, angle + HALF_ANGLE);
  ctx.closePath(); ctx.stroke();
  for (let f = 0; f < 3; f++) {
    const flameAngle = angle + (f - 1) * HALF_ANGLE * 0.6;
    const flicker = 0.7 + 0.3 * Math.sin(tN * 8 + f * 2.1);
    ctx.globalAlpha = 0.55 * phase; ctx.strokeStyle = f === 1 ? '#ffcc00' : '#ff6600';
    ctx.lineWidth = (3 - f * 0.5) / sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(A.x, A.y);
    ctx.lineTo(A.x + Math.cos(flameAngle) * effectRange * flicker, A.y + Math.sin(flameAngle) * effectRange * flicker);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellSleep(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  const center = pts[pts.length - 1]; if (!center) return;
  ctx.save();
  const data = AREA_SPELL_DATA['sleep'];
  const aoeRadius = ftToWorld(data.aoeRadiusFt, gridSize); // world units — scales with zoom
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.25, FADE_START = dur * 0.75;
  const alpha = elapsed < APPEAR ? elapsed / APPEAR : elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (dur - FADE_START)) : 1;

  ctx.globalAlpha = 0.12 * alpha; ctx.fillStyle = '#818cf8';
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.65 * alpha; ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 1.5 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius, 0, Math.PI * 2); ctx.stroke();

  const pulse = 0.5 + 0.5 * Math.sin(tN * 2.5);
  ctx.globalAlpha = 0.3 * alpha * pulse; ctx.strokeStyle = '#c7d2fe'; ctx.lineWidth = 1 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius * 0.6, 0, Math.PI * 2); ctx.stroke();

  // Zzz rising glyphs
  ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 1.2 / sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let z = 0; z < 3; z++) {
    const zPhase = ((tN * 0.5 + z * 0.33) % 1);
    const zAlpha = zPhase < 0.7 ? zPhase / 0.7 : Math.max(0, 1 - (zPhase - 0.7) / 0.3);
    const zX = center.x + (z - 1) * 14 / sc;
    const zY = center.y - (aoeRadius * 0.3 + zPhase * aoeRadius * 0.5);
    const zS = (4 + z * 1.5) / sc;
    ctx.globalAlpha = zAlpha * 0.75 * alpha;
    ctx.beginPath();
    ctx.moveTo(zX - zS, zY - zS); ctx.lineTo(zX + zS, zY - zS);
    ctx.lineTo(zX - zS, zY + zS); ctx.lineTo(zX + zS, zY + zS);
    ctx.stroke();
  }

  // Ft label (first 1.5s)
  if (elapsed < 1.5) {
    const labelAlpha = Math.min(1, elapsed / 0.3) * Math.max(0, 1 - (elapsed - 1.0) / 0.5);
    ctx.globalAlpha = labelAlpha * 0.9;
    ctx.font = `bold ${12 / sc}px sans-serif`; ctx.fillStyle = '#c7d2fe'; ctx.textAlign = 'center';
    ctx.fillText(`${data.aoeRadiusFt}ft`, center.x, center.y - aoeRadius - 6 / sc);
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellGrease(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  const center = pts[pts.length - 1]; if (!center) return;
  ctx.save();
  const data = AREA_SPELL_DATA['grease'];
  const rx = ftToWorld(data.aoeRadiusFt, gridSize); // world units
  const ry = rx * 0.55;
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.20, FADE_START = dur * 0.80;
  const alpha = elapsed < APPEAR ? elapsed / APPEAR : elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (dur - FADE_START)) : 1;
  const shimmer = 0.6 + 0.4 * Math.sin(tN * 3.7);

  ctx.globalAlpha = (0.18 + 0.10 * shimmer) * alpha; ctx.fillStyle = '#d9f99d';
  ctx.beginPath(); ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

  ctx.globalAlpha = 0.70 * alpha; ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 1.5 / sc;
  ctx.setLineDash([6 / sc, 4 / sc]);
  ctx.beginPath(); ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 0.35 * alpha * shimmer; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;
  ctx.beginPath(); ctx.ellipse(center.x, center.y - ry * 0.25, rx * 0.55, ry * 0.2, 0, Math.PI, Math.PI * 2); ctx.stroke();

  if (elapsed < 1.5) {
    const labelAlpha = Math.min(1, elapsed / 0.3) * Math.max(0, 1 - (elapsed - 1.0) / 0.5);
    ctx.globalAlpha = labelAlpha * 0.9;
    ctx.font = `bold ${12 / sc}px sans-serif`; ctx.fillStyle = '#d9f99d'; ctx.textAlign = 'center';
    ctx.fillText(`${data.aoeRadiusFt}ft`, center.x, center.y - ry - 6 / sc);
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// --- PREVIEW (while drawing) ---

export function renderSpellPreview(ctx: CanvasRenderingContext2D, preview: SpellPreview, sc: number, gridSize: number): void {
  ctx.save();

  if (preview.mode === 'line') {
    const { start, end } = preview;
    // Yellow thick dashed line (same style as existing spells)
    ctx.setLineDash([8 / sc, 5 / sc]);
    ctx.globalAlpha = 0.75; ctx.strokeStyle = '#ffd200'; ctx.lineWidth = 2.5 / sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    // End dot
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffd200';
    ctx.beginPath(); ctx.arc(end.x, end.y, 5 / sc, 0, Math.PI * 2); ctx.fill();
    // Start dot
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(start.x, start.y, 4 / sc, 0, Math.PI * 2); ctx.fill();

  } else if (preview.mode === 'area_place') {
    const { origin, center, spellType } = preview;
    const data = AREA_SPELL_DATA[spellType];
    if (!data) { ctx.restore(); return; }

    const rangeWorld = ftToWorld(data.rangeFt, gridSize);
    const aoeWorld   = ftToWorld(data.aoeRadiusFt, gridSize);
    const isOval     = data.aoeRadiusFt === 10; // Grease

    // Range limit: full white dashed circumference from origin
    ctx.globalAlpha = 0.70; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 / sc;
    ctx.setLineDash([8 / sc, 6 / sc]);
    ctx.beginPath(); ctx.arc(origin.x, origin.y, rangeWorld, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Origin crosshair marker
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;
    const cs = 5 / sc;
    ctx.beginPath(); ctx.moveTo(origin.x - cs, origin.y); ctx.lineTo(origin.x + cs, origin.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y - cs); ctx.lineTo(origin.x, origin.y + cs); ctx.stroke();

    // AoE shape at cursor: fill + colored dashed stroke
    ctx.globalAlpha = 0.15; ctx.fillStyle = data.color;
    if (isOval) {
      ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.80; ctx.strokeStyle = data.color; ctx.lineWidth = 2 / sc;
    ctx.setLineDash([6 / sc, 4 / sc]);
    if (isOval) {
      ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);

    // ft label above AoE
    ctx.globalAlpha = 0.85; ctx.fillStyle = data.color;
    ctx.font = `bold ${11 / sc}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(`${data.emoji} ${data.aoeRadiusFt}ft`, center.x, center.y - aoeWorld - 7 / sc);
  }

  ctx.globalAlpha = 1; ctx.restore();
}

export function renderSpells(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { rActiveSpells, setActiveSpells, sc, rGridSize, rSpellPreview } = fc;
  const now = performance.now();
  const alive: Spell[] = [];
  const gridSize = rGridSize.current;
  for (const sp of rActiveSpells.current) {
    const elapsed = (now - sp.startTime) / 1000;
    const dur = SPELL_DURATIONS[sp.type] ?? 2.5;
    if (elapsed > dur) continue;
    alive.push(sp);
    if (sp.type === 'fireball')              drawSpellFireball(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'lightning')        drawSpellLightning(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'magic_beam')       drawSpellMagicBeam(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'magic_missile')    drawSpellMagicMissile(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'hideous_laughter') drawSpellHideousLaughter(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'burning_hands')    drawSpellBurningHands(ctx, sp.points, elapsed, dur, sc);
    else if (sp.type === 'sleep')            drawSpellSleep(ctx, sp.points, elapsed, dur, sc, gridSize);
    else if (sp.type === 'grease')           drawSpellGrease(ctx, sp.points, elapsed, dur, sc, gridSize);
  }
  if (alive.length !== rActiveSpells.current.length) {
    rActiveSpells.current = alive;
    setActiveSpells(alive);
  }
  if (rSpellPreview?.current) {
    renderSpellPreview(ctx, rSpellPreview.current, sc, gridSize);
  }
}
