import type {
  ConditionsMap, DefeatedMap, LibEnemy, MapStructure, Player, Point, PosMap, PsdEnemyOverrides, Room, TokenSizeMap, VisMap,
} from '@/types';
import { pointInPolygon } from '@/lib/geometry';

type Ref<T> = { current: T };
/**
 * El que cal saber dels tokens per a un diàleg. El DM (`useDMRefs`) i la pantalla de
 * jugador tenen els mateixos refs amb els mateixos noms, o sigui que tots dos el compleixen.
 */
export interface DialogWorld {
  rPos: Ref<PosMap>;
  rPlayers: Ref<Player[]>;
  rLibEnemies: Ref<LibEnemy[]>;
  rStruct: Ref<MapStructure | null>;
  rPsdEnemyOverrides: Ref<PsdEnemyOverrides>;
  rTokenSizeOverride: Ref<TokenSizeMap>;
  rDefeated: Ref<DefeatedMap>;
  rConditions: Ref<ConditionsMap>;
  rVis: Ref<VisMap>;
  rRooms: Ref<Room[]>;
  rLayerImages: Ref<Record<number, HTMLCanvasElement>>;
  /** Posició suavitzada (LERP) que es pinta: la càmera i el globus la segueixen si n'hi ha. */
  visualPosRef?: Ref<PosMap>;
}

export interface DialogToken {
  key: string;
  name: string;
  color: string;
  /** Centre del token (coords de mapa). */
  center: Point;
  R: number;
  sprite?: string;
  /** Imatge per al retrat de l'app Clàssica (dataURL, o el llenç de la capa del PSD). */
  image?: string | HTMLCanvasElement;
  defeated: boolean;
  /** Els jugadors no el poden veure (invisible, ull tancat o dins d'una sala fosca). */
  hidden: boolean;
}

/** Tots els tokens de l'escena amb nom: per relacionar-los amb els noms del guió. */
export function sceneTokens(w: DialogWorld): { key: string; name: string }[] {
  const out: { key: string; name: string }[] = [];
  for (const p of w.rPlayers.current) out.push({ key: `pl_${p.id}`, name: p.name });
  for (const e of w.rLibEnemies.current) out.push({ key: `lib_${e.id}`, name: e.name });
  for (const room of w.rStruct.current?.enemyRooms ?? []) for (const e of room.enemies) {
    out.push({ key: String(e.id), name: w.rPsdEnemyOverrides.current[e.id]?.name || e.name });
  }
  return out;
}

const inDarkRoom = (w: DialogWorld, p: Point) =>
  w.rRooms.current.find(r => r.dark && !r.revealed && pointInPolygon(p.x, p.y, r.points)) ?? null;

export function dialogToken(w: DialogWorld, key: string | null, visual = false): DialogToken | null {
  if (!key) return null;
  const pos = (k: string) => (visual ? w.visualPosRef?.current[k] : undefined) ?? w.rPos.current[k];
  const conds = w.rConditions.current[key] ?? [];
  const invisible = conds.includes('invisible');
  const defeated = !!w.rDefeated.current[key];
  if (key.startsWith('pl_')) {
    const p = w.rPlayers.current.find(pl => `pl_${pl.id}` === key); if (!p) return null;
    const R = w.rTokenSizeOverride.current[key] ?? 22;
    const at = pos(key) ?? { x: p.x, y: p.y };
    // La posició d'un jugador és la cantonada del token.
    return { key, name: p.name, color: p.color, center: { x: at.x + R, y: at.y + R }, R, sprite: p.sprite,
      image: p.portrait, defeated, hidden: invisible || p.visible === false };
  }
  let tok: Omit<DialogToken, 'hidden'> | null = null;
  let eyeClosed = false;
  if (key.startsWith('lib_')) {
    const e = w.rLibEnemies.current.find(en => `lib_${en.id}` === key); if (!e) return null;
    const at = pos(key); if (!at) return null;
    tok = { key, name: e.name, color: e.color, center: at, R: w.rTokenSizeOverride.current[key] ?? e.R, sprite: e.sprite,
      image: e.imageData ?? undefined, defeated };
    eyeClosed = e.visible === false;
  } else {
    const id = Number(key);
    const e = w.rStruct.current?.enemyRooms.flatMap(r => r.enemies).find(en => en.id === id); if (!e) return null;
    const at = pos(key); if (!at) return null;
    const ov = w.rPsdEnemyOverrides.current[id] ?? {};
    tok = { key, name: ov.name || e.name, color: '#f85149', center: at,
      R: w.rTokenSizeOverride.current[key] ?? Math.max(Math.min(e.w, e.h) / 2, 22), sprite: ov.sprite,
      image: ov.imageData ?? w.rLayerImages.current[id], defeated };
    eyeClosed = !w.rVis.current[id];
    // Zona del PSD amb la coberta posada (amagada als jugadors).
    const s = w.rStruct.current;
    if (s?.roomLayers.some(zl => {
      if (!w.rVis.current[zl.id]) return false;
      const zp = w.rPos.current[zl.id] || { x: zl.left + zl.w / 2, y: zl.top + zl.h / 2 };
      return at.x >= zp.x - zl.w / 2 && at.x <= zp.x + zl.w / 2 && at.y >= zp.y - zl.h / 2 && at.y <= zp.y + zl.h / 2;
    })) eyeClosed = true;
  }
  // Dins d'una sala fosca no revelada: amagat, llevat que hi hagi un jugador a la mateixa
  // sala (la seva llum el fa visible).
  const room = inDarkRoom(w, tok.center);
  const lit = room && w.rPlayers.current.some(p => {
    if (p.visible === false) return false;
    const r = w.rTokenSizeOverride.current[`pl_${p.id}`] ?? 22;
    const at = w.rPos.current[`pl_${p.id}`] ?? { x: p.x, y: p.y };
    return pointInPolygon(at.x + r, at.y + r, room.points);
  });
  return { ...tok, hidden: invisible || eyeClosed || (!!room && !lit) };
}

/** Inicials per al retrat de l'app Clàssica quan el token no té imatge. */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
