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
  /**
   * true → estructura buida creada per l'app (mapa només amb imatge de fons, sense PSD).
   * El render loop necessita un `struct` per sortir del `if (!s) return`; amb aquesta
   * estructura sintètica el grid, les sales, les parets, les llums i els tokens funcionen
   * només amb la imatge. La UI que és exclusiva del PSD (arbre de capes, "Resaltar
   * enemics", comptador d'actius) s'amaga quan és sintètica.
   */
  synthetic?: boolean;
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
  /** Radi de visió en peus dins de sales fosques (llum que emet el token). Absent → DEFAULT_VISION_FT; 0 → sense llum. */
  visionFt?: number;
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

// Porta: un tram SOBRE una paret (segment a–b alineat amb la paret). Una porta OBERTA
// s'exclou de les "parets efectives" (llum i col·lisió hi passen); una porta TANCADA
// deixa la paret sencera (torna a bloquejar). La paret sencera segueix sempre al graf
// de detecció de sales (la porta no parteix la sala).
export interface Door {
  id: string;
  a: Point;
  b: Point;
  /** false → porta tancada (bloqueja llum i moviment). Absent → oberta. */
  open?: boolean;
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

export type DrawTool = 'none' | 'pen' | 'eraser' | 'shape' | 'pointer' | 'wall' | 'light';

// Punt de llum (torxa/llàntia) col·locat pel DM dins d'una sala. Només s'activa (i els
// jugadors veuen la seva zona) si un token de jugador és dins de la mateixa sala.
export interface LightSource {
  id: string;
  x: number;
  y: number;
  radiusFt: number;
}

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

/**
 * Estat (condició) de D&D que es pot aplicar a un token.
 * L'isotip vectorial corresponent viu a `src/lib/conditions/icons.ts` (mateixa `id`).
 */
export interface Condition {
  id: string;
  /** Nom en català — l'únic que es pinta a la UI. */
  label: string;
  /** Traducció castellana (finestreta d'ajuda del menú). */
  es: string;
  /** Traducció anglesa (finestreta d'ajuda del menú). */
  en: string;
  /** Color identificatiu de l'estat: badge, segment de l'anell i ressaltat del menú. */
  color: string;
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

/**
 * Enquadrament de la càmera en coordenades de MAPA (centre + extensió visible).
 * Independent de la mida i el format de la finestra: veure `src/lib/camera.ts`.
 */
export interface CamRect { cx: number; cy: number; w: number; h: number }

export interface BCStateMessage {
  type: 'STATE';
  vis?: VisMap;
  pos?: PosMap;
  /** @deprecated Càmera en píxels de pantalla del DM: només per a clients antics. Usa `cam`. */
  zoom?: number;
  /** @deprecated Càmera en píxels de pantalla del DM: només per a clients antics. Usa `cam`. */
  panOffset?: Point;
  /** Enquadrament autoritatiu del DM en coords de mapa (mana sobre `zoom`/`panOffset`). */
  cam?: CamRect;
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
  // Parets (camp pesat): el jugador NO les dibuixa, però les necessita per a la línia de
  // visió de la llum dels tokens i per a la col·lisió de moviment (no travessar parets).
  walls?: Wall[];
  // Portes (camp pesat): forats a les parets per on passen la llum i el moviment.
  doors?: Door[];
  // Punts de llum (camp pesat): torxes/llànties col·locades pel DM dins de sales.
  lights?: LightSource[];
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
  /** Enquadrament autoritatiu del DM en coords de mapa (mana sobre `zoom`/`panOffset`). */
  cam?: CamRect;
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
  walls?: Wall[];
  doors?: Door[];
  lights?: LightSource[];
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
  // Format de pantalla d'un client (jugador→DM): el DM llista les pantalles connectades
  // i avisa de quant de mapa veuen fora del seu enquadrament.
  | { type: 'VIEWPORT'; id: string; w: number; h: number }
  | { type: 'EXPOSITOR_SHOW'; buffer: ArrayBuffer; mimeType: string }
  | { type: 'EXPOSITOR_HIDE' }
  | { type: 'EXPOSITOR_SYNC'; zoom: number; panXNorm: number; panYNorm: number; kbTxPct: number; kbTyPct: number }
  | { type: 'TEXTREVEAL_SHOW'; text: string; pos: number; cps: number; fadeMs: number }
  | { type: 'TEXTREVEAL_HIDE' }
  | { type: 'TEXTREVEAL_SYNC'; pos: number; cps: number; fadeMs: number }
  | { type: 'TOKEN_MOVE'; id: number | string; x: number; y: number }
  | { type: 'TOKEN_RELAY'; id: number | string; x: number; y: number }
  // Reset de la memòria d'explorat d'una sala: torna a ser negra del tot (fog of war).
  | { type: 'RESET_EXPLORED'; points: Point[] }
  | { type: 'BG_META'; mimeType: string; withFade?: boolean }
  | { type: 'EXPOSITOR_SHOW_META'; mimeType: string };
