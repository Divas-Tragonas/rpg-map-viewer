// Raig màgic — un raig d'energia arcana sostingut, estil "beam" de videojoc:
//
//   1. CÀRREGA   l'energia convergeix a la mà (espurnes que hi cauen en espiral), una
//                esfera que batega i un destell anamòrfic horitzontal.
//   2. TRET      el raig s'estén en un instant amb una punta brillant i un retrocés de llum.
//   3. SOSTINGUT cos del raig en capes (halo violeta → magenta → nucli blanc) que vibra,
//                dues fibres en hèlix que hi giren al voltant, anells d'energia i polsos que
//                hi viatgen, i a l'impacte una estrella que gira, ones que s'expandeixen i
//                espurnes que esquitxen enrere. Tot il·lumina el mapa.
//   4. COL·LAPSE el raig s'aprima fins a desaparèixer i l'impacte implosiona amb un flaix.
//
// Determinista per (llavor, temps), com la resta d'efectes.

import type { Point } from '@/types';
import { pathAt, pathLen } from '@/lib/geometry';
import {
  mulberry32, glowSprite, blitStretch,
  TAU, clamp01, easeOutCubic, smoothstep, dragged, glow, fxCell, PAL, type RGB3,
} from './fxsprites';

export const MAGIC_BEAM_DUR = 3.2;
const CHARGE = 0.32;
const EXTEND = 0.12;
const COLLAPSE_AT = 2.65;
const COLLAPSE = 0.22;

const { white: WHITE, light: LILAC, mid: VIOLET, deep: DEEP } = PAL.arcane;

function dirAt(pts: Point[], t: number): Point {
  const a = pathAt(pts, Math.max(0, t - 0.01)), b = pathAt(pts, Math.min(1, t + 0.01));
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Point[], rgb: RGB3, width: number, alpha: number): void {
  if (alpha <= 0.004 || width <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

export function drawSpellMagicBeam(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  const cell = fxCell(sc, gridSize), px = 1 / sc;
  const O = pts[0];
  const L = pathLen(pts) || 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const d0 = dirAt(pts, 0), ang0 = Math.atan2(d0.y, d0.x);
  const endFade = 1 - smoothstep(e, MAGIC_BEAM_DUR - 0.35, MAGIC_BEAM_DUR);

  // ── 1. Càrrega ──
  if (e < CHARGE + 0.1) {
    const k = clamp01(e / CHARGE);
    const rnd = mulberry32(seed ^ 0x3a9c);
    for (let i = 0; i < 16; i++) {
      const s0 = rnd() * CHARGE * 0.55, a0 = rnd() * TAU, r0 = cell * (1 + rnd() * 1.2), spin = 2.5 + rnd() * 2;
      const q = clamp01((e - s0) / (CHARGE - s0));
      if (e < s0 || q >= 1) continue;
      const at = (qq: number) => {
        const a = a0 + qq * spin, r = r0 * (1 - easeOutCubic(qq) * 0.96);
        return { x: O.x + Math.cos(a) * r, y: O.y + Math.sin(a) * r };
      };
      const p = at(q), pp = at(Math.max(0, q - 0.08));
      ctx.globalAlpha = Math.sin(Math.PI * q);
      ctx.strokeStyle = 'rgb(225,190,255)'; ctx.lineWidth = 1.6 * px;
      ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    const pulse = 0.85 + 0.15 * Math.sin(e * 45);
    const on = 1 - smoothstep(e, CHARGE, CHARGE + 0.1);
    glow(ctx, VIOLET, O.x, O.y, cell * (0.4 + 1.1 * k) * pulse, 0.7 * on);
    glow(ctx, WHITE, O.x, O.y, cell * (0.12 + 0.3 * k) * pulse, on);
    // Destell anamòrfic (horitzontal a la pantalla, com una lent de càmera)
    ctx.globalAlpha = 0.7 * k * k * on;
    blitStretch(ctx, glowSprite(LILAC), O.x, O.y, cell * (0.8 + 2.4 * k), cell * 0.06 + 1.5 * px, 0);
  }

  if (e < CHARGE) { ctx.restore(); return; }

  // Extensió (0→1), amplada viva i col·lapse
  const ext = easeOutCubic(clamp01((e - CHARGE) / EXTEND));
  const col = clamp01((e - COLLAPSE_AT) / COLLAPSE);
  const alive = 1 - col;
  const buzz = 1 + 0.12 * Math.sin(e * 41 + seed) + 0.06 * Math.sin(e * 97);
  const w = cell * 0.26 * buzz * (1 - col * col) * (0.6 + 0.4 * ext);

  // Mostreig del raig fins on ha arribat
  const N = Math.max(12, Math.min(90, Math.round(L / (cell * 0.35))));
  const beam: Point[] = [];
  for (let i = 0; i <= N; i++) beam.push(pathAt(pts, (i / N) * ext));
  const tip = beam[beam.length - 1];

  if (alive > 0) {
    // ── Llum dinàmica al llarg del raig ──
    const lights = Math.max(2, Math.min(16, Math.round((L * ext) / (cell * 1.8))));
    for (let k = 0; k <= lights; k++) {
      const p = pathAt(pts, (k / lights) * ext);
      glow(ctx, DEEP, p.x, p.y, cell * 1.6, 0.14 * alive);
    }

    // ── Cos del raig en capes ──
    strokePath(ctx, beam, DEEP, w * 3.4, 0.22 * alive);
    strokePath(ctx, beam, VIOLET, w * 1.7, 0.5 * alive);
    strokePath(ctx, beam, LILAC, w * 0.75, 0.85 * alive);
    strokePath(ctx, beam, WHITE, Math.max(1.2 * px, w * 0.28), 1);

    // ── Fibres en hèlix (mostreig fi: ~12 punts per volta, si no surten en ziga-zaga) ──
    const wave = cell * 1.1;
    const NH = Math.max(16, Math.min(400, Math.round((L * ext) / (wave / 12))));
    const hel: { x: number; y: number; nx: number; ny: number; s: number }[] = [];
    for (let i = 0; i <= NH; i++) {
      const t = (i / NH) * ext, p = pathAt(pts, t), dd = dirAt(pts, t);
      hel.push({ x: p.x, y: p.y, nx: -dd.y, ny: dd.x, s: (t * L) / wave * TAU - e * 16 });
    }
    ctx.strokeStyle = 'rgb(240,210,255)';
    ctx.lineWidth = Math.max(1.1 * px, w * 0.14);
    for (let strand = 0; strand < 2; strand++) {
      const ph = strand * Math.PI;
      // Profunditat: el tram "del darrere" (cos < 0) es veu més tènue. Es traça en dues
      // passades (davant / darrere) per no fer un stroke per segment.
      for (const front of [false, true]) {
        ctx.globalAlpha = (front ? 0.85 : 0.3) * alive;
        ctx.beginPath();
        let pen = false;
        for (const h of hel) {
          const isFront = Math.cos(h.s + ph) >= 0;
          if (isFront !== front) { pen = false; continue; }
          const o = Math.sin(h.s + ph) * w * 1.05;
          if (!pen) { ctx.moveTo(h.x + h.nx * o, h.y + h.ny * o); pen = true; }
          else ctx.lineTo(h.x + h.nx * o, h.y + h.ny * o);
        }
        ctx.stroke();
      }
    }

    // ── Anells d'energia que viatgen cap a l'objectiu ──
    for (let r = 0; r < 5; r++) {
      const t = ((e * 0.9 + r / 5) % 1) * ext;
      const p = pathAt(pts, t), dd = dirAt(pts, t);
      const edge = Math.sin(Math.PI * clamp01(t / Math.max(0.01, ext)));
      ctx.globalAlpha = 0.6 * edge * alive;
      ctx.strokeStyle = 'rgb(225,190,255)'; ctx.lineWidth = Math.max(1 * px, w * 0.1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w * 0.28, w * 1.35, Math.atan2(dd.y, dd.x), 0, TAU);
      ctx.stroke();
    }
    // Polsos brillants
    for (let i = 0; i < 4; i++) {
      const t = ((e * 1.6 + i / 4 + (seed % 97) / 97) % 1) * ext;
      const p = pathAt(pts, t);
      glow(ctx, WHITE, p.x, p.y, w * 1.6, 0.7 * Math.sin(Math.PI * clamp01(t / Math.max(0.01, ext))) * alive);
    }
    // Espurnes que es desprenen del raig
    {
      const rnd = mulberry32(seed ^ 0xbea3);
      for (let i = 0; i < 40; i++) {
        const t = rnd(), side = rnd() < 0.5 ? -1 : 1, sp = cell * (0.8 + rnd() * 1.6), per = 0.35 + rnd() * 0.4, ph = rnd();
        if (t > ext) continue;
        const age = ((e + ph * per) % per), lf = age / per;
        const p = pathAt(pts, t), dd = dirAt(pts, t);
        const off = w * 0.6 + dragged(sp, 5, age);
        const x = p.x - dd.y * side * off + dd.x * cell * 0.6 * age, y = p.y + dd.x * side * off + dd.y * cell * 0.6 * age;
        ctx.globalAlpha = (1 - lf) * 0.8 * alive;
        ctx.fillStyle = 'rgb(235,210,255)';
        ctx.beginPath(); ctx.arc(x, y, 1.3 * px, 0, TAU); ctx.fill();
      }
    }

    // ── Boca del raig ──
    glow(ctx, VIOLET, O.x, O.y, w * 3.2, 0.6 * alive);
    glow(ctx, WHITE, O.x, O.y, w * 1.2, 0.9 * alive);
    const rk = (e - CHARGE) / 0.2;
    if (rk >= 0 && rk < 1) {
      glow(ctx, WHITE, O.x, O.y, cell * (0.6 + 1.2 * rk), (1 - rk) ** 2);
      ctx.globalAlpha = (1 - rk) * 0.9;
      blitStretch(ctx, glowSprite(LILAC), O.x, O.y, cell * (1.5 + 2 * rk), cell * 0.08, ang0 + Math.PI / 2);
    }
  }

  // ── Impacte / punta ──
  const hit = ext >= 0.999;
  if (alive > 0) {
    const flick = 0.85 + 0.15 * Math.sin(e * 53 + seed);
    glow(ctx, DEEP, tip.x, tip.y, cell * 2.6, 0.35 * alive * (hit ? 1 : 0.5));
    glow(ctx, VIOLET, tip.x, tip.y, w * 4.2 * flick, 0.75 * alive);
    glow(ctx, WHITE, tip.x, tip.y, w * 1.8 * flick, alive);
    if (hit) {
      // Estrella de raigs que gira
      for (let s = 0; s < 4; s++) {
        const a = e * 1.3 + (s * Math.PI) / 4 + (s % 2 ? 0 : Math.sin(e * 7) * 0.08);
        const len = w * (s % 2 ? 3.2 : 5.5) * flick;
        ctx.globalAlpha = (s % 2 ? 0.45 : 0.75) * alive;
        blitStretch(ctx, glowSprite(s % 2 ? LILAC : WHITE), tip.x, tip.y, len, w * 0.16 + 1 * px, a);
      }
      // Ones que s'expandeixen cada 0,28 s
      const hitAt = CHARGE + EXTEND;
      for (let k = 0; k < 3; k++) {
        const q = (((e - hitAt) / 0.28 + k / 3) % 1);
        if (e - hitAt < (k / 3) * 0.28) continue;
        ctx.globalAlpha = 0.55 * (1 - q) * alive;
        ctx.strokeStyle = 'rgb(200,150,255)'; ctx.lineWidth = Math.max(1 * px, w * 0.18 * (1 - q));
        ctx.beginPath(); ctx.arc(tip.x, tip.y, w * 1.2 + cell * 1.1 * easeOutCubic(q), 0, TAU); ctx.stroke();
      }
      // Esquitxos: espurnes que reboten enrere cap al conjurador
      const dE = dirAt(pts, 1), back = Math.atan2(-dE.y, -dE.x);
      const rnd = mulberry32(seed ^ 0x5e1a5);
      for (let i = 0; i < 30; i++) {
        const a = back + (rnd() - 0.5) * 2.6, sp = cell * (2.5 + rnd() * 4), per = 0.25 + rnd() * 0.35, ph = rnd();
        const age = (e - hitAt + ph * per) % per;
        const lf = age / per;
        const at = (t: number) => { const d = dragged(sp, 5, t); return { x: tip.x + Math.cos(a) * d, y: tip.y + Math.sin(a) * d + cell * 1.5 * t * t }; };
        const p = at(age), q = at(Math.max(0, age - 0.03));
        ctx.globalAlpha = (1 - lf) * 0.9 * alive;
        ctx.strokeStyle = i % 3 ? 'rgb(215,170,255)' : 'rgb(255,245,255)';
        ctx.lineWidth = (1 + (i % 3) * 0.5) * px;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    }
  }

  // ── 4. Implosió final a l'objectiu ──
  if (col > 0) {
    const k = clamp01((e - COLLAPSE_AT - COLLAPSE * 0.6) / 0.4);
    if (k > 0 && k < 1) {
      glow(ctx, WHITE, tip.x, tip.y, cell * (1.4 * (1 - k) + 0.2), (1 - k) * 1.1 * endFade);
      ctx.globalAlpha = (1 - k) * endFade;
      ctx.strokeStyle = 'rgb(220,180,255)'; ctx.lineWidth = 2 * (1 - k) * px;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, cell * 1.6 * easeOutCubic(k), 0, TAU); ctx.stroke();
    }
    const rnd = mulberry32(seed ^ 0x1f10);
    for (let i = 0; i < 18; i++) {
      const a = rnd() * TAU, sp = cell * (1 + rnd() * 2.5), life = 0.3 + rnd() * 0.3;
      const age = e - COLLAPSE_AT - COLLAPSE * 0.6;
      if (age < 0 || age > life) continue;
      const d = dragged(sp, 4, age), lf = age / life;
      glow(ctx, LILAC, tip.x + Math.cos(a) * d, tip.y + Math.sin(a) * d, cell * 0.12, (1 - lf) * endFade);
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
