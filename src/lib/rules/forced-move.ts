import type { PaintedZone, Point, Wall } from '@/types';
import type { TokenSlot } from '@/lib/render/token-geom';
import { pointInPolygon } from '@/lib/geometry';
import { segmentBlocked, type CellBlocker } from '@/lib/rooms/pathing';
import { createJsonStore } from '@/lib/localStore';
import { cellKeyOf, cellSteps, cellsDistFt, tokenCells, tokenSpan, type Grid } from '@/lib/rules/cells';

/**
 * Moviment forçat (v5.44): empènyer o estirar una criatura en línia recta (Ona atronadora, Fuet
 * d'espines, l'Empenta). Es recorre casella a casella: s'atura abans d'una paret, d'una porta tancada,
 * d'un objecte sòlid del mapa de caselles o d'una altra criatura; estirant, també quan queda al costat
 * de qui estira. El terreny difícil no el frena i no gasta peus del torn (el DM mou el token).
 * Només amb graella: sense, no es pot mesurar en peus.
 */

/** Empenta d'un efecte: peus (negatiu = estira cap al llançador), mida màxima i quan s'aplica. */
export interface PushSpec {
  ft: number;
  /** Mida màxima en caselles de costat (2 = Gran o més petit). Absent = qualsevol. */
  maxSpan?: number;
  /** `fail` = qui no supera la salvació (per defecte); `hit` = si l'atac toca. */
  on?: 'fail' | 'hit';
}

export interface ForcedStop {
  kind: 'wall' | 'creature' | 'caster';
  /** Token amb qui xoca (`kind: 'creature'`). */
  who?: string;
}

export interface ForcedResult {
  key: string;
  /** Centre d'abans i de després (coordenades de mapa). */
  from: Point; to: Point;
  /** Peus recorreguts i els que volia recórrer (la diferència: el que no ha pogut fer). */
  movedFt: number; wantedFt: number;
  stop?: ForcedStop;
  /** Zones màgiques on entra (elements: `fire`, `poison`…), en l'ordre en què hi entra. */
  zones: string[];
}

export interface ForcedOpts {
  key: string;
  /** Centre de qui empeny (la direcció és d'aquí cap a l'objectiu; estirant, al revés). */
  origin: Point;
  /** Peus: positiu empeny, negatiu estira. */
  ft: number;
  /** Direcció explícita (acció manual): un punt cap on va. Mana sobre `origin`. */
  toward?: Point;
  /** Token que estira (no es pot travessar i s'atura al seu costat). */
  casterKey?: string;
  slots: readonly TokenSlot[];
  grid: Grid;
  walls: readonly Wall[];
  blocked?: CellBlocker;
  zones?: readonly PaintedZone[];
  /** Caselles ja ocupades pels empesos anteriors (diversos afectats d'un mateix efecte). */
  reserved?: ReadonlySet<string>;
}

/** On acaba un token empès o estirat. `null` si no se'l pot moure (sense direcció o sense ell). */
export function forcedMove(o: ForcedOpts): ForcedResult | null {
  const me = o.slots.find(s => s.key === o.key);
  if (!me || o.ft === 0) return null;
  const pull = o.ft < 0;
  const target = o.toward ?? o.origin;
  let vx = o.toward ? target.x - me.x : (pull ? o.origin.x - me.x : me.x - o.origin.x);
  let vy = o.toward ? target.y - me.y : (pull ? o.origin.y - me.y : me.y - o.origin.y);
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return null;
  vx /= len; vy /= len;
  const n = Math.round(Math.abs(o.ft) / 5);
  // Casella final en línia recta i passos intermedis (un per casella de l'eix llarg).
  const tdc = Math.round(vx * n), tdr = Math.round(vy * n);
  const steps = Math.max(Math.abs(tdc), Math.abs(tdr));
  const g = o.grid;
  const others = o.slots.filter(s => s.key !== o.key);
  const occ = new Map<string, string>();
  for (const s of others) for (const c of tokenCells({ x: s.x, y: s.y }, s.R, g)) occ.set(cellKeyOf(c), s.key);
  const caster = o.casterKey ? o.slots.find(s => s.key === o.casterKey) : undefined;
  const casterCells = caster ? tokenCells({ x: caster.x, y: caster.y }, caster.R, g) : null;
  const zones = o.zones ?? [];
  const inZones = (p: Point) => zones.filter(z => pointInPolygon(p.x, p.y, z.points)).map(z => z.id);

  let cur: Point = { x: me.x, y: me.y };
  let pc = 0, pr = 0;
  let stop: ForcedStop | undefined;
  const entered: string[] = [];
  let inside = new Set(inZones(cur));
  for (let i = 1; i <= steps; i++) {
    const dc = Math.round((tdc * i) / steps), dr = Math.round((tdr * i) / steps);
    const next: Point = { x: me.x + dc * g.gs, y: me.y + dr * g.gs };
    if (segmentBlocked(cur, next, o.walls as Wall[]) || o.blocked?.(next)) { stop = { kind: 'wall' }; break; }
    const cells = tokenCells(next, me.R, g);
    if (casterCells && cells.some(c => casterCells.some(k => k[0] === c[0] && k[1] === c[1]))) { stop = { kind: 'caster' }; break; }
    const hit = cells.map(c => occ.get(cellKeyOf(c))).find(Boolean)
      ?? (cells.some(c => o.reserved?.has(cellKeyOf(c))) ? '' : undefined);
    if (hit !== undefined) { stop = { kind: 'creature', ...(hit ? { who: hit } : {}) }; break; }
    cur = next; pc = dc; pr = dr;
    const now = new Set(inZones(cur));
    for (const id of now) if (!inside.has(id)) entered.push(zones.find(z => z.id === id)!.element);
    inside = now;
    // Estirant: s'atura en quedar al costat de qui estira.
    if (casterCells && cellsDistFt(cells, casterCells) <= 5) break;
  }
  // Mateixa mètrica que el moviment (la diagonal compta el que mesura).
  const movedFt = cellSteps([0, 0], [pc, pr]) * 5;
  return { key: o.key, from: { x: me.x, y: me.y }, to: cur, movedFt, wantedFt: Math.abs(o.ft), ...(stop ? { stop } : {}), zones: entered };
}

/**
 * Diversos afectats d'un mateix efecte: primer el més allunyat de l'origen (així no es bloquegen
 * entre ells), i cadascú reserva les caselles on acaba.
 */
export function forcedMoveAll(keys: readonly string[], base: Omit<ForcedOpts, 'key' | 'reserved'>): ForcedResult[] {
  const slotOf = (k: string) => base.slots.find(s => s.key === k);
  const ordered = [...keys].filter(k => slotOf(k)).sort((a, b) => {
    const A = slotOf(a)!, B = slotOf(b)!;
    const da = Math.hypot(A.x - base.origin.x, A.y - base.origin.y), db = Math.hypot(B.x - base.origin.x, B.y - base.origin.y);
    return base.ft >= 0 ? db - da : da - db;
  });
  const out: ForcedResult[] = [];
  let slots = [...base.slots];
  for (const k of ordered) {
    const r = forcedMove({ ...base, key: k, slots });
    if (!r) continue;
    out.push(r);
    // Els següents el veuen ja al seu lloc nou.
    slots = slots.map(s => s.key === k ? { ...s, x: r.to.x, y: r.to.y } : s);
  }
  return out;
}

/** Cap la criatura? `maxSpan` en caselles de costat (2 = Gran). */
export function pushFits(spec: PushSpec, R: number, gs: number): boolean {
  return spec.maxSpan === undefined || tokenSpan(R, gs) <= spec.maxSpan;
}

/** Text curt del resultat per a l'avís i l'historial. */
export function forcedText(r: ForcedResult, name: string, nameOf: (k: string) => string): string {
  const verb = r.movedFt === 0 ? 'no es mou' : `recula ${r.movedFt} ft`;
  const why = r.stop?.kind === 'wall' ? ' (xoca amb una paret)'
    : r.stop?.kind === 'creature' ? ` (xoca amb ${r.stop.who ? nameOf(r.stop.who) : 'una altra criatura'})`
    : '';
  return `${name} ${verb}${why}`;
}

/**
 * Regla de la casa (desactivada per defecte): estampar-se contra una paret o una criatura fa
 * 1d6 contundent per cada 10 ft que no s'han pogut fer (mínim 1d6). Preferència del DM al navegador.
 */
export const forcedImpactStore = createJsonStore<boolean>('rpg.forcedImpact', false, v => v === true);

/** Daus del cop per estampar-se (regla de la casa). `null` si no hi ha xoc o no s'ha perdut res. */
export function impactDice(r: ForcedResult): string | null {
  if (!r.stop || r.stop.kind === 'caster') return null;
  const lost = r.wantedFt - r.movedFt;
  if (lost <= 0) return null;
  return `${Math.max(1, Math.round(lost / 10))}d6`;
}
