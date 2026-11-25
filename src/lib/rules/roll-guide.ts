/**
 * Guia de tirada simplificada (v5.43): què s'ha de tirar a la taula per a un atac, un conjur o una
 * salvació, dit amb el número que cal treure al dau. L'app no tira res: només ho explica.
 */

/** «+5», «-1», 5 → número. `null` si no se'n pot llegir cap. */
export function parseBonus(b: string | number | undefined | null): number | null {
  if (typeof b === 'number') return Number.isFinite(b) ? b : null;
  if (!b) return null;
  const m = /([+-−]?)\s*(\d+)/.exec(b);
  if (!m) return null;
  const n = parseInt(m[2]);
  return m[1] === '-' || m[1] === '−' ? -n : n;
}

const sgn = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

/** El número mínim que cal treure al d20 per arribar a `target` amb `bonus`, dit en paraules. */
function needText(bonus: number, target: number): string {
  const need = target - bonus;
  if (need <= 2) return "qualsevol cosa menys un 1";
  if (need > 20) return 'només un 20';
  return `${need} o més`;
}

/**
 * Tirada per tocar: «Tira 1d20: toca amb 10 o més (+5 contra CA 15)». Sense CA, el bonus a sumar;
 * sense bonus, el recordatori de sumar el de la fitxa.
 */
export function hitLine(bonus: string | number | undefined | null, ac: number | undefined | null): string {
  const b = parseBonus(bonus);
  if (b !== null && ac) return `Tira 1d20: toca amb ${needText(b, ac)} (${sgn(b)} contra CA ${ac})`;
  if (b !== null) return `Tira 1d20 ${sgn(b)} i compara-ho amb la CA de l'objectiu`;
  if (ac) return `Tira 1d20 + el bonus d'atac: toca si arriba a CA ${ac}`;
  return "Tira 1d20 + el bonus d'atac i compara-ho amb la CA";
}

/** Salvació: «la supera amb 11 o més (+2 contra CD 13)». */
export function saveNeed(saveBonus: number | null | undefined, dc: number | undefined): string | null {
  if (!dc) return null;
  if (saveBonus === null || saveBonus === undefined) return `arriba a ${dc} amb el seu bonus`;
  return `${needText(saveBonus, dc)} (${sgn(saveBonus)} contra CD ${dc})`;
}

/** Avantatge / desavantatge: es compensen (regla de 5e, encara que n'hi hagi més d'un de cada). */
export function advLine(adv: readonly string[], dis: readonly string[]): string | null {
  if (adv.length && dis.length) return `Avantatge (${adv.join(', ')}) i desavantatge (${dis.join(', ')}) es compensen: un sol d20`;
  if (adv.length) return `Amb avantatge (${adv.join(', ')}): tira 2d20 i queda't el més alt`;
  if (dis.length) return `Amb desavantatge (${dis.join(', ')}): tira 2d20 i queda't el més baix`;
  return null;
}

/** Versió curta per a una fila: «11+» (el número mínim al d20). `null` sense dades. */
export function saveNeedShort(saveBonus: number | null | undefined, dc: number | undefined): string | null {
  if (!dc || saveBonus === null || saveBonus === undefined) return null;
  const need = dc - saveBonus;
  return need <= 2 ? '2+' : need > 20 ? 'només 20' : `${need}+`;
}
