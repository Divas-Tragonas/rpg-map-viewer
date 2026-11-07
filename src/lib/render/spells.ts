import type { Spell, SpellPreview, Point } from '@/types';
import type { FrameContext } from './types';
import { cellOfPoint, cellsPaths, circleCells, gridOf, rangePaths, tokenCells, type Grid } from '@/lib/rules/cells';
import { AREA_SPELL_DATA, PERSISTENT_SPELLS } from '@/constants';
import { drawSpellFireball, drawFireballGround, fireballShake, FIREBALL_DUR } from './fireball';
import { drawSpellLightning, drawLightningGround, pruneLightningFx, lightningShake, LIGHTNING_DUR, LIGHTNING_FIRST_STRIKE } from './lightning';
import { drawSpellMagicBeam, MAGIC_BEAM_DUR } from './magicbeam';
import {
  drawSpellMagicMissile, drawSpellHideousLaughter, drawSpellBurningHands,
  MAGIC_MISSILE_DUR, HIDEOUS_LAUGHTER_DUR, BURNING_HANDS_DUR,
} from './minorspells';
import { drawSpellSleep, drawSpellGrease } from './areaspells';
import { drawPixelSpell, hasPixelSpell, pixelTravelS } from './pixelspells';
import { sheet } from '@/lib/sprites/pack';
import {
  drawSpellRayOfFrost, drawSpellShockingGrasp, drawSpellMageHand, drawSpellPrestidigitation, drawSpellMageArmor,
  drawSpellShield, drawSpellDetectMagic, drawSpellLight, drawSpellSacredFlame, drawSpellThaumaturgy, drawSpellBless,
  drawSpellCureWounds, drawSpellCharmPerson,
  RAY_OF_FROST_DUR, SHOCKING_GRASP_DUR, MAGE_HAND_DUR, PRESTIDIGITATION_DUR, MAGE_ARMOR_DUR, SHIELD_DUR,
  DETECT_MAGIC_DUR, LIGHT_DUR, SACRED_FLAME_DUR, THAUMATURGY_DUR, BLESS_DUR, CURE_WOUNDS_DUR, CHARM_PERSON_DUR,
} from './bookspells';

export {
  drawSpellFireball, drawSpellLightning, drawSpellMagicBeam,
  drawSpellMagicMissile, drawSpellHideousLaughter, drawSpellBurningHands, drawSpellSleep, drawSpellGrease,
};

/**
 * Sacsejada de càmera (px de pantalla) dels spells actius. Els ticks del DM i del
 * jugador la sumen a `ox/oy`, així fons, mapa i tokens es mouen junts.
 */
export function spellShake(spells: readonly Spell[], now: number, pixel = false): Point {
  // A l'app Píxel la càmera no tremola (no lliga amb els efectes de pixel art).
  if (pixel) return { x: 0, y: 0 };
  const f = fireballShake(spells, now);
  let x = f.x, y = f.y;
  for (const sp of spells) {
    if (sp.type !== 'lightning') continue;
    const l = lightningShake((now - sp.startTime) / 1000 - LIGHTNING_FIRST_STRIKE, sp.id.length);
    x += l.x; y += l.y;
  }
  return { x, y };
}

/**
 * Segons des del llançament fins que l'efecte arriba als afectats: al pop-up dels conjurs en
 * combat, el dany i els estats s'apliquen llavors (no abans que l'animació toqui).
 */
export function spellImpactS(type: string, pts: Point[], gridSize: number, pixel: boolean, fallbackS: number): number {
  if (pixel && hasPixelSpell(type) && !PERSISTENT_SPELLS.has(type)) {
    const t = pixelTravelS(type, pts, SPELL_DURATIONS[type] ?? 2.5, gridSize);
    return t > 0 ? t + 0.05 : Math.min(fallbackS, 0.3);
  }
  return fallbackS;
}

const SPELL_DURATIONS: Record<string, number> = {
  fireball:         FIREBALL_DUR,
  lightning:        LIGHTNING_DUR,
  magic_beam:       MAGIC_BEAM_DUR,
  magic_missile:    MAGIC_MISSILE_DUR,
  hideous_laughter: HIDEOUS_LAUGHTER_DUR,
  burning_hands:    BURNING_HANDS_DUR,
  sleep:            3.0,
  grease:           3.5,
  ray_of_frost:     RAY_OF_FROST_DUR,
  shocking_grasp:   SHOCKING_GRASP_DUR,
  mage_hand:        MAGE_HAND_DUR,
  prestidigitation: PRESTIDIGITATION_DUR,
  mage_armor:       MAGE_ARMOR_DUR,
  shield:           SHIELD_DUR,
  detect_magic:     DETECT_MAGIC_DUR,
  light:            LIGHT_DUR,
  sacred_flame:     SACRED_FLAME_DUR,
  thaumaturgy:      THAUMATURGY_DUR,
  bless:            BLESS_DUR,
  cure_wounds:      CURE_WOUNDS_DUR,
  charm_person:     CHARM_PERSON_DUR,
};

type SpellDraw = (ctx: CanvasRenderingContext2D, pts: Point[], e: number, dur: number, sc: number, gridSize: number, seed: number) => void;

/** Efectes dels grimoris dels personatges (instantanis, passada 'air'). */
const BOOK_SPELLS: Record<string, SpellDraw> = {
  ray_of_frost: drawSpellRayOfFrost, shocking_grasp: drawSpellShockingGrasp, mage_hand: drawSpellMageHand,
  prestidigitation: drawSpellPrestidigitation, mage_armor: drawSpellMageArmor, shield: drawSpellShield,
  detect_magic: drawSpellDetectMagic, light: drawSpellLight, sacred_flame: drawSpellSacredFlame,
  thaumaturgy: drawSpellThaumaturgy, bless: drawSpellBless, cure_wounds: drawSpellCureWounds,
  charm_person: drawSpellCharmPerson,
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

// ── Preview ──────────────────────────────────────────────────────────────────

const OUT_RED = '#ff4d4d';

/** Anell damunt el token assenyalat amb la distància fins a la seva vora (només DM). */
const IN_GREEN = '#7dffa0', LONG_AMBER = '#ffb347';

function drawReachHover(ctx: CanvasRenderingContext2D, h: NonNullable<SpellPreview['hover']>, sc: number): void {
  const col = h.out ? OUT_RED : h.long ? LONG_AMBER : IN_GREEN;
  ctx.save();
  ctx.globalAlpha = 0.95; ctx.strokeStyle = col; ctx.lineWidth = 2.5 / sc;
  ctx.beginPath(); ctx.arc(h.x, h.y, h.R + 6 / sc, 0, Math.PI * 2); ctx.stroke();
  if (h.ft !== null) {
    const text = `${h.ft}ft${h.out ? ' · fora' : h.long ? ' · desavantatge' : ''}`;
    ctx.font = `bold ${12 / sc}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width, ty = h.y - h.R - 18 / sc;
    ctx.fillStyle = 'rgba(10,13,18,0.85)';
    ctx.fillRect(h.x - tw / 2 - 5 / sc, ty - 8 / sc, tw + 10 / sc, 16 / sc);
    ctx.fillStyle = col; ctx.fillText(text, h.x, ty);
  }
  ctx.restore();
}

/** Més enllà d'aquest abast (caselles) no es pinta la regió: seria massa gran per a cada frame. */
const MAX_REGION_CELLS = 80;

/** Pinta una regió de caselles: farciment suau i perímetre esglaonat (com el rang de moviment). */
function drawCells(ctx: CanvasRenderingContext2D, paths: { fill: Path2D; edge: Path2D }, color: string, fillA: number, edgeA: number, sc: number, dashed = false): void {
  ctx.save();
  if (fillA > 0) { ctx.globalAlpha = fillA; ctx.fillStyle = color; ctx.fill(paths.fill); }
  ctx.globalAlpha = edgeA; ctx.strokeStyle = color; ctx.lineWidth = 2 / sc;
  if (dashed) ctx.setLineDash([6 / sc, 5 / sc]);
  ctx.stroke(paths.edge);
  ctx.restore();
}

/** Abast per caselles des d'unes caselles d'origen (si no és desmesurat). */
function drawRange(ctx: CanvasRenderingContext2D, from: Parameters<typeof rangePaths>[0], ft: number, grid: Grid, color: string, sc: number, long = false): void {
  if (ft / 5 > MAX_REGION_CELLS) return;
  drawCells(ctx, rangePaths(from, ft, grid), color, long ? 0 : 0.07, long ? 0.35 : 0.65, sc, long);
}

/**
 * Atac del menú d'un token: anell de l'abast (i de l'abast llarg, més tènue) mesurat des de la
 * VORA del token, línia fins a l'objectiu i etiqueta amb el nom i els peus. Verd dins, ambre a
 * l'abast llarg (desavantatge), vermell fora: només avís, el DM decideix.
 */
function renderAttackPreview(ctx: CanvasRenderingContext2D, p: Extract<SpellPreview, { mode: 'attack' }>, sc: number, grid: Grid | null): void {
  const col = p.zone === 'out' ? OUT_RED : p.zone === 'long' ? LONG_AMBER : IN_GREEN;
  const { start, startR, end } = p;
  ctx.save();
  // Amb graella: l'abast són les caselles a l'abast (i les de l'abast llarg, només la vora).
  if (grid) {
    const mine = tokenCells(start, startR, grid);
    const ringCol = p.zone === 'out' ? OUT_RED : '#ffffff';
    drawRange(ctx, mine, p.normalFt, grid, ringCol, sc);
    if (p.longFt) drawRange(ctx, mine, p.longFt, grid, ringCol, sc, true);
  }
  const d = Math.hypot(end.x - start.x, end.y - start.y);
  if (d > startR) {
    const sx = start.x + (end.x - start.x) / d * startR, sy = start.y + (end.y - start.y) / d * startR;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.25; ctx.strokeStyle = col; ctx.lineWidth = 8 / sc;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 2 / sc; ctx.setLineDash([10 / sc, 6 / sc]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(end.x, end.y, 4 / sc, 0, Math.PI * 2); ctx.fill();
    // Etiqueta al mig: nom de l'atac i peus (només si no hi ha token assenyalat, que ja en porta).
    const extra = p.zone === 'out' ? " · fora d'abast" : p.zone === 'long' ? ' · desavantatge' : '';
    const text = `⚔ ${p.label}${p.ft !== null && !p.hover ? ` · ${p.ft}ft` : ''}${p.hover ? '' : extra}`;
    const lmx = (sx + end.x) / 2, lmy = (sy + end.y) / 2;
    ctx.globalAlpha = 0.95; ctx.font = `bold ${12 / sc}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(10,13,18,0.85)';
    ctx.fillRect(lmx - tw / 2 - 5 / sc, lmy - 17 / sc, tw + 10 / sc, 14 / sc);
    ctx.fillStyle = col; ctx.fillText(text, lmx, lmy - 10 / sc);
  }
  ctx.restore();
  if (p.hover) drawReachHover(ctx, p.hover, sc);
}

export function renderSpellPreview(ctx: CanvasRenderingContext2D, preview: SpellPreview, sc: number, gridSize: number, grid: Grid | null = null): void {
  if (preview.mode === 'attack') { renderAttackPreview(ctx, preview, sc, grid); return; }
  ctx.save();
  // Fora d'abast: tot en vermell (avís; el clic funciona igualment).
  const hot = preview.outOfRange ? OUT_RED : '#ffd200';

  if (preview.mode === 'line') {
    const { start, end } = preview;
    // Abast màxim (llançat des d'un token): cercle blanc de guions, com el de les àrees
    if (preview.rangeFt && grid) {
      drawRange(ctx, [cellOfPoint(start, grid)], preview.rangeFt, grid, preview.outOfRange ? OUT_RED : '#ffffff', sc);
    } else if (preview.rangeFt && gridSize > 0) {
      ctx.globalAlpha = 0.7; ctx.strokeStyle = preview.outOfRange ? OUT_RED : '#ffffff'; ctx.lineWidth = 1.5 / sc;
      ctx.setLineDash([8 / sc, 6 / sc]);
      ctx.beginPath(); ctx.arc(start.x, start.y, ftToWorld(preview.rangeFt, gridSize), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 3-layer preview line — same visual language as active spells
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.20; ctx.strokeStyle = hot; ctx.lineWidth = 9 / sc;
    ctx.setLineDash([10 / sc, 6 / sc]);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.globalAlpha = 0.55; ctx.strokeStyle = hot; ctx.lineWidth = 2.5 / sc;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.globalAlpha = 0.80; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    // Dots
    ctx.globalAlpha = 0.90; ctx.fillStyle = hot;
    ctx.beginPath(); ctx.arc(end.x, end.y, 5 / sc, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.60;
    ctx.beginPath(); ctx.arc(start.x, start.y, 4 / sc, 0, Math.PI * 2); ctx.fill();

    // Live "shortest distance" readout — a straight line is already its own diagonal.
    const ft = preview.ft ?? worldToFt(Math.hypot(end.x - start.x, end.y - start.y), gridSize);
    const lmx = (start.x + end.x) / 2, lmy = (start.y + end.y) / 2;
    ctx.globalAlpha = 0.9; ctx.font = `bold ${12 / sc}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = `📏 ${ft}ft${preview.outOfRange ? ' · fora d\'abast' : ''}`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(10,13,18,0.82)';
    ctx.fillRect(lmx - tw / 2 - 5 / sc, lmy - 17 / sc, tw + 10 / sc, 14 / sc);
    ctx.fillStyle = hot;
    ctx.fillText(text, lmx, lmy - 10 / sc);
    ctx.textBaseline = 'alphabetic';

  } else if (preview.mode === 'area_place') {
    const { origin, center, spellType } = preview;
    const data = AREA_SPELL_DATA[spellType];
    if (!data) { ctx.restore(); return; }
    const rangeWorld = ftToWorld(data.rangeFt, gridSize);
    const aoeWorld   = ftToWorld(data.aoeRadiusFt, gridSize);
    const isOval     = data.aoeRadiusFt === 10;

    // Range limit — amb graella, les caselles a l'abast; sense, la circumferència de guions
    if (grid) drawRange(ctx, [cellOfPoint(origin, grid)], data.rangeFt, grid, preview.outOfRange ? OUT_RED : '#ffffff', sc);
    else {
      ctx.globalAlpha = 0.70; ctx.strokeStyle = preview.outOfRange ? OUT_RED : '#ffffff'; ctx.lineWidth = 1.5 / sc;
      ctx.setLineDash([8 / sc, 6 / sc]);
      ctx.beginPath(); ctx.arc(origin.x, origin.y, rangeWorld, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Origin crosshair
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / sc;
    const cs = 5 / sc;
    ctx.beginPath(); ctx.moveTo(origin.x - cs, origin.y); ctx.lineTo(origin.x + cs, origin.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y - cs); ctx.lineTo(origin.x, origin.y + cs); ctx.stroke();

    // AoE: amb graella, les caselles que cobreix (centre dins del radi), com a la taula.
    if (grid) {
      drawCells(ctx, cellsPaths(circleCells(center, data.aoeRadiusFt, grid), grid), preview.outOfRange ? OUT_RED : data.color, 0.28, 0.9, sc);
    } else {
    // AoE at cursor — 3-layer (outer glow / fill / stroke)
    ctx.globalAlpha = 0.10; ctx.fillStyle = preview.outOfRange ? OUT_RED : data.color;
    if (isOval) {
      ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.20; ctx.strokeStyle = preview.outOfRange ? OUT_RED : data.color; ctx.lineWidth = 8 / sc;
    ctx.setLineDash([6 / sc, 4 / sc]);
    if (isOval) { ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
    else        { ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 0.80; ctx.lineWidth = 1.5 / sc;
    if (isOval) { ctx.beginPath(); ctx.ellipse(center.x, center.y, aoeWorld, aoeWorld * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
    else        { ctx.beginPath(); ctx.arc(center.x, center.y, aoeWorld, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
    }
  }

  if (preview.hover) drawReachHover(ctx, preview.hover, sc);
  ctx.globalAlpha = 1; ctx.restore();
}

/**
 * Pantalla de jugador: la previsualització del DM arriba a ~20 Hz (throttle del STATE) i
 * s'hi acosta cada frame amb un LERP, perquè el cercle i la punta del raig llisquin en lloc
 * d'anar a salts. Una altra màgia, un altre mode o un altre origen → salta directament.
 */
export function followSpellPreview(cur: SpellPreview | null, tgt: SpellPreview | null, k: number): SpellPreview | null {
  if (cur === tgt || !cur || !tgt || cur.mode !== tgt.mode) return tgt;
  const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
  const lerp = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  if (cur.mode === 'line' && tgt.mode === 'line') {
    if (!near(cur.start, tgt.start) || near(cur.end, tgt.end)) return tgt;
    return { ...tgt, end: lerp(cur.end, tgt.end) };
  }
  if (cur.mode === 'area_place' && tgt.mode === 'area_place') {
    if (cur.spellType !== tgt.spellType || !near(cur.origin, tgt.origin) || near(cur.center, tgt.center)) return tgt;
    return { ...tgt, center: lerp(cur.center, tgt.center) };
  }
  return tgt;
}

// ── Main render ──────────────────────────────────────────────────────────────

/**
 * Two-pass rendering: 'ground' draws area spells (sleep, grease — floor effects,
 * called before the token phases so tokens stand on top of them) and 'air' draws
 * everything else (projectiles, bolts, cones — called after the tokens so they
 * are never hidden underneath). Expiry bookkeeping is idempotent and runs on
 * whichever pass observes a change.
 */
export function renderSpells(ctx: CanvasRenderingContext2D, fc: FrameContext, layer: 'ground' | 'air' = 'air'): void {
  const { rActiveSpells, setActiveSpells, sc, rGridSize, rSpellPreview } = fc;
  const now = performance.now();
  const alive: Spell[] = [];
  const gridSize = rGridSize.current;
  const pixel = fc.rAppStyle?.current === 'pixel' && !!sheet('fx');
  for (const sp of rActiveSpells.current) {
    const elapsed = (now - sp.startTime) / 1000;
    const dur = SPELL_DURATIONS[sp.type] ?? 2.5;
    const isArea = PERSISTENT_SPELLS.has(sp.type);
    if (elapsed > dur && !isArea) continue;  // non-area spells expire
    alive.push(sp);
    const seed = hash32(sp.id);
    // App Píxel: els efectes del paquet Oryx (les àrees persistents es queden com sempre).
    if (pixel && !isArea && hasPixelSpell(sp.type)) {
      if (layer === 'air') drawPixelSpell(ctx, sp.type, sp.points, elapsed, dur, sc, gridSize, seed);
      continue;
    }
    // La bola de foc deixa un socarrim a terra: aquesta part va a la passada 'ground'
    // (sota els tokens) i la resta de l'efecte a la 'air'.
    if (layer === 'ground') {
      if (sp.type === 'fireball')  { drawFireballGround(ctx, sp.points, elapsed, sc, gridSize, seed); continue; }
      if (sp.type === 'lightning') { drawLightningGround(ctx, sp.points, elapsed, sc, gridSize, seed); continue; }
    }
    if (isArea !== (layer === 'ground')) continue;  // each spell draws in its own pass
    const renderElapsed = isArea ? Math.min(elapsed, dur * 0.5) : elapsed;  // area spells: clamp to full-alpha state
    if      (sp.type === 'fireball')         drawSpellFireball(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'lightning')        drawSpellLightning(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed, sp.id);
    else if (sp.type === 'magic_beam')       drawSpellMagicBeam(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'magic_missile')    drawSpellMagicMissile(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'hideous_laughter') drawSpellHideousLaughter(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'burning_hands')    drawSpellBurningHands(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'sleep')            drawSpellSleep(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else if (sp.type === 'grease')           drawSpellGrease(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
    else BOOK_SPELLS[sp.type]?.(ctx, sp.points, renderElapsed, dur, sc, gridSize, seed);
  }
  if (alive.length !== rActiveSpells.current.length) {
    rActiveSpells.current = alive; setActiveSpells(alive);
    pruneLightningFx(new Set(alive.map(sp => sp.id)));
  }
  if (layer === 'air' && rSpellPreview?.current) renderSpellPreview(ctx, rSpellPreview.current, sc, gridSize, gridOf(gridSize, fc.rGridOriginX.current, fc.rGridOriginY.current));
}
