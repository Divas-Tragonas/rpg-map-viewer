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
  /** Velocitat de moviment en peus (1 casella = 5 ft). Absent → DEFAULT_SPEED_FT. Limita el drag des de /player; el DM no té límit. */
  speed?: number;
  /** false → el token no es pot moure des de /player (el DM sempre pot). Absent → true. */
  canMove?: boolean;
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

// Un tram de paret dibuixat pel DM. Les sales fosques es deriven del conjunt de parets.
export interface Wall {
  a: Point;
  b: Point;
}

// Sala detectada (una cara tancada del graf de parets). El polígon `points` es recalcula
// a cada canvi de parets; `dark`/`revealed` els controla el DM.
export interface Room {
  id: string;
  points: Point[];
  bbox: BBox;
  name: string;
  dark: boolean;      // true → habitació fosca (overlay de foscor + ull, com Photoshop)
  revealed: boolean;  // true → revelada als jugadors (només aplica quan dark)
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

export type DrawTool = 'none' | 'pen' | 'eraser' | 'shape' | 'pointer' | 'wall';

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
  /** Group the token/selection currently belongs to (fully), if any. */
  existingGroupId?: string;
  /** Set when the right-click landed on a detected room (walls tool). */
  isRoom?: boolean;
  roomDark?: boolean;
  roomRevealed?: boolean;
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

// Sistema per torns (iniciativa). El DM és la font de veritat; el jugador el rep
// sincronitzat per limitar el moviment del token actiu segons el saldo restant.
export interface TurnState {
  active: boolean;               // combat en curs
  order: (number | string)[];    // ordre de torn: ids plans de token (pl_*, lib_*, o id PSD)
  turnIndex: number;             // índex dins `order` del token que té el torn
  round: number;                 // ronda actual (comença a 1)
  activeRemainingFt: number;     // peus de moviment que li queden al token actiu
  // Saldo de peus amb què va acabar cada token que ja ha passat aquesta ronda (per poder
  // "recuperar" el seu torn tal com havia quedat). Es neteja a cada ronda nova.
  remaining?: Record<string, number>;
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
  rooms?: Room[];
  // Spells d'àrea actius (dormir/grasa) i regla de mesura: es reconcilien al STATE
  // perquè un DELETE_SPELL o un MEASURE de neteja perduts (reconnexió WS) no deixin
  // l'estat obsolet a la pantalla del jugador (camp pesat: només quan canvia la ref).
  activeSpells?: Spell[];
  measure?: { a: Point | null; b: Point | null };
  // Estat del sistema per torns (camp lleuger: petit i s'envia sempre).
  turn?: TurnState;
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
  rooms?: Room[];
  // Spells d'àrea actius: al STRUCT perquè un jugador que es connecta tard els vegi.
  activeSpells?: Spell[];
  // Punter i regla de mesura del DM: es reenvien al STRUCT perquè una reconnexió
  // del WS (Safari en tablet suspèn el socket sovint) no els perdi.
  measure?: { a: Point | null; b: Point | null };
  pointerPos?: Point | null;
  turn?: TurnState;
}

export type BCMessage =
  | BCStateMessage
  | BCStructMessage
  | { type: 'BG'; buffer: ArrayBuffer; mimeType: string; withFade?: boolean }
  | { type: 'STROKE'; points: Point[]; color: string; size: number; tool: DrawTool }
  | { type: 'CLEAR_DRAW' }
  | { type: 'UNDO_DRAW'; strokeHistory: StrokeData[] }
  | { type: 'POINTER'; pos: Point | null }
  | { type: 'MEASURE'; a: Point | null; b: Point | null }
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
  | { type: 'TOKEN_RELAY'; id: number | string; x: number; y: number }
  | { type: 'BG_META'; mimeType: string; withFade?: boolean }
  | { type: 'EXPOSITOR_SHOW_META'; mimeType: string };
