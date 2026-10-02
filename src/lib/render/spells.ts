import type { Spell, SpellPreview, Point } from '@/types';
import type { FrameContext } from './types';
import { AREA_SPELL_DATA, PERSISTENT_SPELLS } from '@/constants';
import { drawSpellFireball, drawFireballGround, fireballShake, FIREBALL_DUR } from './fireball';
import { drawSpellLightning, drawLightningGround, pruneLightningFx, lightningShake, LIGHTNING_DUR, LIGHTNING_FIRST_STRIKE } from './lightning';
import { drawSpellMagicBeam, MAGIC_BEAM_DUR } from './magicbeam';
import {
  drawSpellMagicMissile, drawSpellHideousLaughter, drawSpellBurningHands,
  MAGIC_MISSILE_DUR, HIDEOUS_LAUGHTER_DUR, BURNING_HANDS_DUR,
} from './minorspells';
import { drawSpellSleep, drawSpellGrease } from './areaspells';
import {
  drawSpellRayOfFrost, drawSpellShockingGrasp, drawSpellMageHand, drawSpellPrestidigitation, drawSpellMageArmor,
  drawSpellShield, drawSpellDetectMagic, drawSpellLight, drawSpellSacredFlame, drawSpellThaumaturgy, drawSpellBless,
  drawSpellCureWounds,
  RAY_OF_FROST_DUR, SHOCKING_GRASP_DUR, MAGE_HAND_DUR, PRESTIDIGITATION_DUR, MAGE_ARMOR_DUR, SHIELD_DUR,
  DETECT_MAGIC_DUR, LIGHT_DUR, SACRED_FLAME_DUR, THAUMATURGY_DUR, BLESS_DUR, CURE_WOUNDS_DUR,
} from './bookspells';

export {
  drawSpellFireball, drawSpellLightning, drawSpellMagicBeam,
  drawSpellMagicMissile, drawSpellHideousLaughter, drawSpellBurningHands, drawSpellSleep, drawSpellGrease,
};

/**
 * Sacsejada de càmera (px de pantalla) dels spells actius. Els ticks del DM i del
 * jugador la sumen a `ox/oy`, així fons, mapa i tokens es mouen junts.
 */
export function spellShake(spells: readonly Spell[], now: number): Point {
  const f = fireballShake(spells, now);
  let x = f.x, y = f.y;
  for (const sp of spells) {
    if (sp.type !== 'lightning') continue;
    const l = lightningShake((now - sp.startTime) / 1000 - LIGHTNING_FIRST_STRIKE, sp.id.length);
    x += l.x; y += l.y;
  }
  return { x, y };
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
};

type SpellDraw = (ctx: CanvasRenderingContext2D, pts: Point[], e: number, dur: number, sc: number, gridSize: number, seed: number) => void;

/** Efectes dels grimoris dels personatges (instantanis, passada 'air'). */
const BOOK_SPELLS: Record<string, SpellDraw> = {
  ray_of_frost: drawSpellRayOfFrost, shocking_grasp: drawSpellShockingGrasp, mage_hand: drawSpellMageHand,
  prestidigitation: drawSpellPrestidigitation, mage_armor: drawSpellMageArmor, shield: drawSpellShield,
  detect_magic: drawSpellDetectMagic, light: drawSpellLight, sacred_flame: drawSpellSacredFlame,
  thaumaturgy: drawSpellThaumaturgy, bless: drawSpellBless, cure_wounds: drawSpellCureWounds,
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

export function renderSpellPreview(ctx: CanvasRenderingContext2D, preview: SpellPreview, sc: number, gridSize: number): void {
  ctx.save();

  if (preview.mode === 'line') {
    const { start, end } = preview;
    // Abast màxim (llançat des d'un token): cercle blanc de guions, com el de les àrees
    if (preview.rangeFt && gridSize > 0) {
      ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 / sc;
      ctx.setLineDash([8 / sc, 6 / sc]);
      ctx.beginPath(); ctx.arc(start.x, start.y, ftToWorld(preview.rangeFt, gridSize), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
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
  for (const sp of rActiveSpells.current) {
    const elapsed = (now - sp.startTime) / 1000;
    const dur = SPELL_DURATIONS[sp.type] ?? 2.5;
    const isArea = PERSISTENT_SPELLS.has(sp.type);
    if (elapsed > dur && !isArea) continue;  // non-area spells expire
    alive.push(sp);
    const seed = hash32(sp.id);
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
  if (layer === 'air' && rSpellPreview?.current) renderSpellPreview(ctx, rSpellPreview.current, sc, gridSize);
}
