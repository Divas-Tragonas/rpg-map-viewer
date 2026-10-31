/**
 * Missions preparades: un mapa concret amb la colla ja col·locada i el que aquell mapa demana
 * (de moment, l'ajust de color de les figuretes). Obrir-ne una és carregar una partida feta
 * (`missionState` → `applySessionState`), o sigui que tot el que ja funciona amb les partides
 * (desat, desat automàtic, sincronització amb els jugadors) hi funciona igual.
 *
 * De moment els mapes viuen al repositori (`public/missions/<id>/`); més endavant aniran al
 * back office. El mapa de cada missió es genera amb el seu script (`scripts/mission-*.py`).
 */
import type { Door, FigureGrade, MissionScenes, Player, Room, TurnState, Wall } from '@/types';
import { DEFAULT_PARTY, DEFAULT_SPEED_FT } from '@/constants';
import { detectRooms } from '@/lib/rooms/detect';
import { getBBox, pointInPolygon } from '@/lib/geometry';
import { CONYBERRY_PLACES } from '@/lib/places/conyberry';

/**
 * Un lloc d'una missió on la colla pot entrar (una casa, la farga, la capella…): un mapa propi
 * amb la seva geometria de joc. GENERAT pels scripts de cada missió
 * (`scripts/mission-conyberry-llocs.py` → `lib/places/conyberry.ts`), que també en dibuixen el mapa.
 */
export interface MissionPlace {
  id: string;
  name: string;
  /** `interior`: dins d'una casa; `exterior`: un tros de fora vist de més a prop (el pati de la farga). */
  kind: 'interior' | 'exterior';
  /** Una línia per al DM: què hi ha. */
  text: string;
  /** Mapa dins de `public/` (sense la barra del davant), amb caselles de la mida de la missió. */
  map: string;
  cols: number;
  rows: number;
  /** Al mapa de la missió: la casella davant de la porta (la marca del DM). */
  door: [number, number];
  /** Al mapa de la missió: on queda la colla en sortir. */
  back: [number, number][];
  /** Al mapa del lloc: on apareix la colla en entrar, i la sortida (la marca del DM). */
  spawn: [number, number][];
  exit: [number, number];
  /** Parets (x1, y1, x2, y2 en px de mapa, una darrere l'altra) i portes (x1, y1, x2, y2, oberta). */
  walls: number[];
  doors: number[];
  /** Nom de cada sala, amb una casella de dins; les cares del graf de parets sense nom no són sales. */
  rooms: { name: string; c: number; r: number; dark: boolean }[];
}

export interface Mission {
  id: string;
  name: string;
  /** Una línia sota el nom (on és, què s'hi fa). */
  subtitle: string;
  /** Mapa dins de `public/` (sense la barra del davant). */
  map: string;
  /** Mida de la casella del mapa en px. */
  cell: number;
  /** Casella de cada membre de la colla, en l'ordre de `DEFAULT_PARTY`. */
  party: [number, number][];
  /** Ajust de color perquè les figuretes del paquet lliguin amb el mapa. */
  figureGrade: FigureGrade;
  /** Llocs on es pot entrar (canvi d'escena amb fos a negre). Veure `sceneState`. */
  places?: MissionPlace[];
}

export const MISSIONS: Mission[] = [
  {
    id: 'conyberry',
    name: 'Cony Cirera',
    subtitle: 'El poble abandonat del llac',
    map: 'missions/conyberry/mapa.png',
    cell: 48,
    // Al camí, al sud del pou.
    party: [[17, 13], [18, 13], [16, 14], [17, 14], [18, 14]],
    // Mesurat amb les figuretes damunt del mapa: una mica menys saturades i cap al to càlid de
    // l'aquarel·la, però més clares que el mapa, amb els negres a la tinta del mapa (`INK` de
    // `scripts/oryx-village.py`) i l'ombra cap a baix a la dreta que fan els arbres i les cases.
    // Amb l'ajust de la v4.53 (sat 0,6, guany 0,95 i sense ombra) es barrejaven amb el camí.
    figureGrade: { sat: 0.85, warm: [1, 0.98, 0.92], gain: 1.08, ink: [44, 36, 24], shadow: 0.55 },
    // Els grups de cases que l'usuari va marcar al mapa (la resta no tenen interior).
    places: CONYBERRY_PLACES,
  },
];

/** L'escena del mapa de la missió (el poble); la resta d'escenes són els `id` dels llocs. */
export const VILLAGE = 'poble';

export const missionUrl = (m: Mission) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/${m.map}`;

const NO_TURN: TurnState = { active: false, order: [], turnIndex: 0, round: 1, activeRemainingFt: 0 };

/** La partida d'inici d'una missió, en el format que llegeix `applySessionState`. */
export function missionState(m: Mission, bg: Blob): Record<string, unknown> {
  const R = Math.round(m.cell * 0.45);
  const pos: Record<string, { x: number; y: number }> = {};
  const sizes: Record<string, number> = {};
  const players: Player[] = DEFAULT_PARTY.map((p, i) => {
    const [c, r] = m.party[i] ?? m.party[0];
    // La posició d'un token de jugador és la cantonada (centre − R), com a `addPlayer`.
    const x = c * m.cell + m.cell / 2 - R, y = r * m.cell + m.cell / 2 - R;
    const id = 9001 + i;
    pos[`pl_${id}`] = { x, y }; sizes[`pl_${id}`] = R;
    return { id, name: p.name, color: p.color, x, y, visible: true, hp: p.hpMax, hpMax: p.hpMax, speed: p.speed ?? DEFAULT_SPEED_FT, sprite: p.sprite };
  });
  // Tot el que no és de la missió es buida: si no, quedaria el que hi hagués del mapa d'abans.
  return {
    bgBlob: bg, bgName: `${m.name}.png`,
    players, pos, tokenSizeOverride: sizes,
    // La graella del mapa (una casella = 5 ft), visible, amb els tokens ajustats a la casella i
    // els enemics que s'afegeixin de la biblioteca també a la mida de la casella.
    gridSize: m.cell, gridOriginX: 0, gridOriginY: 0, gridSnap: true, gridVisible: true, gridLineWidth: 1,
    gridAutoSize: true,
    zoom: 1, panOffset: { x: 0, y: 0 },
    vis: {}, conditions: {}, defeated: {}, paintedZones: [], strokeHistory: [],
    libEnemies: [], walls: [], rooms: [], doors: [], lights: [], turn: NO_TURN,
    tokenGroups: [], dialogs: {}, tileMap: null,
    figureGrade: m.figureGrade,
    missionScenes: m.places?.length ? { mission: m.id, current: VILLAGE, saved: {} } satisfies MissionScenes : null,
  };
}

// ── Escenes: entrar i sortir dels llocs ──────────────────────────────────────

export const missionById = (id: string | undefined) => MISSIONS.find(m => m.id === id);
export const placeOf = (m: Mission, scene: string) => m.places?.find(p => p.id === scene);
export const sceneTitle = (m: Mission, scene: string) => (scene === VILLAGE ? m.name : placeOf(m, scene)?.name ?? m.name);
export const sceneUrl = (m: Mission, scene: string) => {
  const p = placeOf(m, scene);
  return p ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/${p.map}` : missionUrl(m);
};

/** Parets, portes i sales d'un lloc. Les sales són les cares del graf de parets amb nom. */
export function placeGeometry(p: MissionPlace, cell: number): { walls: Wall[]; doors: Door[]; rooms: Room[] } {
  const walls: Wall[] = [];
  for (let i = 0; i + 3 < p.walls.length; i += 4) walls.push({ a: { x: p.walls[i], y: p.walls[i + 1] }, b: { x: p.walls[i + 2], y: p.walls[i + 3] } });
  const doors: Door[] = [];
  for (let i = 0, k = 0; i + 4 < p.doors.length; i += 5, k++) {
    doors.push({ id: `pd_${p.id}_${k}`, a: { x: p.doors[i], y: p.doors[i + 1] }, b: { x: p.doors[i + 2], y: p.doors[i + 3] }, open: p.doors[i + 4] === 1 });
  }
  const faces = detectRooms(walls);
  const area = (poly: { x: number; y: number }[]) => { const b = getBBox(poly); return b.w * b.h; };
  const rooms: Room[] = [];
  p.rooms.forEach((lab, i) => {
    const x = (lab.c + 0.5) * cell, y = (lab.r + 0.5) * cell;
    // La cara més petita que conté la casella: el contorn de fora de la casa també la conté.
    const face = faces.filter(f => pointInPolygon(x, y, f)).sort((a, b) => area(a) - area(b))[0];
    if (!face || rooms.some(r => r.points === face)) return;
    rooms.push({ id: `room_${p.id}_${i}`, points: face, bbox: getBBox(face), name: lab.name, dark: lab.dark, revealed: false });
  });
  return { walls, doors, rooms };
}

/** Partida d'una escena on la colla no ha estat mai (sense la colla: la porta `sceneState`). */
function freshScene(m: Mission, scene: string, bg: Blob): Record<string, unknown> {
  const p = placeOf(m, scene);
  if (!p) return missionState(m, bg);
  const { walls, doors, rooms } = placeGeometry(p, m.cell);
  return {
    bgName: `${p.name}.png`,
    pos: {}, tokenSizeOverride: {},
    gridSize: m.cell, gridOriginX: 0, gridOriginY: 0, gridSnap: true, gridVisible: true, gridLineWidth: 1,
    gridAutoSize: true,
    zoom: 1, panOffset: { x: 0, y: 0 },
    vis: {}, conditions: {}, defeated: {}, paintedZones: [], strokeHistory: [],
    libEnemies: [], walls, rooms, doors, lights: [], turn: NO_TURN,
    tokenGroups: [], dialogs: {}, tileMap: null,
  };
}

const isPl = (k: string) => k.startsWith('pl_');
/** Les entrades d'un mapa per token: les de l'escena (`base`) que no són de jugadors + les dels jugadors d'ara. */
function mergePl<T>(base: Record<string, T> | undefined, cur: Record<string, T> | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(base ?? {})) if (!isPl(k)) out[k] = v;
  for (const [k, v] of Object.entries(cur ?? {})) if (isPl(k)) out[k] = v;
  return out;
}

/**
 * Canvi d'escena: l'estat de la partida (format de `applySessionState`) de l'escena `target`.
 * L'escena d'on es ve (`cur`, el nucli de la partida d'ara) es desa tal com és, i la de destí
 * es recupera com es va deixar (o es crea si no s'hi ha estat mai). La colla hi va sencera,
 * amb la vida, els estats i els diàlegs: només canvia on és (a l'entrada del lloc, o davant de
 * la porta del poble en sortir). Un combat s'acaba en canviar d'escena.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sceneState(m: Mission, scenes: MissionScenes, cur: Record<string, any>, target: string, bg: Blob): Record<string, unknown> {
  const from = scenes.current;
  const { missionScenes: _drop, ...core } = cur;
  void _drop;
  const saved = { ...scenes.saved, [from]: core };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: Record<string, any> = saved[target] ? { ...saved[target] } : freshScene(m, target, bg);
  const fromPlace = placeOf(m, from), toPlace = placeOf(m, target);
  const cells = toPlace ? toPlace.spawn : (fromPlace?.back ?? m.party);
  const R = Math.round(m.cell * 0.45);
  const posIn = (i: number) => {
    const [c, r] = cells[i % cells.length];
    return { x: c * m.cell + m.cell / 2 - R, y: r * m.cell + m.cell / 2 - R };
  };
  const players: Player[] = (cur.players ?? []).map((pl: Player, i: number) => ({ ...pl, ...posIn(i) }));
  const pos = mergePl<{ x: number; y: number }>(base.pos, {});
  players.forEach(pl => { pos[`pl_${pl.id}`] = { x: pl.x, y: pl.y }; });
  return {
    ...base,
    bgBlob: bg, bgName: base.bgName ?? `${sceneTitle(m, target)}.png`,
    players, pos,
    conditions: mergePl(base.conditions, cur.conditions),
    defeated: mergePl(base.defeated, cur.defeated),
    tokenSizeOverride: mergePl(base.tokenSizeOverride, cur.tokenSizeOverride),
    dialogs: mergePl(base.dialogs, cur.dialogs),
    turn: NO_TURN,
    // L'ajust de color és del mapa de la missió (tots els llocs són del mateix full de poble):
    // es conserva com el tenia el DM (encès o apagat).
    figureGrade: cur.figureGrade ?? m.figureGrade,
    appStyle: cur.appStyle,
    missionScenes: { mission: m.id, current: target, saved } satisfies MissionScenes,
  };
}
