import { DAMAGE_TYPES, type DamageType } from '@/lib/characters';
import type { ApiEnemy } from '@/lib/api';
import type { LibEnemy } from '@/types';

/**
 * Defenses d'un enemic (camps de la API `/enemies`, v5): abast cos a cos i com li afecta
 * cada tipus de dany. Es copien al token en afegir-lo (com la XP) i NO viatgen als jugadors.
 */
export interface Defenses {
  reachFt?: number;
  resistances?: DamageType[];
  vulnerabilities?: DamageType[];
  immunities?: DamageType[];
  /** Resistent només si l'atac NO és màgic (armes normals). */
  nonMagicResistances?: DamageType[];
}

export const damageLabel = (t: DamageType | undefined) => DAMAGE_TYPES.find(d => d.id === t)?.label ?? '';

/** Té alguna defensa de dany (per decidir si cal copiar-les o ensenyar-les). */
export function hasDefenses(d: Defenses | undefined): boolean {
  return !!d && !!((d.resistances?.length) || (d.vulnerabilities?.length) || (d.immunities?.length) || (d.nonMagicResistances?.length) || (d.reachFt !== undefined && d.reachFt !== 5));
}

/**
 * Dany final segons el tipus i les defenses (regles de 5e): la immunitat el deixa a 0; la
 * resistència el parteix per la meitat (arrodonit avall) i la vulnerabilitat el dobla; si en té
 * totes dues per al mateix tipus, es compensen. `magic`: l'atac és màgic (les resistències a
 * armes no màgiques no compten). Retorna també el perquè de cada canvi, per ensenyar-lo al DM.
 * Només és una previsualització: el número l'ha tret el DM amb els daus i ell decideix.
 */
export function applyDefenses(
  amount: number, type: DamageType | undefined, d: Defenses | undefined, magic = false,
): { final: number; reasons: string[] } {
  const base = Math.max(0, Math.floor(amount));
  if (!type || !d) return { final: base, reasons: [] };
  const name = damageLabel(type);
  if (d.immunities?.includes(type)) return { final: 0, reasons: [`Immune a ${name}`] };
  const resNormal = !!d.resistances?.includes(type);
  const resNonMagic = !magic && !!d.nonMagicResistances?.includes(type);
  const res = resNormal || resNonMagic;
  const vul = !!d.vulnerabilities?.includes(type);
  if (res && vul) return { final: base, reasons: [`Resistent i vulnerable a ${name}: es compensen`] };
  if (res) return { final: Math.floor(base / 2), reasons: [`Resistent a ${name}${resNormal ? '' : ' (arma no màgica)'}: la meitat`] };
  if (vul) return { final: base * 2, reasons: [`Vulnerable a ${name}: el doble`] };
  return { final: base, reasons: [] };
}

/** Defenses d'un enemic de la BD (o `undefined` si no en té cap: una API anterior no les dona). */
export function defensesOf(e: ApiEnemy): Defenses | undefined {
  const d: Defenses = {
    reachFt: e.reachFt, resistances: e.resistances, vulnerabilities: e.vulnerabilities,
    immunities: e.immunities, nonMagicResistances: e.nonMagicResistances,
  };
  return hasDefenses(d) ? d : undefined;
}

/**
 * Enemics tal com els veuen les pantalles de jugador: sense `defenses` (des de la consola es
 * veurien les debilitats). Si cap no en té, retorna la mateixa llista (sense còpia).
 */
export function libEnemiesForPlayers(list: LibEnemy[]): LibEnemy[] {
  if (!list.some(e => e.defenses)) return list;
  return list.map(e => {
    if (!e.defenses) return e;
    const { defenses: _d, ...rest } = e; void _d;
    return rest;
  });
}
