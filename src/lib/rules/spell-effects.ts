import type { Point } from '@/types';
import type { AbilityId, DamageType } from '@/lib/characters';
import type { TokenSlot } from '@/lib/render/token-geom';

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
  shape: 'circle' | 'line' | 'cone' | 'single';
  sizeFt?: number;
  damageType?: DamageType;
  save?: AbilityId;
  half?: boolean;
  conditions?: string[];
  heal?: boolean;
}

export const SPELL_EFFECTS: Record<string, SpellEffect> = {
  fireball:         { shape: 'circle', sizeFt: 20, damageType: 'fire', save: 'dex', half: true },
  lightning:        { shape: 'line', sizeFt: 5, damageType: 'lightning', save: 'dex', half: true },
  magic_beam:       { shape: 'line', sizeFt: 5, damageType: 'force' },
  magic_missile:    { shape: 'single', damageType: 'force' },
  ray_of_frost:     { shape: 'single', damageType: 'cold' },
  shocking_grasp:   { shape: 'single', damageType: 'lightning' },
  burning_hands:    { shape: 'cone', sizeFt: 15, damageType: 'fire', save: 'dex', half: true },
  sacred_flame:     { shape: 'single', damageType: 'radiant', save: 'dex' },
  hideous_laughter: { shape: 'single', save: 'wis', conditions: ['prone', 'incapacitated'] },
  charm_person:     { shape: 'single', save: 'wis', conditions: ['charmed'] },
  sleep:            { shape: 'circle', sizeFt: 20, conditions: ['unconscious'] },
  grease:           { shape: 'circle', sizeFt: 10, save: 'dex', conditions: ['prone'] },
  cure_wounds:      { shape: 'single', heal: true },
};

export const SAVE_LABEL: Record<AbilityId, string> = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };

const ft = (f: number, gs: number) => (f / 5) * gs;

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Tokens afectats per un conjur llançat (claus `pl_*`/`lib_*`), en ordre de pintura. Un token
 * compta si la seva base toca la forma (radi `R` inclòs). El llançador (el token que conté el
 * primer punt) no compta a les línies, cons i d'un sol objectiu; a les àrees sí, si hi és a dins.
 * Sense graella no hi ha peus: retorna [].
 */
export function spellTargets(type: string, points: Point[], slots: TokenSlot[], gridSize: number): string[] {
  const fx = SPELL_EFFECTS[type];
  if (!fx || gridSize <= 0 || points.length === 0) return [];
  const start = points[0], end = points[points.length - 1];
  const caster = slots.find(s => Math.hypot(s.x - start.x, s.y - start.y) <= s.R);
  const others = slots.filter(s => s !== caster);
  switch (fx.shape) {
    case 'circle': {
      const r = ft(fx.sizeFt ?? 5, gridSize);
      return slots.filter(s => Math.hypot(s.x - end.x, s.y - end.y) <= r + s.R).map(s => s.key);
    }
    case 'line': {
      const half = ft(fx.sizeFt ?? 5, gridSize) / 2;
      return others.filter(s => {
        for (let i = 1; i < points.length; i++) if (distToSegment(s, points[i - 1], points[i]) <= half + s.R) return true;
        return points.length === 1 && Math.hypot(s.x - start.x, s.y - start.y) <= half + s.R;
      }).map(s => s.key);
    }
    case 'cone': {
      const len = ft(fx.sizeFt ?? 15, gridSize);
      const dir = Math.atan2(end.y - start.y, end.x - start.x);
      const halfAngle = Math.atan(0.5);  // amplada final = llargada
      return others.filter(s => {
        const d = Math.hypot(s.x - start.x, s.y - start.y);
        if (d > len + s.R || d === 0) return false;
        let da = Math.abs(Math.atan2(s.y - start.y, s.x - start.x) - dir);
        if (da > Math.PI) da = 2 * Math.PI - da;
        return da <= halfAngle + Math.asin(Math.min(1, s.R / d));
      }).map(s => s.key);
    }
    case 'single': {
      // El token més proper al punt final, si el toca (o és a menys de mitja casella de la vora).
      let best: TokenSlot | null = null, bestD = Infinity;
      for (const s of others) {
        const d = Math.hypot(s.x - end.x, s.y - end.y) - s.R;
        if (d <= gridSize / 2 && d < bestD) { best = s; bestD = d; }
      }
      return best ? [best.key] : [];
    }
  }
}
