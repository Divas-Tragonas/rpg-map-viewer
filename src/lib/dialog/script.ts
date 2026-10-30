import type { DialogCamMode, DialogStyle } from '@/types';

/**
 * Guió d'un diàleg en format teatre, una intervenció per línia:
 *
 *     Klarg: Qui gosa entrar a la meva cova?
 *     Klarg (crit, enfoca): FORA D'AQUÍ!
 *     Narrador: Les torxes tremolen.
 *     ???: No el miris als ulls...
 *     > Atacar -> combat
 *     > Negociar -> pacte
 *     # combat
 *     Klarg: Doncs morireu.
 *     -> fi
 *     # pacte
 *     Klarg (xiuxiueig): Parlem-ne.
 *
 * - `Nom (opcions): text`: les opcions (separades per comes) són l'estil (normal, crit,
 *   xiuxiueig, pensament) i la càmera (auto, enfoca, dos, quiet). Sense opcions: normal i auto.
 * - `> text -> etiqueta`: opció de resposta de la intervenció d'abans.
 * - `# etiqueta`: punt on salten les opcions. `-> etiqueta` salta; `-> fi` acaba.
 * - Una línia que no té cap d'aquestes formes continua el text de la intervenció d'abans.
 * - `//` al començament: comentari.
 */

export interface DialogOption { text: string; label: string }
export interface ScriptSay {
  kind: 'say';
  /** Línia del guió (0 = la primera) on comença: per reescriure-li les opcions. */
  src: number;
  name: string;
  style: DialogStyle;
  cam: DialogCamMode;
  text: string;
  options?: DialogOption[];
}
export interface ScriptJump { kind: 'jump'; label: string }
export type ScriptStep = ScriptSay | ScriptJump;
export interface ParsedScript {
  steps: ScriptStep[];
  /** Etiqueta (normalitzada) → índex del pas on comença. */
  labels: Record<string, number>;
  /** Noms dels personatges en ordre d'aparició (sense el narrador ni «???»). */
  speakers: string[];
  /** Avisos per al DM (etiquetes que no existeixen…). */
  warnings: string[];
}

export const STYLES: { id: DialogStyle; label: string }[] = [
  { id: 'normal', label: 'Normal' }, { id: 'crit', label: 'Crit' },
  { id: 'xiuxiueig', label: 'Xiuxiueig' }, { id: 'pensament', label: 'Pensament' },
];
export const CAM_MODES: { id: DialogCamMode; label: string }[] = [
  { id: 'auto', label: 'Automàtica' }, { id: 'enfoca', label: 'Enfocar' },
  { id: 'dos', label: 'Els dos que parlen' }, { id: 'quiet', label: 'No moure' },
];

const STYLE_WORDS: Record<string, DialogStyle> = {
  normal: 'normal', crit: 'crit', cridant: 'crit', crida: 'crit',
  xiuxiueig: 'xiuxiueig', xiuxiuejant: 'xiuxiueig', xiuxiueja: 'xiuxiueig',
  pensament: 'pensament', pensa: 'pensament', pensant: 'pensament',
};
const CAM_WORDS: Record<string, DialogCamMode> = {
  auto: 'auto', automatica: 'auto', enfoca: 'enfoca', enfocar: 'enfoca',
  dos: 'dos', 'els dos': 'dos', 'tots dos': 'dos', quiet: 'quiet', quieta: 'quiet', 'no moure': 'quiet',
};

/** Sense accents ni majúscules ni espais de més: per comparar noms i etiquetes. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const isNarrator = (name: string) => norm(name) === 'narrador';
export const isAnonymous = (name: string) => /^\?+$/.test(name.trim());

const SAY_RE = /^([^:()>#\-/][^:()]{0,39}?)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;

export function parseScript(src: string): ParsedScript {
  const steps: ScriptStep[] = [];
  const labels: Record<string, number> = {};
  const speakers: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let last: ScriptSay | null = null;
  src.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//')) return;
    if (line.startsWith('#')) {
      const l = norm(line.slice(1));
      if (l) labels[l] = steps.length;
      last = null;
      return;
    }
    if (line.startsWith('->')) {
      steps.push({ kind: 'jump', label: norm(line.slice(2)) || 'fi' });
      last = null;
      return;
    }
    if (line.startsWith('>')) {
      const m = line.slice(1).split('->');
      const text = m[0].trim(), label = norm(m[1] ?? '');
      if (last && text) (last.options ??= []).push({ text, label: label || 'fi' });
      return;
    }
    const m = SAY_RE.exec(line);
    if (m) {
      const name = m[1].trim();
      let style: DialogStyle = 'normal', cam: DialogCamMode = 'auto';
      for (const w of (m[2] ?? '').split(',').map(norm).filter(Boolean)) {
        if (STYLE_WORDS[w]) style = STYLE_WORDS[w];
        else if (CAM_WORDS[w]) cam = CAM_WORDS[w];
      }
      const say: ScriptSay = { kind: 'say', src: i, name, style, cam, text: m[3].trim() };
      steps.push(say);
      last = say;
      if (!isNarrator(name) && !isAnonymous(name) && !seen.has(norm(name))) { seen.add(norm(name)); speakers.push(name); }
      return;
    }
    // Continuació del text de la intervenció d'abans.
    if (last) last.text = last.text ? `${last.text} ${line}` : line;
  });
  const want = (l: string) => { if (l !== 'fi' && labels[l] === undefined) warnings.push(`No hi ha cap «# ${l}».`); };
  for (const st of steps) {
    if (st.kind === 'jump') want(st.label);
    else st.options?.forEach(o => want(o.label));
  }
  return { steps, labels, speakers, warnings };
}

/** Pas que ve després de `i` (seguint els salts). `null` = s'ha acabat. */
export function nextSay(p: ParsedScript, i: number): number | null {
  let j = i + 1;
  for (let guard = 0; guard < 64; guard++) {
    const st = p.steps[j];
    if (!st) return null;
    if (st.kind === 'say') return j;
    if (st.label === 'fi' || p.labels[st.label] === undefined) return null;
    j = p.labels[st.label];
  }
  return null;
}

/** Primera intervenció a partir d'una etiqueta (o del començament). */
export function sayAtLabel(p: ParsedScript, label: string | null): number | null {
  if (label === 'fi') return null;
  const at = label === null ? 0 : p.labels[label];
  if (at === undefined) return null;
  return nextSay(p, at - 1);
}

/** Reescriu les opcions (estil i càmera) d'una intervenció del guió. */
export function setLineOpts(src: string, lineNo: number, style: DialogStyle, cam: DialogCamMode): string {
  const lines = src.split('\n');
  const m = SAY_RE.exec(lines[lineNo]?.trim() ?? '');
  if (!m) return src;
  const opts = [style !== 'normal' ? style : '', cam !== 'auto' ? CAM_SRC[cam] : ''].filter(Boolean);
  lines[lineNo] = `${m[1].trim()}${opts.length ? ` (${opts.join(', ')})` : ''}: ${m[3].trim()}`;
  return lines.join('\n');
}
const CAM_SRC: Record<DialogCamMode, string> = { auto: 'auto', enfoca: 'enfoca', dos: 'dos', quiet: 'quiet' };

/**
 * Relaciona cada nom del guió amb el token de l'escena que es diu igual (sense accents ni
 * majúscules), o que hi comença («Liriandor» → «Liriandor Líadon»). Els que ja estaven
 * relacionats a mà es conserven si el token encara hi és.
 */
export function matchCast(speakers: string[], tokens: { key: string; name: string }[],
  prev: Record<string, string | null> = {}): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const keys = new Set(tokens.map(t => t.key));
  for (const sp of speakers) {
    const kept = prev[sp];
    if (kept === null || (kept && keys.has(kept))) { out[sp] = kept; continue; }
    const n = norm(sp);
    const hit = tokens.find(t => norm(t.name) === n)
      ?? tokens.find(t => norm(t.name).startsWith(n + ' ') || norm(t.name).split(' ')[0] === n.split(' ')[0]);
    out[sp] = hit?.key ?? null;
  }
  return out;
}
