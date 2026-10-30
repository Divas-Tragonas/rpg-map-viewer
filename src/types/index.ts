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
  /** Estil Píxel: figureta del token (criatura del paquet Oryx, `CREATURES`). Absent → cercle de color. */
  sprite?: string;
  /** Estil Píxel: retrat (dataURL PNG de 48 px fet amb el generador de retrats). */
  portrait?: string;
}

/** Estil de l'app: el clàssic de sempre o el Píxel (sprites, mapes de caselles). */
export type AppStyle = 'classic' | 'pixel';

/**
 * Ajust de color de les figuretes (app Píxel) perquè lliguin amb un mapa de tons apagats (les
 * missions: el paquet és molt saturat). Es fa per píxel als fulls de criatures, un sol cop
 * (`setFigureGrade` a `lib/sprites/pack.ts`): saturació, multiplicador càlid i guany, i els
 * negres passen a la tinta del mapa. `off` → el mapa en té, però el DM l'ha apagat.
 */
export interface FigureGrade {
  sat: number;
  warm: [number, number, number];
  gain: number;
  ink: [number, number, number];
  /**
   * Opacitat (0..1) de l'ombra que cada figureta fa cap a baix a la dreta, com els arbres i les
   * cases del mapa. És el que les fa destacar del fons sense posar-los cap contorn.
   */
  shadow?: number;
  off?: boolean;
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
  /** Generada pel mapa de caselles (es regenera sola; les dibuixades a mà no la porten). */
  tile?: boolean;
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

export type SpellType =
  | 'fireball' | 'lightning' | 'magic_beam' | 'magic_missile' | 'hideous_laughter' | 'burning_hands' | 'sleep' | 'grease'
  // Grimoris dels personatges (Notion): veure `SPELLBOOKS` a constants
  | 'ray_of_frost' | 'shocking_grasp' | 'mage_hand' | 'prestidigitation' | 'mage_armor' | 'shield' | 'detect_magic'
  | 'light' | 'sacred_flame' | 'thaumaturgy' | 'bless' | 'cure_wounds' | 'charm_person';

export interface Spell {
  id: string;
  type: SpellType;
  points: Point[];
  startTime: number;
}

export type SpellPreview =
  /** `rangeFt`: abast màxim (es pinta un cercle d'abast al voltant de `start`). */
  | { mode: 'line'; start: Point; end: Point; rangeFt?: number }
  | { mode: 'area_place'; origin: Point; center: Point; spellType: string };

/**
 * Màgia triada que espera el clic de destí. `mode: 'line'` → el clic fixa la punta del
 * raig; `'area'` (o absent) → el centre de l'àrea. En tots dos casos el destí es limita a
 * l'abast del conjur (`spellRangeFt`) mesurat des d'`origin`.
 */
export interface AreaSpellPending {
  type: SpellType;
  origin: Point;
  mode?: 'line' | 'area';
}

export type DrawTool = 'none' | 'pen' | 'eraser' | 'shape' | 'pointer' | 'wall' | 'light' | 'tiles';

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
  /** Estil Píxel: figureta del token (criatura del paquet Oryx). */
  sprite?: string;
}

export interface PsdEnemyOverride {
  hp?: number;
  hpMax?: number;
  name?: string;
  imageData?: string;
  /** Estil Píxel: figureta del token (criatura del paquet Oryx). */
  sprite?: string;
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
  /** Centre del token de jugador (coords de mapa): origen dels conjurs del seu grimori. */
  casterPos?: Point;
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

// ── Diàlegs de personatges (veure `lib/dialog/`) ──────────────────────────────
/** Com es diu una línia: canvia el color, la velocitat i la finestra. */
export type DialogStyle = 'normal' | 'crit' | 'xiuxiueig' | 'pensament';
/** Què fa la càmera en una línia d'escena. */
export type DialogCamMode = 'auto' | 'enfoca' | 'dos' | 'quiet';

/** Diàleg preparat, desat a un token (dins de la partida i del desat automàtic). */
export interface SavedDialog {
  id: string;
  title: string;
  /** Guió en format teatre (`Nom (opcions): text`), veure `lib/dialog/script.ts`. */
  script: string;
  /** Nom del guió → token de l'escena (`pl_3`, `lib_7`, id del PSD) o `null` = veu sense token. */
  cast: Record<string, string | null>;
  /** Començar just després de la cinemàtica de boss del token que el té desat. */
  afterBoss?: boolean;
}

/**
 * Diàleg que es veu ara mateix a totes les pantalles: camp lleuger `dialog` del STATE i del
 * STRUCT (`null` = cap). El retrat NO viatja: cada pantalla el treu del token (`tokenId`).
 */
export interface DialogSync {
  /** Id de l'execució (canvia a cada llançament). */
  id: string;
  /** Línia del guió (canvia a cada intervenció, també en tornar enrere). */
  line: number;
  /** Escena (barres, càmera, caixa) o globus sobre el token (combat). */
  kind: 'scene' | 'bubble';
  tokenId: string | null;
  /** Nom que es veu (buit = veu sense nom, «???»). */
  name: string;
  /** Sense retrat ni càmera: narrador, «???» o algú que els jugadors no poden veure. */
  voice: boolean;
  text: string;
  style: DialogStyle;
  cps: number;
  /** Mil·lisegons que feia que havia començat la línia quan el DM ha enviat el missatge. */
  age: number;
  /** El DM ha completat la línia: totes les pantalles la mostren sencera. */
  done: boolean;
  bars: boolean;
  /** Enquadrament de la càmera (coords de mapa) o `null` = vista normal. */
  cam: CamRect | null;
  /** Opcions de resposta numerades (quan la línia en té). */
  options?: string[];
}

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
  // Màgia que el DM està apuntant (radi, abast, punta del raig): els jugadors la veuen en
  // viu. Camp lleuger, s'envia sempre (`null` = cap). Absent → DM antic, no tocar res.
  spellPreview?: SpellPreview | null;
  // Estil Píxel (camp lleuger, sempre): les pantalles de jugador pinten sprites i el rètol píxel.
  appStyle?: AppStyle;
  // Parts vives del mapa de caselles (aigua, torxes, portes): camp pesat (per referència).
  tileLive?: import('@/lib/tilemap/render').TileLive | null;
  // Diàleg en curs (camp lleuger, sempre; `null` = cap). Absent → DM antic, no tocar res.
  dialog?: DialogSync | null;
  // Ajust de color de les figuretes del mapa (lleuger, sempre; `null` = cap). Absent → DM antic.
  figureGrade?: FigureGrade | null;
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
  spellPreview?: SpellPreview | null;
  appStyle?: AppStyle;
  tileLive?: import('@/lib/tilemap/render').TileLive | null;
  dialog?: DialogSync | null;
  figureGrade?: FigureGrade | null;
  /**
   * Dibuix a ploma per a qui es connecta tard o carrega una partida. Els traços més antics
   * surten de `strokeHistory` i viatgen ja rasteritzats a `strokeBaseline` (PNG en dataURL),
   * així que el dibuix es reconstrueix sempre com a base + historial. Veure `_capStrokeHistory`.
   */
  strokeHistory?: StrokeData[];
  strokeBaseline?: string | null;
}

export type BCMessage =
  | BCStateMessage
  | BCStructMessage
  | { type: 'BG'; buffer: ArrayBuffer; mimeType: string; withFade?: boolean }
  | { type: 'STROKE'; points: Point[]; color: string; size: number; tool: DrawTool }
  | { type: 'CLEAR_DRAW' }
  // `strokeBaseline` només s'inclou quan la base ha canviat des de l'últim cop que es va
  // enviar: durant una tanda de Ctrl+Z no es toca, i és una imatge de la mida del mapa.
  | { type: 'UNDO_DRAW'; strokeHistory: StrokeData[]; strokeBaseline?: string | null }
  | { type: 'POINTER'; pos: Point | null }
  | { type: 'MEASURE'; a: Point | null; b: Point | null }
  | { type: 'SPELL'; spell: Omit<Spell, 'startTime'> & { startTime: number } }
  | { type: 'DELETE_SPELL'; id: string }
  | { type: 'BOSS_INTRO'; tokenId: number | string; bossName: string; tokenPos: Point | null; cam?: CamRect | null; portraitDataUrl: string | null;
      /** Estil (`BossIntroStyle`); absent = la clàssica. Les de pixel art porten la figureta i la colla. */
      style?: string; sprite?: string | null; party?: { name: string; sprite?: string }[];
      /** Cinemàtica de grup: els altres enemics (`img` = dataURL petit si no tenen figureta). */
      extras?: { name: string; sprite?: string | null; img?: string | null }[];
      /** Missatge escrit pel DM (`{nom}` = nom de l'enemic o del grup). */
      message?: string | null }
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

/**
 * Avís visible a la pantalla del DM. Fins ara, una càrrega que fallava (fons il·legible,
 * partida corrupta, desat automàtic sense espai) només deixava rastre a la consola: l'app
 * es quedava igual i no hi havia cap manera de saber què havia passat.
 */
export interface Notice {
  id: number;
  kind: 'error' | 'warn' | 'info';
  text: string;
}

/** Publica un avís a la pantalla del DM. `kind` per defecte: 'error'. */
export type Notify = (text: string, kind?: Notice['kind']) => void;
