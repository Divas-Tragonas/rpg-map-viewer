import type { Spell, SpellPreview, Point } from '@/types';
import type { FrameContext } from './types';
import { pathAt } from '@/lib/geometry';
import { AREA_SPELL_DATA, SPELL_TYPES } from '@/constants';

const AREA_SPELL_TYPES = new Set(['sleep', 'grease']);

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

function ftToWorld(ft: number, gridSize: number): number {
  return (ft / 5) * gridSize;
}

function worldToFt(px: number, gridSize: number): number {
  return gridSize > 0 ? Math.round((px / gridSize) * 5) : 0;
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Unified impact: flash → primary ring → white secondary ring.
 * maxRPx: max ring radius in screen pixels (divided internally by sc).
 * imp: 0→1 progress through the impact phase.
 */
function drawImpact(ctx: CanvasRenderingContext2D, cx: number, cy: number, maxRPx: number, color: string, sc: number, imp: number): void {
  const fade = Math.max(0, 1 - imp);
  const maxR = maxRPx / sc;
  ctx.lineCap = 'round';

  // Flash (first 15% of phase)
  if (imp < 0.15) {
    const ft = imp / 0.15;
    ctx.globalAlpha = (1 - ft) * 0.65; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.5 * ft, 0, Math.PI * 2); ctx.fill();
  }
  // Ring 1 — primary color
  ctx.globalAlpha = fade * 0.70; ctx.strokeStyle = color;
  ctx.lineWidth = (4 * fade) / sc;
  ctx.beginPath(); ctx.arc(cx, cy, maxR * Math.min(1, imp * 1.5), 0, Math.PI * 2); ctx.stroke();
  // Ring 2 — white, 60% size
  ctx.globalAlpha = fade * 0.38; ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = (2 * fade) / sc;
  ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.6 * Math.min(1, imp * 2.2), 0, Math.PI * 2); ctx.stroke();
}

// ── Path spells ─────────────────────────────────────────────────────────────

export function drawSpellFireball(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  ctx.save();
  const TRAVEL = dur * 0.72, IMPACT = dur - TRAVEL;
  if (elapsed <= TRAVEL) {
    const t = elapsed / TRAVEL, pos = pathAt(pts, t), tN = performance.now() / 1000;
    // Outer glow trail
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
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(pos.x, pos.y, bR * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT, end = pts[pts.length - 1];
    drawImpact(ctx, end.x, end.y, 48, '#ff6600', sc, imp);
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellLightning(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  ctx.save();
  const tN = performance.now();
  const fade = elapsed < 0.18 ? elapsed / 0.18 : elapsed > dur - 0.28 ? Math.max(0, (dur - elapsed) / 0.28) : 1;
  if (fade < 0.01) { ctx.restore(); return; }
  // 3-layer structure: outer glow / mid / core
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

export function drawSpellMagicBeam(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  ctx.save();
  const BU = 0.55, FD = 0.42, HOLD = dur - FD;
  const phase = elapsed < BU ? elapsed / BU : 1;
  const alpha = elapsed < BU ? elapsed / BU : elapsed > HOLD ? Math.max(0, (dur - elapsed) / FD) : 1;
  if (alpha < 0.01) { ctx.restore(); return; }
  const steps = Math.max(2, Math.ceil(pts.length * phase) + 1);
  const subPts: Point[] = [];
  for (let i = 0; i < steps; i++) subPts.push(pathAt(pts, Math.min(phase, i / (steps - 1))));
  // 3-layer: outer glow / mid / core / bright core
  [[22, '#3311aa', 0.20], [11, '#5533ee', 0.40], [4.5, '#8866ff', 0.75], [1.5, '#ddd8ff', 0.95]].forEach(([lw, col, a]) => {
    ctx.globalAlpha = (a as number) * alpha; ctx.strokeStyle = col as string; ctx.lineWidth = (lw as number) / sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); subPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
  });
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

// ── Line spells ─────────────────────────────────────────────────────────────

export function drawSpellMagicMissile(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const TRAVEL = dur * 0.65, IMPACT = dur - TRAVEL;

  if (elapsed <= TRAVEL) {
    const t = elapsed / TRAVEL;
    const pos = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
    // Outer glow trail
    for (let i = 5; i >= 1; i--) {
      const tt = Math.max(0, t - 0.06 * i);
      const tp = { x: A.x + (B.x - A.x) * tt, y: A.y + (B.y - A.y) * tt };
      ctx.globalAlpha = (1 - i / 6) * 0.35; ctx.fillStyle = '#9933cc';
      ctx.beginPath(); ctx.arc(tp.x, tp.y, (8 * (1 - i / 6)) / sc, 0, Math.PI * 2); ctx.fill();
    }
    // Mid trail
    for (let i = 3; i >= 1; i--) {
      const tt = Math.max(0, t - 0.03 * i);
      const tp = { x: A.x + (B.x - A.x) * tt, y: A.y + (B.y - A.y) * tt };
      ctx.globalAlpha = (1 - i / 4) * 0.5; ctx.fillStyle = '#c084fc';
      ctx.beginPath(); ctx.arc(tp.x, tp.y, (4 * (1 - i / 4)) / sc, 0, Math.PI * 2); ctx.fill();
    }
    // Core head
    ctx.globalAlpha = 1; ctx.shadowBlur = 10 / sc; ctx.shadowColor = '#c084fc';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 4 / sc, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT;
    drawImpact(ctx, B.x, B.y, 38, '#c084fc', sc, imp);
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellHideousLaughter(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
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
    const steps = Math.max(2, Math.floor(t * 14));

    const buildPath = () => {
      ctx.beginPath(); ctx.moveTo(A.x, A.y);
      for (let i = 1; i <= steps; i++) {
        const st = i / steps * t;
        const px = A.x + dx * st, py = A.y + dy * st;
        const wobble = Math.sin(i * 2.7 + tN * 0.005) * 5 / sc;
        ctx.lineTo(px + nx * wobble, py + ny * wobble);
      }
      ctx.lineTo(pos.x, pos.y);
    };
    // 3-layer structure
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.20; ctx.strokeStyle = '#a16207'; ctx.lineWidth = 9 / sc; buildPath(); ctx.stroke();
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3 / sc;  buildPath(); ctx.stroke();
    ctx.globalAlpha = 0.90; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;  buildPath(); ctx.stroke();
    // Head
    ctx.globalAlpha = 1; ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 4 / sc, 0, Math.PI * 2); ctx.fill();
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT;
    drawImpact(ctx, B.x, B.y, 42, '#facc15', sc, imp);
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellBurningHands(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const dist = Math.hypot(B.x - A.x, B.y - A.y);
  const dx = B.x - A.x, dy = B.y - A.y;
  const angle = Math.atan2(dy, dx);
  const HALF_ANGLE = Math.PI / 6;
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.20, FADE_START = dur * 0.70;
  const phase = elapsed < APPEAR ? elapsed / APPEAR : elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (dur - FADE_START)) : 1;
  if (phase < 0.01) { ctx.restore(); return; }
  const effectRange = dist * phase;

  // Outer glow cone
  ctx.globalAlpha = 0.15 * phase; ctx.fillStyle = '#cc3300';
  ctx.beginPath(); ctx.moveTo(A.x, A.y);
  ctx.arc(A.x, A.y, effectRange * 1.05, angle - HALF_ANGLE, angle + HALF_ANGLE);
  ctx.closePath(); ctx.fill();
  // Mid fill
  ctx.globalAlpha = 0.22 * phase; ctx.fillStyle = '#ff6600';
  ctx.beginPath(); ctx.moveTo(A.x, A.y);
  ctx.arc(A.x, A.y, effectRange, angle - HALF_ANGLE, angle + HALF_ANGLE);
  ctx.closePath(); ctx.fill();
  // Cone outline — 3 layers
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.25 * phase; ctx.strokeStyle = '#cc3300'; ctx.lineWidth = 6 / sc;
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.arc(A.x, A.y, effectRange, angle - HALF_ANGLE, angle + HALF_ANGLE); ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = 0.60 * phase; ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2 / sc;
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.arc(A.x, A.y, effectRange, angle - HALF_ANGLE, angle + HALF_ANGLE); ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = 0.80 * phase; ctx.strokeStyle = '#ffeeaa'; ctx.lineWidth = 1 / sc;
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.arc(A.x, A.y, effectRange, angle - HALF_ANGLE, angle + HALF_ANGLE); ctx.closePath(); ctx.stroke();
  // Flame lines
  for (let f = 0; f < 3; f++) {
    const fa = angle + (f - 1) * HALF_ANGLE * 0.6;
    const flicker = 0.7 + 0.3 * Math.sin(tN * 8 + f * 2.1);
    ctx.globalAlpha = 0.55 * phase; ctx.strokeStyle = f === 1 ? '#ffcc00' : '#ff6600';
    ctx.lineWidth = (3 - f * 0.5) / sc;
    ctx.beginPath(); ctx.moveTo(A.x, A.y);
    ctx.lineTo(A.x + Math.cos(fa) * effectRange * flicker, A.y + Math.sin(fa) * effectRange * flicker); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Area spells ─────────────────────────────────────────────────────────────

export function drawSpellSleep(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  const center = pts[pts.length - 1]; if (!center) return;
  ctx.save();
  const data = AREA_SPELL_DATA['sleep'];
  const aoeRadius = ftToWorld(data.aoeRadiusFt, gridSize);
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.25, FADE_START = dur * 0.75;
  const alpha = elapsed < APPEAR ? elapsed / APPEAR : elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (dur - FADE_START)) : 1;

  // Outer glow ring
  ctx.globalAlpha = 0.15 * alpha; ctx.strokeStyle = '#4338ca'; ctx.lineWidth = 12 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius, 0, Math.PI * 2); ctx.stroke();
  // Fill
  ctx.globalAlpha = 0.12 * alpha; ctx.fillStyle = '#818cf8';
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius, 0, Math.PI * 2); ctx.fill();
  // Mid stroke
  ctx.globalAlpha = 0.50 * alpha; ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 2 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius, 0, Math.PI * 2); ctx.stroke();
  // Core bright stroke
  ctx.globalAlpha = 0.70 * alpha; ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 1 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius, 0, Math.PI * 2); ctx.stroke();
  // Pulse ring
  const pulse = 0.5 + 0.5 * Math.sin(tN * 2.5);
  ctx.globalAlpha = 0.25 * alpha * pulse; ctx.strokeStyle = '#c7d2fe'; ctx.lineWidth = 1 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, aoeRadius * 0.6, 0, Math.PI * 2); ctx.stroke();
  // Zzz
  ctx.lineWidth = 1.2 / sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let z = 0; z < 3; z++) {
    const zPhase = ((tN * 0.5 + z * 0.33) % 1);
    const zA = zPhase < 0.7 ? zPhase / 0.7 : Math.max(0, 1 - (zPhase - 0.7) / 0.3);
    const zX = center.x + (z - 1) * 14 / sc;
    const zY = center.y - (aoeRadius * 0.3 + zPhase * aoeRadius * 0.5);
    const zS = (4 + z * 1.5) / sc;
    ctx.globalAlpha = zA * 0.75 * alpha; ctx.strokeStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.moveTo(zX - zS, zY - zS); ctx.lineTo(zX + zS, zY - zS);
    ctx.lineTo(zX - zS, zY + zS); ctx.lineTo(zX + zS, zY + zS);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

export function drawSpellGrease(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number): void {
  const center = pts[pts.length - 1]; if (!center) return;
  ctx.save();
  const data = AREA_SPELL_DATA['grease'];
  const rx = ftToWorld(data.aoeRadiusFt, gridSize);
  const ry = rx * 0.55;
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.20, FADE_START = dur * 0.80;
  const alpha = elapsed < APPEAR ? elapsed / APPEAR : elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (dur - FADE_START)) : 1;
  const shimmer = 0.6 + 0.4 * Math.sin(tN * 3.7);

  // Outer glow
  ctx.globalAlpha = 0.12 * alpha; ctx.strokeStyle = '#365314'; ctx.lineWidth = 10 / sc;
  ctx.beginPath(); ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  // Fill
  ctx.globalAlpha = (0.18 + 0.10 * shimmer) * alpha; ctx.fillStyle = '#d9f99d';
  ctx.beginPath(); ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  // Mid stroke dashed
  ctx.globalAlpha = 0.55 * alpha; ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 2 / sc;
  ctx.setLineDash([6 / sc, 4 / sc]);
  ctx.beginPath(); ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Core bright stroke
  ctx.globalAlpha = 0.70 * alpha; ctx.strokeStyle = '#d9f99d'; ctx.lineWidth = 1 / sc;
  ctx.beginPath(); ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  // Gloss
  ctx.globalAlpha = 0.35 * alpha * shimmer; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;
  ctx.beginPath(); ctx.ellipse(center.x, center.y - ry * 0.25, rx * 0.55, ry * 0.2, 0, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Preview ──────────────────────────────────────────────────────────────────

export function renderSpellPreview(ctx: CanvasRenderingContext2D, preview: SpellPreview, sc: number, gridSize: number): void {
  ctx.save();

  if (preview.mode === 'line') {
    const { start, end } = preview;
    // 3-layer preview line — same visual language as active spells
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.20; ctx.strokeStyle = '#ffd200'; ctx.lineWidth = 9 / sc;
    ctx.setLineDash([10 / sc, 6 / sc]);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffd200'; ctx.lineWidth = 2.5 / sc;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.globalAlpha = 0.80; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    // Dots
    ctx.globalAlpha = 0.90; ctx.fillStyle = '#ffd200';
    ctx.beginPath(); ctx.arc(end.x, end.y, 5 / sc, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.60;
    ctx.beginPath(); ctx.arc(start.x, start.y, 4 / sc, 0, Math.PI * 2); ctx.fill();

    // Live "shortest distance" readout — a straight line is already its own diagonal.
    const ft = worldToFt(Math.hypot(end.x - start.x, end.y - start.y), gridSize);
    const lmx = (start.x + end.x) / 2, lmy = (start.y + end.y) / 2;
    ctx.globalAlpha = 0.9; ctx.font = `bold ${12 / sc}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = `📏 ${ft}ft`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(10,13,18,0.82)';
    ctx.fillRect(lmx - tw / 2 - 5 / sc, lmy - 17 / sc, tw + 10 / sc, 14 / sc);
    ctx.fillStyle = '#ffd200';
    ctx.fillText(text, lmx, lmy - 10 / sc);
    ctx.textBaseline = 'alphabetic';

  } else if (preview.mode === 'area_place') {
    const { origin, center, spellType } = preview;
    const data = AREA_SPELL_DATA[spellType];
    if (!data) { ctx.restore(); return; }
    const rangeWorld = ftToWorld(data.rangeFt, gridSize);
    const aoeWorld   = ftToWorld(data.aoeRadiusFt, gridSize);
    const isOval     = data.aoeRadiusFt === 10;

    // Range limit — full white dashed circumference
    ctx.globalAlpha = 0.70; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 / sc;
    ctx.setLineDash([8 / sc, 6 / sc]);
    ctx.beginPath(); ctx.arc(origin.x, origin.y, rangeWorld, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Origin crosshair
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;
    const cs = 5 / sc;
    ctx.beginPath(); ctx.moveTo(origin.x - cs, origin.y); ctx.lineTo(origin.x + cs, origin.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y - cs); ctx.lineTo(origin.x, origin.y + cs); ctx.stroke();

    // AoE at cursor — 3-layer (outer glow / fill / stroke)
    ctx.globalAlpha = 0.10; ctx.fillStyle = data.color;
    if (isOval) {
      ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.20; ctx.strokeStyle = data.color; ctx.lineWidth = 8 / sc;
    ctx.setLineDash([6 / sc, 4 / sc]);
    if (isOval) { ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
    else        { ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 0.80; ctx.lineWidth = 1.5 / sc;
    if (isOval) { ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
    else        { ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  ctx.globalAlpha = 1; ctx.restore();
}

// ── Main render ──────────────────────────────────────────────────────────────

export function renderSpells(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const { rActiveSpells, setActiveSpells, sc, rGridSize, rSpellPreview } = fc;
  const now = performance.now();
  const alive: Spell[] = [];
  const gridSize = rGridSize.current;
  for (const sp of rActiveSpells.current) {
    const elapsed = (now - sp.startTime) / 1000;
    const dur = SPELL_DURATIONS[sp.type] ?? 2.5;
    const isArea = AREA_SPELL_TYPES.has(sp.type);
    if (elapsed > dur && !isArea) continue;  // non-area spells expire
    alive.push(sp);
    const renderElapsed = isArea ? Math.min(elapsed, dur * 0.5) : elapsed;  // area spells: clamp to full-alpha state
    if      (sp.type === 'fireball')         drawSpellFireball(ctx, sp.points, renderElapsed, dur, sc, gridSize);
    else if (sp.type === 'lightning')        drawSpellLightning(ctx, sp.points, renderElapsed, dur, sc, gridSize);
    else if (sp.type === 'magic_beam')       drawSpellMagicBeam(ctx, sp.points, renderElapsed, dur, sc, gridSize);
    else if (sp.type === 'magic_missile')    drawSpellMagicMissile(ctx, sp.points, renderElapsed, dur, sc, gridSize);
    else if (sp.type === 'hideous_laughter') drawSpellHideousLaughter(ctx, sp.points, renderElapsed, dur, sc, gridSize);
    else if (sp.type === 'burning_hands')    drawSpellBurningHands(ctx, sp.points, renderElapsed, dur, sc, gridSize);
    else if (sp.type === 'sleep')            drawSpellSleep(ctx, sp.points, renderElapsed, dur, sc, gridSize);
    else if (sp.type === 'grease')           drawSpellGrease(ctx, sp.points, renderElapsed, dur, sc, gridSize);
  }
  if (alive.length !== rActiveSpells.current.length) {
    rActiveSpells.current = alive; setActiveSpells(alive);
  }
  if (rSpellPreview?.current) renderSpellPreview(ctx, rSpellPreview.current, sc, gridSize);
}
