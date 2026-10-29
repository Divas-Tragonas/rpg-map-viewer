/**
 * Màgies a l'app Píxel: les mateixes màgies (mateixos gestos, durades i sincronització)
 * pintades amb els efectes del paquet Oryx (`uf_FX.png`, 24 px) en lloc dels procedurals.
 *
 * Una màgia és una combinació de tres peces: un **projectil** que viatja pel traç (una fila
 * del full, amb 8 orientacions), un **esclat** de 5 fotogrames a l'impacte (anell que creix)
 * i un **segell** opcional que es queda damunt de l'objectiu o del llançador (estrelles,
 * zetes, escut, creu…). Les àrees persistents (dormir, greix) continuen amb el seu efecte de
 * sempre: han de mostrar l'àrea de reglament.
 */
import type { Point } from '@/types';
import { blit } from '@/lib/sprites/draw';
import { AREA_SPELL_DATA } from '@/constants';

const FX = 24;
/** Columna del full per a cada orientació (angle de canvas: 0 = dreta, 90 = avall). */
const DIR_COLS: [number, number][] = [[0, 0], [45, 4], [90, 3], [135, 5], [180, 2], [-135, 6], [-90, 1], [-45, 7]];
function dirCol(angDeg: number): number {
  let best = 0, bd = Infinity;
  for (const [a, c] of DIR_COLS) {
    const d = Math.abs(((angDeg - a + 540) % 360) - 180);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Files de projectils i esclats (columna inicial, fila; 5 fotogrames en fila).
const PROJ = { fire: 8, ice: 9, stone: 10, arcane: 11, shadow: 12, poison: 13, spark: 14, meteor: 15 } as const;
const BURST = { grey: [0, 0], ice: [5, 0], fire: [0, 1], poison: [5, 1] } as const;
type Seal = { frames: [number, number][]; ms: number; scale?: number };
const SEAL: Record<string, Seal> = {
  stars:   { frames: [[0, 4], [1, 4]], ms: 140 },
  zzz:     { frames: [[2, 4]], ms: 400 },
  bang:    { frames: [[6, 4], [7, 4], [8, 4], [9, 4]], ms: 110 },
  shield:  { frames: [[1, 2]], ms: 400, scale: 2.2 },
  sparkle: { frames: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3]], ms: 90 },
  heal:    { frames: [[6, 3], [7, 3], [8, 3], [9, 3]], ms: 120, scale: 1.4 },
  arcane:  { frames: [[6, 2], [7, 2], [8, 2], [9, 2]], ms: 120, scale: 1.4 },
  zap:     { frames: [[0, 6], [1, 6], [2, 6], [3, 6]], ms: 70, scale: 1.4 },
  light:   { frames: [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], ms: 110, scale: 1.8 },
  target:  { frames: [[5, 5], [6, 5], [7, 5], [8, 5], [9, 5]], ms: 120, scale: 1.6 },
  drip:    { frames: [[4, 5], [5, 5]], ms: 200 },
};

interface PixelSpellDef {
  proj?: keyof typeof PROJ;
  /** Quants projectils (projectil màgic en tira tres). */
  count?: number;
  burst?: keyof typeof BURST;
  seal?: keyof typeof SEAL;
  /** El segell va al llançador (personals) en lloc del destí. */
  onCaster?: boolean;
  /** Ventall de projectils petits (mans ardents). */
  cone?: boolean;
}

const DEFS: Record<string, PixelSpellDef> = {
  fireball:         { proj: 'fire', burst: 'fire' },
  lightning:        { proj: 'spark', burst: 'ice', seal: 'zap' },
  magic_beam:       { proj: 'arcane', burst: 'grey', seal: 'arcane' },
  magic_missile:    { proj: 'arcane', count: 3, burst: 'grey' },
  hideous_laughter: { proj: 'arcane', seal: 'bang' },
  burning_hands:    { proj: 'fire', cone: true },
  ray_of_frost:     { proj: 'ice', burst: 'ice' },
  shocking_grasp:   { burst: 'ice', seal: 'zap' },
  mage_hand:        { proj: 'stone', seal: 'sparkle' },
  prestidigitation: { seal: 'sparkle' },
  mage_armor:       { seal: 'shield', onCaster: true },
  shield:           { seal: 'shield', onCaster: true },
  detect_magic:     { seal: 'target', onCaster: true },
  light:            { seal: 'light' },
  sacred_flame:     { burst: 'fire', seal: 'light' },
  thaumaturgy:      { burst: 'grey', seal: 'bang', onCaster: true },
  bless:            { seal: 'stars' },
  cure_wounds:      { burst: 'poison', seal: 'heal' },
  charm_person:     { proj: 'arcane', seal: 'arcane' },
};

export const hasPixelSpell = (type: string) => type in DEFS;

/** Punt i angle al llarg d'una polilínia, per fracció de longitud (0..1). */
function along(pts: Point[], f: number): { x: number; y: number; ang: number } {
  if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, ang: 0 };
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let want = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= seg || i === pts.length - 1) {
      const k = seg > 0 ? Math.min(1, want / seg) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, ang: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
    }
    want -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, ang: 0 };
}

const fx = (ctx: CanvasRenderingContext2D, col: number, row: number, cx: number, cy: number, size: number) =>
  blit(ctx, 'fx', col * FX, row * FX, FX, FX, cx - size / 2, cy - size / 2, size, size);

/**
 * Pinta una màgia en píxel. `e` = segons des de l'inici, `dur` = durada total de la màgia
 * (la mateixa que el procedural, així caduca igual a totes les pantalles).
 */
export function drawPixelSpell(ctx: CanvasRenderingContext2D, type: string, pts: Point[], e: number, dur: number, gridSize: number, seed: number) {
  const def = DEFS[type]; if (!def || pts.length === 0) return;
  const cell = gridSize > 0 ? gridSize : 48;
  const from = pts[0], to = pts[pts.length - 1];
  const dist = pts.length > 1 ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
  // El viatge dura segons la distància (ràpid, però que es vegi), mai més d'un terç.
  const travel = def.proj && dist > 0 ? Math.min(dur * 0.35, 0.18 + dist / (cell * 22)) : 0;
  const fade = Math.max(0, Math.min(1, (dur - e) / 0.35));
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (def.proj && e < travel) {
    const row = PROJ[def.proj];
    const n = def.count ?? 1;
    if (def.cone) {
      // Ventall: 7 flames que surten de la mà dins d'un con de 60°.
      const base = Math.atan2(to.y - from.y, to.x - from.x);
      for (let i = 0; i < 7; i++) {
        const a = base + (i - 3) * (Math.PI / 18) + Math.sin(seed + i) * 0.04;
        const k = Math.min(1, e / travel) * (0.75 + 0.25 * Math.sin(seed * 0.3 + i * 1.7) ** 2);
        const x = from.x + Math.cos(a) * dist * k, y = from.y + Math.sin(a) * dist * k;
        fx(ctx, dirCol(a * 180 / Math.PI), row, x, y, cell * (0.55 + 0.35 * k));
      }
    } else {
      for (let j = 0; j < n; j++) {
        const lag = j * 0.07;
        const f = Math.max(0, (e - lag) / Math.max(0.01, travel - lag * 0.5));
        if (f <= 0 || f > 1) continue;
        // Els de projectil màgic fan una corba lleu (cadascun cap al seu costat).
        const p = along(pts, f);
        const bend = n > 1 ? Math.sin(f * Math.PI) * cell * 0.9 * (j - (n - 1) / 2) : 0;
        const nx = -Math.sin(p.ang * Math.PI / 180), ny = Math.cos(p.ang * Math.PI / 180);
        const x = p.x + nx * bend, y = p.y + ny * bend;
        // Estela: dues còpies enrere, més transparents.
        for (let tIdx = 2; tIdx >= 0; tIdx--) {
          const q = along(pts, Math.max(0, f - tIdx * 0.05));
          ctx.globalAlpha = tIdx === 0 ? 1 : 0.35 / tIdx;
          fx(ctx, dirCol(p.ang), row, tIdx === 0 ? x : q.x + nx * bend, tIdx === 0 ? y : q.y + ny * bend, cell * 0.95);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  const t0 = travel;
  if (e >= t0) {
    const k = e - t0;
    const at = def.onCaster ? from : to;
    // Mida de l'esclat: l'àrea de reglament si en té (bola de foc 15 ft), si no una casella i mitja.
    const areaFt = type === 'fireball' ? 15 : (AREA_SPELL_DATA[type]?.aoeRadiusFt ?? 0);
    const radius = areaFt >= 5 ? (areaFt / 5) * cell : cell * 0.75;
    if (def.burst) {
      const [c0, r] = BURST[def.burst];
      const frame = Math.min(4, Math.floor(k / 0.07));
      if (k < 0.07 * 6) {
        ctx.globalAlpha = frame === 4 ? 0.6 : 1;
        fx(ctx, c0 + frame, r, at.x, at.y, radius * 2.1);
        ctx.globalAlpha = 1;
      }
    }
    if (def.seal) {
      const s = SEAL[def.seal];
      const fr = s.frames[Math.floor(k * 1000 / s.ms) % s.frames.length];
      const size = cell * (s.scale ?? 1);
      // El segell es queda flotant i s'esvaeix amb la màgia.
      ctx.globalAlpha = fade * Math.min(1, k / 0.12);
      const bob = Math.sin(k * 5) * cell * 0.06;
      const above = def.seal === 'shield' || def.seal === 'light' || def.seal === 'target' || def.seal === 'heal' || def.seal === 'arcane' || def.seal === 'zap';
      fx(ctx, fr[0], fr[1], at.x, at.y - (above ? 0 : cell * 0.75) + bob, size);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
