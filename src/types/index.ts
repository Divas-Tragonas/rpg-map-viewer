export interface PSDLayer {
  id: number;
  name: string;
  top: number;
  left: number;
  bottom: number;
  right: number;
  w: number;
  h: number;
  visible: boolean;
  opacity: number;
  secType: number;
  channelInfo: Array<{ id: number; len: number }>;
  children?: PSDLayer[];
  isGroup?: boolean;
}

export interface Enemy extends PSDLayer {
  isGroup: false;
}

export interface EnemySubGroup {
  id: number;
  name: string;
  enemies: PSDLayer[];
}

export interface EnemyRoom {
  id: number;
  name: string;
  enemies: PSDLayer[];
  directEnemies: PSDLayer[];
  subGroups: EnemySubGroup[];
}

export interface MapStructure {
  extras: PSDLayer & { children: PSDLayer[]; isGroup: true };
  roomLayers: PSDLayer[];
  enemyRooms: EnemyRoom[];
}

export interface PSDInfo {
  width: number;
  height: number;
}

export interface ParsedPSD {
  width: number;
  height: number;
  bitDepth: number;
  layers: PSDLayer[];
  channelDataOffset: number;
  error: string | null;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
  hp: number;
  hpMax: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface PaintedZone {
  id: string;
  element: string;
  points: Point[];
  bbox: BBox;
}

export type SpellType = 'fireball' | 'lightning' | 'magic_beam' | 'magic_missile' | 'hideous_laughter' | 'burning_hands' | 'sleep' | 'grease';

export interface Spell {
  id: string;
  type: SpellType;
  points: Point[];
  startTime: number;
}

export type SpellPreview =
  | { mode: 'line'; start: Point; end: Point }
  | { mode: 'area_place'; origin: Point; center: Point; spellType: string };

export interface AreaSpellPending {
  type: SpellType;
  origin: Point;
}

export type DrawTool = 'none' | 'pen' | 'eraser' | 'shape' | 'pointer';

export interface StrokeData {
  points: Point[];
  color: string;
  size: number;
  tool: DrawTool;
}

export interface StrokeAnimState extends StrokeData {
  idx: number;
  ptsPerFrame: number;
}

export interface LibEnemy {
  id: number;
  templateId: string;
  name: string;
  color: string;
  hpMax: number;
  hp: number;
  R: number;
  visible: boolean;
  imageData: string | null;
}

export interface PsdEnemyOverride {
  hp?: number;
  hpMax?: number;
  name?: string;
  imageData?: string;
}

export type PsdEnemyOverrides = Record<number, PsdEnemyOverride>;

export interface ContextMenuState {
  id: number | string;
  name: string;
  x: number;
  y: number;
  isPaintedZone?: boolean;
  isAreaSpell?: boolean;
  isLibEnemy?: boolean;
  libEnemyId?: number;
  tokenPos?: Point | null;
  isMultiSelect?: boolean;
  ids?: (number | string)[];
}

export interface ExpositorState {
  visible: boolean;
  src: string | null;
  mediaType: 'image' | 'video' | null;
}

export interface SceneConfigMenuState {
  id: number | string;
  name: string;
  tokenPos: Point | null;
  menuX: number;
  menuY: number;
}

export interface ShapeMenuState {
  points: Point[];
  bbox: BBox;
  cx: number;
  cy: number;
}

export interface SpellMenuState {
  points: Point[];
  cx: number;
  cy: number;
  mode?: 'path' | 'line' | 'area';
}

export interface Condition {
  id: string;
  label: string;
  bg: string;
  tint: string | null;
}

export interface Element {
  id: string;
  label: string;
  color: string;
  glow: string;
  emoji: string;
}

export type VisMap = Record<number | string, boolean>;
export type PosMap = Record<number | string, Point>;
export type ConditionsMap = Record<string, string[]>;
export type DefeatedMap = Record<string, boolean>;
export type TokenSizeMap = Record<string, number>;

export interface BCStateMessage {
  type: 'STATE';
  vis?: VisMap;
  pos?: PosMap;
  zoom?: number;
  panOffset?: Point;
  players?: Player[];
  conditions?: ConditionsMap;
  defeated?: DefeatedMap;
  paintedZones?: PaintedZone[];
  gridVisible?: boolean;
  gridSize?: number;
  gridSnap?: boolean;
  gridOriginX?: number;
  gridOriginY?: number;
  gridLineWidth?: number;
  enemyHighlight?: boolean;
  highlightLocked?: boolean;
  tokenSizeOverride?: TokenSizeMap;
  appMode?: string;
  dmPreviewActive?: boolean;
  dmPreviewZoom?: number;
  dmPreviewPan?: Point;
  libEnemies?: LibEnemy[];
  psdEnemyOverrides?: PsdEnemyOverrides;
}

export interface BCStructMessage {
  type: 'STRUCT';
  struct: MapStructure;
  vis: VisMap;
  pos: PosMap;
  zoom: number;
  players: Player[];
  psdInfo: PSDInfo;
  layerImageUrls: Record<string, string>;
  conditions: ConditionsMap;
  defeated: DefeatedMap;
  paintedZones: PaintedZone[];
  panOffset: Point;
  gridVisible: boolean;
  gridSize: number;
  gridSnap: boolean;
  gridOriginX: number;
  gridOriginY: number;
  gridLineWidth: number;
  enemyHighlight: boolean;
  highlightLocked: boolean;
  tokenSizeOverride: TokenSizeMap;
  libEnemies: LibEnemy[];
  psdEnemyOverrides?: PsdEnemyOverrides;
}

export type BCMessage =
  | BCStateMessage
  | BCStructMessage
  | { type: 'BG'; buffer: ArrayBuffer; mimeType: string; withFade?: boolean }
  | { type: 'STROKE'; points: Point[]; color: string; size: number; tool: DrawTool }
  | { type: 'CLEAR_DRAW' }
  | { type: 'UNDO_DRAW'; strokeHistory: StrokeData[] }
  | { type: 'POINTER'; pos: Point | null }
  | { type: 'SPELL'; spell: Omit<Spell, 'startTime'> & { startTime: number } }
  | { type: 'DELETE_SPELL'; id: string }
  | { type: 'BOSS_INTRO'; tokenId: number | string; bossName: string; tokenPos: Point | null; portraitDataUrl: string | null }
  | { type: 'BOSS_INTRO_SKIP' }
  | { type: 'PLAYER_READY' }
  | { type: 'EXPOSITOR_SHOW'; buffer: ArrayBuffer; mimeType: string }
  | { type: 'EXPOSITOR_HIDE' }
  | { type: 'EXPOSITOR_SYNC'; zoom: number; panXNorm: number; panYNorm: number; kbTxPct: number; kbTyPct: number }
  | { type: 'TEXTREVEAL_SHOW'; text: string; pos: number; cps: number; fadeMs: number }
  | { type: 'TEXTREVEAL_HIDE' }
  | { type: 'TEXTREVEAL_SYNC'; pos: number; cps: number; fadeMs: number }
  | { type: 'TOKEN_MOVE'; id: number | string; x: number; y: number }
  | { type: 'BG_META'; mimeType: string; withFade?: boolean }
  | { type: 'EXPOSITOR_SHOW_META'; mimeType: string };
