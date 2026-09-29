// Bola de foc — efecte en quatre temps, com als jocs:
//
//   1. CÀRREGA   cercle rúnic al conjurador, espurnes que s'hi arremolinen i una esfera
//                que creix fins que surt disparada amb un esclat.
//   2. VIATGE    projectil que accelera: nucli incandescent que gira, cua de foc que
//                queda ENRERE al món (no enganxada al cap), fum, espurnes i la llum que
//                projecta sobre el mapa.
//   3. IMPACTE   flaix, llum dinàmica que il·lumina tot el voltant, bola de foc que
//                s'infla i es refreda (blanc → groc → taronja → vermell), ona expansiva
//                amb anell de pols, terra que s'encén al pas de l'ona, runa encesa volant
//                i fum que s'alça i es queda. Sacsejada de càmera (`fireballShake`).
//   4. RESIDU    socarrim a terra (passada 'ground', sota els tokens) amb brases que es
//                refreden, i el fum que s'esvaeix.
//
// Tot són partícules DETERMINISTES: cada una és una funció pura de (llavor, temps), o
// sigui que no hi ha estat entre frames i totes les pantalles (DM i jugadors) veuen
// exactament la mateixa explosió. Els sprites (foc/fum amb soroll) venen de fxsprites.

import type { Point } from '@/types';
import { pathAt } from '@/lib/geometry';
import { mulberry32, glowSprite, fireSprite, smokeSprite, scorchSprite, blit } from './fxsprites';

const CHARGE = 0.32;               // s de càrrega abans de disparar
const TRAVEL = 0.7;                // s de vol
const IMPACT_AT = CHARGE + TRAVEL; // s en què esclata
export const FIREBALL_DUR = 4.6;
const BLAST_FT = 20;               // radi de la bola de foc de D&D

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
function smoothstep(t: number, a: number, b: number): number {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
}
/** Desplaçament amb fricció: arrenca a velocitat v i es frena (exp). */
const dragged = (v: number, k: number, age: number) => v * (1 - Math.exp(-k * age)) / k;

const WHITE: [number, number, number] = [255, 246, 225];
const AMBER: [number, number, number] = [255, 176, 80];
const ORANGE: [number, number, number] = [255, 112, 26];

/** Posició a la trajectòria (0..1) per a un temps donat: el projectil accelera. */
function pathT(e: number): number {
  const u = clamp01((e - CHARGE) / TRAVEL);
  return 0.25 * u + 0.75 * u * u;
}

function dirAt(pts: Point[], t: number): Point {
  const a = pathAt(pts, Math.max(0, t - 0.02)), b = pathAt(pts, Math.min(1, t + 0.02));
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/** Bufarada de foc amb temperatura contínua 0..3 (fosa entre dos sprites). */
function fire(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, temp: number, alpha: number, variant: number): void {
  if (alpha <= 0.004 || r <= 0) return;
  const t = Math.min(3, Math.max(0, temp)), i = Math.floor(t), f = t - i;
  ctx.globalAlpha = alpha * (1 - f);
  blit(ctx, fireSprite(i, variant), x, y, r, rot);
  if (f > 0.02 && i < 3) {
    ctx.globalAlpha = alpha * f;
    blit(ctx, fireSprite(i + 1, variant), x, y, r, rot);
  }
}

function glow(ctx: CanvasRenderingContext2D, rgb: [number, number, number], x: number, y: number, r: number, alpha: number): void {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = Math.min(1, alpha);
  blit(ctx, glowSprite(rgb), x, y, r);
}

function sizes(sc: number, gridSize: number) {
  const cell = gridSize > 0 ? gridSize : 48 / sc;
  return { cell, R: (BLAST_FT / 5) * cell, headR: cell * 0.42 };
}

// ── Passada 'ground': socarrim + brases (sota els tokens) ────────────────────

export function drawFireballGround(ctx: CanvasRenderingContext2D, pts: Point[], e: number, sc: number, gridSize: number, seed: number): void {
  const tau = e - IMPACT_AT;
  if (tau < 0 || pts.length === 0) return;
  const end = pts[pts.length - 1];
  const { cell, R } = sizes(sc, gridSize);
  const endFade = 1 - smoothstep(e, FIREBALL_DUR - 0.9, FIREBALL_DUR);
  ctx.save();
  ctx.globalAlpha = 0.72 * smoothstep(tau, 0.02, 0.18) * endFade;
  blit(ctx, scorchSprite(), end.x, end.y, R * 0.9, (seed % 628) / 100);

  // Brases que es refreden dins del cràter
  ctx.globalCompositeOperation = 'lighter';
  const rnd = mulberry32(seed ^ 0xb7a5e);
  const cool = Math.exp(-tau * 0.55) * endFade;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.72, ph = rnd() * TAU, sz = 0.05 + rnd() * 0.09;
    const pulse = 0.55 + 0.45 * Math.sin(tau * (3 + (i % 5)) + ph);
    const x = end.x + Math.cos(a) * d, y = end.y + Math.sin(a) * d;
    const al = cool * pulse * smoothstep(tau, 0.1, 0.4);
    glow(ctx, ORANGE, x, y, cell * sz * 2.4, 0.5 * al);
    glow(ctx, AMBER, x, y, cell * sz, 0.9 * al);
  }
  ctx.restore();
}

// ── Passada 'air': tot el que vola (sobre els tokens) ────────────────────────

export function drawSpellFireball(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length === 0) return;
  const { cell, R, headR } = sizes(sc, gridSize);
  const O = pts[0], end = pts[pts.length - 1];
  const headAt = (t: number) => pathAt(pts, pathT(t));
  const tau = e - IMPACT_AT;
  const endFade = 1 - smoothstep(e, FIREBALL_DUR - 0.9, FIREBALL_DUR);
  const px = 1 / sc;

  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ── Fum (blend normal, per sota del foc) ──
  // Fum de la cua
  {
    const rnd = mulberry32(seed ^ 0x51a0e);
    for (let i = 0; i < 26; i++) {
      const te = CHARGE + ((i + rnd()) / 26) * TRAVEL, life = 1.1 + rnd() * 0.7;
      const side = (rnd() - 0.5) * 2, v = rnd(), rot0 = rnd() * TAU;
      const age = e - te;
      if (age < 0 || age > life) continue;
      const lf = age / life, p = headAt(te), dir = dirAt(pts, pathT(te));
      const x = p.x - dir.y * side * headR * 0.6 - dir.x * dragged(cell * 0.8, 2, age);
      const y = p.y + dir.x * side * headR * 0.6 - dir.y * dragged(cell * 0.8, 2, age) - cell * 0.35 * age;
      ctx.globalAlpha = 0.34 * Math.sin(Math.PI * lf) * endFade;
      blit(ctx, smokeSprite(i % 3), x, y, cell * (0.28 + 0.55 * lf) * (0.8 + 0.4 * v), rot0 + age * 0.6);
    }
  }
  // Fum de l'explosió: s'infla, s'alça i es queda
  if (tau > 0) {
    const rnd = mulberry32(seed ^ 0x5d0ce);
    for (let i = 0; i < 28; i++) {
      const ts = 0.04 + rnd() * 0.4, a = rnd() * TAU, df = 0.15 + 0.75 * Math.sqrt(rnd());
      const rs = rnd(), spin = (rnd() - 0.5) * 0.8, rot0 = rnd() * TAU, life = 2.4 + rnd() * 1.4;
      const age = tau - ts;
      if (age < 0 || age > life) continue;
      const lf = age / life;
      const d = R * df * (1 - Math.exp(-2.6 * age));
      const x = end.x + Math.cos(a) * d, y = end.y + Math.sin(a) * d - cell * 0.55 * age;
      const r = R * (0.16 + 0.12 * rs) * (1 + 1.5 * (1 - Math.exp(-1.1 * age)));
      ctx.globalAlpha = 0.62 * smoothstep(age, 0, 0.3) * (1 - lf) ** 1.4 * endFade;
      blit(ctx, smokeSprite(i % 3), x, y, r, rot0 + spin * age);
    }
  }

  ctx.globalCompositeOperation = 'lighter';

  // ── Llum dinàmica sobre el mapa ──
  if (tau < 0 && e >= CHARGE * 0.3) {
    const p = headAt(e), fl = 0.85 + 0.15 * Math.sin(e * 37 + seed) * Math.sin(e * 23);
    glow(ctx, ORANGE, p.x, p.y, cell * 3.2, 0.3 * fl * smoothstep(e, CHARGE * 0.3, CHARGE));
  }
  if (tau >= 0) {
    const fl = 0.86 + 0.14 * Math.sin(tau * 31 + seed) * Math.sin(tau * 13.7);
    glow(ctx, ORANGE, end.x, end.y, R * 2.3, 0.8 * Math.exp(-tau * 1.5) * fl * endFade + 0.1 * endFade * Math.exp(-tau * 0.4));
    glow(ctx, AMBER, end.x, end.y, R * 1.3, 0.7 * Math.exp(-tau * 3));
  }

  // ── 1. Càrrega: cercle rúnic + espurnes que convergeixen ──
  if (e < IMPACT_AT) {
    const on = smoothstep(e, 0, 0.14) * (1 - smoothstep(e, CHARGE, CHARGE + 0.35));
    if (on > 0.01) {
      const cr = cell * 0.95 * (0.55 + 0.45 * easeOutCubic(clamp01(e / 0.22)));
      const rot = e * 2.4;
      glow(ctx, ORANGE, O.x, O.y, cr * 1.9, 0.45 * on);
      ctx.strokeStyle = 'rgb(255,150,60)';
      ctx.globalAlpha = 0.85 * on; ctx.lineWidth = 2 * px;
      ctx.beginPath(); ctx.arc(O.x, O.y, cr, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.6 * on; ctx.lineWidth = 1.2 * px;
      ctx.beginPath(); ctx.arc(O.x, O.y, cr * 0.8, 0, TAU); ctx.stroke();
      // Runes: traços curts entre els dos anells
      ctx.globalAlpha = 0.9 * on; ctx.lineWidth = 1.6 * px; ctx.strokeStyle = 'rgb(255,210,130)';
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = rot + (k / 16) * TAU, a2 = a + (k % 3 === 0 ? 0.16 : 0.07);
        const r1 = cr * 0.84, r2 = cr * (k % 2 ? 0.95 : 0.9);
        ctx.moveTo(O.x + Math.cos(a) * r1, O.y + Math.sin(a) * r1);
        ctx.lineTo(O.x + Math.cos(a2) * r2, O.y + Math.sin(a2) * r2);
      }
      ctx.stroke();
      // Hexagrama que gira al revés
      ctx.globalAlpha = 0.55 * on; ctx.lineWidth = 1.1 * px; ctx.strokeStyle = 'rgb(255,130,40)';
      for (let tri = 0; tri < 2; tri++) {
        ctx.beginPath();
        for (let k = 0; k <= 3; k++) {
          const a = -rot * 1.4 + tri * Math.PI / 3 + (k / 3) * TAU;
          const x = O.x + Math.cos(a) * cr * 0.78, y = O.y + Math.sin(a) * cr * 0.78;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // Espurnes que s'hi arremolinen
    const rnd = mulberry32(seed ^ 0xc4a26e);
    for (let i = 0; i < 18; i++) {
      const s0 = rnd() * CHARGE * 0.6, a0 = rnd() * TAU, d0 = cell * (1.2 + rnd() * 1.1);
      const k = clamp01((e - s0) / (CHARGE - s0 + 0.02));
      if (e < s0 || k >= 1) continue;
      const a = a0 + k * 3.2, d = d0 * (1 - easeOutCubic(k) * 0.97);
      glow(ctx, AMBER, O.x + Math.cos(a) * d, O.y + Math.sin(a) * d, cell * 0.14, Math.sin(Math.PI * k));
    }
    // Esclat de sortida
    const lk = (e - CHARGE) / 0.2;
    if (lk >= 0 && lk < 1) {
      glow(ctx, WHITE, O.x, O.y, cell * (0.8 + 1.2 * lk), (1 - lk) ** 2);
      ctx.globalAlpha = 0.7 * (1 - lk); ctx.strokeStyle = 'rgb(255,200,140)'; ctx.lineWidth = 3 * (1 - lk) * px;
      ctx.beginPath(); ctx.arc(O.x, O.y, cell * (0.5 + 1.6 * easeOutCubic(lk)), 0, TAU); ctx.stroke();
    }
  }

  // ── 2. Cua de foc que queda al món ──
  {
    const rnd = mulberry32(seed ^ 0x7a11);
    for (let i = 0; i < 90; i++) {
      const te = CHARGE + ((i + rnd()) / 90) * TRAVEL, life = 0.3 + rnd() * 0.32;
      const side = (rnd() - 0.5) * 2, spread = (rnd() - 0.5) * 2, rs = rnd(), rot0 = rnd() * TAU;
      const age = e - te;
      if (age < 0 || age > life) continue;
      const lf = age / life, p = headAt(te), dir = dirAt(pts, pathT(te));
      const lat = side * headR * 0.45 + dragged(spread * cell * 1.3, 4, age);
      const back = dragged(cell * 1.6, 4, age);
      const x = p.x - dir.y * lat - dir.x * back;
      const y = p.y + dir.x * lat - dir.y * back - cell * 0.5 * age;
      fire(ctx, x, y, headR * (0.8 + 0.55 * rs) * (1 - 0.5 * lf), rot0 + age * 3, 0.3 + lf * 2.9, (1 - lf) ** 1.2 * 0.9, i % 3);
    }
  }
  // Estela lluminosa (motion blur del cap)
  if (e >= CHARGE && tau < 0) {
    const u = (e - CHARGE) / TRAVEL, N = 16;
    let prev: Point | null = null;
    for (let k = 0; k <= N; k++) {
      const f = k / N, uu = u - 0.16 * (1 - f);
      if (uu < 0) { prev = null; continue; }
      const p = headAt(CHARGE + uu * TRAVEL);
      if (prev) {
        ctx.globalAlpha = 0.18 + 0.5 * f;
        ctx.strokeStyle = f > 0.7 ? 'rgb(255,226,150)' : f > 0.35 ? 'rgb(255,140,40)' : 'rgb(200,60,12)';
        ctx.lineWidth = headR * 1.5 * f;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      prev = p;
    }
  }
  // Espurnes que es desprenen del projectil
  {
    const rnd = mulberry32(seed ^ 0x5a4c5);
    for (let i = 0; i < 40; i++) {
      const te = CHARGE + ((i + rnd()) / 40) * TRAVEL, life = 0.3 + rnd() * 0.4;
      const side = (rnd() - 0.5) * 2, sp = cell * (2 + rnd() * 4), hot = rnd();
      const age = e - te;
      if (age < 0 || age > life) continue;
      const lf = age / life, p = headAt(te), dir = dirAt(pts, pathT(te));
      const at = (a: number) => {
        const lat = dragged(side * sp, 3, a), back = dragged(sp * 0.3, 3, a);
        return { x: p.x - dir.y * lat - dir.x * back, y: p.y + dir.x * lat - dir.y * back + cell * 0.6 * a * a };
      };
      const a = at(age), b = at(Math.max(0, age - 0.035));
      ctx.globalAlpha = (1 - lf) * 0.95;
      ctx.strokeStyle = hot > 0.5 ? 'rgb(255,236,170)' : 'rgb(255,160,60)';
      ctx.lineWidth = (1.1 + 1.2 * hot) * px;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
    }
  }

  // ── Cap del projectil (i esfera de càrrega) ──
  if (tau < 0) {
    const grow = e < CHARGE ? easeOutCubic(e / CHARGE) : 1;
    const p = headAt(e), dir = dirAt(pts, pathT(e));
    const hr = headR * grow * (0.94 + 0.06 * Math.sin(e * 41 + seed));
    glow(ctx, AMBER, p.x, p.y, hr * 2.8, 0.6);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + e * 9, off = hr * 0.32;
      const lag = (k % 3) * hr * 0.28 * (e > CHARGE ? 1 : 0);
      fire(ctx, p.x + Math.cos(a) * off - dir.x * lag, p.y + Math.sin(a) * off - dir.y * lag,
        hr * (0.85 + 0.2 * Math.sin(e * 23 + k * 1.7)), e * 7 + k, k % 2 ? 1.1 : 0.4, 0.85, k % 3);
    }
    glow(ctx, WHITE, p.x, p.y, hr * 1.15, 1);
    fire(ctx, p.x, p.y, hr * 0.7, -e * 11, 0, 1, 0);
  }

  // ── 3. Impacte ──
  if (tau >= 0) {
    // Flaix
    if (tau < 0.18) {
      const k = tau / 0.18;
      glow(ctx, WHITE, end.x, end.y, R * (0.5 + 0.8 * k), (1 - k) ** 2);
      glow(ctx, [255, 228, 170], end.x, end.y, R * 1.6, 0.8 * (1 - k));
    }
    // Nucli: el cor blanc que s'apaga
    glow(ctx, WHITE, end.x, end.y, R * 0.75, 0.95 * Math.exp(-tau * 4.5));

    // Ona expansiva: anell de pols (normal) + front brillant (additiu)
    if (tau < 0.55) {
      const k = tau / 0.55, rr = R * 1.06 * easeOutQuart(k), f = 1 - k;
      if (rr > 1e-3) {
        ctx.globalCompositeOperation = 'source-over';
        const g = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, rr);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.62, 'rgba(0,0,0,0)');
        g.addColorStop(0.86, `rgba(70,52,38,${0.32 * f})`);
        g.addColorStop(0.97, `rgba(110,84,60,${0.42 * f})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(end.x, end.y, rr, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.75 * f; ctx.strokeStyle = 'rgb(255,190,120)'; ctx.lineWidth = cell * 0.2 * f;
        ctx.beginPath(); ctx.arc(end.x, end.y, rr, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.9 * f; ctx.strokeStyle = 'rgb(255,250,235)'; ctx.lineWidth = 1.6 * px;
        ctx.beginPath(); ctx.arc(end.x, end.y, rr * 0.99, 0, TAU); ctx.stroke();
      }
    }

    // Terra que s'encén al pas de l'ona
    {
      const rnd = mulberry32(seed ^ 0x6f1a3);
      for (let i = 0; i < 38; i++) {
        const a = rnd() * TAU, rf = 0.3 + 0.66 * Math.sqrt(rnd()), life = 0.6 + rnd() * 1.5;
        const rs = rnd(), rot0 = rnd() * TAU;
        // Moment en què l'ona arriba a aquest radi (inversa d'easeOutQuart)
        const ts = 0.55 * (1 - Math.pow(Math.max(0, 1 - rf / 1.06), 0.25));
        const age = tau - ts;
        if (age < 0 || age > life) continue;
        const lf = age / life, flick = 0.8 + 0.2 * Math.sin(age * 24 + i);
        const x = end.x + Math.cos(a) * R * rf, y = end.y + Math.sin(a) * R * rf - cell * 0.5 * age;
        fire(ctx, x, y, cell * (0.3 + 0.35 * rs) * flick * (1 - 0.3 * lf), rot0 + age * 2, 0.9 + lf * 2.1,
          smoothstep(age, 0, 0.07) * (1 - lf) ** 1.3 * endFade, i % 3);
      }
    }

    // La bola de foc: s'infla des del centre i es refreda
    {
      const rnd = mulberry32(seed ^ 0xf12eba11);
      for (let i = 0; i < 50; i++) {
        const ts = rnd() * 0.1, a = rnd() * TAU, df = Math.sqrt(rnd()), rs = rnd();
        const rot0 = rnd() * TAU, spin = (rnd() - 0.5) * 3, life = 0.75 + rnd() * 0.95;
        const age = tau - ts;
        if (age < 0 || age > life) continue;
        const lf = age / life;
        const d = R * 0.72 * df * (1 - Math.exp(-5.5 * age));
        const x = end.x + Math.cos(a) * d, y = end.y + Math.sin(a) * d - cell * 0.4 * age;
        const r = R * (0.2 + 0.14 * rs) * (0.45 + 0.9 * (1 - Math.exp(-4 * age)));
        const temp = lf * 3.1 + df * 0.5 - 0.3;
        fire(ctx, x, y, r, rot0 + spin * age, temp, smoothstep(age, 0, 0.04) * (1 - lf) ** 1.1, i % 3);
      }
    }

    // Runa encesa i brases que surten disparades
    {
      const rnd = mulberry32(seed ^ 0xe3b3e5);
      for (let i = 0; i < 48; i++) {
        const a = rnd() * TAU, sp = R * (1.3 + 2.4 * rnd()), life = 0.55 + rnd() * 0.9;
        const w = rnd(), ts = rnd() * 0.06;
        const age = tau - ts;
        if (age < 0 || age > life) continue;
        const lf = age / life;
        const at = (t: number) => {
          const d = dragged(sp, 2.4, t);
          return { x: end.x + Math.cos(a) * d, y: end.y + Math.sin(a) * d + cell * 1.4 * t * t };
        };
        const p = at(age), q = at(Math.max(0, age - 0.045));
        ctx.globalAlpha = (1 - lf) * endFade;
        ctx.strokeStyle = lf < 0.35 ? 'rgb(255,240,190)' : lf < 0.7 ? 'rgb(255,168,60)' : 'rgb(230,80,20)';
        ctx.lineWidth = (1.2 + 2 * w) * (1 - 0.5 * lf) * px;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        if (i % 4 === 0) glow(ctx, ORANGE, p.x, p.y, cell * 0.22, 0.6 * (1 - lf) * endFade);
      }
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/**
 * Sacsejada de càmera (px de pantalla) de les bolas de foc que acaben d'esclatar.
 * El tick la suma a `ox/oy`, o sigui que es mou tot junt: fons, mapa i tokens.
 */
export function fireballShake(spells: readonly { type: string; startTime: number; id: string }[], now: number): Point {
  let x = 0, y = 0;
  for (const sp of spells) {
    if (sp.type !== 'fireball') continue;
    const tau = (now - sp.startTime) / 1000 - IMPACT_AT;
    if (tau < 0 || tau > 0.65) continue;
    const amp = 11 * (1 - tau / 0.65) ** 2;
    const s = sp.id.length + (sp.startTime % 7);
    x += amp * (0.6 * Math.sin(tau * 71 + s) + 0.4 * Math.sin(tau * 127 + s * 2));
    y += amp * (0.6 * Math.cos(tau * 83 + s) + 0.4 * Math.sin(tau * 113 + s * 3));
  }
  return { x, y };
}
