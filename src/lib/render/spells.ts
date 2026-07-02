import type { Spell, SpellPreview, Point } from '@/types';
import type { FrameContext } from './types';
import { pathAt, pathLen } from '@/lib/geometry';
import { AREA_SPELL_DATA } from '@/constants';

const AREA_SPELL_TYPES = new Set(['sleep', 'grease']);

const SPELL_DURATIONS: Record<string, number> = {
  fireball:         3.0,
  lightning:        2.4,
  magic_beam:       3.0,
  magic_missile:    1.9,
  hideous_laughter: 2.3,
  burning_hands:    2.6,
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

// FNV-1a — stable per-spell seed so every instance keeps the same particle layout
// on every frame (particles are pure functions of elapsed time + seeded PRNG).
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutCubic(t: number): number { const u = 1 - t; return 1 - u * u * u; }
function easeOutQuart(t: number): number { const u = 1 - t; return 1 - u * u * u * u; }
function smoothstep(t: number, a: number, b: number): number {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/** Radial-gradient blob (the workhorse of every glow/flame/impact here). */
function glowBlob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]): void {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** Local path direction (unit vector) at t, via finite differences. */
function pathDirAt(pts: Point[], t: number): Point {
  const a = pathAt(pts, Math.max(0, t - 0.02)), b = pathAt(pts, Math.min(1, t + 0.02));
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Generic burst: white flash → hot core bloom → gradient shockwave → flying sparks.
 * maxRPx: max radius in screen pixels. imp: 0→1 progress. Draw in 'lighter' mode.
 */
function drawBurst(ctx: CanvasRenderingContext2D, cx: number, cy: number, maxRPx: number, rgb: [number, number, number], sc: number, imp: number, seed: number): void {
  const maxR = maxRPx / sc;
  const [r, g, b] = rgb;
  ctx.globalCompositeOperation = 'lighter';
  // Flash
  if (imp < 0.22) {
    const ft = imp / 0.22;
    glowBlob(ctx, cx, cy, maxR * (0.35 + 0.5 * ft), [
      [0, `rgba(255,255,255,${0.9 * (1 - ft)})`],
      [0.4, `rgba(${r},${g},${b},${0.6 * (1 - ft)})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }
  // Core bloom
  const bloomA = Math.max(0, 1 - smoothstep(imp, 0.3, 1));
  glowBlob(ctx, cx, cy, maxR * 0.55, [
    [0, `rgba(255,255,255,${0.55 * bloomA})`],
    [0.35, `rgba(${r},${g},${b},${0.45 * bloomA})`],
    [1, 'rgba(0,0,0,0)'],
  ]);
  // Shockwave ring
  const fade = Math.max(0, 1 - imp);
  const ringR = maxR * easeOutQuart(Math.min(1, imp * 1.15));
  ctx.globalAlpha = fade * 0.6;
  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = (4.5 * fade) / sc; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = fade * 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (1.5 * fade) / sc;
  ctx.beginPath(); ctx.arc(cx, cy, ringR * 0.75, 0, Math.PI * 2); ctx.stroke();
  // Sparks
  const rnd = mulberry32(seed);
  for (let i = 0; i < 10; i++) {
    const ang = rnd() * Math.PI * 2, spd = 0.55 + rnd() * 0.45, sz = 1.2 + rnd() * 1.8;
    const d = maxR * 1.1 * spd * easeOutCubic(imp);
    const px = cx + Math.cos(ang) * d, py = cy + Math.sin(ang) * d + (imp * imp * 14) / sc;
    ctx.globalAlpha = fade * 0.9;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : `rgb(${r},${g},${b})`;
    ctx.beginPath(); ctx.arc(px, py, (sz * fade) / sc, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ── Fireball ────────────────────────────────────────────────────────────────

export function drawSpellFireball(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number): void {
  ctx.save();
  const TRAVEL = dur * 0.62, IMPACT = dur - TRAVEL;
  const tN = performance.now() / 1000;

  if (elapsed <= TRAVEL) {
    const t = elapsed / TRAVEL, pos = pathAt(pts, t);
    const rnd = mulberry32(seed);
    // Faint smoke behind the comet (normal blend, subtle)
    for (let i = 0; i < 6; i++) {
      const back = 0.1 + rnd() * 0.16, ti = t - back;
      const jx = (rnd() - 0.5) * 12, jy = (rnd() - 0.5) * 8 - back * 50;
      if (ti < 0) continue;
      const p = pathAt(pts, ti), age = back / 0.26;
      ctx.globalAlpha = (1 - age) * 0.09;
      ctx.fillStyle = 'rgb(35,26,22)';
      ctx.beginPath(); ctx.arc(p.x + jx / sc, p.y + jy / sc, (6 + 9 * age) / sc, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    // Flame trail hugging the path
    for (let i = 0; i < 30; i++) {
      const back = rnd() * 0.2, ti = t - back;
      const latR = rnd(), riseR = rnd();
      if (ti < 0) continue;
      const age = back / 0.2;
      const p = pathAt(pts, ti), dir = pathDirAt(pts, ti);
      const lat = (latR - 0.5) * 22 * age, rise = -(4 + riseR * 16) * age;
      const px = p.x + (-dir.y * lat) / sc, py = p.y + (dir.x * lat) / sc + rise / sc;
      const col = age < 0.25 ? '255,240,170' : age < 0.55 ? '255,160,50' : '230,70,10';
      glowBlob(ctx, px, py, (9 - 6.5 * age) / sc, [
        [0, `rgba(${col},${0.9 * (1 - age)})`],
        [1, 'rgba(0,0,0,0)'],
      ]);
    }
    // Comet head — layered glow + white core, flickering
    const pulse = 0.85 + 0.15 * Math.sin(tN * 26 + seed);
    glowBlob(ctx, pos.x, pos.y, (38 * pulse) / sc, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.2, 'rgba(255,214,80,0.85)'],
      [0.5, 'rgba(255,110,10,0.4)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    glowBlob(ctx, pos.x, pos.y, (12 * pulse) / sc, [
      [0, 'rgba(255,255,255,1)'],
      [1, 'rgba(255,230,150,0)'],
    ]);
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT, end = pts[pts.length - 1];
    // Explosion radius: ~2.6 cells when grid is calibrated, screen-relative fallback.
    const R = gridSize > 0 ? gridSize * 2.6 : 140 / sc;
    const rnd = mulberry32(seed ^ 0x9e3779b9);

    // Smoke (normal blend) grows through the second half
    if (imp > 0.3) {
      const sT = (imp - 0.3) / 0.7;
      for (let i = 0; i < 7; i++) {
        const ang = rnd() * Math.PI * 2, d = R * (0.15 + rnd() * 0.45);
        const px = end.x + Math.cos(ang) * d, py = end.y + Math.sin(ang) * d - sT * R * (0.12 + rnd() * 0.2);
        ctx.globalAlpha = 0.20 * (1 - sT) * Math.min(1, sT * 3);
        ctx.fillStyle = 'rgb(30,24,20)';
        ctx.beginPath(); ctx.arc(px, py, R * (0.2 + 0.35 * sT) * (0.6 + rnd() * 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else { for (let i = 0; i < 28; i++) rnd(); } // keep PRNG stream aligned across phases (smoke consumes 4×7 draws)

    ctx.globalCompositeOperation = 'lighter';
    // Flash
    if (imp < 0.1) {
      const ft = imp / 0.1;
      glowBlob(ctx, end.x, end.y, R * (0.4 + 0.6 * ft), [
        [0, `rgba(255,255,255,${0.95 * (1 - ft * 0.5)})`],
        [1, 'rgba(0,0,0,0)'],
      ]);
    }
    // Fire bloom — overlapping turbulent blobs, cooling white→orange→deep red
    const grow = easeOutCubic(Math.min(1, imp * 1.3));
    const cool = smoothstep(imp, 0.15, 0.85);
    const bloomFade = 1 - smoothstep(imp, 0.5, 0.95);
    for (let i = 0; i < 9; i++) {
      const ang = rnd() * Math.PI * 2, dist = Math.pow(rnd(), 0.7) * R * 0.5 * grow;
      const br = R * (0.28 + rnd() * 0.38) * grow;
      const bx = end.x + Math.cos(ang) * dist, by = end.y + Math.sin(ang) * dist - imp * R * 0.08;
      const hot = `rgba(255,${Math.round(235 - 150 * cool)},${Math.round(140 - 130 * cool)},${0.55 * bloomFade})`;
      const mid = `rgba(${Math.round(255 - 60 * cool)},${Math.round(120 - 80 * cool)},10,${0.3 * bloomFade})`;
      glowBlob(ctx, bx, by, br, [[0, hot], [0.55, mid], [1, 'rgba(0,0,0,0)']]);
    }
    // Shockwave
    const fade = Math.max(0, 1 - imp);
    const ringR = R * 1.12 * easeOutQuart(Math.min(1, imp * 1.1));
    ctx.globalAlpha = fade * 0.55; ctx.strokeStyle = '#ffb066'; ctx.lineWidth = (5 * fade) / sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(end.x, end.y, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = fade * 0.25; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (1.5 * fade) / sc;
    ctx.beginPath(); ctx.arc(end.x, end.y, ringR * 0.82, 0, Math.PI * 2); ctx.stroke();
    // Flying embers
    for (let i = 0; i < 24; i++) {
      const ang = rnd() * Math.PI * 2, spd = 0.4 + rnd() * 0.6, szr = rnd();
      const d = R * (0.55 + 0.6 * spd) * easeOutCubic(imp);
      const px = end.x + Math.cos(ang) * d, py = end.y + Math.sin(ang) * d + imp * imp * R * 0.22;
      const eFade = Math.max(0, 1 - imp * (0.8 + szr * 0.4));
      if (eFade <= 0) continue;
      const col = imp < 0.35 ? '255,220,120' : imp < 0.65 ? '255,140,40' : '220,60,10';
      glowBlob(ctx, px, py, (1.6 + szr * 2.6) * eFade / sc + R * 0.012, [
        [0, `rgba(${col},${0.9 * eFade})`],
        [1, 'rgba(0,0,0,0)'],
      ]);
    }
    // Lingering ground glow
    glowBlob(ctx, end.x, end.y, R * 0.5, [
      [0, `rgba(255,90,10,${0.3 * fade})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Lightning ───────────────────────────────────────────────────────────────

interface Bolt { strikeIdx: number; main: Point[]; branches: Point[][]; }
const boltCache = new Map<string, Bolt>();
export function pruneSpellFx(aliveIds: Set<string>): void {
  for (const k of boltCache.keys()) { if (!aliveIds.has(k)) boltCache.delete(k); }
}

function makeBolt(pts: Point[], seed: number, strikeIdx: number): Bolt {
  const rnd = mulberry32((seed ^ Math.imul(strikeIdx + 1, 0x85ebca6b)) >>> 0);
  const L = pathLen(pts);
  const N = Math.max(12, Math.min(44, Math.round(L / 26)));
  const amp = L * 0.035;
  const main: Point[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = pathAt(pts, t), dir = pathDirAt(pts, t);
    // Pin ends, displace the middle: coarse + fine octave of perpendicular jitter
    const env = Math.sin(Math.PI * t);
    const off = ((rnd() * 2 - 1) * amp + (rnd() * 2 - 1) * amp * 0.4) * env;
    main.push({ x: p.x - dir.y * off, y: p.y + dir.x * off });
  }
  const branches: Point[][] = [];
  const nb = 2 + Math.floor(rnd() * 3);
  for (let bIdx = 0; bIdx < nb; bIdx++) {
    const at = 0.2 + rnd() * 0.6;
    const start = main[Math.round(at * N)];
    const dir = pathDirAt(pts, at);
    const side = rnd() < 0.5 ? -1 : 1;
    const angle = Math.atan2(dir.y, dir.x) + side * (0.4 + rnd() * 0.5);
    const bLen = L * (0.1 + rnd() * 0.14);
    const br: Point[] = [start];
    let x = start.x, y = start.y, a = angle;
    for (let s = 1; s <= 4; s++) {
      a += (rnd() * 2 - 1) * 0.45;
      x += Math.cos(a) * (bLen / 4); y += Math.sin(a) * (bLen / 4);
      br.push({ x, y });
    }
    branches.push(br);
  }
  return { strikeIdx, main, branches };
}

function strokePolyline(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { const p = pts[i]; i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
  ctx.stroke();
}

export function drawSpellLightning(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number, spellId: string): void {
  ctx.save();
  const fade = elapsed < 0.1 ? elapsed / 0.1 : elapsed > dur - 0.3 ? Math.max(0, (dur - elapsed) / 0.3) : 1;
  if (fade < 0.01) { ctx.restore(); return; }

  // Re-strike: brand-new fractal geometry every ~110ms, bright at each strike
  const PERIOD = 0.11;
  const strikeIdx = Math.floor(elapsed / PERIOD);
  const strikeT = (elapsed - strikeIdx * PERIOD) / PERIOD;
  let bolt = boltCache.get(spellId);
  if (!bolt || bolt.strikeIdx !== strikeIdx) { bolt = makeBolt(pts, seed, strikeIdx); boltCache.set(spellId, bolt); }
  const env = 1 - 0.6 * smoothstep(strikeT, 0.2, 1);

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const layers: [number, string, number][] = [
    [13, '#2b4bd8', 0.22],
    [4.5, '#7ea0ff', 0.55],
    [1.6, '#f4f8ff', 1.0],
  ];
  for (const [lw, col, a] of layers) {
    ctx.globalAlpha = a * fade * env;
    ctx.strokeStyle = col; ctx.lineWidth = lw / sc;
    strokePolyline(ctx, bolt.main);
    ctx.globalAlpha = a * fade * env * 0.65;
    ctx.lineWidth = (lw * 0.55) / sc;
    for (const br of bolt.branches) strokePolyline(ctx, br);
  }
  // Impact glow at target + sparks, refreshed each strike
  const end = bolt.main[bolt.main.length - 1];
  glowBlob(ctx, end.x, end.y, 30 / sc, [
    [0, `rgba(240,246,255,${0.85 * fade * env})`],
    [0.4, `rgba(126,160,255,${0.5 * fade * env})`],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const rnd = mulberry32((seed ^ Math.imul(strikeIdx + 1, 0xc2b2ae35)) >>> 0);
  for (let i = 0; i < 6; i++) {
    const ang = rnd() * Math.PI * 2, d = (8 + rnd() * 22) * easeOutCubic(strikeT) / sc;
    ctx.globalAlpha = fade * env * (1 - strikeT) * 0.9;
    ctx.fillStyle = '#dbe7ff';
    ctx.beginPath(); ctx.arc(end.x + Math.cos(ang) * d, end.y + Math.sin(ang) * d, 1.6 / sc, 0, Math.PI * 2); ctx.fill();
  }
  // Source glow at caster end
  const start = bolt.main[0];
  glowBlob(ctx, start.x, start.y, 16 / sc, [
    [0, `rgba(126,160,255,${0.5 * fade * env})`],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Magic beam ──────────────────────────────────────────────────────────────

export function drawSpellMagicBeam(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number): void {
  ctx.save();
  const BU = 0.5, FD = 0.45, HOLD = dur - FD;
  const phase = elapsed < BU ? easeOutCubic(elapsed / BU) : 1;
  const alpha = elapsed < BU ? elapsed / BU : elapsed > HOLD ? Math.max(0, (dur - elapsed) / FD) : 1;
  if (alpha < 0.01) { ctx.restore(); return; }
  const tN = performance.now() / 1000;
  const steps = Math.max(2, Math.ceil(pts.length * phase) + 1);
  const subPts: Point[] = [];
  for (let i = 0; i < steps; i++) subPts.push(pathAt(pts, Math.min(phase, i / (steps - 1))));

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Breathing width + energy layers
  const breathe = 1 + 0.18 * Math.sin(tN * 11 + seed);
  const layers: [number, string, number][] = [
    [24 * breathe, '#2a0a80', 0.22],
    [11 * breathe, '#6633ee', 0.42],
    [4.5, '#a385ff', 0.8],
    [1.6, '#f2edff', 1.0],
  ];
  for (const [lw, col, a] of layers) {
    ctx.globalAlpha = a * alpha; ctx.strokeStyle = col; ctx.lineWidth = lw / sc;
    strokePolyline(ctx, subPts);
  }
  // Energy pulses surging along the beam
  for (let i = 0; i < 5; i++) {
    const pT = ((tN * 0.55 + i / 5) % 1) * phase;
    const p = pathAt(pts, pT);
    const pA = Math.sin((pT / Math.max(0.01, phase)) * Math.PI) * alpha;
    glowBlob(ctx, p.x, p.y, (9 + 3 * Math.sin(tN * 7 + i * 2.2)) / sc, [
      [0, `rgba(255,255,255,${0.75 * pA})`],
      [0.4, `rgba(163,133,255,${0.5 * pA})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }
  // Sparkles spiralling around the beam
  const rnd = mulberry32(seed);
  for (let i = 0; i < 8; i++) {
    const speed = 0.35 + rnd() * 0.4, ph0 = rnd() * Math.PI * 2, rad = (5 + rnd() * 9);
    const sT = ((tN * speed + i / 8) % 1) * phase;
    const p = pathAt(pts, sT), dir = pathDirAt(pts, sT);
    const swing = Math.sin(tN * 5 + ph0) * rad;
    const px = p.x - (dir.y * swing) / sc, py = p.y + (dir.x * swing) / sc;
    ctx.globalAlpha = alpha * 0.8 * Math.sin((sT / Math.max(0.01, phase)) * Math.PI);
    ctx.fillStyle = '#e6dcff';
    ctx.beginPath(); ctx.arc(px, py, 1.6 / sc, 0, Math.PI * 2); ctx.fill();
  }
  // Charge glow at the origin
  const o = pts[0];
  glowBlob(ctx, o.x, o.y, (20 + 5 * Math.sin(tN * 9)) / sc, [
    [0, `rgba(242,237,255,${0.8 * alpha})`],
    [0.4, `rgba(122,80,255,${0.5 * alpha})`],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Magic missile — three staggered curving darts ───────────────────────────

function bezier(A: Point, C: Point, B: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * A.x + 2 * u * t * C.x + t * t * B.x, y: u * u * A.y + 2 * u * t * C.y + t * t * B.y };
}

export function drawSpellMagicMissile(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const rnd = mulberry32(seed);
  const STAGGER = 0.13, TRAVEL = 0.85, IMPACT = 0.5;

  ctx.globalCompositeOperation = 'lighter';
  for (let m = 0; m < 3; m++) {
    const bend = len * 0.16 * (m === 0 ? -1 : m === 1 ? 1 : -0.45) * (0.7 + rnd() * 0.6);
    const scatA = (rnd() - 0.5) * 14, scatB = (rnd() - 0.5) * 14;
    const C = { x: (A.x + B.x) / 2 + nx * bend, y: (A.y + B.y) / 2 + ny * bend };
    const t0 = m * STAGGER, local = elapsed - t0;
    if (local < 0) continue;

    if (local <= TRAVEL) {
      const t = easeOutCubic(local / TRAVEL) * 0.4 + (local / TRAVEL) * 0.6;
      // Trail
      for (let k = 12; k >= 1; k--) {
        const tt = t - k * 0.032;
        if (tt < 0) continue;
        const tp = bezier(A, C, B, tt);
        const kf = 1 - k / 13;
        glowBlob(ctx, tp.x, tp.y, (8 * kf + 1.2) / sc, [
          [0, `rgba(192,132,252,${0.65 * kf})`],
          [1, 'rgba(0,0,0,0)'],
        ]);
      }
      // Head
      const pos = bezier(A, C, B, t);
      glowBlob(ctx, pos.x, pos.y, 15 / sc, [
        [0, 'rgba(255,255,255,0.95)'],
        [0.3, 'rgba(192,132,252,0.75)'],
        [1, 'rgba(0,0,0,0)'],
      ]);
    } else if (local <= TRAVEL + IMPACT) {
      const imp = (local - TRAVEL) / IMPACT;
      drawBurst(ctx, B.x + (nx * scatA) / sc, B.y + (ny * scatB) / sc, 34, [192, 132, 252], sc, imp, seed + m * 101);
      ctx.globalCompositeOperation = 'lighter'; // drawBurst resets it
    }
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Hideous laughter ────────────────────────────────────────────────────────

export function drawSpellHideousLaughter(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const TRAVEL = dur * 0.45, IMPACT = dur - TRAVEL;
  const tN = performance.now() / 1000;
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;

  if (elapsed <= TRAVEL) {
    const t = elapsed / TRAVEL;
    ctx.globalCompositeOperation = 'lighter';
    // Wobbling pink stream
    const steps = 22;
    const stream: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const st = (i / steps) * t;
      const wob = Math.sin(st * 26 + tN * 10) * len * 0.045 * Math.sin(Math.PI * st / Math.max(0.01, t));
      stream.push({ x: A.x + dx * st + nx * wob, y: A.y + dy * st + ny * wob });
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const layers: [number, string, number][] = [
      [10, '#9d174d', 0.28],
      [4, '#ec4899', 0.6],
      [1.4, '#fff0f7', 0.95],
    ];
    for (const [lw, col, a] of layers) {
      ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw / sc;
      strokePolyline(ctx, stream);
    }
    // Giggling sparkle motes falling off the stream
    const rnd = mulberry32(seed);
    for (let i = 0; i < 7; i++) {
      const st = rnd() * t, drop = (tN * 20 + i * 7) % 14;
      const p = { x: A.x + dx * st + nx * drop / sc, y: A.y + dy * st + ny * drop / sc };
      ctx.globalAlpha = 0.7 * (1 - drop / 14);
      ctx.fillStyle = i % 2 ? '#f9a8d4' : '#fde68a';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.7 / sc, 0, Math.PI * 2); ctx.fill();
    }
    // Head
    const head = stream[stream.length - 1];
    glowBlob(ctx, head.x, head.y, 12 / sc, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.35, 'rgba(236,72,153,0.7)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  } else {
    const imp = (elapsed - TRAVEL) / IMPACT;
    drawBurst(ctx, B.x, B.y, 40, [236, 72, 153], sc, Math.min(1, imp * 1.6), seed);
    // Floating "HA!" glyphs — the target can't stop laughing
    const rnd = mulberry32(seed ^ 0x51ed270b);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const appear = i * 0.11;
      if (imp < appear) { rnd(); rnd(); rnd(); rnd(); continue; }
      const local = Math.min(1, (imp - appear) / (1 - appear));
      const ang = rnd() * Math.PI * 2, d = (14 + rnd() * 30) / sc;
      const rot = (rnd() - 0.5) * 0.7, size = (16 + rnd() * 12);
      const px = B.x + Math.cos(ang) * d, py = B.y + Math.sin(ang) * d - (local * 44) / sc;
      const a = Math.sin(Math.PI * Math.min(1, local * 1.15));
      glowBlob(ctx, px, py, (size * 1.1) / sc, [
        [0, `rgba(236,72,153,${0.35 * a})`],
        [1, 'rgba(0,0,0,0)'],
      ]);
      ctx.save();
      ctx.translate(px, py); ctx.rotate(rot + Math.sin(tN * 6 + i) * 0.08);
      ctx.font = `italic 900 ${size / sc}px system-ui`;
      ctx.globalAlpha = a; ctx.fillStyle = i % 2 ? '#ffd6ec' : '#fff3b8';
      ctx.fillText('HA!', 0, 0);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Burning hands — cone of roiling flame tongues ───────────────────────────

export function drawSpellBurningHands(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const [A, B] = [pts[0], pts[1]];
  const range = Math.hypot(B.x - A.x, B.y - A.y);
  const angle = Math.atan2(B.y - A.y, B.x - A.x);
  const HALF = Math.PI / 6;
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.14, FADE_START = dur * 0.68;
  const env = elapsed < APPEAR ? easeOutCubic(elapsed / APPEAR)
            : elapsed > FADE_START ? Math.max(0, 1 - (elapsed - FADE_START) / (dur - FADE_START)) : 1;
  if (env < 0.01) { ctx.restore(); return; }
  const reach = range * (elapsed < APPEAR ? easeOutCubic(elapsed / APPEAR) : 1);
  const flick = 0.9 + 0.1 * Math.sin(tN * 24 + seed);

  // Soft smoke drifting past the cone tip (normal blend)
  const rndS = mulberry32(seed ^ 0x7f4a7c15);
  for (let i = 0; i < 6; i++) {
    const fa = angle + (rndS() * 2 - 1) * HALF * 0.85;
    const cyc = (tN * (0.5 + rndS() * 0.3) + rndS()) % 1;
    const d = reach * (0.75 + 0.35 * cyc);
    ctx.globalAlpha = 0.07 * env * Math.sin(Math.PI * cyc);
    ctx.fillStyle = 'rgb(38,28,22)';
    ctx.beginPath();
    ctx.arc(A.x + Math.cos(fa) * d, A.y + Math.sin(fa) * d - cyc * reach * 0.1, reach * (0.06 + 0.08 * cyc), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'lighter';
  // Base heat wedge — nested feathered wedges so the cone has no hard straight edges
  const wedge = (half: number, r: number) => {
    ctx.beginPath(); ctx.moveTo(A.x, A.y);
    ctx.arc(A.x, A.y, r, angle - half, angle + half);
    ctx.closePath();
  };
  for (const [hf, rf, af] of [[1, 1, 0.35], [0.72, 0.96, 0.5], [0.45, 0.9, 0.65]] as const) {
    const g = ctx.createRadialGradient(A.x, A.y, 0, A.x, A.y, Math.max(1, reach * rf));
    g.addColorStop(0, `rgba(255,220,120,${0.16 * af * env * flick})`);
    g.addColorStop(0.35, `rgba(255,120,20,${0.1 * af * env})`);
    g.addColorStop(0.8, `rgba(200,40,0,${0.04 * af * env})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; wedge(HALF * hf, reach * rf); ctx.fill();
  }

  // Flame tongues surging outward
  const rnd = mulberry32(seed);
  for (let i = 0; i < 28; i++) {
    const angFrac = (rnd() * 2 - 1) * 0.9;
    const fa = angle + angFrac * HALF;
    const cycleDur = 0.34 + rnd() * 0.28, phase = rnd(), reachFrac = 0.55 + rnd() * 0.45, wobPh = rnd() * 17;
    const cy = ((elapsed / cycleDur) + phase) % 1;
    const distF = easeOutCubic(cy) * reachFrac;
    const d = reach * distF;
    const wob = Math.sin(cy * 9 + wobPh) * reach * 0.045 * distF;
    const px = A.x + Math.cos(fa) * d - Math.sin(fa) * wob;
    const py = A.y + Math.sin(fa) * d + Math.cos(fa) * wob - cy * cy * reach * 0.05;
    const size = reach * (0.045 + 0.13 * Math.sin(Math.PI * cy)) * (0.7 + 0.3 * flick);
    const a = env * Math.sin(Math.PI * Math.min(1, cy * 1.25));
    let col: string;
    if      (cy < 0.22) col = `rgba(255,244,190,${0.85 * a})`;
    else if (cy < 0.5)  col = `rgba(255,190,60,${0.7 * a})`;
    else if (cy < 0.75) col = `rgba(255,110,20,${0.5 * a})`;
    else                col = `rgba(210,50,5,${0.35 * a})`;
    glowBlob(ctx, px, py, size, [[0, col], [1, 'rgba(0,0,0,0)']]);
  }
  // White-hot core at the caster's hands
  glowBlob(ctx, A.x, A.y, reach * 0.2 * flick, [
    [0, `rgba(255,255,235,${0.9 * env})`],
    [0.4, `rgba(255,200,80,${0.55 * env})`],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Sleep — drifting dream mist ─────────────────────────────────────────────

export function drawSpellSleep(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number): void {
  const center = pts[pts.length - 1]; if (!center) return;
  ctx.save();
  const data = AREA_SPELL_DATA['sleep'];
  const R = ftToWorld(data.aoeRadiusFt, gridSize);
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.22;
  const alpha = elapsed < APPEAR ? easeOutCubic(elapsed / APPEAR) : 1;

  // Soft dome (normal blend so it reads as haze, not light)
  glowBlob(ctx, center.x, center.y, R, [
    [0, `rgba(129,140,248,${0.16 * alpha})`],
    [0.7, `rgba(79,70,229,${0.1 * alpha})`],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.globalCompositeOperation = 'lighter';
  // Orbiting mist wisps
  for (let i = 0; i < 4; i++) {
    const a = tN * 0.22 * (i % 2 ? 1 : -0.8) + i * 1.9;
    const d = R * (0.35 + 0.18 * Math.sin(tN * 0.5 + i * 2.1));
    glowBlob(ctx, center.x + Math.cos(a) * d, center.y + Math.sin(a) * d, R * 0.42, [
      [0, `rgba(165,180,252,${0.11 * alpha})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }
  // Boundary — faint breathing ring
  const breathe = 0.8 + 0.2 * Math.sin(tN * 1.6);
  ctx.globalAlpha = 0.3 * alpha * breathe; ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth = 1.4 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, R, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.14 * alpha; ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 4 / sc;
  ctx.beginPath(); ctx.arc(center.x, center.y, R * (0.94 + 0.05 * breathe), 0, Math.PI * 2); ctx.stroke();
  // Twinkling dream-stars
  const rnd = mulberry32(seed);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.85, tw0 = rnd() * Math.PI * 2;
    const tw = Math.pow(Math.max(0, Math.sin(tN * 1.7 + tw0)), 8);
    if (tw < 0.02) continue;
    const px = center.x + Math.cos(a) * d, py = center.y + Math.sin(a) * d;
    const s = (2.5 + 2 * tw) / sc;
    ctx.globalAlpha = 0.85 * tw * alpha; ctx.strokeStyle = '#eef2ff'; ctx.lineWidth = 1 / sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px - s, py); ctx.lineTo(px + s, py);
    ctx.moveTo(px, py - s); ctx.lineTo(px, py + s); ctx.stroke();
  }
  // Rising Zzz glyphs
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let z = 0; z < 3; z++) {
    const ph = ((tN * 0.35 + z * 0.33) % 1);
    const zA = Math.sin(Math.PI * ph) * 0.8;
    const size = R * (0.14 + z * 0.05) * (0.7 + ph * 0.5);
    const px = center.x + Math.sin(tN * 0.8 + z * 2.6) * R * 0.12 + (z - 1) * R * 0.14;
    const py = center.y - R * (0.1 + ph * 0.55);
    ctx.save();
    ctx.translate(px, py); ctx.rotate(Math.sin(tN * 0.7 + z) * 0.16);
    ctx.font = `italic 700 ${size}px Georgia, serif`;
    ctx.globalAlpha = zA * alpha * 0.4; ctx.fillStyle = '#312e81'; ctx.fillText('z', size * 0.05, size * 0.05);
    ctx.globalAlpha = zA * alpha; ctx.fillStyle = '#e0e7ff'; ctx.fillText('z', 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ── Grease — dark iridescent slick ──────────────────────────────────────────

export function drawSpellGrease(ctx: CanvasRenderingContext2D, pts: Point[], elapsed: number, dur: number, sc: number, gridSize: number, seed: number): void {
  const center = pts[pts.length - 1]; if (!center) return;
  ctx.save();
  const data = AREA_SPELL_DATA['grease'];
  const R = ftToWorld(data.aoeRadiusFt, gridSize);
  const SQ = 0.58; // vertical squash — puddle in perspective
  const tN = performance.now() / 1000;
  const APPEAR = dur * 0.18;
  const spread = elapsed < APPEAR ? easeOutCubic(elapsed / APPEAR) : 1;
  const alpha = Math.min(1, spread * 1.4);
  const rnd = mulberry32(seed);

  // Irregular blob outline from seeded harmonics — drawn in unsquashed space and
  // scaled vertically, so the radial gradients match the puddle's perspective.
  const ph1 = rnd() * Math.PI * 2, ph2 = rnd() * Math.PI * 2, ph3 = rnd() * Math.PI * 2;
  const a1 = 0.1 + rnd() * 0.08, a2 = 0.05 + rnd() * 0.05, a3 = 0.03 + rnd() * 0.04;
  ctx.translate(center.x, center.y); ctx.scale(1, SQ);
  const blob = (rx: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const th = (i / 30) * Math.PI * 2;
      const w = 1 + a1 * Math.sin(3 * th + ph1) + a2 * Math.sin(5 * th + ph2) + a3 * Math.sin(8 * th + ph3);
      i === 0 ? ctx.moveTo(Math.cos(th) * rx * w, Math.sin(th) * rx * w) : ctx.lineTo(Math.cos(th) * rx * w, Math.sin(th) * rx * w);
    }
    ctx.closePath();
  };
  // Dark oily film — translucent, edge fading to nothing so the floor reads underneath
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.3 * spread);
  g.addColorStop(0, `rgba(24,20,10,${0.55 * alpha})`);
  g.addColorStop(0.55, `rgba(32,27,14,${0.48 * alpha})`);
  g.addColorStop(0.82, `rgba(24,19,10,${0.3 * alpha})`);
  g.addColorStop(1, 'rgba(18,14,8,0)');
  ctx.fillStyle = g; blob(R * spread); ctx.fill();
  // Splatter droplets
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2, d = R * (1.02 + rnd() * 0.28) * spread, s = R * (0.05 + rnd() * 0.07);
    ctx.globalAlpha = 0.4 * alpha; ctx.fillStyle = 'rgb(24,20,11)';
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, s, s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Iridescent sheen sliding across the surface
  ctx.globalCompositeOperation = 'lighter';
  const sheens: [string, number][] = [['110,220,150', 0.22], ['160,130,235', 0.18], ['225,205,130', 0.14]];
  sheens.forEach(([col, sa], i) => {
    const a = tN * (0.12 + i * 0.05) + i * 2.3;
    const d = R * 0.4;
    const sx = Math.cos(a) * d, sy = Math.sin(a) * d;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.55);
    sg.addColorStop(0, `rgba(${col},${sa * alpha})`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.save(); blob(R * spread); ctx.clip();
    ctx.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);
    ctx.restore();
  });
  // Wet specular rim along the top edge
  ctx.globalAlpha = 0.3 * alpha * (0.75 + 0.25 * Math.sin(tN * 1.1));
  ctx.strokeStyle = '#cfe3d8'; ctx.lineWidth = 3.5 / sc; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, R * 0.8 * spread, Math.PI * 1.12, Math.PI * 1.75); ctx.stroke();
  ctx.globalAlpha = 0.18 * alpha;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.85 * spread, Math.PI * 0.18, Math.PI * 0.6); ctx.stroke();
  // Glistening highlights
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.7, tw0 = rnd() * Math.PI * 2;
    const tw = Math.pow(Math.max(0, Math.sin(tN * 2.2 + tw0)), 10);
    if (tw < 0.03) continue;
    ctx.globalAlpha = 0.7 * tw * alpha; ctx.fillStyle = '#fff8d8';
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 3 / sc, 1.6 / sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }
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
    const seed = hash32(sp.id);
    if      (sp.type === 'fireball')         drawSpellFireball(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'lightning')        drawSpellLightning(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed, sp.id);
    else if (sp.type === 'magic_beam')       drawSpellMagicBeam(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'magic_missile')    drawSpellMagicMissile(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'hideous_laughter') drawSpellHideousLaughter(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'burning_hands')    drawSpellBurningHands(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'sleep')            drawSpellSleep(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'grease')           drawSpellGrease(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
  }
  if (alive.length !== rActiveSpells.current.length) {
    rActiveSpells.current = alive; setActiveSpells(alive);
    pruneSpellFx(new Set(alive.map(sp => sp.id)));
  }
  if (rSpellPreview?.current) renderSpellPreview(ctx, rSpellPreview.current, sc, gridSize);
}
