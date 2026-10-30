/**
 * Text que apareix lletra a lletra. Funció pura de (text, velocitat): cada pantalla calcula
 * quantes lletres es veuen amb el seu rellotge i totes arriben al mateix lloc alhora.
 *
 * Marques del text:
 * - `*paraula*` → èmfasi (color i tremolor). Els asteriscs no es veuen.
 * - `...` o `…` → pausa llarga.
 * - Pauses més curtes després dels punts, signes d'exclamació i interrogació, i de les comes.
 */

export interface RevealGlyph { ch: string; emph: boolean; /** ms en què apareix */ t: number }
export interface RevealLayout { glyphs: RevealGlyph[]; /** ms en què ja es veu tot */ total: number }

const PAUSE_ELLIPSIS = 650, PAUSE_STOP = 330, PAUSE_COMMA = 140;

export function layoutReveal(text: string, cps: number): RevealLayout {
  const step = 1000 / Math.max(4, cps);
  const glyphs: RevealGlyph[] = [];
  let t = 0, emph = false;
  const src = text.replace(/…/g, '...');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '*') { emph = !emph; continue; }
    glyphs.push({ ch, emph, t });
    t += ch === ' ' ? step * 0.5 : step;
    const next = src[i + 1];
    const atEnd = next === undefined || next === ' ' || next === '*' || next === '\n';
    if (ch === '.' && src.slice(i - 2, i + 1) === '...') { if (next !== '.') t += PAUSE_ELLIPSIS; }
    else if ((ch === '.' || ch === '!' || ch === '?') && atEnd && next !== undefined) t += PAUSE_STOP;
    else if ((ch === ',' || ch === ';' || ch === ':') && atEnd) t += PAUSE_COMMA;
  }
  return { glyphs, total: t };
}

/** Quantes lletres es veuen als `ms` de començar la línia. */
export function visibleCount(l: RevealLayout, ms: number): number {
  if (ms >= l.total) return l.glyphs.length;
  let lo = 0, hi = l.glyphs.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (l.glyphs[mid].t <= ms) lo = mid + 1; else hi = mid; }
  return lo;
}

/** Velocitat segons l'estil: el crit va més de pressa i el xiuxiueig més a poc a poc. */
export const STYLE_SPEED: Record<string, number> = { normal: 1, crit: 1.35, xiuxiueig: 0.72, pensament: 0.85 };
