// Conjurs dels grimoris dels personatges (veure `SPELLBOOKS` a constants): els trucs i
// conjurs de nivell 1 de Liriandor i Yunquerin que no tenien efecte propi.
//
// Mateix llenguatge que la resta (paletes `PAL`, `glow`/`streak`/`impactBurst`, partícules
// deterministes per llavor) però més petits encara que els spells menors: la majoria són
// trucs que es llancen cada torn i han de llegir-se en un segon i desaparèixer.
//
// Tots reben `pts = [origen, destí]`. Els personals (escut, detectar màgia) arriben amb
// origen = destí: el centre del token que els llança.

import type { Point } from '@/types';
import { AREA_SPELL_DATA } from '@/constants';
import {
  mulberry32, smokeSprite, blit, blitStretch, glowSprite, streak, impactBurst,
  TAU, clamp01, easeOutCubic, easeOutQuart, smoothstep, dragged, glow, fxCell, rgb, PAL,
  type RGB3,
} from './fxsprites';

const ftToWorld = (ft: number, cell: number) => (ft / 5) * cell;

/** Entrada i sortida suaus d'un efecte de durada `dur`. */
const fadeIO = (e: number, dur: number, fin: number, fout: number) =>
  smoothstep(e, 0, fin) * (1 - smoothstep(e, dur - fout, dur));

function begin(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
}
function end(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ── Raig de gebre — un raig blanc-blau que glaça on toca ─────────────────────

export const RAY_OF_FROST_DUR = 1.6;
const RF_CHARGE = 0.15, RF_EXTEND = 0.1, RF_HOLD = 0.75;

export function drawSpellRayOfFrost(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  const P = PAL.frost, cell = fxCell(sc, gridSize), px = 1 / sc;
  const [A, B] = pts;
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, ang = Math.atan2(dy, dx);
  const hitT = RF_CHARGE + RF_EXTEND;
  begin(ctx);

  // Càrrega a la mà
  const charge = smoothstep(e, 0, RF_CHARGE) * (1 - smoothstep(e, RF_HOLD, RF_HOLD + 0.25));
  glow(ctx, P.mid, A.x, A.y, cell * 0.9, 0.45 * charge);
  glow(ctx, P.white, A.x, A.y, cell * 0.25, charge);

  // El raig: s'estén de pressa i es manté vibrant; tres capes (halo, cos, nucli)
  const reach = easeOutCubic(clamp01((e - RF_CHARGE) / RF_EXTEND));
  const beam = e < RF_CHARGE ? 0 : 1 - smoothstep(e, RF_HOLD, RF_HOLD + 0.3);
  if (beam > 0.01) {
    const tip = { x: A.x + dx * reach, y: A.y + dy * reach };
    const flick = 0.85 + 0.15 * Math.sin(e * 47 + seed);
    ctx.lineCap = 'butt';
    streak(ctx, A, tip, P.deep, cell * 0.55, 0.22 * beam);
    streak(ctx, A, tip, P.mid, cell * 0.26 * flick, 0.55 * beam);
    streak(ctx, A, tip, P.white, Math.max(px, cell * 0.08), 0.95 * beam);
    ctx.lineCap = 'round';
    // Cristalls que brillen al llarg del raig
    const rnd = mulberry32(seed ^ 0xf05);
    for (let i = 0; i < 22; i++) {
      const u = rnd(), side = (rnd() - 0.5) * cell * 0.4, ph = rnd() * TAU;
      if (u > reach) continue;
      const tw = 0.5 + 0.5 * Math.sin(e * 20 + ph);
      glow(ctx, i % 3 ? P.light : P.white, A.x + dx * u + nx * side, A.y + dy * u + ny * side, cell * 0.12, tw * beam);
    }
    glow(ctx, P.light, tip.x, tip.y, cell * 0.6, 0.6 * beam);
  }

  // Impacte: esclat gelat, estelles de gel i una placa de gebre que es fon a poc a poc
  if (e >= hitT) {
    const tau = e - hitT;
    impactBurst(ctx, B.x, B.y, cell * 0.45, P, tau / 0.5, seed, px);
    const rnd = mulberry32(seed ^ 0x1ce);
    for (let i = 0; i < 9; i++) {
      const a = ang + Math.PI + (rnd() - 0.5) * 2.4, sp = cell * (2.5 + rnd() * 2);
      const age = tau - rnd() * 0.08, life = 0.45;
      if (age < 0 || age > life) continue;
      const at = (t: number) => { const d = dragged(sp, 6, t); return { x: B.x + Math.cos(a) * d, y: B.y + Math.sin(a) * d }; };
      streak(ctx, at(Math.max(0, age - 0.05)), at(age), P.white, Math.max(px, cell * 0.06), 1 - age / life);
    }
    const frost = smoothstep(tau, 0, 0.15) * (1 - smoothstep(e, RAY_OF_FROST_DUR - 0.5, RAY_OF_FROST_DUR));
    glow(ctx, P.mid, B.x, B.y, cell * 0.9, 0.3 * frost);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + seed;
      glow(ctx, P.light, B.x + Math.cos(a) * cell * 0.35, B.y + Math.sin(a) * cell * 0.35, cell * 0.22, 0.35 * frost);
    }
  }
  end(ctx);
}

// ── Toc electritzant — descàrrega curta de la mà a l'objectiu ────────────────

export const SHOCKING_GRASP_DUR = 1.1;

export function drawSpellShockingGrasp(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  const P = PAL.storm, cell = fxCell(sc, gridSize), px = 1 / sc;
  const [A, B0] = pts;
  // Un toc: si el destí és a sobre del llançador, l'arc surt cap a la vora del token
  const d0 = Math.hypot(B0.x - A.x, B0.y - A.y);
  const B = d0 < cell * 0.5 ? { x: A.x + cell * 0.8, y: A.y } : B0;
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const on = 1 - smoothstep(e, 0.45, 0.65);
  begin(ctx);

  if (on > 0.01) {
    // Arcs en ziga-zaga que canvien de forma 24 cops per segon
    const frame = Math.floor(e * 24);
    for (let k = 0; k < 3; k++) {
      const rnd = mulberry32((seed ^ (frame * 977 + k * 131)) >>> 0);
      const SEG = 7, path: Point[] = [A];
      for (let i = 1; i < SEG; i++) {
        const u = i / SEG, off = (rnd() - 0.5) * Math.min(len * 0.5, cell * 1.2) * Math.sin(Math.PI * u);
        path.push({ x: A.x + dx * u + nx * off, y: A.y + dy * u + ny * off });
      }
      path.push(B);
      const a = on * (k === 0 ? 1 : 0.5);
      for (const [c, w, al] of [[P.mid, cell * 0.22, 0.35], [P.light, cell * 0.08, 0.8], [P.white, Math.max(px, cell * 0.03), 1]] as [RGB3, number, number][]) {
        ctx.globalAlpha = al * a; ctx.strokeStyle = rgb(c); ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
      }
    }
    const fl = 0.7 + 0.3 * Math.sin(e * 90 + seed);
    glow(ctx, P.mid, A.x, A.y, cell * 0.8, 0.5 * on * fl);
    glow(ctx, P.white, A.x, A.y, cell * 0.22, on);
    glow(ctx, P.deep, B.x, B.y, cell * 1.6, 0.3 * on);
    glow(ctx, P.white, B.x, B.y, cell * 0.35, on * fl);
  }
  impactBurst(ctx, B.x, B.y, cell * 0.5, P, (e - 0.05) / 0.55, seed, px);
  // Espurnes que salten de l'objectiu
  const rnd = mulberry32(seed ^ 0x5a7c);
  for (let i = 0; i < 14; i++) {
    const t0 = 0.05 + rnd() * 0.5, a = rnd() * TAU, sp = cell * (2 + rnd() * 3), life = 0.3;
    const age = e - t0;
    if (age < 0 || age > life) continue;
    const at = (t: number) => { const d = dragged(sp, 5, t); return { x: B.x + Math.cos(a) * d, y: B.y + Math.sin(a) * d + cell * t * t * 2 }; };
    streak(ctx, at(Math.max(0, age - 0.03)), at(age), P.white, 1.5 * px, 1 - age / life);
  }
  end(ctx);
}

// ── Mà de mag — una mà espectral que sura al punt triat ──────────────────────

export const MAGE_HAND_DUR = 2.6;

function handPath(ctx: CanvasRenderingContext2D, s: number): void {
  // Palmell + quatre dits + polze, en coords locals (mida `s` ≈ alçada de la mà)
  ctx.beginPath();
  ctx.roundRect(-s * 0.26, -s * 0.05, s * 0.52, s * 0.5, s * 0.14);
  const fingers: [number, number, number][] = [[-0.19, -0.4, 0.33], [-0.065, -0.47, 0.4], [0.065, -0.45, 0.38], [0.19, -0.36, 0.3]];
  for (const [fx, fy, fl] of fingers) ctx.roundRect(s * fx - s * 0.055, s * fy, s * 0.11, s * fl + s * 0.1, s * 0.055);
  ctx.save();
  ctx.translate(-s * 0.25, s * 0.12); ctx.rotate(-0.75);
  ctx.roundRect(-s * 0.055, -s * 0.3, s * 0.11, s * 0.32, s * 0.055);
  ctx.restore();
}

export function drawSpellMageHand(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const P = PAL.arcane, cell = fxCell(sc, gridSize), px = 1 / sc;
  const a = fadeIO(e, MAGE_HAND_DUR, 0.35, 0.5);
  const bob = Math.sin(e * 3.2) * cell * 0.08;
  const appear = easeOutCubic(clamp01(e / 0.45));
  const s = cell * 0.95 * (0.7 + 0.3 * appear);
  begin(ctx);
  glow(ctx, P.deep, B.x, B.y, cell * 1.6, 0.3 * a);
  glow(ctx, P.mid, B.x, B.y + bob, cell * 0.9, 0.35 * a);
  ctx.save();
  ctx.translate(B.x, B.y + bob); ctx.rotate(Math.sin(e * 1.7) * 0.12);
  handPath(ctx, s);
  ctx.globalAlpha = 0.35 * a; ctx.fillStyle = rgb(P.mid); ctx.fill();
  ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = rgb(P.light); ctx.lineWidth = Math.max(px, cell * 0.04); ctx.stroke();
  ctx.restore();
  // Polsim arcà que cau dels dits
  const rnd = mulberry32(seed ^ 0x4a4d);
  for (let i = 0; i < 12; i++) {
    const per = 0.9 + rnd() * 0.6, ph = rnd(), ox = (rnd() - 0.5) * s * 0.5;
    const q = (e / per + ph) % 1;
    glow(ctx, P.light, B.x + ox, B.y + bob + s * 0.4 + q * cell * 0.8, cell * 0.08, Math.sin(Math.PI * q) * a);
  }
  end(ctx);
}

// ── Prestidigitació — un truc de saló: espurnes de colors que fan espiral ────

export const PRESTIDIGITATION_DUR = 1.9;
const CONFETTI: RGB3[] = [[255, 170, 230], [255, 225, 120], [150, 230, 255], [200, 170, 255], [255, 255, 255]];

export function drawSpellPrestidigitation(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const cell = fxCell(sc, gridSize), px = 1 / sc;
  begin(ctx);
  impactBurst(ctx, B.x, B.y, cell * 0.3, PAL.charm, e / 0.4, seed, px);
  const rnd = mulberry32(seed ^ 0x7e57);
  for (let i = 0; i < 30; i++) {
    const t0 = rnd() * 0.5, a0 = rnd() * TAU, life = 0.9 + rnd() * 0.5, c = CONFETTI[i % CONFETTI.length];
    const age = e - t0;
    if (age < 0 || age > life) continue;
    const lf = age / life, a = a0 + age * 5, r = cell * (0.15 + 0.55 * easeOutCubic(lf));
    const x = B.x + Math.cos(a) * r, y = B.y + Math.sin(a) * r * 0.6 - cell * 1.1 * lf;
    glow(ctx, c, x, y, cell * 0.13, Math.sin(Math.PI * lf) * (0.6 + 0.4 * Math.sin(age * 25 + i)));
  }
  end(ctx);
}

// ── Armadura de mag — un anell de runes que es tanca sobre l'objectiu ────────

export const MAGE_ARMOR_DUR = 2.1;

export function drawSpellMageArmor(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const P = PAL.dream, cell = fxCell(sc, gridSize), px = 1 / sc;
  const close = easeOutQuart(clamp01(e / 0.6));
  const r = cell * (1.1 - 0.5 * close);
  const a = fadeIO(e, MAGE_ARMOR_DUR, 0.15, 0.6);
  begin(ctx);
  // Anell de runes (marques) que gira mentre es tanca
  ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = rgb(P.light); ctx.lineWidth = Math.max(px, cell * 0.035);
  ctx.beginPath(); ctx.arc(B.x, B.y, r, 0, TAU); ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * TAU + e * 1.6;
    const x = B.x + Math.cos(ang) * r, y = B.y + Math.sin(ang) * r;
    ctx.globalAlpha = 0.9 * a;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * cell * 0.08, y - Math.sin(ang) * cell * 0.08);
    ctx.lineTo(x + Math.cos(ang) * cell * 0.08, y + Math.sin(ang) * cell * 0.08); ctx.stroke();
    glow(ctx, P.white, x, y, cell * 0.07, a);
  }
  // En tancar-se: una closca que brilla i s'esvaeix
  const shell = smoothstep(e, 0.45, 0.7) * (1 - smoothstep(e, 1.3, MAGE_ARMOR_DUR));
  glow(ctx, P.mid, B.x, B.y, cell * 0.9, 0.35 * shell);
  ctx.globalAlpha = 0.5 * shell; ctx.strokeStyle = rgb(P.white); ctx.lineWidth = Math.max(px, cell * 0.06);
  ctx.beginPath(); ctx.arc(B.x, B.y, cell * 0.6, 0, TAU); ctx.stroke();
  if (e > 0.55 && e < 0.9) glow(ctx, P.white, B.x, B.y, cell * 1.1, 0.5 * (1 - (e - 0.55) / 0.35));
  end(ctx);
}

// ── Escut — una barrera d'hexàgons que salta al voltant del llançador ────────

export const SHIELD_DUR = 1.9;

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = rot + (k / 6) * TAU;
    if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

export function drawSpellShield(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const A = pts[0]; if (!A) return;
  const P = PAL.arcane, cell = fxCell(sc, gridSize), px = 1 / sc;
  const R = cell * 0.62, N = 12;
  const out = 1 - smoothstep(e, SHIELD_DUR - 0.6, SHIELD_DUR);
  begin(ctx);
  if (e < 0.25) glow(ctx, P.white, A.x, A.y, cell * 1.4, 0.8 * (1 - e / 0.25));
  glow(ctx, P.mid, A.x, A.y, R * 1.3, 0.25 * smoothstep(e, 0, 0.2) * out);
  // Hexàgons que apareixen en cadena al voltant del token
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * TAU - Math.PI / 2;
    const t0 = 0.04 + i * 0.022, k = clamp01((e - t0) / 0.18);
    if (k <= 0) continue;
    const pop = 1 + 0.4 * Math.sin(Math.PI * k) * (k < 1 ? 1 : 0);
    const shimmer = 0.7 + 0.3 * Math.sin(e * 9 + i * 0.9);
    const hx = A.x + Math.cos(ang) * R, hy = A.y + Math.sin(ang) * R, hr = cell * 0.16 * pop;
    hexPath(ctx, hx, hy, hr, ang);
    ctx.globalAlpha = 0.2 * out * shimmer; ctx.fillStyle = rgb(P.mid); ctx.fill();
    ctx.globalAlpha = 0.9 * out; ctx.strokeStyle = rgb(P.light); ctx.lineWidth = Math.max(px, cell * 0.03); ctx.stroke();
  }
  // Ona del «cop» que l'escut atura
  impactBurst(ctx, A.x, A.y - R, cell * 0.3, P, (e - 0.3) / 0.45, seed, px);
  end(ctx);
}

// ── Detectar màgia — polsos que s'escampen fins a 30 ft ──────────────────────

export const DETECT_MAGIC_DUR = 2.8;

export function drawSpellDetectMagic(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const A = pts[0]; if (!A) return;
  const P = PAL.arcane, cell = fxCell(sc, gridSize), px = 1 / sc;
  const R = ftToWorld(AREA_SPELL_DATA.detect_magic.aoeRadiusFt, cell);
  const a = fadeIO(e, DETECT_MAGIC_DUR, 0.2, 0.7);
  begin(ctx);
  glow(ctx, P.deep, A.x, A.y, R, 0.12 * a);
  for (let p = 0; p < 3; p++) {
    const k = (e - 0.1 - p * 0.5) / 1.3;
    if (k < 0 || k > 1) continue;
    ctx.globalAlpha = 0.7 * (1 - k) * a; ctx.strokeStyle = rgb(P.light);
    ctx.lineWidth = Math.max(px, cell * 0.12 * (1 - k));
    ctx.beginPath(); ctx.arc(A.x, A.y, R * easeOutCubic(k), 0, TAU); ctx.stroke();
  }
  // Contorn de l'àrea, tènue
  ctx.globalAlpha = 0.35 * a; ctx.lineWidth = 1.5 * px; ctx.setLineDash([6 * px, 5 * px]);
  ctx.beginPath(); ctx.arc(A.x, A.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // Ull arcà sobre el llançador
  const eyeR = cell * 0.35, eyeY = A.y - cell * 0.65;
  ctx.globalAlpha = 0.9 * a; ctx.lineWidth = Math.max(px, cell * 0.05);
  ctx.beginPath();
  ctx.moveTo(A.x - eyeR, eyeY);
  ctx.quadraticCurveTo(A.x, eyeY - eyeR * 0.8, A.x + eyeR, eyeY);
  ctx.quadraticCurveTo(A.x, eyeY + eyeR * 0.8, A.x - eyeR, eyeY);
  ctx.stroke();
  glow(ctx, P.white, A.x, eyeY, cell * 0.16, a);
  // Brillantors d'aures que «apareixen» per l'àrea
  const rnd = mulberry32(seed ^ 0xde7);
  for (let i = 0; i < 18; i++) {
    const ang = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.95, t0 = 0.3 + rnd() * 1.6;
    const age = e - t0;
    if (age < 0 || age > 0.7) continue;
    glow(ctx, i % 2 ? P.light : P.white, A.x + Math.cos(ang) * d, A.y + Math.sin(ang) * d, cell * 0.14, Math.sin(Math.PI * age / 0.7) * a);
  }
  end(ctx);
}

// ── Llum — l'objecte tocat s'encén com una torxa (20 ft) ─────────────────────

export const LIGHT_DUR = 3.2;

export function drawSpellLight(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const P = PAL.radiant, cell = fxCell(sc, gridSize);
  const R = ftToWorld(AREA_SPELL_DATA.light.aoeRadiusFt, cell);
  const a = fadeIO(e, LIGHT_DUR, 0.5, 0.9);
  const fl = 0.92 + 0.08 * Math.sin(e * 13 + seed) * Math.sin(e * 7.3);
  begin(ctx);
  glow(ctx, P.deep, B.x, B.y, R * 1.1, 0.18 * a * fl);   // la bassa de llum
  glow(ctx, P.light, B.x, B.y, R * 0.55, 0.22 * a * fl);
  glow(ctx, P.mid, B.x, B.y, cell * 0.7, 0.6 * a);
  glow(ctx, P.white, B.x, B.y, cell * 0.25, a);
  if (e < 0.3) glow(ctx, P.white, B.x, B.y, cell * 1.4, 0.7 * (1 - e / 0.3));
  end(ctx);
}

// ── Flama sagrada — una columna de llum radiant cau sobre l'objectiu ─────────

export const SACRED_FLAME_DUR = 1.8;
const SF_FALL = 0.22;

export function drawSpellSacredFlame(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const P = PAL.radiant, cell = fxCell(sc, gridSize), px = 1 / sc;
  const top = B.y - cell * 5;
  begin(ctx);
  // El raig baixa del cel
  if (e < SF_FALL + 0.5) {
    const k = clamp01(e / SF_FALL), y = top + (B.y - top) * easeOutCubic(k);
    const fade = 1 - smoothstep(e, SF_FALL, SF_FALL + 0.5);
    ctx.lineCap = 'butt';
    streak(ctx, { x: B.x, y: top }, { x: B.x, y }, P.mid, cell * 0.7, 0.25 * fade);
    streak(ctx, { x: B.x, y: top }, { x: B.x, y }, P.light, cell * 0.3, 0.6 * fade);
    streak(ctx, { x: B.x, y: top }, { x: B.x, y }, P.white, Math.max(px, cell * 0.1), 0.95 * fade);
    ctx.lineCap = 'round';
  }
  // Flames radiants que pugen de l'objectiu
  if (e >= SF_FALL) {
    const tau = e - SF_FALL;
    impactBurst(ctx, B.x, B.y, cell * 0.55, P, tau / 0.5, seed, px);
    const on = 1 - smoothstep(e, SACRED_FLAME_DUR - 0.5, SACRED_FLAME_DUR);
    glow(ctx, P.mid, B.x, B.y - cell * 0.3, cell * 1.3, 0.35 * on);
    const rnd = mulberry32(seed ^ 0x5acf);
    for (let i = 0; i < 40; i++) {
      const t0 = rnd() * 1.0, life = 0.4 + rnd() * 0.3, ox = (rnd() - 0.5) * cell * 0.8, rs = rnd();
      const age = tau - t0;
      if (age < 0 || age > life) continue;
      const lf = age / life;
      const x = B.x + ox * (1 - lf * 0.6) + Math.sin(age * 15 + i) * cell * 0.05, y = B.y + cell * 0.25 - cell * 1.4 * lf;
      ctx.globalAlpha = Math.sin(Math.PI * lf) * 0.8 * on;
      blitStretch(ctx, glowSprite(lf < 0.4 ? P.white : P.light), x, y, cell * 0.12 * (0.7 + rs), cell * 0.28 * (0.7 + rs), Math.PI / 2);
    }
  }
  end(ctx);
}

// ── Taumatúrgia — el terra tremola i ressona una veu de tro ──────────────────

export const THAUMATURGY_DUR = 1.9;

export function drawSpellThaumaturgy(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const P = PAL.radiant, cell = fxCell(sc, gridSize), px = 1 / sc;
  const R = ftToWorld(AREA_SPELL_DATA.thaumaturgy.aoeRadiusFt, cell);
  const a = fadeIO(e, THAUMATURGY_DUR, 0.1, 0.6);
  ctx.save();
  // Pols que salta del terra (blend normal)
  const rnd = mulberry32(seed ^ 0x7a0);
  for (let i = 0; i < 12; i++) {
    const ang = rnd() * TAU, d = Math.sqrt(rnd()) * R * 1.3, t0 = rnd() * 0.6, life = 0.8 + rnd() * 0.4, rot = rnd() * TAU;
    const age = e - t0;
    if (age < 0 || age > life) continue;
    const lf = age / life;
    ctx.globalAlpha = 0.25 * Math.sin(Math.PI * lf);
    blit(ctx, smokeSprite(i % 3), B.x + Math.cos(ang) * d, B.y + Math.sin(ang) * d - cell * 0.3 * lf, cell * (0.25 + 0.3 * lf), rot);
  }
  ctx.globalCompositeOperation = 'lighter';
  // Tres ones de tremolor
  for (let p = 0; p < 3; p++) {
    const k = (e - p * 0.25) / 0.7;
    if (k < 0 || k > 1) continue;
    const jit = Math.sin(e * 60 + p) * cell * 0.02;
    ctx.globalAlpha = 0.7 * (1 - k) * a; ctx.strokeStyle = rgb(P.light);
    ctx.lineWidth = Math.max(px, cell * 0.1 * (1 - k));
    ctx.beginPath(); ctx.arc(B.x + jit, B.y, R * 1.6 * easeOutCubic(k), 0, TAU); ctx.stroke();
  }
  glow(ctx, P.mid, B.x, B.y, R * 1.2, 0.25 * a);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ── Beneir — un halo daurat i llum que cau en espiral sobre l'objectiu ───────

export const BLESS_DUR = 2.4;

export function drawSpellBless(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const P = PAL.radiant, cell = fxCell(sc, gridSize), px = 1 / sc;
  const a = fadeIO(e, BLESS_DUR, 0.25, 0.7);
  begin(ctx);
  // Halo sobre el cap
  const hy = B.y - cell * 0.5, hr = cell * 0.38 * easeOutCubic(clamp01(e / 0.4));
  ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = rgb(P.light); ctx.lineWidth = Math.max(px, cell * 0.06);
  ctx.beginPath(); ctx.ellipse(B.x, hy, hr, hr * 0.32, 0, 0, TAU); ctx.stroke();
  glow(ctx, P.white, B.x, hy, hr * 1.2, 0.35 * a);
  // Motes que baixen en espiral
  const rnd = mulberry32(seed ^ 0xb1e5);
  for (let i = 0; i < 22; i++) {
    const t0 = rnd() * 1.3, life = 0.8, a0 = rnd() * TAU;
    const age = e - t0;
    if (age < 0 || age > life) continue;
    const lf = age / life, r = cell * 0.7 * (1 - lf), ang = a0 + lf * 5;
    glow(ctx, i % 3 ? P.light : P.white, B.x + Math.cos(ang) * r, B.y - cell * 1.6 * (1 - lf) + Math.sin(ang) * r * 0.35, cell * 0.11, Math.sin(Math.PI * lf) * a);
  }
  // Batec de benedicció al token
  const pulse = 0.5 + 0.5 * Math.sin(e * 5);
  glow(ctx, P.mid, B.x, B.y, cell * (0.9 + 0.1 * pulse), 0.3 * a * smoothstep(e, 0.5, 0.9));
  end(ctx);
}

// ── Curar ferides — llum verda que puja i una creu que brilla ────────────────

export const CURE_WOUNDS_DUR = 2.2;

export function drawSpellCureWounds(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const B = pts[pts.length - 1]; if (!B) return;
  const P = PAL.life, cell = fxCell(sc, gridSize), px = 1 / sc;
  const a = fadeIO(e, CURE_WOUNDS_DUR, 0.15, 0.7);
  begin(ctx);
  impactBurst(ctx, B.x, B.y, cell * 0.4, P, e / 0.5, seed, px);
  glow(ctx, P.mid, B.x, B.y, cell * 1.1, 0.35 * a);
  // Motes que pugen
  const rnd = mulberry32(seed ^ 0xc0e);
  for (let i = 0; i < 28; i++) {
    const t0 = rnd() * 1.2, life = 0.8 + rnd() * 0.4, ox = (rnd() - 0.5) * cell * 1.1, ph = rnd() * TAU;
    const age = e - t0;
    if (age < 0 || age > life) continue;
    const lf = age / life;
    glow(ctx, i % 3 ? P.light : P.white, B.x + ox + Math.sin(age * 6 + ph) * cell * 0.08, B.y + cell * 0.4 - cell * 1.5 * lf,
      cell * 0.1, Math.sin(Math.PI * lf) * a);
  }
  // Creu que surt amb un rebot sobre el token
  const pop = easeOutCubic(clamp01((e - 0.1) / 0.35));
  const cs = cell * 0.32 * pop * (1 + 0.15 * Math.sin(Math.PI * clamp01((e - 0.1) / 0.35)));
  const cy = B.y - cell * 0.7 - cell * 0.15 * smoothstep(e, 0.4, CURE_WOUNDS_DUR);
  if (cs > 0) {
    ctx.lineCap = 'round';
    for (const [c, w, al] of [[P.mid, cs * 0.55, 0.5], [P.white, cs * 0.28, 1]] as [RGB3, number, number][]) {
      ctx.globalAlpha = al * a; ctx.strokeStyle = rgb(c); ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(B.x - cs, cy); ctx.lineTo(B.x + cs, cy); ctx.moveTo(B.x, cy - cs); ctx.lineTo(B.x, cy + cs); ctx.stroke();
    }
    glow(ctx, P.light, B.x, cy, cs * 2.2, 0.4 * a);
  }
  end(ctx);
}
