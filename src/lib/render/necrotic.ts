// Raig necròtic — màgia de mort (Dit de la mort, Danyar, Marcir…). No crema ni esclata:
// PREN. Per això és l'únic efecte amb un nucli FOSC (blend normal) i l'únic on la llum
// viatja de l'objectiu cap al llançador.
//
//   1. APLEC    la foscor es condensa a la mà i s'empassa la llum del voltant (0,24 s).
//   2. RAIG     un fuet negre amb vora verd malalt surt disparat (0,12 s) i es queda
//               retorçant-se, amb fum que se'n desprèn.
//   3. MARCIR   a l'objectiu no hi ha explosió sinó implosió: anells que es tanquen, una
//               taca d'ombra, i espurnes de vida que en surten i viatgen raig amunt fins
//               al llançador, que s'encén en rebre-les.
//   4. CENDRA   el raig s'aprima i s'apaga; de l'objectiu en pugen volves de cendra.
//
// Partícules deterministes (llavor, temps), com tots els efectes.

import type { Point } from '@/types';
import {
  mulberry32, glowSprite, smokeSprite, blit, streak, impactBurst, PAL,
  TAU, clamp01, easeOutCubic, smoothstep, glow, fxUnit, rgb, type RGB3,
} from './fxsprites';

export const NECROTIC_RAY_DUR = 2.4;
const GATHER = 0.24, EXTEND = 0.12, HOLD = 1.15;
const HIT = GATHER + EXTEND;
const BLACK: RGB3 = [0, 0, 0], ASH: RGB3 = [58, 60, 58];
const SAMPLES = 40;

export function drawSpellNecroticRay(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  const P = PAL.necro, cell = fxUnit(sc, gridSize), px = 1 / sc;
  const A = pts[0], B = pts[pts.length - 1];
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const ph = (seed % 628) / 100;
  // El raig es retorça: dues ones que corren en sentits contraris, lligades als dos extrems.
  const amp = Math.min(cell * 0.16, len * 0.06);
  const at = (u: number): Point => {
    const env = Math.sin(Math.PI * u);
    const w = (Math.sin(u * 7 + e * 5 + ph) * amp + Math.sin(u * 17 - e * 9 + ph * 2) * amp * 0.4) * env;
    return { x: A.x + dx * u + nx * w, y: A.y + dy * u + ny * w };
  };
  const reach = easeOutCubic(clamp01((e - GATHER) / EXTEND));
  const beam = e < GATHER ? 0 : 1 - smoothstep(e, HOLD, HOLD + 0.4);
  const tau = e - HIT;
  const endFade = 1 - smoothstep(e, NECROTIC_RAY_DUR - 0.5, NECROTIC_RAY_DUR);
  // `strand` ≠ 0: un filament que s'enrosca al voltant del raig (tres voltes; ~13 mostres per volta).
  const trace = (to: number, strand = 0) => {
    ctx.beginPath();
    for (let i = 0; i <= SAMPLES; i++) {
      const u = to * i / SAMPLES, p = at(u);
      const o = strand ? Math.sin(u * TAU * 3 - e * 7 + strand) * cell * 0.24 * Math.sin(Math.PI * u) : 0;
      if (i === 0) ctx.moveTo(p.x + nx * o, p.y + ny * o); else ctx.lineTo(p.x + nx * o, p.y + ny * o);
    }
  };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ── Ombres (blend normal): la mà i l'objectiu s'enfosqueixen ──
  const gather = smoothstep(e, 0, GATHER) * (1 - smoothstep(e, HOLD, HOLD + 0.4));
  glow(ctx, BLACK, A.x, A.y, cell * 2.4, 0.9 * gather);
  if (tau >= 0) {
    const shade = smoothstep(tau, 0, 0.12) * (1 - smoothstep(tau, 0.9, 1.6));
    glow(ctx, BLACK, B.x, B.y, cell * (2.2 + 0.8 * smoothstep(tau, 0, 0.5)), shade);
    glow(ctx, BLACK, B.x, B.y, cell * 1.3, 0.8 * shade);
  }
  // Penombra sota el raig i fum fosc que se'n desprèn
  if (beam > 0.01 && reach > 0) {
    ctx.strokeStyle = '#000'; ctx.globalAlpha = 0.3 * beam; ctx.lineWidth = cell * 1.1;
    trace(reach); ctx.stroke();
  }
  if (beam > 0.01) {
    const rnd = mulberry32(seed ^ 0x5b0c);
    for (let i = 0; i < 18; i++) {
      const u = (i + rnd()) / 18, t0 = HIT + rnd() * 0.5, life = 0.6 + rnd() * 0.4, side = rnd() < 0.5 ? -1 : 1, rot = rnd() * TAU;
      const age = e - t0;
      if (age < 0 || age > life || u > reach) continue;
      const lf = age / life, p = at(u), off = side * cell * (0.1 + 0.45 * lf);
      ctx.globalAlpha = 0.6 * Math.sin(Math.PI * lf) * beam;
      blit(ctx, smokeSprite(i % 3), p.x + nx * off, p.y + ny * off - cell * 0.25 * age, cell * (0.3 + 0.4 * lf), rot + age);
    }
  }

  // ── Llum (additiva) ──
  ctx.globalCompositeOperation = 'lighter';

  // Aplec: espurnes pàl·lides xuclades cap a la mà
  if (e < GATHER + 0.1) {
    const k = clamp01(e / GATHER);
    const rnd = mulberry32(seed ^ 0x9a7);
    for (let i = 0; i < 12; i++) {
      const a = rnd() * TAU, d0 = cell * (0.9 + rnd() * 0.9), t0 = rnd() * 0.4;
      const kk = clamp01((k - t0) / (1 - t0));
      if (kk <= 0 || kk >= 1) continue;
      const pos = (t: number) => { const d = d0 * (1 - t * t), aa = a + t * 1.2; return { x: A.x + Math.cos(aa) * d, y: A.y + Math.sin(aa) * d }; };
      streak(ctx, pos(Math.max(0, kk - 0.2)), pos(kk), P.light, 1.4 * px, kk);
    }
    glow(ctx, P.mid, A.x, A.y, cell * (1.1 - 0.5 * k), 0.5 * k * (1 - smoothstep(e, GATHER, GATHER + 0.1)));
  }
  // Vora de la mà: un anell de llum malalta al voltant del forat
  glow(ctx, P.deep, A.x, A.y, cell * 1.4, 0.7 * gather);
  glow(ctx, P.light, A.x, A.y, cell * 0.34, 0.5 * gather);

  // El raig: halo ample i cos verd…
  if (beam > 0.01 && reach > 0) {
    const pulse = 0.85 + 0.15 * Math.sin(e * 29 + ph);
    const thin = 0.35 + 0.65 * beam;
    ctx.strokeStyle = rgb(P.deep); ctx.globalAlpha = 0.4 * beam; ctx.lineWidth = cell * 0.95;
    trace(reach); ctx.stroke();
    ctx.strokeStyle = rgb(P.mid); ctx.globalAlpha = 0.6 * beam; ctx.lineWidth = cell * 0.5 * pulse * thin;
    trace(reach); ctx.stroke();
    ctx.strokeStyle = rgb(P.light); ctx.globalAlpha = 0.7 * beam; ctx.lineWidth = cell * 0.32 * thin;
    trace(reach); ctx.stroke();
    // Dos filaments que s'hi enrosquen
    ctx.strokeStyle = rgb(P.light); ctx.globalAlpha = 0.5 * beam; ctx.lineWidth = Math.max(px, cell * 0.045);
    trace(reach, 1); ctx.stroke();
    trace(reach, 1 + Math.PI); ctx.stroke();
    // …i el nucli negre a sobre (blend normal): el que es veu és un buit amb la vora encesa
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#020403'; ctx.globalAlpha = 0.92 * Math.min(1, beam * 1.6); ctx.lineWidth = Math.max(px, cell * 0.2 * (0.35 + 0.65 * beam));
    trace(reach); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    // Cap del raig mentre s'estén
    if (reach < 1) { const tip = at(reach); glow(ctx, P.white, tip.x, tip.y, cell * 0.4, 0.9); }
  }

  // ── Impacte: implosió ──
  if (tau >= 0) {
    impactBurst(ctx, B.x, B.y, cell * 0.42, P, tau / 0.45, seed, px);
    // Tot el que envolta l'objectiu és xuclat cap endins: ratlles que hi convergeixen i un anell que es tanca
    {
      const rnd = mulberry32(seed ^ 0x1b9);
      for (let i = 0; i < 26; i++) {
        const a = rnd() * TAU, t0 = rnd() * 0.75, d0 = cell * (1.3 + rnd() * 0.9), life = 0.3 + rnd() * 0.15;
        const k = (tau - t0) / life;
        if (k <= 0 || k >= 1) continue;
        const pos = (t: number) => { const d = d0 * (1 - t * t) + cell * 0.2; return { x: B.x + Math.cos(a) * d, y: B.y + Math.sin(a) * d }; };
        streak(ctx, pos(Math.max(0, k - 0.3)), pos(k), i % 3 ? P.mid : P.light, Math.max(px, cell * 0.06), Math.sin(Math.PI * k));
      }
      const k = tau / 0.5;
      if (k < 1) {
        ctx.globalAlpha = 0.7 * Math.sin(Math.PI * k); ctx.strokeStyle = rgb(P.mid);
        ctx.lineWidth = cell * 0.2 * (0.7 + 0.5 * k);
        ctx.beginPath(); ctx.arc(B.x, B.y, cell * (1.8 - 1.5 * k * k), 0, TAU); ctx.stroke();
      }
    }
    const wither = smoothstep(tau, 0, 0.15) * (1 - smoothstep(tau, 0.8, 1.5));
    glow(ctx, P.deep, B.x, B.y, cell * 1.9, 0.7 * wither);
    glow(ctx, P.mid, B.x, B.y, cell * 0.8, 0.45 * wither * (0.7 + 0.3 * Math.sin(tau * 23)));

    // Espurnes de vida: surten de l'objectiu i viatgen raig amunt fins al llançador
    const rnd = mulberry32(seed ^ 0xd4a1);
    let absorbed = 0;
    for (let i = 0; i < 18; i++) {
      const t0 = 0.08 + (i + rnd()) / 18 * 0.75, life = 0.5 + rnd() * 0.25;
      const oa = rnd() * TAU, od = cell * (0.15 + 0.4 * rnd()), bend = (rnd() - 0.5) * Math.min(cell * 1.6, len * 0.35), big = rnd();
      const age = tau - t0;
      if (age > life) absorbed += Math.max(0, 1 - (age - life) / 0.25);
      if (age < 0 || age > life) continue;
      const S = { x: B.x + Math.cos(oa) * od, y: B.y + Math.sin(oa) * od };
      const pos = (t: number): Point => {
        const k = clamp01(t / life), v = k * k * (3 - 2 * k) * 0.35 + 0.65 * k * k * k;   // es desenganxa a poc a poc i accelera
        const side = Math.sin(Math.PI * v) * bend;
        return { x: S.x + (A.x - S.x) * v + nx * side, y: S.y + (A.y - S.y) * v + ny * side - cell * 0.35 * Math.sin(Math.PI * k) * (1 - v) };
      };
      const p = pos(age), q = pos(Math.max(0, age - 0.028)), al = smoothstep(age, 0, 0.08);
      streak(ctx, q, p, P.light, Math.max(px, cell * 0.09), 0.55 * al);
      glow(ctx, P.mid, p.x, p.y, cell * (0.45 + 0.2 * big), 0.5 * al);
      glow(ctx, P.light, p.x, p.y, cell * (0.24 + 0.1 * big), 0.8 * al);
      glow(ctx, P.white, p.x, p.y, cell * 0.12, al);
    }
    // El llançador s'encén amb cada espurna que rep
    if (absorbed > 0) {
      const a = Math.min(1, absorbed * 0.5);
      glow(ctx, P.mid, A.x, A.y, cell * 1.2, 0.4 * a);
      glow(ctx, P.white, A.x, A.y, cell * 0.3, 0.6 * a);
    }
  }

  // ── Cendra (blend normal, per sobre): volves que pugen de l'objectiu ──
  if (tau > 0.1) {
    ctx.globalCompositeOperation = 'source-over';
    const rnd = mulberry32(seed ^ 0xa54);
    for (let i = 0; i < 16; i++) {
      const t0 = 0.1 + rnd() * 0.8, life = 0.8 + rnd() * 0.5, ox = (rnd() - 0.5) * cell * 0.9, sway = rnd() * TAU, sz = 0.09 + rnd() * 0.08;
      const age = tau - t0;
      if (age < 0 || age > life) continue;
      const lf = age / life;
      ctx.globalAlpha = 0.85 * Math.sin(Math.PI * Math.sqrt(lf)) * endFade;
      blit(ctx, glowSprite(ASH), B.x + ox + Math.sin(age * 4 + sway) * cell * 0.12, B.y - cell * (0.1 + 1.1 * lf), cell * sz * 2);
    }
  }

  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
