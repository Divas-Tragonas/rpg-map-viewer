/**
 * Màgies a l'app Píxel: les mateixes màgies (mateixos gestos, durades i sincronització)
 * pintades amb pixel art en lloc dels efectes procedurals.
 *
 * Una màgia combina peces (`DEFS`): un **projectil** del full Oryx (`uf_FX.png`, 8 orientacions)
 * que viatja pel traç; un **raig**, un **con** o una **línia** fets amb les animacions dels paquets
 * nous (`fx_anims.png`, veure `lib/sprites/fxanim.ts`); **animacions a l'impacte** (`fx`); i el
 * **segell** Oryx de sempre (estrelles, zetes, escut…). Tot és funció pura del temps i de la llavor:
 * totes les pantalles veuen el mateix. Les àrees persistents (dormir, greix) continuen amb el seu
 * efecte de sempre: han de mostrar l'àrea de reglament.
 */
import type { Point } from '@/types';
import { blit, tintedRegion } from '@/lib/sprites/draw';
import { AREA_SPELL_DATA } from '@/constants';
import { PAL, fxCell, FX_SIZE, type Palette } from './fxsprites';
import { animFrame, drawAnim, drawAnimAlong, FX_ANIMS, type FxAnimId } from '@/lib/sprites/fxanim';
import { sheet } from '@/lib/sprites/pack';
import { FIG_FOOT_DY, FIG_BODY_DY, FIG_HEAD_DY } from './token-geom';

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
/**
 * Esclats d'altres elements: l'esclat gris del full tenyit per lluminositat amb la paleta de
 * l'escola (`PAL`, la mateixa dels efectes procedurals), un sol cop per element.
 */
const BURST_TINT = { arcane: PAL.arcane, storm: PAL.storm, radiant: PAL.radiant, charm: PAL.charm, potion: PAL.potion } as const;
type BurstKind = keyof typeof BURST | keyof typeof BURST_TINT;
const ramp = (p: Palette) => [p.deep, p.mid, p.light, p.white];
const tintedBurst = (kind: keyof typeof BURST_TINT) => tintedRegion('fx', 0, 0, FX * 5, FX, ramp(BURST_TINT[kind]));
type Seal = { frames: [number, number][]; ms: number; scale?: number; /** Tenyit amb aquesta paleta. */ tint?: Palette };
const SEAL: Record<string, Seal> = {
  stars:   { frames: [[0, 4], [1, 4]], ms: 140 },
  zzz:     { frames: [[2, 4]], ms: 400 },
  bang:    { frames: [[6, 4], [7, 4], [8, 4], [9, 4]], ms: 110 },
  shield:  { frames: [[1, 2]], ms: 400, scale: 2.2 },
  sparkle: { frames: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3]], ms: 90 },
  heal:    { frames: [[6, 3], [7, 3], [8, 3], [9, 3]], ms: 120, scale: 1.4, tint: PAL.potion },  // vermell de poció
  arcane:  { frames: [[6, 2], [7, 2], [8, 2], [9, 2]], ms: 120, scale: 1.4 },
  zap:     { frames: [[0, 6], [1, 6], [2, 6], [3, 6]], ms: 70, scale: 1.4 },
  light:   { frames: [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], ms: 110, scale: 1.8 },
  target:  { frames: [[5, 5], [6, 5], [7, 5], [8, 5], [9, 5]], ms: 120, scale: 1.6 },
  drip:    { frames: [[4, 5], [5, 5]], ms: 200 },
};

/**
 * Animació dels paquets nous (`fx_anims.png`, veure `lib/sprites/fxanim.ts`) en un punt de la màgia.
 *  - `at`: al destí (per defecte) o al llançador.
 *  - Mida: `k` × el píxel de la figureta. Ampliades fins a l'àrea de reglament quedaven massa gruixudes
 *    (un píxel d'art de 7 px de pantalla): les àrees es fan amb una gran al mig i `scatter` fins a la vora.
 *  - `delay` (s des de l'impacte) i `hold`: les de bucle es mantenen fins que la màgia s'esvaeix.
 *  - `scatter`: N còpies repartides per l'àrea (o al voltant del punt), desfasades per llavor.
 */
interface AnimFx {
  anim: FxAnimId;
  at?: 'target' | 'caster';
  k?: number;
  anchor?: 'center' | 'foot';
  /** Centrada al terra (esclats d'àrea vistos de dalt) en lloc del cos de la figureta. */
  ground?: boolean;
  tint?: Palette;
  bright?: boolean;
  delay?: number;
  hold?: boolean;
  scatter?: number;
  alpha?: number;
}

interface PixelSpellDef {
  proj?: keyof typeof PROJ;
  /** Quants projectils (projectil màgic en tira tres). */
  count?: number;
  /** Esclat antic del full Oryx (només els que no tenen animació nova). */
  burst?: BurstKind;
  seal?: keyof typeof SEAL;
  /** El segell va al llançador (personals) en lloc del destí. */
  onCaster?: boolean;
  /** Con (mans ardents, alès): esclats que avancen des de la mà fins a la punta. */
  cone?: { anims: FxAnimId[]; k: number; tint?: Palette };
  /** Línia (alè d'àcid): esclats seguits del llançador al destí. */
  line?: { anim: FxAnimId; k: number };
  /** Raig (llamp, raig màgic): animació enrajolada del llançador al destí mentre dura. */
  beam?: { anim: FxAnimId; k: number; tint?: Palette };
  /** Animacions a l'impacte (després del viatge del projectil). */
  fx?: AnimFx[];
}

const DEFS: Record<string, PixelSpellDef> = {
  fireball:         { proj: 'fire', fx: [
    // El gran al mig a 2,5 píxels de figura (ampliat fins a l'àrea quedava massa gruixut) i els petits
    // repartits fins a la vora de l'àrea de reglament.
    { anim: 'fire_explosion', k: 2.5, ground: true },
    { anim: 'fire_burst', scatter: 8, k: 2, delay: 0.1 },
    { anim: 'burning_ground', scatter: 7, k: 1.4, anchor: 'foot', delay: 0.55, hold: true },
  ] },
  lightning:        { beam: { anim: 'chain_arc', k: 1.1 }, fx: [
    { anim: 'thunder_burst', k: 1.3 },
    { anim: 'bolt_blue', k: 1.6, delay: 0.25 },
    { anim: 'zap_yellow', at: 'caster', k: 1.4 },
  ] },
  magic_beam:       { beam: { anim: 'chain_arc', k: 1.1, tint: PAL.arcane }, seal: 'arcane', fx: [
    { anim: 'impact_star', k: 1.3, tint: PAL.arcane },
    { anim: 'impact_star', k: 1.0, tint: PAL.arcane, bright: true, delay: 0.5 },
  ] },
  magic_missile:    { proj: 'arcane', count: 3, fx: [
    { anim: 'impact_star', k: 1.1, tint: PAL.arcane },
    { anim: 'impact_star', k: 0.9, tint: PAL.arcane, bright: true, delay: 0.07, scatter: 2 },
  ] },
  hideous_laughter: { proj: 'arcane', seal: 'bang', fx: [
    { anim: 'impact_star', k: 1.1, tint: PAL.charm },
  ] },
  burning_hands:    { cone: { anims: ['fire_burst'], k: 1.1 } },
  ray_of_frost:     { proj: 'ice', fx: [
    { anim: 'ice_burst', k: 0.8 },
    { anim: 'ice_spikes', k: 1.3, anchor: 'foot', delay: 0.05 },
  ] },
  shocking_grasp:   { fx: [{ anim: 'spark_orb', k: 1.5 }, { anim: 'crackle', k: 1.3, delay: 0.2, hold: true }] },
  mage_hand:        { proj: 'stone', seal: 'sparkle' },
  prestidigitation: { fx: [{ anim: 'spark_fountain', k: 1.6, anchor: 'foot', hold: true }] },
  mage_armor:       { seal: 'shield', onCaster: true, fx: [{ anim: 'impact_star', at: 'caster', k: 1.3, tint: PAL.arcane }] },
  shield:           { seal: 'shield', onCaster: true, fx: [{ anim: 'impact_star', at: 'caster', k: 1.3, tint: PAL.arcane }] },
  detect_magic:     { seal: 'target', onCaster: true },
  light:            { seal: 'light' },
  sacred_flame:     { fx: [{ anim: 'sky_strike', k: 0.9, anchor: 'foot', tint: PAL.radiant, bright: true }] },
  thaumaturgy:      { seal: 'bang', onCaster: true, fx: [{ anim: 'dust_cloud', at: 'caster', k: 2.2 }] },
  bless:            { seal: 'stars', fx: [{ anim: 'spark_fountain', k: 1.6, anchor: 'foot', tint: PAL.radiant, bright: true, hold: true }] },
  cure_wounds:      { fx: [{ anim: 'heal_rise', k: 1.8, tint: PAL.potion, bright: true }] },
  charm_person:     { proj: 'arcane', fx: [
    { anim: 'impact_star', k: 1.1, tint: PAL.charm },
    { anim: 'status_charmed', k: 1.4, delay: 0.1, hold: true },
  ] },
  // Efectes de les criatures (v5 snapshot 9; animacions noves a la v5 snapshot 10).
  breath_fire:      { cone: { anims: ['fire_burst'], k: 1.35 } },
  breath_cold:      { cone: { anims: ['ice_burst', 'snow_swirl'], k: 0.75 } },
  breath_poison:    { cone: { anims: ['poison_puff'], k: 1.5 } },
  breath_acid:      { line: { anim: 'acid_splash', k: 1.4 } },
  fire_bolt:        { proj: 'fire', fx: [{ anim: 'fire_dome', k: 0.9, anchor: 'foot' }] },
  necrotic_ray:     { proj: 'shadow', fx: [{ anim: 'dark_bolt', k: 1.0, anchor: 'foot' }] },
  eye_ray:          { proj: 'arcane', seal: 'target', fx: [{ anim: 'impact_star', k: 1.2, tint: PAL.arcane }] },
  hold:             { proj: 'arcane', seal: 'target', fx: [
    { anim: 'impact_star', k: 1.1, tint: PAL.charm },
    { anim: 'crackle', k: 1.3, tint: PAL.charm, bright: true, delay: 0.15, hold: true },
  ] },
  dread:            { seal: 'bang', onCaster: true, fx: [{ anim: 'dark_bolt', at: 'caster', k: 1.3, anchor: 'foot' }] },
  cloud:            { fx: [
    // Com la bola de foc: un núvol gran al mig i bocins repartits per l'àrea (ampliat fins a l'àrea
    // quedava massa gruixut i tapava les figuretes).
    { anim: 'poison_cloud', k: 1.6, ground: true, hold: true, alpha: 0.7 },
    { anim: 'poison_puff', scatter: 9, k: 1.6, delay: 0.15, hold: true, alpha: 0.7 },
  ] },
  vanish:           { onCaster: true, fx: [{ anim: 'whirlwind', at: 'caster', k: 1.5, anchor: 'foot' }] },
  thunder:          { onCaster: true, fx: [
    { anim: 'thunder_burst', at: 'caster', k: 2.2, ground: true },
    { anim: 'crackle', at: 'caster', scatter: 6, k: 1.4, delay: 0.1 },
    { anim: 'bolt_blue', at: 'caster', k: 1.8, delay: 0.1 },
  ] },
  entangle:         { fx: [
    { anim: 'nature_impact', k: 1.8 },
    { anim: 'vines', scatter: 6, k: 1.1, anchor: 'foot', delay: 0.15, hold: true },
  ] },
  radiant_bolt:     { proj: 'arcane', fx: [{ anim: 'sky_strike', k: 0.9, anchor: 'foot', tint: PAL.radiant, bright: true }] },
  acid_arrow:       { proj: 'poison', fx: [
    { anim: 'acid_splash', k: 1.4, anchor: 'foot' },
    { anim: 'acid_puddle', k: 1.4, anchor: 'foot', delay: 0.4, hold: true },
  ] },
};

/** Esclats del full Oryx que es fan servir si el full d'animacions noves no s'ha pogut carregar. */
const LEGACY_BURST: Record<string, BurstKind> = {
  fireball: 'fire', lightning: 'storm', magic_beam: 'arcane', magic_missile: 'arcane', hideous_laughter: 'charm',
  ray_of_frost: 'ice', shocking_grasp: 'storm', sacred_flame: 'radiant', thaumaturgy: 'grey', cure_wounds: 'potion',
  charm_person: 'charm', breath_fire: 'fire', breath_cold: 'ice', breath_poison: 'poison', breath_acid: 'poison',
  fire_bolt: 'fire', necrotic_ray: 'grey', eye_ray: 'arcane', hold: 'charm', dread: 'charm', cloud: 'poison',
  thunder: 'storm', entangle: 'grey', radiant_bolt: 'radiant', acid_arrow: 'poison',
};

/** Atzar determinista (0..1) per llavor i índexs: la mateixa disposició a totes les pantalles. */
function rnd(seed: number, i: number, j = 0): number {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(i + 1, 668265263) + Math.imul(j + 7, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Els peus i el cos d'una figureta respecte del centre de la casella, en caselles: surten de la
 * geometria dels tokens (`render/token-geom.ts`), perquè els efectes quedin on és la figura.
 */
const FOOT_DY = FIG_FOOT_DY, BODY_DY = FIG_BODY_DY;

function drawAnimFx(ctx: CanvasRenderingContext2D, f: AnimFx, at: Point, from: Point, to: Point, k: number,
  fade: number, P: number, radius: number, grid: number, seed: number) {
  const t = k - (f.delay ?? 0);
  if (t < 0) return;
  const a = FX_ANIMS[f.anim];
  const base = f.at === 'caster' ? from : f.at === 'target' ? to : at;
  const px = P * (f.k ?? 1);
  const foot = f.anchor === 'foot';
  const n = f.scatter ?? 1;
  const spread = (radius > grid * 0.9 ? radius * 0.8 : grid * 0.55);
  for (let i = 0; i < n; i++) {
    let x = base.x, y = base.y;
    if (f.scatter) {
      const ang = rnd(seed, i, 1) * Math.PI * 2, r = Math.sqrt(rnd(seed, i, 2)) * spread;
      x += Math.cos(ang) * r; y += Math.sin(ang) * r * 0.75;
    } else if (foot) y += grid * FOOT_DY;
    else if (!f.ground) y += grid * BODY_DY;
    // Les còpies es desfasen: les d'un cop surten una mica després; les de bucle, en un altre fotograma.
    const ti = t * 1000 - (a.loop ? -i * 137 : i * 45);
    const frame = f.hold && a.loop ? animFrame(f.anim, ti, true) : animFrame(f.anim, ti, false);
    if (frame < 0) continue;
    ctx.globalAlpha = (f.alpha ?? 1) * (f.hold ? fade * Math.min(1, t / 0.15) : 1);
    drawAnim(ctx, f.anim, frame, x, y, px, { anchor: f.anchor, tint: f.tint, bright: f.bright, flip: rnd(seed, i, 3) < 0.5 });
  }
  ctx.globalAlpha = 1;
}

/**
 * Con (5e: tan ample com llarg a la punta): files d'esclats des de la mà fins a la punta. Cada esclat
 * surt quan hi arriba l'onada (0,35 s fins a la punta); els de bucle (fum, neu) duren fins al final.
 */
function drawCone(ctx: CanvasRenderingContext2D, c: NonNullable<PixelSpellDef['cone']>, from: Point, to: Point, dist: number,
  e: number, dur: number, P: number, seed: number) {
  if (dist <= 0) return;
  const base = Math.atan2(to.y - from.y, to.x - from.x);
  const ux = Math.cos(base), uy = Math.sin(base), nx = -uy, ny = ux;
  const step = Math.max(P * 14, dist / 7);
  const fade = Math.max(0, Math.min(1, (dur - e) / 0.4));
  let idx = 0;
  for (let d = step * 0.6; d <= dist + 1; d += step) {
    const width = d;  // amplada del con a aquesta distància
    const count = Math.max(1, Math.round(width / (step * 1.4)));
    for (let j = 0; j < count; j++, idx++) {
      const off = (count === 1 ? 0 : (j / (count - 1) - 0.5)) * width * 0.85 + (rnd(seed, idx, 4) - 0.5) * step * 0.5;
      const dd = d + (rnd(seed, idx, 5) - 0.5) * step * 0.5;
      const x = from.x + ux * dd + nx * off, y = from.y + uy * dd + ny * off;
      const anim = c.anims[idx % c.anims.length];
      const a = FX_ANIMS[anim];
      const t0 = 0.04 + (dd / dist) * 0.35 + rnd(seed, idx, 6) * 0.06;
      const ms = (e - t0) * 1000;
      const frame = a.loop ? (e < t0 ? -1 : animFrame(anim, ms, true)) : animFrame(anim, ms, false);
      if (frame < 0) continue;
      ctx.globalAlpha = a.loop ? 0.8 * fade * Math.min(1, ms / 150) : 1;
      // Més grossos cap a la punta, com s'obre el con.
      drawAnim(ctx, anim, frame, x, y, P * c.k * (0.7 + 0.5 * dd / dist), { tint: c.tint, flip: rnd(seed, idx, 7) < 0.5 });
    }
  }
  ctx.globalAlpha = 1;
}

/** Línia (alè d'àcid): esclats seguits del llançador al destí, en ordre. */
function drawLine(ctx: CanvasRenderingContext2D, l: NonNullable<PixelSpellDef['line']>, from: Point, to: Point, dist: number,
  e: number, P: number, grid: number, seed: number) {
  if (dist <= 0) return;
  const ux = (to.x - from.x) / dist, uy = (to.y - from.y) / dist;
  const step = grid * 0.55;
  for (let i = 0, d = step * 0.5; d <= dist; i++, d += step) {
    const off = (rnd(seed, i, 8) - 0.5) * grid * 0.35;
    const t0 = 0.03 + (d / dist) * 0.3;
    const frame = animFrame(l.anim, (e - t0) * 1000, false);
    if (frame < 0) continue;
    drawAnim(ctx, l.anim, frame, from.x + ux * d - uy * off, from.y + uy * d + ux * off + grid * FOOT_DY, P * l.k, { anchor: 'foot', flip: rnd(seed, i, 9) < 0.5 });
  }
}

export const hasPixelSpell = (type: string) => type in DEFS;

/**
 * Segons fins que el projectil d'una màgia en píxel arriba al destí (0 si no en té): la mateixa
 * fórmula que `drawPixelSpell`, perquè el dany s'apliqui quan l'efecte toca.
 */
export function pixelTravelS(type: string, pts: Point[], dur: number, gridSize: number, sc = 1): number {
  const def = DEFS[type];
  if (!def?.proj || pts.length < 2) return 0;
  const from = pts[0], to = pts[pts.length - 1];
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  return dist > 0 ? Math.min(dur * 0.35, 0.18 + dist / (fxCell(sc, gridSize) * 22)) : 0;
}

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
 * Mides: `grid` és la casella (àrees de reglament i velocitat del viatge) i `cell` la mida dels efectes
 * (`FX_SIZE` de la casella, com els procedurals): amb la casella sencera, cada dard del projectil màgic
 * era tan gros com una figureta.
 */
export function drawPixelSpell(ctx: CanvasRenderingContext2D, type: string, pts: Point[], e: number, dur: number, sc: number, gridSize: number, seed: number, aoeFt?: number) {
  const def = DEFS[type]; if (!def || pts.length === 0) return;
  const grid = fxCell(sc, gridSize), cell = grid * FX_SIZE;
  const from = pts[0], to = pts[pts.length - 1];
  const dist = pts.length > 1 ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
  // El viatge dura segons la distància (ràpid, però que es vegi), mai més d'un terç.
  const travel = def.proj && dist > 0 ? Math.min(dur * 0.35, 0.18 + dist / (grid * 22)) : 0;
  const fade = Math.max(0, Math.min(1, (dur - e) / 0.35));
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const anims = !!sheet('anims');
  // Píxel de la figureta (S/48 amb S ≈ 1,2 caselles): les animacions noves hi van a escala.
  const P = grid / 40;

  if (def.cone && anims) drawCone(ctx, def.cone, from, to, dist, e, dur, P, seed);
  if (def.line && anims) drawLine(ctx, def.line, from, to, dist, e, P, grid, seed);
  if (def.beam && anims && dist > 0) {
    // Raig: s'estén en 0,12 s, es manté parpellejant i s'apaga en l'últim terç.
    const grow = Math.min(1, e / 0.12);
    const end = dur * 0.62;
    if (e < end) {
      ctx.globalAlpha = (e > end - 0.25 ? (end - e) / 0.25 : 1) * (0.75 + 0.25 * (Math.floor(e * 1000 / 50) % 3 === 0 ? 0 : 1));
      drawAnimAlong(ctx, def.beam.anim, e * 1000, from.x, from.y, from.x + (to.x - from.x) * grow, from.y + (to.y - from.y) * grow,
        P * def.beam.k, { tint: def.beam.tint, bright: true, seed: seed % 7 });
      ctx.globalAlpha = 1;
    }
  }

  if (def.proj && e < travel) {
    const row = PROJ[def.proj];
    const n = def.count ?? 1;
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

  const t0 = travel;
  if (e >= t0) {
    const k = e - t0;
    const at = def.onCaster ? from : to;
    // Mida de l'esclat: l'àrea de reglament si en té (bola de foc 15 ft, casella sencera); si no, la de l'efecte.
    const areaFt = aoeFt ?? (type === 'fireball' ? 15 : (AREA_SPELL_DATA[type]?.aoeRadiusFt ?? 0));
    const radius = areaFt >= 5 ? (areaFt / 5) * grid : cell * 0.75;
    const burst = def.burst ?? (anims ? undefined : LEGACY_BURST[type]);
    if (burst) {
      const frame = Math.min(4, Math.floor(k / 0.07));
      if (k < 0.07 * 6) {
        ctx.globalAlpha = frame === 4 ? 0.6 : 1;
        const size = radius * 2.1;
        if (burst in BURST) {
          const [c0, r] = BURST[burst as keyof typeof BURST];
          fx(ctx, c0 + frame, r, at.x, at.y, size);
        } else {
          const t = tintedBurst(burst as keyof typeof BURST_TINT);
          if (t) ctx.drawImage(t, frame * FX, 0, FX, FX, at.x - size / 2, at.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (def.fx && anims) {
      for (const f of def.fx) drawAnimFx(ctx, f, def.onCaster ? from : to, from, to, k, fade, P, radius, grid, seed);
    }
    if (def.seal) {
      const s = SEAL[def.seal];
      const fr = s.frames[Math.floor(k * 1000 / s.ms) % s.frames.length];
      const size = cell * (s.scale ?? 1);
      // El segell es queda flotant i s'esvaeix amb la màgia.
      ctx.globalAlpha = fade * Math.min(1, k / 0.12);
      const bob = Math.sin(k * 5) * cell * 0.06;
      // Els que embolcallen el token (escut, llum, diana…) van al centre del cos de la figura; la resta
      // (exclamació, estrelles, zzz…) suren damunt del cap, sense tocar-lo.
      const above = def.seal === 'shield' || def.seal === 'light' || def.seal === 'target' || def.seal === 'heal' || def.seal === 'arcane' || def.seal === 'zap';
      const sy = (above ? at.y + grid * BODY_DY : at.y + grid * FIG_HEAD_DY - size * 0.55) + bob;
      const t = s.tint ? tintedRegion('fx', fr[0] * FX, fr[1] * FX, FX, FX, ramp(s.tint)) : null;
      if (t) ctx.drawImage(t, at.x - size / 2, sy - size / 2, size, size);
      else fx(ctx, fr[0], fr[1], at.x, sy, size);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
