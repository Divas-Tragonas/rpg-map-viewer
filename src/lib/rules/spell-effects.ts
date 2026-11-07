import type { Point } from '@/types';
import type { AbilityId, DamageType } from '@/lib/characters';
import type { TokenSlot } from '@/lib/render/token-geom';
import { cellCenter, cellKeyOf, cellOfPoint, circleCells, tokenCells, type Cell, type Grid } from '@/lib/rules/cells';

/**
 * Taula d'efectes dels conjurs (v5): què fa cada màgia de l'app quan toca tokens en combat.
 * L'app no tira res: proposa qui queda afectat, la salvació i els estats, i el DM ho confirma
 * al pop-up (`SpellEffectPopup`) amb el dany que han tret els daus.
 *
 *  - `shape`: com es decideix qui toca. `circle` = àrea al voltant del punt final (radi en
 *    peus); `line` = franja al llarg del traç (amplada en peus); `cone` = con des de l'origen
 *    (llargada en peus, amplada final = llargada, com a 5e); `single` = el token del punt final.
 *  - `save`: característica de la salvació. `half` = qui la supera rep la meitat (si no, res).
 *  - `conditions`: estats proposats a qui NO supera la salvació (o a tothom si no n'hi ha).
 *  - `heal`: cura en lloc de dany.
 * Les que no hi són (Beneir, Mà de mag, Llum…) no obren cap pop-up.
 */
export interface SpellEffect {
  /** `self`: només el llançador (Escut, Armadura de mag): el pop-up en mostra el benefici. */
  shape: 'circle' | 'line' | 'cone' | 'single' | 'self';
  sizeFt?: number;
  damageType?: DamageType;
  save?: AbilityId;
  half?: boolean;
  conditions?: string[];
  heal?: boolean;
  /** Segons des del llançament fins a l'impacte de l'animació: el dany i els estats s'apliquen llavors. */
  impactS?: number;
  /** Benefici que dona (es mostra al pop-up i es marca amb un estat de benefici). */
  buff?: 'shield' | 'mage_armor' | 'bless';
  /**
   * Durada en combat, en torns del llançador (regles de 5e): els estats que posa s'acaben sols
   * quan comença el seu torn per `rounds`-èsima vegada. 1 = «fins al principi del seu proper torn»
   * (Escut); 10 = 1 minut. Sense = no caduca en combat (Encisar, 1 hora; Greix: fins que s'aixequi).
   */
  rounds?: number;
  /** L'efecte s'acaba si l'afectat rep dany (Dormir). */
  endsOnDamage?: boolean;
}

export const SPELL_EFFECTS: Record<string, SpellEffect> = {
  fireball:         { shape: 'circle', sizeFt: 20, damageType: 'fire', save: 'dex', half: true, impactS: 0.85 },
  lightning:        { shape: 'line', sizeFt: 5, damageType: 'lightning', save: 'dex', half: true, impactS: 0.15 },
  magic_beam:       { shape: 'line', sizeFt: 5, damageType: 'force', impactS: 0.45 },
  magic_missile:    { shape: 'single', damageType: 'force', impactS: 0.85 },
  ray_of_frost:     { shape: 'single', damageType: 'cold', impactS: 0.3 },
  shocking_grasp:   { shape: 'single', damageType: 'lightning', impactS: 0.2 },
  burning_hands:    { shape: 'cone', sizeFt: 15, damageType: 'fire', save: 'dex', half: true, impactS: 0.35 },
  sacred_flame:     { shape: 'single', damageType: 'radiant', save: 'dex', impactS: 0.3 },
  hideous_laughter: { shape: 'single', save: 'wis', conditions: ['prone', 'incapacitated'], impactS: 0.75, rounds: 10 },
  charm_person:     { shape: 'single', save: 'wis', conditions: ['charmed'], impactS: 0.8 },
  sleep:            { shape: 'circle', sizeFt: 20, conditions: ['unconscious'], impactS: 0.6, rounds: 10, endsOnDamage: true },
  grease:           { shape: 'circle', sizeFt: 10, save: 'dex', conditions: ['prone'], impactS: 0.6 },
  shield:           { shape: 'self', buff: 'shield', rounds: 1, conditions: ['shielded'] },
  mage_armor:       { shape: 'single', buff: 'mage_armor', conditions: ['mage_armored'] },
  bless:            { shape: 'single', buff: 'bless', rounds: 10, conditions: ['blessed'] },
  cure_wounds:      { shape: 'single', heal: true, impactS: 0.5 },
};

/**
 * Efecte d'una màgia: només les de la taula. Les que no fan dany ni posen estats (Mà de mag, Llum,
 * Prestidigitació, Taumatúrgia, Detectar màgia) no obren cap pop-up: es llancen i prou.
 */
export function effectFor(type: string): SpellEffect | null {
  return SPELL_EFFECTS[type] ?? null;
}

export const SAVE_LABEL: Record<AbilityId, string> = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };

const ft = (f: number, gs: number) => (f / 5) * gs;

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Caselles que cobreix un conjur (amb graella), com a la taula: àrea = caselles amb el centre dins
 * del radi; línia = caselles amb el centre a menys de mitja casella del traç; con = caselles amb el
 * centre dins del con (sense la del llançador); un sol objectiu = la casella del punt final.
 */
export function spellCells(type: string, points: Point[], g: Grid): Cell[] {
  const fx = effectFor(type);
  if (!fx || points.length === 0) return [];
  const start = points[0], end = points[points.length - 1];
  if (fx.shape === 'circle') return circleCells(end, fx.sizeFt ?? 5, g);
  if (fx.shape === 'single' || fx.shape === 'self') return [cellOfPoint(end, g)];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  // Con: si s'ha apuntat més lluny del que arriba (fora d'abast, decisió del DM), s'allarga fins al punt.
  const len = Math.max(ft(fx.sizeFt ?? 15, g.gs), fx.shape === 'cone' ? Math.hypot(end.x - start.x, end.y - start.y) : 0);
  if (fx.shape === 'cone') { x0 = start.x - len; x1 = start.x + len; y0 = start.y - len; y1 = start.y + len; }
  const out: Cell[] = [];
  const own = cellKeyOf(cellOfPoint(start, g));
  const dir = Math.atan2(end.y - start.y, end.x - start.x), halfAngle = Math.atan(0.5);
  for (let c = Math.floor((x0 - g.gox) / g.gs) - 1; c <= Math.floor((x1 - g.gox) / g.gs) + 1; c++) {
    for (let r = Math.floor((y0 - g.goy) / g.gs) - 1; r <= Math.floor((y1 - g.goy) / g.gs) + 1; r++) {
      const m = cellCenter([c, r], g);
      if (fx.shape === 'line') {
        for (let i = 1; i < points.length; i++) if (distToSegment(m, points[i - 1], points[i]) <= g.gs / 2) { out.push([c, r]); break; }
      } else {
        if (`${c},${r}` === own) continue;
        const d = Math.hypot(m.x - start.x, m.y - start.y);
        if (d === 0 || d > len) continue;
        let da = Math.abs(Math.atan2(m.y - start.y, m.x - start.x) - dir);
        if (da > Math.PI) da = 2 * Math.PI - da;
        if (da <= halfAngle + 1e-6) out.push([c, r]);
      }
    }
  }
  return out;
}

/**
 * Tokens afectats per un conjur llançat (claus `pl_*`/`lib_*`), en ordre de pintura. Per caselles:
 * un token compta si alguna de les caselles que ocupa és dins de `spellCells`. El llançador (el token
 * que conté el primer punt) no compta a les línies, cons i d'un sol objectiu; a les àrees sí, si hi és.
 * Sense graella no hi ha peus: retorna [].
 */
export function spellTargets(type: string, points: Point[], slots: TokenSlot[], grid: Grid | null): string[] {
  const fx = effectFor(type);
  if (!fx || points.length === 0) return [];
  const start = points[0], end = points[points.length - 1];
  const caster = slots.find(s => Math.hypot(s.x - start.x, s.y - start.y) <= s.R);
  if (fx.shape === 'self') return caster ? [caster.key] : [];
  const pool = fx.shape === 'circle' ? slots : slots.filter(s => s !== caster);
  if (fx.shape === 'single') {
    // El token que ocupa la casella del punt final; si no n'hi ha (o no hi ha graella), el que hi
    // és a sobre o el més proper a mitja casella.
    if (grid) {
      const endKey = cellKeyOf(cellOfPoint(end, grid));
      const on = pool.find(s => tokenCells(s, s.R, grid).some(c => cellKeyOf(c) === endKey));
      if (on) return [on.key];
    }
    const slack = grid ? grid.gs / 2 : 0;
    let best: TokenSlot | null = null, bestD = Infinity;
    for (const s of pool) {
      const d = Math.hypot(s.x - end.x, s.y - end.y) - s.R;
      if (d <= slack && d < bestD) { best = s; bestD = d; }
    }
    return best ? [best.key] : [];
  }
  // Àrees, línies i cons es mesuren en caselles: sense graella no hi ha peus.
  if (!grid) return [];
  const hit = new Set(spellCells(type, points, grid).map(cellKeyOf));
  return pool.filter(s => tokenCells(s, s.R, grid).some(c => hit.has(cellKeyOf(c)))).map(s => s.key);
}
