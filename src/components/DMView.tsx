'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, FS, RADIUS, BC_CHANNEL, WAND_CURSOR, AREA_SPELL_DATA, spellRangeFt, DEFAULT_SPEED_FT, tint, FONT_SERIF, SHADOW } from '@/constants';
import { modeForTool, type DMMode } from '@/lib/dm-mode';
import { peekUndo } from '@/lib/undo';
import { tokenMenuFor } from '@/lib/token-menu';
import { DamagePopup } from '@/components/dm/DamagePopup';
import { SpellEffectPopup, type SpellTarget } from '@/components/dm/SpellEffectPopup';
import { spellTargets, SPELL_EFFECTS } from '@/lib/rules/spell-effects';
import { spellImpactS } from '@/lib/render/spells';
import { gridOf } from '@/lib/rules/cells';
import { mapToClient } from '@/lib/screen';
import { tokenSlots } from '@/lib/render/token-geom';
import type {
  PosMap, Player, Spell, PaintedZone,
  ConditionsMap, DefeatedMap, TokenSizeMap, DrawTool,
  ContextMenuState, SceneConfigMenuState, SpellMenuState, ShapeMenuState, Point,
  LibEnemy, Wall, Room, Door, LightSource, TurnState, Notice, Notify,
} from '@/types';
import { clearExploredAt } from '@/lib/render/darkrooms';
import { useDMRefs } from '@/hooks/useDMRefs';
import { useCinematic } from '@/hooks/useCinematic';
import { useDMActions } from '@/hooks/useDMActions';
import { useRafLoop } from '@/hooks/useRafLoop';
import { useMouseHandlers } from '@/hooks/useMouseHandlers';
import { useWheelZoom } from '@/hooks/useWheelZoom';
import { useKeyboardHandlers } from '@/hooks/useKeyboardHandlers';
import { createSyncSocket } from '@/lib/ws';
import { computeReachableCells, segmentBlocked, buildMovePath } from '@/lib/rooms/pathing';
import { tileBlocker } from '@/lib/tilemap/render';
import { effectiveWalls } from '@/lib/rooms/doors';
import { RevealEngine, cpsFromSlider, fadeMsFromSlider, speedLabel, smoothLabel } from '@/lib/textreveal';
import { ImportPanel } from '@/components/dm/ImportPanel';
import { RoomsPanel } from '@/components/dm/RoomsPanel';
import { PlayersPanel } from '@/components/dm/PlayersPanel';
import { FloatingToolbar } from '@/components/dm/FloatingToolbar';
import { EnemyLibraryPanel } from '@/components/dm/EnemyLibraryPanel';
import { CanvasHUD } from '@/components/dm/CanvasHUD';
import { NoticeStack } from '@/components/ui/NoticeStack';
import { SpellMenuOverlay } from '@/components/dm/SpellMenuOverlay';
import { ShapeMenuOverlay } from '@/components/dm/ShapeMenuOverlay';
import { ContextMenuOverlay, type MenuPos } from '@/components/dm/ContextMenuOverlay';
import { SceneConfigOverlay } from '@/components/dm/SceneConfigOverlay';
import { TurnTracker } from '@/components/dm/TurnTracker';
import { ServerSessionsPanel } from '@/components/dm/ServerSessionsPanel';
import { TopBar } from '@/components/dm/TopBar';
import { ShowPanelHeader, type ShowTab } from '@/components/dm/ShowPanelHeader';
import { DialogPanel, EMPTY_DRAFT, type DialogDraft } from '@/components/dm/DialogPanel';
import { DialogControls } from '@/components/dm/DialogControls';
import { useDialog } from '@/hooks/useDialog';
import { SceneEnemiesPanel } from '@/components/dm/SceneEnemiesPanel';
import { ShortcutsHelp } from '@/components/dm/ShortcutsHelp';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { ImageIcon, CheckIcon, PlayIcon } from '@/components/icons';
import { isApiConfigured } from '@/lib/api';
import { budgetFor, firstActive, nextActive } from '@/lib/turn';
import { movementLimit } from '@/lib/rules/conditions';
import { terrainCost } from '@/lib/rules/terrain';
import { useAutosave } from '@/hooks/useAutosave';
import { useStoredFlag } from '@/hooks/useStoredFlag';
import { clearAutosave, readAutosave, readAutosaveMeta, type AutosaveMeta } from '@/lib/autosave';
import { useTileMap } from '@/hooks/useTileMap';
import { TilePalette } from '@/components/dm/TilePalette';
import { PixelMapPanel } from '@/components/dm/PixelMapPanel';
import { useSpritePack } from '@/hooks/useSpritePack';
import { ensurePack } from '@/lib/sprites/pack';
import { useCompactLayout } from '@/hooks/useCompact';
import { useCanvasPointer } from '@/hooks/useCanvasPointer';
import { relayBoards, openBoard } from '@/lib/relay';
import { addEnemyNumbered } from '@/lib/enemy-naming';
import type { TileBrush } from '@/lib/tilemap/editor';
import { WelcomeScreen } from '@/components/dm/WelcomeScreen';
import { useCharacters } from '@/hooks/useCharacters';
import { XpAwardDialog, type XpAward } from '@/components/dm/XpAwardDialog';
import { SheetPanel } from '@/components/dm/SheetPanel';
import { buildSheetShow, characterFor, STATS_PART, sheetOf, abilityMod } from '@/lib/characters';
import { creatureStats } from '@/lib/bestiary';
import { RightRail } from '@/components/dm/RightRail';
import { StoryPanel, type StoryTab } from '@/components/dm/StoryPanel';
import { useStory } from '@/hooks/useStory';
import { useJournalWatchers } from '@/hooks/useJournalWatchers';
import { logJournal } from '@/lib/journal';

/** Amplada del panell «Mostrar als jugadors» (la mateixa per a les dues pestanyes: canviar
 *  de pestanya no ha de fer saltar el panell). */
const SHOW_PANEL_W = 560;
// Amplada del lateral: el bloc del nom del mapa de la barra superior hi queda alineat.
const SIDEBAR_W = 270;


export function DMView() {
  // ── State ────────────────────────────────────────────────────────────────
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgName, setBgName] = useState('');
  const [pos, setPos] = useState<PosMap>({});
  const [zoom, setZoom] = useState(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [conditions, setConditions] = useState<ConditionsMap>({});
  const [defeated, setDefeated] = useState<DefeatedMap>({});
  const [paintedZones, setPaintedZones] = useState<PaintedZone[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [, setDoors] = useState<Door[]>([]);
  const [lights, setLights] = useState<LightSource[]>([]);
  // Pop-up de dany d'un atac (v5): s'obre en clicar l'objectiu mentre s'apunta un atac del menú.
  const [damagePrompt, setDamagePrompt] = useState<import('@/types').DamagePrompt | null>(null);
  // Pop-up d'un conjur llançat en combat (v5): afectats, dany/cura i estats proposats.
  const [spellPrompt, setSpellPrompt] = useState<{ type: string; points: import('@/types').Point[]; keys: string[]; anchor: { l: number; r: number; t: number; b: number } } | null>(null);
  const [lightSelectedId, setLightSelectedId] = useState<string | null>(null);
  const [newLightRadiusFt, setNewLightRadiusFt] = useState(15);
  const [turn, setTurn] = useState<TurnState>({ active: false, order: [], turnIndex: 0, round: 1, activeRemainingFt: 0 });
  // Desat automàtic (P5): interruptor i metadades del desat que hi ha guardat, si n'hi ha.
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [autosaveMeta, setAutosaveMeta] = useState<AutosaveMeta | null>(null);
  const [recovering, setRecovering] = useState(false);
  // Què desfaria el proper «Desfer» (Ctrl+Z) i què refaria el «Refer» (Ctrl+Maj+Z); null = res.
  const [undoNext, setUndoNext] = useState<{ undo: string | null; redo: string | null }>({ undo: null, redo: null });
  // Pantalles de jugador connectades (id → mida), reportades pel missatge VIEWPORT.
  const [playerScreens, setPlayerScreens] = useState<Record<string, { w: number; h: number; ts: number }>>({});
  // Format de l'enquadrament compartit (rDmCam, que es recalcula a cada frame): es mostreja
  // a baixa freqüència perquè el HUD no re-renderitzi a 60fps mentre el DM fa pan/zoom.
  const [camAr, setCamAr] = useState<number | null>(null);
  const [, setActiveDrag] = useState<string | number | null>(null);
  const [activeSpells, setActiveSpells] = useState<Spell[]>([]);
  const [tokenSizeOverride, setTokenSizeOverride] = useState<TokenSizeMap>({});
  const [gridVisible, setGridVisible] = useState(false);
  const [gridSize, setGridSize] = useState(70);
  const [gridSnap, setGridSnap] = useState(false);
  const [gridAutoSize, setGridAutoSize] = useState(false);
  const [gridLineWidth, setGridLineWidth] = useState(1.5);
  const [gridOriginX, setGridOriginX] = useState(0);
  const [gridOriginY, setGridOriginY] = useState(0);
  const [gridCalibrating, setGridCalibrating] = useState(false);
  const [drawToolState, setDrawToolState] = useState<DrawTool>('none');
  const [drawColor, setDrawColor] = useState<string>(C.enemy);
  const [drawSize, setDrawSize] = useState(6);
  // Pestanyes per funció: Escena (tot el que hi ha al mapa: jugadors i enemics de qualsevol
  // origen), Mapa (fons, capes, sales, llums) i Biblioteca (plantilles per afegir enemics).
  const [sidebarTab, setSidebarTab] = useState<'escena' | 'mapa' | 'biblioteca'>('escena');
  // Lateral plegable (botó a la barra superior): més mapa quan no cal la llista. Es recorda.
  const [sidebarOpen, setSidebarOpen] = useStoredFlag('rpg_sidebar_open', true);
  // Mòbil (veure `useCompact`): el lateral és un calaix que comença tancat i no es recorda.
  const compact = useCompactLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sideOpen = compact ? drawerOpen : sidebarOpen;
  const toggleSide = useCallback(() => { if (compact) setDrawerOpen(v => !v); else setSidebarOpen(!sidebarOpen); }, [compact, sidebarOpen, setSidebarOpen]);
  // Preparar (construir el mapa) o Jugar (a la taula): decideix quines eines i pestanyes
  // surten. El ref és perquè el wrapper de setDrawTool el pugui consultar sense dependències.
  const [mode, setMode] = useState<DMMode>('jugar');
  const modeRef = React.useRef<DMMode>('jugar');
  // Arrossegar el mapa: Espai premut (cursor de mà oberta) i pan en curs (mà tancada).
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Quina «app»: Clàssica o Píxel (sprites del paquet Oryx i mapes de caselles). Es recorda.
  // App Píxel per defecte (v5). Clau nova: qui tenia desada la Clàssica com a «per defecte» de
  // l'antiga (`rpg_pixel`) també passa a la Píxel; a partir d'aquí es recorda el que triï.
  const [pixel, setPixel] = useStoredFlag('rpg_pixel_v5', true);
  // Mode Fòsfor: les pantalles de jugador es veuen com una TV de tub antiga (menú Pantalles).
  const [phosphor, setPhosphor] = useStoredFlag('rpg_phosphor', false);
  const pack = useSpritePack();
  // Mapa de caselles obert (n'hi ha prou amb la mida per a la UI; el mapa viu a R.rTileMap).
  const [tileMapSize, setTileMapSize] = useState<{ cols: number; rows: number } | null>(null);
  // Fitxer arrossegant-se damunt del canvas (tota la pantalla accepta el mapa o la partida).
  const [fileOver, setFileOver] = useState(false);
  const fileDragDepth = React.useRef(0);
  const [libEnemies, setLibEnemies] = useState<LibEnemy[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | number | null>(null);
  const [areaSelectMode, setAreaSelectMode] = useState(false);
  const [dmPrivateActive, setDmPrivateActive] = useState(false);
  const [ctrlPanActive, setCtrlPanActive] = useState(false);
  const [shiftPanActive, setShiftPanActive] = useState(false);
  const [canvasCursor, setCanvasCursor] = useState('default');
  const [enemyHighlight, setEnemyHighlight] = useState(false);
  const [highlightLocked, setHighlightLocked] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Menú del clic dret flotant (l'ha arrossegat el DM): on és i, en ref, si n'hi ha (per al ratolí).
  const [menuFloat, setMenuFloatState] = useState<MenuPos | null>(null);
  const menuFloatRef = useRef<MenuPos | null>(null);
  const setMenuFloat = useCallback((p: MenuPos | null) => { menuFloatRef.current = p; setMenuFloatState(p); }, []);
  // Des del mapa, un clic dret en buit tanca el menú… menys si és flotant: s'ha mogut per tenir-lo obert.
  const setContextMenuFromMap = useCallback((m: ContextMenuState | null) => {
    if (m === null && menuFloatRef.current) return;
    setContextMenu(m);
  }, []);
  const [sceneConfigMenu, setSceneConfigMenu] = useState<SceneConfigMenuState | null>(null);
  const [spellMenu, setSpellMenu] = useState<SpellMenuState | null>(null);
  const [shapeMenu, setShapeMenu] = useState<ShapeMenuState | null>(null);
  const [newPName, setNewPName] = useState('');
  const [newPColor, setNewPColor] = useState('#60a5fa');
  const [newPHpMax, setNewPHpMax] = useState(20);
  const [expositorOpen, setExpositorOpen] = useState(false);
  const [expositorLocalSrc, setExpositorLocalSrc] = useState<string | null>(null);
  const [expositorLocalType, setExpositorLocalType] = useState<'image' | 'video' | null>(null);
  const [expositorActive, setExpositorActive] = useState(false);
  const expositorFileRef = React.useRef<File | null>(null);
  const expositorInputRef = React.useRef<HTMLInputElement>(null);
  const expositorActiveRef = React.useRef(false);
  const expositorZoom = React.useRef(1);
  const expositorPan = React.useRef({ x: 0, y: 0 });
  const expositorDragRef = React.useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const expositorKbStartTime = React.useRef<number | null>(null);
  const expositorKbVariant = React.useRef(0);
  const expositorKbPhase = React.useRef(0);
  const expositorKbPaused = React.useRef(false);
  const expositorRafRef = React.useRef<number | null>(null);
  const expositorLastSync = React.useRef(0);
  const expositorInnerRef = React.useRef<HTMLDivElement | null>(null);
  const expositorPreviewRef = React.useRef<HTMLDivElement | null>(null);

  // ── Partides al servidor ────────────────────────────────────────────────────
  const [showServerSessions, setShowServerSessions] = useState(false);
  const serverSessionsEnabled = useMemo(() => isApiConfigured(), []);

  // ── Opacitat del fons (només DM) ─────────────────────────────────────────────
  const [bgOpacity, setBgOpacity] = useState(1);

  // ── Revelador de text ──────────────────────────────────────────────────────
  const [textRevealOpen, setTextRevealOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Pestanya «Fitxa» del panell Mostrar als jugadors: personatge triat, parts i quin es veu ara.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSel, setSheetSel] = useState<string | null>(null);
  const [sheetParts, setSheetParts] = useState<string[]>([STATS_PART]);
  const [sheetShowId, setSheetShowId] = useState<string | null>(null);
  // Repartiment d'experiència pendent en acabar un combat.
  const [xpAward, setXpAward] = useState<XpAward | null>(null);
  const [xpBusy, setXpBusy] = useState(false);
  // Acaba el diàleg en curs (l'Expositor i el Revelador el criden en mostrar-se).
  const dialogEndRef = React.useRef<() => void>(() => {});
  // «Mostrar als jugadors»: Expositor i Revelador són les dues pestanyes d'un sol panell.
  // Cada pestanya continua obrint el seu estat de sempre (expositorOpen / textRevealOpen),
  // així els seus bucles i dreceres de teclat no canvien; la pestanya recorda l'última.
  const [showTab, setShowTab] = useState<ShowTab>('imatge');
  const [textRevealActive, setTextRevealActive] = useState(false);
  const [trDramatic, setTrDramatic] = useState(true);
  const [trManual, setTrManual] = useState(false);
  const trEngineRef = React.useRef<RevealEngine | null>(null);
  const trStageRef = React.useRef<HTMLDivElement | null>(null);
  const trTextRef = React.useRef<HTMLDivElement | null>(null);
  const trSrcRef = React.useRef<HTMLTextAreaElement | null>(null);
  const trSpeedRef = React.useRef<HTMLInputElement | null>(null);
  const trSmoothRef = React.useRef<HTMLInputElement | null>(null);
  const trSpeedLblRef = React.useRef<HTMLElement | null>(null);
  const trSmoothLblRef = React.useRef<HTMLElement | null>(null);
  const trCounterRef = React.useRef<HTMLSpanElement | null>(null);
  const trProgRef = React.useRef<HTMLDivElement | null>(null);
  const trPlayBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const trRunningRef = React.useRef(false);
  const trPausedRef = React.useRef(true);
  const trActiveRef = React.useRef(false);
  const trDramaticRef = React.useRef(true);
  const trManualRef = React.useRef(false);
  const trRafRef = React.useRef<number | null>(null);
  const trLastTsRef = React.useRef(0);
  const trLastSyncRef = React.useRef(0);
  // Reenviar TEXTREVEAL_SHOW quan un jugador (re)connecta: iOS Safari talla el WS
  // en bloquejar la pantalla o canviar d'app, i sense això la tablet només rebria
  // els TEXTREVEAL_SYNC (que ignora perquè no té el text). S'assigna més avall,
  // quan trBroadcastShow ja existeix.
  const trResendShowRef = React.useRef<() => void>(() => {});
  // ── Història: mòduls i diari (panell a la dreta del mapa, veure `StoryPanel`) ──
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyTab, setStoryTab] = useState<StoryTab>('modul');
  const [noteFocus, setNoteFocus] = useState(0);
  // Text que un mòdul vol deixar al Revelador (s'hi escriu quan la pestanya és oberta).
  const trPrefillRef = React.useRef<string | null>(null);
  const [trPrefillNonce, setTrPrefillNonce] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const R = useDMRefs();
  // Pinzell de l'eina Caselles (la paleta en mostra el triat; el ratolí llegeix el ref).
  const [tileBrush, setTileBrushState] = useState<TileBrush>(() => R.rTileBrush.current);
  const setTileBrush = useCallback((b: TileBrush) => { R.rTileBrush.current = b; setTileBrushState(b); }, [R]);

  // ── Cinematic ─────────────────────────────────────────────────────────────
  const { launchBossIntro, skipBossIntro } = useCinematic(R);

  // Opacitat del fons (només DM): actualitza estat + ref mirall que llegeix el tick.
  const onBgOpacityChange = useCallback((v: number) => {
    setBgOpacity(v);
    R.rBgDmOpacity.current = v;
  }, [R]);

  // ── Mode Preparar / Jugar ──────────────────────────────────────────────────
  // La pestanya del lateral segueix el mode: Mapa només existeix a Preparar (i s'hi obre en
  // entrar-hi); en tornar a Jugar, si s'hi era, es passa a Escena. El panell «Mostrar als
  // jugadors» és cosa de la partida: es tanca en anar a Preparar (el que es mostri, es manté).
  const applyMode = useCallback((m: DMMode) => {
    if (modeRef.current === m) return;
    modeRef.current = m; setMode(m);
    if (m === 'preparar') {
      setSidebarTab('mapa');
      setExpositorOpen(false); setTextRevealOpen(false);
    } else {
      setSidebarTab(t => (t === 'mapa' ? 'escena' : t));
    }
  }, []);

  // ── setDrawTool wrapper (updates ref + state synchronously) ───────────────
  const setDrawTool = useCallback((fn: DrawTool | ((t: DrawTool) => DrawTool)) => {
    setDrawToolState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      R.rDrawTool.current = next;
      // Triar una eina de l'altre mode (tecla 5 jugant, 1 preparant…) hi canvia sol: així
      // les dreceres funcionen sempre i el mode no queda mai amb una eina que no hi és.
      const need = modeForTool(next);
      if (need) applyMode(need);
      if (prev === 'pointer' && next !== 'pointer') {
        R.rPointerPos.current = null; R.rMeasure.current = { a: null, b: null };
        // El punter i la regla desapareixen també de les pantalles dels jugadors, sigui quin
        // sigui el camí per on es deixa l'eina (botó, tecla o canvi de mode).
        R.bcRef.current?.postMessage({ type: 'POINTER', pos: null }); R.wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: null }));
        R.bcRef.current?.postMessage({ type: 'MEASURE', a: null, b: null }); R.wsRef.current?.send(JSON.stringify({ type: 'MEASURE', a: null, b: null }));
      }
      if (prev === 'wall' && next !== 'wall') { R.rWallPenLast.current = null; R.rWallChain.current = []; R.rWallCursor.current = null; R.rHoveredRoomId.current = null; }
      if (prev === 'light' && next !== 'light') { R.rLightSelected.current = null; setLightSelectedId(null); R.rLightDrag.current = null; }
      if (next === 'shape') setCanvasCursor(WAND_CURSOR);
      else if (next === 'wall' || next === 'light' || next === 'tiles' || next === 'terrain') setCanvasCursor('crosshair');
      else if (next === 'none') setCanvasCursor('default');
      return next;
    });
  }, [R]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvi de mode des de l'interruptor de la barra: si l'eina activa no existeix al mode
  // nou, es torna a la selecció.
  const switchMode = useCallback((m: DMMode) => {
    applyMode(m);
    setDrawTool(t => { const owner = modeForTool(t); return owner && owner !== m ? 'none' : t; });
  }, [applyMode, setDrawTool]);

  // ── Desfer / refer únic ──────────────────────────────────────────────────────
  // Torna a mirar què desfaria i què refaria la pila (`lib/undo.ts`). Es crida cada cop que
  // la pila canvia (useDMActions ho avisa amb `onUndoChange`). L'etiqueta es calcula aquí i
  // no al render: llegir refs al render és l'error de lint `react-hooks/refs`.
  const refreshUndo = useCallback(() => {
    const u = peekUndo(R.rUndo.current, 'undo'), r = peekUndo(R.rUndo.current, 'redo');
    setUndoNext(p => (p.undo === (u?.label ?? null) && p.redo === (r?.label ?? null)) ? p : { undo: u?.label ?? null, redo: r?.label ?? null });
  }, [R]);

  // Els diàlegs desats es refresquen a la UI quan es carrega una partida (`useDialog` es
  // crea més avall: hi arriba per ref).
  const dialogsChangedRef = React.useRef<() => void>(() => {});

  // ── Avisos a la pantalla ───────────────────────────────────────────────────
  // Abans, tot el que fallava en carregar (fons il·legible, partida corrupta, desat
  // automàtic sense espai) només anava a la consola: des de fora es veia com "no passa res".
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeIdRef = useRef(0);
  const dismissNotice = useCallback((id: number) => {
    setNotices(ns => ns.filter(n => n.id !== id));
  }, []);
  const notify = useCallback<Notify>((text, kind = 'error') => {
    setNotices(ns => {
      // El mateix avís repetit (p. ex. dos fitxers dolents seguits) no ha d'apilar-se.
      const dedup = ns.filter(n => n.text !== text);
      return [...dedup.slice(-2), { id: ++noticeIdRef.current, kind, text }];
    });
  }, []);

  // Fitxes de la colla a la API (experiència, fitxa a les pantalles). Sense back office, 'off'.
  const chars = useCharacters(notify);

  // ── Setters object for useDMActions ────────────────────────────────────────
  const S = useMemo(() => ({
    onDialogsChange: () => dialogsChangedRef.current(),
    setBgLoaded, setBgName,
    setPos, setZoom, setPlayers, setConditions, setDefeated,
    setPaintedZones, onUndoChange: refreshUndo, setActiveSpells, setGridSize, setGridSnap,
    setGridLineWidth, setGridOriginX, setGridOriginY, setGridCalibrating, setTokenSizeOverride,
    setGridVisible, setGridAutoSize,
    setLibEnemies, setWalls, setRooms, setDoors, setLights, setTurn,
    notify,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────
  const {
    _broadcastState, _sendFullState, loadBg, loadDemo, snapAllTokens, sizeAllTokens,
    addPlayer, removePlayer, adjustPlayerHp, setPlayerHpMax, setPlayerSpeed, setPlayerCharacter, syncPlayersHpMax, setPlayerVision, setPlayerCanMove, setPlayerLook, replaceBgImage, renamePlayer, loadParty, clearDrawing,
    saveSession, loadSession, serverSaveSession, serverLoadSession, addSpell,
    buildAutosaveRecord, applySessionState, _pushMapEdit,
    undo, redo, commitStroke, beginTokenDrag, beginMapGesture, beginZoneDrag, endUndoGesture,
    tokensCmd, _record, _recordTokens, setRoomRevealed,
    addPaintedZone, deletePaintedZone, deleteAreaSpell, clearPaintedZones, toggleCondition, openPlayerWindow,
    addLibEnemy, addDbEnemy, adjustLibEnemyHp, setLibEnemyProps,
    removeLibEnemy, toggleLibEnemyVisibility, setTokenSize,
    redetectRooms, setRoomDark, toggleRoomReveal, renameRoom, deleteRoom, cancelWallChain,
    addDoor, removeDoor, toggleDoor, startDoorPlacement,
  } = useDMActions(R, S);


  // ── App Píxel ──────────────────────────────────────────────────────────────
  // Els fulls del paquet de sprites són a `public/sprites/`: cada pantalla els carrega sola.
  useEffect(() => { void ensurePack(); }, []);
  // L'estil viatja dins de cada STATE: canviar d'app ho canvia també a les pantalles de jugador.
  useEffect(() => {
    R.rAppStyle.current = pixel ? 'pixel' : 'classic';
    _broadcastState({});
    // L'eina Caselles no existeix a l'app Clàssica.
    if (!pixel && R.rDrawTool.current === 'tiles') setDrawTool('none');
  }, [pixel, _broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mode Fòsfor: com l'estil, viatja dins de cada STATE (i del STRUCT, per a qui es connecta tard).
  useEffect(() => {
    R.rPhosphor.current = phosphor;
    _broadcastState({});
  }, [phosphor, _broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mapa de caselles ───────────────────────────────────────────────────────
  const setTileGrid = useCallback((gs: number) => {
    R.rGridSize.current = gs; setGridSize(gs);
    R.rGridOriginX.current = 0; setGridOriginX(0);
    R.rGridOriginY.current = 0; setGridOriginY(0);
    R.rGridSnap.current = true; setGridSnap(true);
    // Un mapa de caselles sempre es juga amb graella: s'encén sola (abans només rebia la mida i
    // l'imant, i no es veia enlloc).
    R.rGridVisible.current = true; setGridVisible(true);
  }, [R]);
  // Criatures d'un .tmx → enemics de la biblioteca amb la seva figureta.
  const addCreatureTokens = useCallback((list: { name: string; x: number; y: number }[]) => {
    let ens = R.rLibEnemies.current;
    const np = { ...R.rPos.current };
    list.forEach((cr, i) => {
      const id = Date.now() + i;
      const name = cr.name.replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase());
      // Vida i XP del monstre de D&D amb què es juga aquesta figureta (`lib/bestiary.ts`).
      const st = creatureStats(cr.name);
      const hp = st?.hp ?? 10;
      ens = addEnemyNumbered(ens, { id, templateId: `oryx_${cr.name}`, name, color: C.enemy, hpMax: hp, hp, xp: st?.xp ?? 0, R: 22, visible: true, imageData: null, sprite: cr.name });
      np[`lib_${id}`] = { x: cr.x, y: cr.y };
    });
    R.rLibEnemies.current = ens; setLibEnemies(ens);
    R.rPos.current = np; setPos(np);
    _broadcastState({});
  }, [R, _broadcastState]);
  const syncTileSize = useCallback((has: boolean) => {
    const m = R.rTileMap.current;
    setTileMapSize(has && m ? { cols: m.cols, rows: m.rows } : null);
  }, [R]);
  const { createTileMap, importTmx, tileDown, tileMove, tileUp, tileLeave } = useTileMap(R, {
    setWalls, setRooms, setDoors, setLights, setGrid: setTileGrid,
    loadBg, replaceBgImage, broadcast: _broadcastState, pushMapEdit: _pushMapEdit,
    addCreatures: addCreatureTokens, setHasTileMap: syncTileSize,
  });

  // ── Desat automàtic ────────────────────────────────────────────────────────
  // Xarxa de seguretat contra un F5: tot l'estat viu (fons, parets, sales, portes, llums,
  // posicions, vides, dibuix i torns) només existia en memòria i un refresc el buidava.
  const { savedAt: autosaveAt, failing: autosaveFailing, saveNow: autosaveNow } = useAutosave(R, {
    enabled: autosaveEnabled, hasMap: bgLoaded, mapName: bgName, buildRecord: buildAutosaveRecord,
    onError: notify,
  });

  // En arrencar: hi ha partida recuperable? (i la preferència de l'interruptor). Els dos
  // setState van DESPRÉS d'un await, o sigui que no disparen renders en cascada.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const meta = await readAutosaveMeta();
      if (!alive) return;
      setAutosaveMeta(meta);
      setAutosaveEnabled(localStorage.getItem('rpg_autosave') !== 'off');
    })();
    return () => { alive = false; };
  }, []);

  const toggleAutosave = useCallback(() => {
    setAutosaveEnabled(prev => {
      const next = !prev;
      localStorage.setItem('rpg_autosave', next ? 'on' : 'off');
      // Apagar-lo esborra el que hi hagués desat: si l'usuari no vol autodesat, tampoc no
      // vol que la partida es quedi al disc del navegador.
      if (!next) { void clearAutosave(); setAutosaveMeta(null); }
      return next;
    });
  }, []);

  const recoverAutosave = useCallback(async () => {
    switchMode('jugar');
    setRecovering(true);
    try {
      const saved = await readAutosave();
      if (saved) await applySessionState(saved.state);
    } finally {
      setRecovering(false);
      setAutosaveMeta(null);   // ja recuperada: el botó desapareix
    }
  }, [applySessionState, switchMode]);

  const discardAutosave = useCallback(async () => {
    await clearAutosave();
    setAutosaveMeta(null);
  }, []);

  // ── Sistema per torns ──────────────────────────────────────────────────────
  // Peus amb què arrenca un token en agafar el torn: la velocitat del jugador. Els
  // enemics no tenen límit des de /player, així que un sentinella gran fa de "sense límit".
  // La primitiva viu a `lib/turn.ts` perquè `useDMActions` la comparteix (veure removeFromTurn).
  const _budgetFor = useCallback((id: number | string): number => budgetFor(id, R.rPlayers.current), [R]);

  const _applyTurn = useCallback((t: TurnState) => {
    // Cada canvi de torn fa caducar els moviments de combat de la pila (tornaven els peus del torn).
    R.rTurnGen.current++;
    R.rTurn.current = t; setTurn(t); _broadcastState({});
    refreshUndo();
  }, [R, _broadcastState, refreshUndo]);

  const startTurnCombat = useCallback((includeIds: (number | string)[]) => {
    // Tots els jugadors s'afegeixen automàticament; després els enemics/grups triats. Dedup.
    const order: (number | string)[] = [];
    const seen = new Set<string>();
    [...R.rPlayers.current.map(p => `pl_${p.id}` as string | number), ...includeIds].forEach(id => {
      const k = String(id);
      if (!seen.has(k)) { seen.add(k); order.push(id); }
    });
    if (order.length === 0) return;
    const first = firstActive(order, R.rDefeated.current);
    _applyTurn({ active: true, order, turnIndex: first, round: 1, activeRemainingFt: _budgetFor(order[first]) });
    const nPl = order.filter(id => String(id).startsWith('pl_')).length;
    logJournal('combat', `Comença el combat: ${nPl} jugadors i ${order.length - nPl} enemics`, { data: { started: true, players: nPl, foes: order.length - nPl } });
  }, [R, _applyTurn, _budgetFor]);

  const endTurnCombat = useCallback(() => {
    _applyTurn({ active: false, order: [], turnIndex: 0, round: 1, activeRemainingFt: 0 });
  }, [_applyTurn]);

  const advanceTurn = useCallback(() => {
    const t = R.rTurn.current;
    if (!t.active || t.order.length === 0) return;
    // Desa el saldo amb què deixa el torn el token actual (per poder recuperar-lo després).
    const remaining = { ...(t.remaining ?? {}), [String(t.order[t.turnIndex])]: t.activeRemainingFt };
    // Els tokens derrotats se salten: un enemic amb la X o un jugador a 0 de vida ja no
    // juga, i abans calia passar-li el torn a mà (un clic buit per baixa i per ronda).
    const { index: ni, wraps } = nextActive(t.order, t.turnIndex, R.rDefeated.current);
    const round = t.round + wraps;
    const rem = wraps > 0 ? {} : remaining;  // volta completa → nova ronda (neteja saldos)
    _applyTurn({ ...t, turnIndex: ni, round, remaining: rem, activeRemainingFt: _budgetFor(t.order[ni]) });
  }, [R, _applyTurn, _budgetFor]);

  const advanceRound = useCallback(() => {
    const t = R.rTurn.current;
    if (!t.active || t.order.length === 0) return;  // salta els que queden i comença ronda nova
    const first = firstActive(t.order, R.rDefeated.current);
    _applyTurn({ ...t, turnIndex: first, round: t.round + 1, remaining: {}, activeRemainingFt: _budgetFor(t.order[first]) });
  }, [R, _applyTurn, _budgetFor]);

  // Recupera el torn d'un token anterior tal com l'havia deixat (saldo de peus inclòs). Desa
  // abans el saldo del token actual perquè, en tornar cap endavant, es respecti el que li quedava.
  const recoverTurn = useCallback((id: number | string) => {
    const t = R.rTurn.current;
    if (!t.active) return;
    const idx = t.order.findIndex(o => String(o) === String(id));
    if (idx < 0 || idx === t.turnIndex) return;
    const remaining = { ...(t.remaining ?? {}), [String(t.order[t.turnIndex])]: t.activeRemainingFt };
    const restored = remaining[String(id)] ?? _budgetFor(id);
    _applyTurn({ ...t, turnIndex: idx, remaining, activeRemainingFt: restored });
  }, [R, _applyTurn, _budgetFor]);

  // Reordena la cua de torns (mode edició de la barra) mantenint actiu el mateix token.
  const reorderTurn = useCallback((newOrder: (number | string)[]) => {
    const t = R.rTurn.current;
    if (!t.active) return;
    const activeId = t.order[t.turnIndex];
    const turnIndex = Math.max(0, newOrder.findIndex(o => String(o) === String(activeId)));
    _applyTurn({ ...t, order: newOrder, turnIndex });
  }, [R, _applyTurn]);

  // Processa un TOKEN_MOVE rebut d'una pantalla de jugador (BC o WS). El DM és autoritat:
  // valida el bloqueig manual i, si hi ha combat, que sigui el token del torn actiu i que el
  // moviment no superi el saldo de peus (mateixa mètrica de disc que el clamp del drag). Si
  // rebutja, retorna la posició autoritzada (TOKEN_RELAY) perquè el token torni al lloc a l'instant.
  const handlePlayerTokenMove = useCallback((id: number | string, x: number, y: number) => {
    const sid = String(id);
    if (!sid.startsWith('pl_')) return;
    // ECO DEL MATEIX MOVIMENT: la pantalla de jugador envia cada TOKEN_MOVE pel
    // BroadcastChannel **i** pel WebSocket, o sigui que una pantalla del mateix ordinador
    // (amb la API engegada) el fa arribar DUES vegades. La segona còpia ja no mou res
    // (rPos hi és), però abans esborrava el camí d'animació que acabava de fixar la
    // primera → el token semblava teletransportar-se al DM. Descartar-la del tot també
    // evita un TOKEN_RELAY i una entrada de rMoveHistory duplicats.
    const prev = R.rPos.current[id];
    if (prev && prev.x === x && prev.y === y) return;
    const bounceBack = () => {
      const auth = R.rPos.current[id];
      if (!auth) return;
      const back = { type: 'TOKEN_RELAY', id, x: auth.x, y: auth.y };
      R.bcRef.current?.postMessage(back);
      R.wsRef.current?.send(JSON.stringify(back));
    };
    const player = R.rPlayers.current.find(p => `pl_${p.id}` === sid);
    if (player?.canMove === false) { bounceBack(); return; }
    // A 0 de vida el jugador no pot moure el token (fins recuperar-ne). El DM sí que pot
    // (el seu drag no passa per aquesta via).
    if (player && player.hpMax > 0 && player.hp <= 0) { bounceBack(); return; }

    const turn = R.rTurn.current;
    // Parets efectives: els trams de porta no bloquegen (per allà sí que es passa).
    const walls = effectiveWalls(R.rWalls.current, R.rDoors.current);
    // Mapa de caselles: paret, buit i porta tancada són caselles on no es pot entrar (la
    // mateixa regla que pinta el rang del jugador, `tileBlocker`).
    const blocked = tileBlocker(R.rTileLive.current, R.rDoors.current);
    let consumedFt = 0;
    if (turn.active && sid !== String(turn.order[turn.turnIndex])) { bounceBack(); return; }  // no és el seu torn
    // Estats que limiten el moviment (Agafat, Retingut, Paralitzat… → 0; Tombat → meitat).
    // Mateix `movementLimit` que fa servir el clamp del drag i la pintura del rang, perquè
    // el jugador no vegi un rang que aquí li rebotem.
    const limit = movementLimit(
      turn.active ? turn.activeRemainingFt : (player?.speed ?? DEFAULT_SPEED_FT),
      R.rConditions.current[sid],
    );
    if (limit.immobile) { bounceBack(); return; }
    const gs = R.rGridSize.current;
    if (gs > 0) {
      const gox = ((R.rGridOriginX.current % gs) + gs) % gs;
      const goy = ((R.rGridOriginY.current % gs) + gs) % gs;
      const Rv = R.rTokenSizeOverride.current[id] ?? 22;
      const cur = R.rPos.current[id] ?? { x, y };
      const col = (px: number) => Math.floor((px + Rv - gox) / gs);
      const row = (py: number) => Math.floor((py + Rv - goy) / gs);
      if (turn.active) {
        const cells = Math.max(0, Math.ceil(Math.hypot(col(x) - col(cur.x), row(y) - row(cur.y)) - 0.5));
        consumedFt = cells * 5;
        if (consumedFt > limit.ft + 0.001) { bounceBack(); return; }
      }
      // Parets: la casella de destí ha de tenir camí transitable des de l'origen (mateix
      // Dijkstra que el clamp/pintura del drag: no es travessa cap paret, cal una porta).
      // En combat, el cost passa a ser el del CAMÍ (vorejar una paret cobra el desvium).
      // Terreny difícil (cost doble): mateixa font que el drag del jugador (`terrainCost`).
      const cost = terrainCost(R.rDifficult.current, gs, gox, goy);
      if (walls.length > 0 || blocked || cost) {
        const budgetFt = limit.ft;
        const reach = computeReachableCells(walls, col(cur.x), row(cur.y), Math.max(0, Math.floor(budgetFt / 5)), { gs, gox, goy }, blocked, cost);
        if (reach) {
          const pathCost = reach.get(`${col(x) - col(cur.x)},${row(y) - row(cur.y)}`);
          if (pathCost === undefined) { bounceBack(); return; }
          if (turn.active) consumedFt = Math.max(0, Math.ceil(pathCost - 0.5)) * 5;
        }
      }
    } else if (walls.length > 0) {
      // Sense grid: el tram directe entre centres no pot creuar cap paret.
      const Rv = R.rTokenSizeOverride.current[id] ?? 22;
      const cur = R.rPos.current[id] ?? { x, y };
      if (segmentBlocked({ x: cur.x + Rv, y: cur.y + Rv }, { x: x + Rv, y: y + Rv }, walls)) { bounceBack(); return; }
    }

    if (turn.active) {
      // Desfeible amb Ctrl+Z fins que canviï el torn: torna la posició i els peus gastats.
      const gen = R.rTurnGen.current;
      const base = tokensCmd(`moviment de ${R.rPlayers.current.find(p => `pl_${p.id}` === sid)?.name ?? 'un jugador'}`, [sid]);
      const ftBefore = turn.activeRemainingFt;
      let ftAfter = ftBefore;
      const setFt = (ft: number) => {
        const t = R.rTurn.current; if (!t.active) return;
        const nt = { ...t, activeRemainingFt: ft }; R.rTurn.current = nt; setTurn(nt);
      };
      _record({
        ...base, alive: () => R.rTurnGen.current === gen,
        undo() { ftAfter = R.rTurn.current.activeRemainingFt; setFt(ftBefore); base.undo(); },
        redo() { setFt(ftAfter); base.redo(); },
      });
    }

    // Animació de desplaçament a la pantalla del DM: el token recorre el camí real
    // (vorejant les parets, forma d'L) o la línia recta si no n'hi ha, en lloc de saltar de
    // cop de l'origen al destí — així el DM veu el moviment i per on ha passat. El camí es
    // calcula des de la posició ANTERIOR, abans d'escriure la nova a rPos.
    {
      const from = R.rPos.current[id];
      if (from) {
        const Rv = R.rTokenSizeOverride.current[id] ?? 22;
        const gsA = R.rGridSize.current;
        const grid = gsA > 0
          ? { gs: gsA, gox: ((R.rGridOriginX.current % gsA) + gsA) % gsA, goy: ((R.rGridOriginY.current % gsA) + gsA) % gsA }
          : { gs: 0, gox: 0, goy: 0 };
        const pts = buildMovePath(from, { x, y }, { walls, grid, R: Rv, straightFallback: true, blocked });
        if (pts) {
          R.rMovePath.current[sid] = { pts, t: 0 };
          // Ancorar ja la posició visual a l'origen: `renderRooms` (que hi centra la llum)
          // corre ABANS de `renderPlayerTokens`, i sense això el primer frame il·luminaria
          // el destí abans que el token hi arribi.
          R.visualPosRef.current[sid] = { ...from };
        } else {
          delete R.rMovePath.current[sid];
        }
      }
    }

    const np = { ...R.rPos.current, [id]: { x, y } };
    R.rPos.current = np; setPos(np);

    // Relay d'un sol token a la resta de pantalles de jugador: s'envia SEMPRE (també en
    // combat) i ABANS del STATE, perquè cada pantalla animi el token vorejant les parets
    // (forma d'L) des de la posició antiga. El STATE (en combat) reajusta rPos/saldo però
    // no toca el camí ja fixat.
    const relay = { type: 'TOKEN_RELAY', id, x, y };
    R.bcRef.current?.postMessage(relay);
    R.wsRef.current?.send(JSON.stringify(relay));

    if (turn.active) {
      // Descompta el saldo i propaga pos + saldo a totes les pantalles amb un STATE
      // (la font autoritzada de rPos, així el disc del jugador s'encongeix i res salta).
      if (consumedFt > 0) {
        const nt = { ...turn, activeRemainingFt: Math.max(0, turn.activeRemainingFt - consumedFt) };
        R.rTurn.current = nt; setTurn(nt);
      }
      _broadcastState({});
    }
  }, [R, _broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Embolcalls que refresquen el menú contextual de sala al moment (sense re-seleccionar).
  const handleSetRoomDark = useCallback((id: string, dark: boolean) => {
    setRoomDark(id, dark);
    setContextMenu(cm => cm && String(cm.id) === id ? { ...cm, roomDark: dark, roomRevealed: dark ? cm.roomRevealed : false } : cm);
  }, [setRoomDark]);
  const handleToggleRoomReveal = useCallback((id: string) => {
    toggleRoomReveal(id);
    setContextMenu(cm => cm && String(cm.id) === id ? { ...cm, roomRevealed: !cm.roomRevealed } : cm);
  }, [toggleRoomReveal]);
  // "🚪 Afegir porta" del menú de sala: activa l'eina Parets en mode col·locació de porta
  // (mateix mode que s'obre sol en tancar una sala nova).
  const handleAddDoorToRoom = useCallback((id: string) => {
    setDrawTool('wall');
    startDoorPlacement(id);
    setContextMenu(null);
  }, [setDrawTool, startDoorPlacement]);

  // ── Punts de llum (torxes/llànties) ──────────────────────────────────────────
  const addLight = useCallback((x: number, y: number) => {
    _pushMapEdit('afegir llum');
    const id = `light_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nl = [...R.rLights.current, { id, x, y, radiusFt: R.rNewLightRadiusFt.current }];
    R.rLights.current = nl; setLights(nl);
    R.rLightSelected.current = id; setLightSelectedId(id);
    _broadcastState({});
  }, [R, _broadcastState, _pushMapEdit]);

  const removeLight = useCallback((id: string) => {
    const nl = R.rLights.current.filter(l => l.id !== id);
    if (nl.length === R.rLights.current.length) return;
    _pushMapEdit('eliminar llum');
    R.rLights.current = nl; setLights(nl);
    if (R.rLightSelected.current === id) { R.rLightSelected.current = null; setLightSelectedId(null); }
    _broadcastState({});
  }, [R, _broadcastState, _pushMapEdit]);

  const selectLight = useCallback((id: string | null) => {
    R.rLightSelected.current = id; setLightSelectedId(id);
    // El slider del radi reflecteix la llum seleccionada.
    const ls = id ? R.rLights.current.find(l => l.id === id) : null;
    if (ls) { R.rNewLightRadiusFt.current = ls.radiusFt; setNewLightRadiusFt(ls.radiusFt); }
  }, [R]);

  // Slider del radi: edita la llum seleccionada si n'hi ha, i sempre el valor per defecte
  // de les llums noves.
  const setLightRadius = useCallback((ft: number) => {
    R.rNewLightRadiusFt.current = ft; setNewLightRadiusFt(ft);
    const sel = R.rLightSelected.current;
    if (sel) {
      // Arrossegar el control lliscant fa molts canvis seguits: s'agrupen en un sol desfer.
      _pushMapEdit('radi de llum', `light-radius:${sel}`);
      const nl = R.rLights.current.map(l => l.id === sel ? { ...l, radiusFt: ft } : l);
      R.rLights.current = nl; setLights(nl);
      _broadcastState({});
    }
  }, [R, _broadcastState, _pushMapEdit]);

  // ── Reset de l'explorat d'una sala ────────────────────────────────────────────
  // Torna a fer negra del tot una sala ja explorada (fog of war): esborra la memòria
  // localment (DM) i avisa els jugadors perquè esborrin la seva (RESET_EXPLORED).
  const onResetExplored = useCallback((id: string) => {
    const room = R.rRooms.current.find(r => r.id === id);
    if (!room) { setContextMenu(null); return; }
    clearExploredAt(room.points);
    R.bcRef.current?.postMessage({ type: 'RESET_EXPLORED', points: room.points });
    R.wsRef.current?.send(JSON.stringify({ type: 'RESET_EXPLORED', points: room.points }));
    setContextMenu(null);
  }, [R]);

  // ── Pantalles de jugador connectades ──────────────────────────────────────
  // Cada pantalla reporta la seva mida (VIEWPORT). Amb l'enquadrament en coords de mapa
  // ningú no veu MENYS que el DM, però una pantalla d'un altre format veu MÉS: el HUD ho
  // mostra perquè el DM sàpiga què hi ha realment a l'altra banda.
  const _registerScreen = useCallback((id: string, w: number, h: number) => {
    if (!w || !h) return;
    const prev = R.rPlayerScreens.current[id];
    R.rPlayerScreens.current = { ...R.rPlayerScreens.current, [id]: { w, h, ts: Date.now() } };
    // Re-render només quan canvia alguna cosa visible (el heartbeat cada 15s no en fa).
    if (!prev || prev.w !== w || prev.h !== h) setPlayerScreens(R.rPlayerScreens.current);
  }, [R]);

  // Oblidar les pantalles que fa massa que no reporten (pestanya tancada): el heartbeat
  // del jugador va cada 15s, així que 50s de marge cobreix reconnexions i suspensions.
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const cur = R.rPlayerScreens.current;
      const kept = Object.fromEntries(Object.entries(cur).filter(([, s]) => now - s.ts < 50000));
      if (Object.keys(kept).length !== Object.keys(cur).length) {
        R.rPlayerScreens.current = kept; setPlayerScreens(kept);
      }
    }, 10000);
    return () => clearInterval(iv);
  }, [R]);

  // Mostreig del format de l'enquadrament per al HUD (fora del render: `rDmCam` és una ref
  // que escriu el tick a 60fps i llegir-la en render no refrescaria res).
  useEffect(() => {
    const iv = setInterval(() => {
      const c = R.rDmCam.current;
      const ar = c ? Math.round((c.w / Math.max(c.h, 1e-6)) * 1000) / 1000 : null;
      setCamAr(prev => (prev === ar ? prev : ar));
    }, 700);
    return () => clearInterval(iv);
  }, [R]);

  // ── BC setup (DM only receives PLAYER_READY) ──────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel(BC_CHANNEL);
    R.bcRef.current = bc;
    const onMsg = (e: { data: unknown }) => {
      const msg = e.data as { type?: string; id?: string | number; w?: number; h?: number; x?: number; y?: number } | null;
      if (msg?.type === 'PLAYER_READY') {
        _sendFullState();
        trResendShowRef.current();
      } else if (msg?.type === 'VIEWPORT' && msg.id) {
        _registerScreen(String(msg.id), msg.w ?? 0, msg.h ?? 0);
      } else if (msg?.type === 'TOKEN_MOVE' && msg.id !== undefined && msg.x !== undefined && msg.y !== undefined) {
        // Moviment fet des de la pantalla de jugador (mateix ordinador via BC). La validació
        // (bloqueig, torn actiu i saldo de peus) i la propagació viuen a handlePlayerTokenMove.
        handlePlayerTokenMove(msg.id, msg.x, msg.y);
      }
    };
    bc.onmessage = onMsg;
    // El tauler de missions de la wiki rep el canal per postMessage (veure `lib/relay.ts`).
    const unrelay = relayBoards(bc, onMsg);
    return () => { unrelay(); bc.close(); R.bcRef.current = null; };
  }, [_sendFullState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket setup (network sync for cross-device iPad/player) ───────────
  useEffect(() => {
    const ws = createSyncSocket('dm', (ev) => {
      let msg: { type: string; id?: number | string; x?: number; y?: number; w?: number; h?: number };
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      if (msg.type === 'PLAYER_READY') {
        _sendFullState();
        trResendShowRef.current();
      } else if (msg.type === 'VIEWPORT' && msg.id !== undefined && msg.w && msg.h) {
        _registerScreen(String(msg.id), msg.w, msg.h);
      } else if (msg.type === 'TOKEN_MOVE' && msg.id !== undefined && msg.x !== undefined && msg.y !== undefined) {
        // Moviment des de la pantalla de jugador (per xarxa). Mateixa validació + propagació
        // que la via BC (bloqueig, torn actiu i saldo de peus) a handlePlayerTokenMove.
        handlePlayerTokenMove(msg.id, msg.x, msg.y);
      }
    }, () => {
      // onOpen (connexió i reconnexions): reenviar l'estat complet perquè el
      // servidor refresqui el STRUCT en caché per als clients que es connectin
      // més tard, i els ja connectats recuperin l'estat si el DM havia caigut.
      _sendFullState();
      trResendShowRef.current();
    });
    R.wsRef.current = ws;
    return () => { ws.close(); R.wsRef.current = null; };
  }, [_sendFullState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw canvas init ───────────────────────────────────────────────
  useEffect(() => {
    const oc = document.createElement('canvas');
    oc.width = 1920; oc.height = 1080;
    R.drawCanvasRef.current = oc;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync state → refs ─────────────────────────────────────────────────────
  useEffect(() => {
    R.rPos.current = pos; R.rZoom.current = zoom;
    R.rPlayers.current = players; R.rLibEnemies.current = libEnemies;
    R.rDrawColor.current = drawColor; R.rDrawSize.current = drawSize;
    R.rConditions.current = conditions; R.rPaintedZones.current = paintedZones;
    R.rWalls.current = walls; R.rRooms.current = rooms; R.rLights.current = lights;
    R.rDefeated.current = defeated;
    R.rGridVisible.current = gridVisible; R.rGridSize.current = gridSize;
    R.rGridSnap.current = gridSnap; R.rGridAutoSize.current = gridAutoSize;
    R.rTokenSizeOverride.current = tokenSizeOverride; R.rGridLineWidth.current = gridLineWidth;
    R.rGridOriginX.current = gridOriginX; R.rGridOriginY.current = gridOriginY;
    R.rGridCalibrating.current = gridCalibrating; R.rEnemyHighlight.current = enemyHighlight;
    R.rHighlightLocked.current = highlightLocked; R.rSelectedToken.current = selectedToken;
    R.rContextMenu.current = contextMenu;
    R.rActiveSpells.current = activeSpells;
  }, [
    pos, zoom, players, libEnemies, drawColor, drawSize, conditions, paintedZones,
    walls, rooms, lights,
    defeated, gridVisible, gridSize, gridSnap, gridAutoSize, tokenSizeOverride,
    gridLineWidth, gridOriginX, gridOriginY, gridCalibrating, enemyHighlight, highlightLocked,
    selectedToken, contextMenu, activeSpells,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enemy highlight timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enemyHighlight || highlightLocked) return;
    const t = setTimeout(() => {
      setEnemyHighlight(false);
      R.rEnemyHighlight.current = false;
      R.rHighlightAlpha.current = 0;
      R.highlightStartRef.current = null;
    }, 3500);
    return () => clearTimeout(t);
  }, [enemyHighlight, highlightLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset canvas cursor when leaving shape tool ───────────────────────────
  useEffect(() => {
    if (drawToolState !== 'shape') {
      setCanvasCursor('default');
      R.rHoveredPaintedZoneId.current = null;
    }
  }, [drawToolState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAF loop ──────────────────────────────────────────────────────────────
  const broadcastDmPreview = useCallback(() => _broadcastState({}), [_broadcastState]);
  useRafLoop(R, { setActiveSpells, setDmPrivateActive, broadcastDmPreview });

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useWheelZoom(R, setZoom, setDmPrivateActive, _broadcastState);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  // ── Conjurs: qui toca i pop-up per confirmar dany, salvacions i estats (abans de l'animació) ──
  // També fora de combat: el DM pot voler el dany sense començar els torns.
  const onSpellCast = useCallback((type: string, points: import('@/types').Point[]): boolean => {
    const slots = tokenSlots(R, false);
    const keys = spellTargets(type, points, slots, gridOf(R.rGridSize.current, R.rGridOriginX.current, R.rGridOriginY.current));
    if (keys.length === 0) return false;
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (const k of keys) {
      const s = slots.find(x => x.key === k); if (!s) continue;
      const a = mapToClient(R, { x: s.x - s.R, y: s.y - s.R }), z = mapToClient(R, { x: s.x + s.R, y: s.y + s.R });
      if (!a || !z) continue;
      l = Math.min(l, a.x); t = Math.min(t, a.y); r = Math.max(r, z.x); b = Math.max(b, z.y);
    }
    if (!Number.isFinite(l)) return false;
    setDamagePrompt(null);
    setSpellPrompt({ type, points, keys, anchor: { l, r, t, b } });
    return true;
  }, [R]);

  const mouseSetters = useMemo(() => ({
    setPos, setActiveDrag, setSelectedToken, setShapeMenu, setSpellMenu,
    setActiveSpells, setPaintedZones, setContextMenu: setContextMenuFromMap, onUndoChange: refreshUndo,
    setDmPrivateActive, setCanvasCursor,
    setWalls, setRooms, redetectRooms, addDoor, removeDoor, toggleDoor,
    addLight, removeLight, selectLight, setLights, pushMapEdit: _pushMapEdit, setPanning,
    setRoomRevealed, beginTokenDrag, beginMapGesture, beginZoneDrag, endUndoGesture,
    tileTool: { down: tileDown, move: tileMove, up: tileUp, leave: tileLeave },
    notify, openDamage: setDamagePrompt, onSpellCast,
  }), [notify, onSpellCast, redetectRooms, addDoor, removeDoor, toggleDoor, addLight, removeLight, selectLight]); // eslint-disable-line react-hooks/exhaustive-deps

  const { onMouseDown, onMouseMove, onMouseUp, onMouseLeaveCanvas, onContextMenu, onDoubleClick } =
    useMouseHandlers(R, mouseSetters, _broadcastState, commitStroke);

  const handleMouseUp = useCallback(() => {
    onMouseUp(setPos, snapAllTokens, sizeAllTokens, setGridSize, setGridOriginX, setGridOriginY, setGridCalibrating);
  }, [onMouseUp, setPos, snapAllTokens, sizeAllTokens, setGridSize, setGridOriginX, setGridOriginY, setGridCalibrating]);
  // Ratolí i dit al canvas: el dit hi afegeix pinça, mantenir premut (menú) i doble toc.
  const canvasPointer = useCanvasPointer(R, {
    down: onMouseDown, move: onMouseMove, up: handleMouseUp, leave: onMouseLeaveCanvas,
    context: onContextMenu, dbl: onDoubleClick,
    setZoom, setDmPrivateActive, broadcast: () => _broadcastState({}),
  });

  // ── Multi-selection group delete (Delete/Backspace removes lib enemies in the selection) ──
  const onDeleteSelection = useCallback(() => {
    for (const id of R.rMultiSelected.current) {
      if (typeof id === 'string' && id.startsWith('lib_')) removeLibEnemy(parseInt(id.replace('lib_', '')));
    }
    R.rMultiSelected.current = new Set();
  }, [removeLibEnemy]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grimori: llançar una màgia des d'un token de jugador ───────────────────
  // Personals (abast 0) surten a l'instant del token. La resta queden pendents del clic
  // de destí (`rAreaPlacementPending`, el mateix camí que les àrees de la roda): el ratolí
  // mou la punta del raig o el centre de l'àrea, limitats a l'abast en peus.
  const castFromToken = useCallback((type: import('@/types').SpellType, origin: { x: number; y: number }) => {
    const area = AREA_SPELL_DATA[type];
    // Personals: les de protecció (Escut) obren el pop-up amb el benefici; la resta surten ja.
    if (area && area.rangeFt === 0) { if (!onSpellCast(type, [origin, origin])) addSpell(type, [origin, origin], () => {}); return; }
    const mode = area ? 'area' as const : 'line' as const;
    R.rAttackPending.current = null;
    R.rAreaPlacementPending.current = { type, origin, mode };
    R.rSpellPreview.current = mode === 'area'
      ? { mode: 'area_place', origin, center: origin, spellType: type }
      : { mode: 'line', start: origin, end: origin, rangeFt: spellRangeFt(type) };
  }, [addSpell, onSpellCast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Atacs del menú d'un token: el ratolí apunta l'objectiu (abast vora a vora, només avís) ──
  const attackFromToken = useCallback((p: import('@/types').AttackPending) => {
    R.rAreaPlacementPending.current = null;
    R.rAttackPending.current = p;
    // Sense previsualització fins que el ratolí es mogui (el menú es tanca i el cursor ja és al mapa).
    R.rSpellPreview.current = null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Token groups (double-click a member to select the whole group) ─────────
  const onCreateGroup = useCallback((ids: (number | string)[]) => {
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    for (const id of ids) R.rTokenGroups.current.set(id, groupId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDissolveGroup = useCallback((groupId: string) => {
    for (const [id, gid] of R.rTokenGroups.current) {
      if (gid === groupId) R.rTokenGroups.current.delete(id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onLeaveGroup = useCallback((id: number | string) => {
    const gid = R.rTokenGroups.current.get(id);
    if (!gid) return;
    R.rTokenGroups.current.delete(id);
    const remaining = [...R.rTokenGroups.current.entries()].filter(([, g]) => g === gid);
    if (remaining.length === 1) R.rTokenGroups.current.delete(remaining[0][0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Desfer l'última paret (Backspace amb l'eina Parets activa) ─────────────
  const removeLastWall = useCallback(() => {
    if (R.rWalls.current.length === 0) return;
    _pushMapEdit('desfer paret');
    const last = R.rWalls.current[R.rWalls.current.length - 1];
    const nw = R.rWalls.current.slice(0, -1);
    R.rWalls.current = nw; setWalls(nw);
    // Treu-la també de la cadena en curs si n'era l'última.
    if (R.rWallChain.current[R.rWallChain.current.length - 1] === last) {
      R.rWallChain.current = R.rWallChain.current.slice(0, -1);
    }
    R.rWallPenLast.current = nw.length > 0 ? last.a : null;
    redetectRooms();
  }, [redetectRooms]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Modes de ratolí (CTRL / MAJ / selecció per àrea) ───────────────────────
  // Viuen aquí, no dins de useKeyboardHandlers, perquè ara també s'activen des dels
  // botons de la barra d'eines flotant: tecla i botó han de fer exactament el mateix.
  const toggleCtrlPan = useCallback(() => {
    if (!R.rCtrlPanToggle.current) {
      R.rCtrlPanToggle.current = true;
      R.rCtrlPanSnapshot.current = { ...R.rPanOffset.current, zoom: R.rZoom.current };
      setCtrlPanActive(true);
    } else {
      R.rCtrlPanToggle.current = false;
      if (R.rCtrlPanSnapshot.current) {
        const { x, y, zoom } = R.rCtrlPanSnapshot.current;
        R.rPanOffset.current = { x, y };
        R.rZoom.current = zoom; setZoom(zoom);
        _broadcastState({});
      }
      R.rCtrlPanSnapshot.current = null;
      setCtrlPanActive(false);
    }
  }, [R, _broadcastState]);

  // Vista privada: la teva càmera es mou sola i els jugadors es queden on eren. En sortir-ne,
  // la teva vista torna sola a la compartida. La fan servir el selector de càmera del mapa
  // (`CanvasHUD`) i el toc de Maj.
  const setPrivateView = useCallback((on: boolean) => {
    if (R.rShiftPanToggle.current === on) return;
    R.rShiftPanToggle.current = on;
    setShiftPanActive(on);
    if (on) return;
    R.rShiftHeld.current = false;
    if (R.dmLocalPan.current.x !== 0 || R.dmLocalPan.current.y !== 0 || R.dmLocalZoom.current !== 1) {
      R.dmPrivateReturnAnim.current = true;
    }
  }, [R]);

  const toggleShiftPan = useCallback(() => {
    // Amb l'eina de màgies, Maj serveix per traçar la línia del spell: no fa de toggle.
    if (R.rDrawTool.current === 'shape') return;
    setPrivateView(!R.rShiftPanToggle.current);
  }, [R, setPrivateView]);

  // «Enviar aquesta vista»: els jugadors passen a veure exactament el que veus en privat. La
  // vista compartida pren el teu enquadrament (zoom × zoom privat, pan + pan privat) i el
  // privat torna a zero: a la teva pantalla no es mou res i continues en vista privada.
  const sendPrivateView = useCallback(() => {
    const z = Math.max(0.2, Math.min(10, R.rZoom.current * R.dmLocalZoom.current));
    R.rPanOffset.current = {
      x: R.rPanOffset.current.x + R.dmLocalPan.current.x,
      y: R.rPanOffset.current.y + R.dmLocalPan.current.y,
    };
    R.rZoom.current = z; setZoom(z);
    R.dmLocalPan.current = { x: 0, y: 0 }; R.dmLocalZoom.current = 1;
    R.dmPrivateReturnAnim.current = false;
    _broadcastState({});
  }, [R, _broadcastState]);

  const toggleAreaSelect = useCallback(() => {
    const next = !R.rAreaSelectMode.current;
    R.rAreaSelectMode.current = next; setAreaSelectMode(next);
    if (!next) R.rAreaSelectRect.current = null;
  }, [R]);

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  const toggleShortcuts = useCallback(() => setShowShortcuts(v => !v), []);
  // Clic a una fila de la llista d'Escena: selecciona el token al canvas (com fer-hi clic).
  const selectToken = useCallback((id: string | number) => {
    setSelectedToken(id); R.rSelectedToken.current = id;
  }, [R]);
  // Clic dret a una fila del lateral: el mateix menú que fer clic dret al token al mapa
  // (també per als tokens que no es veuen a la pantalla ara mateix).
  const openTokenMenu = useCallback((id: string | number, x: number, y: number) => {
    selectToken(id);
    setContextMenu(tokenMenuFor(R, id, x, y));
  }, [R, selectToken]);
  // Enter passa el torn només a Jugar: a Preparar la barra de torns no es veu i un Enter
  // perdut passaria el torn sense que el DM ho veiés.
  const advanceTurnIfPlaying = useCallback(() => { if (mode === 'jugar') advanceTurn(); }, [mode, advanceTurn]);
  // Tecla N: nota ràpida al diari (obre el panell Història pel diari i enfoca el camp).
  const openQuickNote = useCallback(() => { setStoryTab('diari'); setStoryOpen(true); setNoteFocus(n => n + 1); }, []);
  useKeyboardHandlers(R, {
    setDrawTool, undo, redo, skipBossIntro, onQuickNote: openQuickNote,
    toggleCtrlPan, toggleShiftPan, toggleAreaSelect,
    onDeleteSelection,
    removeLastWall,
    cancelWallChain,
    advanceTurn: advanceTurnIfPlaying, toggleShortcuts, setSpaceHeld,
  });

  // ── Fitxers deixats a qualsevol lloc del canvas ────────────────────────────
  // Abans només es podien deixar a la caixa petita «Img/Vídeo» del panell lateral, i el text
  // de benvinguda del centre ho demanava, però el centre no acceptava res.
  // Obrir un mapa nou és començar a preparar-lo: graella, parets, llums.
  // Obrir una partida desada (fitxer, servidor, desat automàtic o la demo) és per jugar-la.
  // Un mapa d'imatge nou deixa enrere el mapa de caselles que hi hagués.
  const dropTileMap = useCallback(() => {
    if (!R.rTileMap.current) return;
    R.rTileMap.current = null; R.rTileRestore.current({ rebake: false });
    if (R.rDrawTool.current === 'tiles') setDrawTool('none');
  }, [R, setDrawTool]);
  const openNewMap = useCallback((f: File) => { switchMode('preparar'); dropTileMap(); return loadBg(f); }, [switchMode, loadBg, dropTileMap]);
  const openSession = useCallback((f: File) => { switchMode('jugar'); return loadSession(f); }, [switchMode, loadSession]);
  const openServerSession = useCallback((id: string) => { switchMode('jugar'); return serverLoadSession(id); }, [switchMode, serverLoadSession]);
  const openDemo = useCallback(() => { switchMode('jugar'); dropTileMap(); return loadDemo(); }, [switchMode, loadDemo, dropTileMap]);
  const openTileMap = useCallback(async (cols: number, rows: number) => {
    switchMode('preparar');
    await createTileMap(cols, rows);
    setDrawTool('tiles');
  }, [switchMode, createTileMap, setDrawTool]);
  const openTmx = useCallback(async (f: File) => {
    switchMode('preparar');
    try { await importTmx(f); } catch (err) { console.error('Error important el .tmx:', err); }
  }, [switchMode, importTmx]);

  const loadAnyFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (name.endsWith('.tmx')) { setPixel(true); void openTmx(f); return; }
    if (name.endsWith('.json')) void openSession(f);
    else if (f.type.startsWith('image/') || f.type.startsWith('video/')) void openNewMap(f);
  }, [openSession, openNewMap, openTmx, setPixel]);
  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onStageDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    fileDragDepth.current += 1; setFileOver(true);
  };
  const onStageDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    fileDragDepth.current = Math.max(0, fileDragDepth.current - 1);
    if (fileDragDepth.current === 0) setFileOver(false);
  };
  const onStageDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    fileDragDepth.current = 0; setFileOver(false);
    const f = e.dataTransfer.files[0];
    if (f) loadAnyFile(f);
  };

  // ── Canvas-level callbacks ────────────────────────────────────────────────
  const onResetView = useCallback(() => {
    R.rZoom.current = 1; setZoom(1);
    R.rPanOffset.current = { x: 0, y: 0 };
    _broadcastState({});
  }, [_broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  const onToggleEnemyHighlight = useCallback(() => {
    const next = !R.rEnemyHighlight.current;
    R.rEnemyHighlight.current = next; setEnemyHighlight(next);
    if (next) R.highlightStartRef.current = performance.now();
    else { R.rHighlightAlpha.current = 0; R.highlightStartRef.current = null; }
    _broadcastState({});
  }, [_broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Graella visible / amagada (menú Vista, als dos modes). La configuració és al panell de
  // Graella de Preparar; aquí només s'ensenya o s'amaga, sense obrir el calibratge.
  const toggleGridVisible = useCallback(() => {
    const nv = !R.rGridVisible.current;
    R.rGridVisible.current = nv; setGridVisible(nv);
    if (!nv && R.rGridCalibrating.current) { R.rGridCalibrating.current = false; setGridCalibrating(false); }
    _broadcastState({});
  }, [R, _broadcastState]);

  const onToggleHighlightLocked = useCallback(() => {
    const next = !R.rHighlightLocked.current;
    R.rHighlightLocked.current = next; setHighlightLocked(next);
  }, [R]);

  const openSceneConfig = useCallback(() => {
    if (!contextMenu || contextMenu.isPaintedZone) return;
    setSceneConfigMenu({
      id: contextMenu.id, name: contextMenu.name,
      tokenPos: (pos[contextMenu.id] ?? null) as Point | null,
      menuX: contextMenu.x, menuY: contextMenu.y,
    });
    setContextMenu(null);
  }, [contextMenu, pos]);

  const onZoomChange = useCallback((z: number) => {
    R.rZoom.current = z; setZoom(z); _broadcastState({});
  }, [_broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExpositorFile = useCallback((file: File) => {
    if (expositorLocalSrc) URL.revokeObjectURL(expositorLocalSrc);
    const url = URL.createObjectURL(file);
    setExpositorLocalSrc(url);
    setExpositorLocalType(file.type.startsWith('video/') ? 'video' : 'image');
    expositorFileRef.current = file;
    expositorKbStartTime.current = null;
    expositorKbVariant.current = Math.floor(Math.random() * 4);
    expositorKbPhase.current = 0;
    // Auto-send if already active on player
    if (expositorActiveRef.current) {
      file.arrayBuffer().then(buf => {
        R.bcRef.current?.postMessage({ type: 'EXPOSITOR_SHOW', buffer: buf, mimeType: file.type });
        R.wsRef.current?.send(JSON.stringify({ type: 'EXPOSITOR_SHOW_META', mimeType: file.type }));
        R.wsRef.current?.sendBinary(buf);
      });
    }
  }, [expositorLocalSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  const hideTextRevealOnPlayer = useCallback(() => {
    R.bcRef.current?.postMessage({ type: 'TEXTREVEAL_HIDE' });
    R.wsRef.current?.send(JSON.stringify({ type: 'TEXTREVEAL_HIDE' }));
    trActiveRef.current = false;
    setTextRevealActive(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendExpositorToPlayer = useCallback(async () => {
    const file = expositorFileRef.current;
    if (!file) return;
    // Sinergia: en mostrar una imatge/vídeo, amaguem el revelador de text (crossfade al jugador)
    // i acabem el diàleg (cadascun amaga els altres).
    if (trActiveRef.current) hideTextRevealOnPlayer();
    dialogEndRef.current();
    const buf = await file.arrayBuffer();
    R.bcRef.current?.postMessage({ type: 'EXPOSITOR_SHOW', buffer: buf, mimeType: file.type });
    R.wsRef.current?.send(JSON.stringify({ type: 'EXPOSITOR_SHOW_META', mimeType: file.type }));
    R.wsRef.current?.sendBinary(buf);
    expositorActiveRef.current = true;
    setExpositorActive(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hideExpositorOnPlayer = useCallback(() => {
    R.bcRef.current?.postMessage({ type: 'EXPOSITOR_HIDE' });
    R.wsRef.current?.send(JSON.stringify({ type: 'EXPOSITOR_HIDE' }));
    expositorActiveRef.current = false;
    setExpositorActive(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Panell «Mostrar als jugadors» (pestanyes Imatge o vídeo / Text) ─────────
  const openShowTab = useCallback((t: ShowTab) => {
    setShowTab(t);
    setExpositorOpen(t === 'imatge');
    setTextRevealOpen(t === 'text');
    setDialogOpen(t === 'dialeg');
    setSheetOpen(t === 'fitxa');
  }, []);
  const closeShowPanel = useCallback(() => { setExpositorOpen(false); setTextRevealOpen(false); setDialogOpen(false); setSheetOpen(false); }, []);
  const showPanelOpen = expositorOpen || textRevealOpen || dialogOpen || sheetOpen;

  // ── Diàlegs de personatges (pestanya «Diàleg», veure `useDialog`) ─────────
  const dlg = useDialog(R, {
    broadcast: () => _broadcastState({}),
    hideOthers: () => {
      if (expositorActiveRef.current) hideExpositorOnPlayer();
      if (trActiveRef.current) hideTextRevealOnPlayer();
    },
    launchBossIntro,
  });
  useEffect(() => { dialogEndRef.current = () => { if (R.rDialog.current) dlg.end(); }; dialogsChangedRef.current = dlg.reloadDialogs; });

  const [dialogDraft, setDialogDraft] = useState<DialogDraft>(EMPTY_DRAFT);
  // Tokens de l'escena per relacionar-hi els noms del guió (de l'estat, no dels refs).
  const sceneTokenList = useMemo(() => [
    ...players.map(p => ({ key: `pl_${p.id}`, name: p.name })),
    ...libEnemies.map(e => ({ key: `lib_${e.id}`, name: e.name })),
  ], [players, libEnemies]);
  const saveDraft = useCallback((d: DialogDraft) => {
    if (!d.owner) return;
    const id = d.id ?? Math.random().toString(36).slice(2, 10);
    dlg.saveDialog(d.owner, { id, title: d.title.trim() || 'Diàleg', script: d.script, cast: d.cast, afterBoss: d.afterBoss });
    setDialogDraft({ ...d, id });
  }, [dlg]);
  const startDraft = useCallback((d: DialogDraft) => {
    setDialogDraft(d);
    // El panell es tanca: el DM ha de veure l'escena, i la barra de control ja ho té tot.
    closeShowPanel();
    dlg.start({ title: d.title.trim() || 'Diàleg', script: d.script, cast: d.cast, cps: d.cps, afterBossOf: d.afterBoss ? d.owner : null });
  }, [dlg, closeShowPanel]);

  const toggleShowPanel = useCallback(() => {
    if (showPanelOpen) closeShowPanel();
    // Si ara mateix s'està mostrant alguna cosa, s'obre per aquella pestanya.
    else openShowTab(dlg.ui ? 'dialeg' : textRevealActive ? 'text' : expositorActive ? 'imatge' : sheetShowId ? 'fitxa' : showTab);
  }, [showPanelOpen, closeShowPanel, openShowTab, textRevealActive, expositorActive, showTab, dlg.ui, sheetShowId]);

  // ── Fitxa a les pantalles de jugador (camp pesat `sheet` del STATE) ────────
  /** Foto de la fitxa amb les parts triades; el retrat i el color, del jugador que la porta. */
  const sheetFor = useCallback((id: string, parts: string[]) => {
    const c = chars.characters.find(ch => ch.id === id);
    if (!c) return null;
    const pl = players.find(p => characterFor(p, chars.characters)?.id === id);
    return buildSheetShow(c, parts, { color: pl?.color, sprite: pixel ? pl?.sprite : undefined, portrait: pl?.portrait });
  }, [chars.characters, players, pixel]);
  const showSheet = useCallback(() => {
    if (!sheetSel) return;
    const sh = sheetFor(sheetSel, sheetParts);
    if (!sh) return;
    R.rSheetShow.current = sh; setSheetShowId(sh.id); _broadcastState({});
  }, [R, sheetSel, sheetParts, sheetFor, _broadcastState]);
  const hideSheet = useCallback(() => {
    R.rSheetShow.current = null; setSheetShowId(null); _broadcastState({});
  }, [R, _broadcastState]);
  // Mentre es mostra: si canvien les parts, l'experiència o el retrat, les pantalles es refresquen.
  useEffect(() => {
    const cur = R.rSheetShow.current;
    if (!cur || sheetSel !== cur.id) return;
    const sh = sheetFor(cur.id, sheetParts);
    if (sh && JSON.stringify(sh) !== JSON.stringify(cur)) { R.rSheetShow.current = sh; _broadcastState({}); }
  }, [R, sheetSel, sheetParts, sheetFor, _broadcastState]);

  // Vida màxima de cada jugador = la de la seva fitxa (font de veritat, també sense connexió).
  useEffect(() => {
    const pairs = players.flatMap(p => {
      const c = characterFor(p, chars.characters);
      return c && c.hpMax !== p.hpMax ? [{ id: p.id, hpMax: c.hpMax }] : [];
    });
    if (pairs.length) syncPlayersHpMax(pairs);
  }, [players, chars.characters, syncPlayersHpMax]);
  /** Canviar la vida màxima d'un jugador amb fitxa la canvia també a la fitxa (si no, es desfaria). */
  const setPlayerHpMaxAndSheet = useCallback((id: number, hpMax: number) => {
    setPlayerHpMax(id, hpMax);
    const pl = players.find(p => p.id === id);
    const c = pl ? characterFor(pl, chars.characters) : null;
    if (c && c.hpMax !== hpMax) void chars.update(c.id, { hpMax: Math.max(1, Math.round(hpMax)) });
  }, [setPlayerHpMax, players, chars]);

  // ── Experiència ────────────────────────────────────────────────────────────
  /**
   * Acabar el combat: si hi ha enemics derrotats amb XP i jugadors amb fitxa, prepara el
   * repartiment (finestra «Experiència del combat») abans de tancar-lo.
   */
  const finishCombat = useCallback(() => {
    const t = R.rTurn.current;
    if (t.active && chars.status !== 'loading') {
      const enemies: XpAward['enemies'] = [];
      for (const id of t.order) {
        const key = String(id);
        if (key.startsWith('pl_') || !R.rDefeated.current[key]) continue;
        const en = R.rLibEnemies.current.find(e => `lib_${e.id}` === key);
        if (en?.xp) enemies.push({ name: en.name, xp: en.xp });
      }
      const players = t.order.filter(id => String(id).startsWith('pl_')).flatMap(id => {
        const pl = R.rPlayers.current.find(p => `pl_${p.id}` === String(id));
        if (!pl) return [];
        const c = characterFor(pl, chars.characters);
        return [{ key: String(id), name: pl.name, characterId: c?.id ?? null, characterName: c?.name ?? null, defeated: !!R.rDefeated.current[String(id)] }];
      });
      if (enemies.length && players.some(p => p.characterId)) {
        setXpAward({ awardId: `combat-${Date.now().toString(36)}`, enemies, players });
      }
    }
    if (t.active) {
      const nameOf = (key: string) => key.startsWith('pl_')
        ? R.rPlayers.current.find(p => `pl_${p.id}` === key)?.name
        : R.rLibEnemies.current.find(e => `lib_${e.id}` === key)?.name;
      const keys = t.order.map(String).filter(k => R.rDefeated.current[k]);
      const foes = keys.filter(k => !k.startsWith('pl_')).flatMap(k => nameOf(k) ?? []);
      const fallen = keys.filter(k => k.startsWith('pl_')).flatMap(k => nameOf(k) ?? []);
      logJournal('combat',
        `Combat acabat · ${t.round} ${t.round === 1 ? 'ronda' : 'rondes'}${foes.length ? ` · derrotats: ${foes.join(', ')}` : ''}${fallen.length ? ` · a terra: ${fallen.join(', ')}` : ''}`,
        { data: { ended: true, rounds: t.round, defeated: foes, fallen } });
    }
    endTurnCombat();
  }, [R, chars.status, chars.characters, endTurnCombat]);
  const confirmXpAward = useCallback(async (awards: { id: string; amount: number }[], total: number) => {
    if (!xpAward) return;
    setXpBusy(true);
    const names = xpAward.enemies.map(e => e.name).join(', ');
    const res = await chars.awardBatch(awards, { reason: `Combat: ${names}`.slice(0, 120), source: 'combat', awardId: xpAward.awardId });
    setXpBusy(false);
    if (res) {
      const who = awards.flatMap(a => chars.characters.find(c => c.id === a.id)?.name ?? []);
      logJournal('xp', `XP repartida: ${total} entre ${who.length ? who.join(', ') : `${awards.length} personatges`}`, { data: { total, to: who } });
      notify(`Repartides ${total} XP entre ${awards.length} ${awards.length === 1 ? 'personatge' : 'personatges'}.`, 'info');
      setXpAward(null);
    }
  }, [xpAward, chars, notify]);
  const characterMenu = useMemo(() => ({
    characters: chars.characters, status: chars.status, pending: chars.pending,
    onLink: (playerId: number, characterId: string | undefined) => setPlayerCharacter(playerId, characterId),
    onAward: (id: string, amount: number, reason: string) => {
      void chars.award(id, amount, { reason, source: 'dm', awardId: `dm-${Date.now().toString(36)}` }).then(c => {
        if (c) notify(`${amount > 0 ? '+' : ''}${amount} XP a ${c.name} (${c.xp} XP).`, 'info');
      });
    },
    onLevelUp: (id: string, level: number) => {
      void chars.update(id, { level }).then(c => { if (c) notify(`${c.name} puja a nivell ${level}.`, 'info'); });
    },
    onShowSheet: (id: string) => { setSheetSel(id); openShowTab('fitxa'); },
  }), [chars, notify, setPlayerCharacter, openShowTab]);

  // ── Expositor RAF loop: KB animation + EXPOSITOR_SYNC broadcast ───────────
  useEffect(() => {
    if (!expositorLocalSrc) return;
    if (expositorKbStartTime.current === null) {
      expositorKbStartTime.current = performance.now();
    }

    const KB_HALF = 38000;
    const KB_VARIANTS = [
      (p: number) => ({ scale: 1 + p * 0.12, tx: 0, ty: 0 }),       // zoom
      (p: number) => ({ scale: 1.07, tx: p * 6, ty: 0 }),             // pan-right
      (p: number) => ({ scale: 1.07, tx: -p * 6, ty: 0 }),            // pan-left
      (p: number) => ({ scale: 1.07, tx: 0, ty: -p * 6 }),            // pan-up
    ];

    const tick = () => {
      expositorRafRef.current = requestAnimationFrame(tick);

      if (!expositorKbPaused.current) {
        const elapsed = performance.now() - (expositorKbStartTime.current ?? performance.now());
        const cycle = elapsed % (KB_HALF * 2);
        const raw = cycle < KB_HALF ? cycle / KB_HALF : 2 - cycle / KB_HALF;
        expositorKbPhase.current = (1 - Math.cos(raw * Math.PI)) / 2;
      }

      const kb = KB_VARIANTS[expositorKbVariant.current]?.(expositorKbPhase.current) ?? { scale: 1, tx: 0, ty: 0 };
      const userZ = expositorZoom.current;
      const userPx = expositorPan.current.x;
      const userPy = expositorPan.current.y;

      if (expositorInnerRef.current) {
        expositorInnerRef.current.style.transform =
          `translate(calc(-50% + ${userPx}px), calc(-50% + ${userPy}px)) scale(${userZ * kb.scale}) translate(${kb.tx}%, ${kb.ty}%)`;
      }

      if (expositorActiveRef.current) {
        const now = performance.now();
        if (now - expositorLastSync.current >= 33) {
          expositorLastSync.current = now;
          const pw = expositorPreviewRef.current?.clientWidth || 320;
          const ph = expositorPreviewRef.current?.clientHeight || 260;
          const expSync = {
            type: 'EXPOSITOR_SYNC',
            zoom: userZ * kb.scale,
            panXNorm: userPx / pw,
            panYNorm: userPy / ph,
            kbTxPct: kb.tx,
            kbTyPct: kb.ty,
          };
          R.bcRef.current?.postMessage(expSync);
          R.wsRef.current?.send(JSON.stringify(expSync));
        }
      }
    };

    expositorRafRef.current = requestAnimationFrame(tick);
    return () => { if (expositorRafRef.current) cancelAnimationFrame(expositorRafRef.current); };
  }, [expositorLocalSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Spacebar handler for expositor ───────────────────────────────────────
  useEffect(() => {
    if (!expositorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // (Abans la condició tenia la precedència malament i QUALSEVOL tecla fora d'un camp
      // reiniciava el Ken Burns: també l'Enter de passar torn o les dreceres de les eines.)
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        expositorKbPaused.current = !expositorKbPaused.current;
        expositorZoom.current = 1;
        expositorPan.current = { x: 0, y: 0 };
        expositorKbStartTime.current = performance.now();
        expositorKbPhase.current = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expositorOpen]);

  // ── Revelador de text: helpers ─────────────────────────────────────────────
  const trCps = useCallback(() => cpsFromSlider(+(trSpeedRef.current?.value ?? 50)), []);
  const trFadeMs = useCallback(() => fadeMsFromSlider(+(trSmoothRef.current?.value ?? 55)), []);

  const trUpdateStatus = useCallback(() => {
    const eng = trEngineRef.current;
    const n = eng?.n ?? 0;
    if (trProgRef.current) trProgRef.current.style.width = (n ? (eng!.pos / n * 100) : 0) + '%';
    if (trCounterRef.current) {
      if (!n) trCounterRef.current.textContent = '—';
      else if (trManualRef.current) trCounterRef.current.innerHTML = `Frase <b style="color:${C.bright}">${eng!.sentenceIndex()}</b> / ${eng!.bounds.length}`;
      else trCounterRef.current.innerHTML = `<b style="color:${C.bright}">${Math.round(eng!.pos / n * 100)}%</b> revelat`;
    }
    if (trPlayBtnRef.current) {
      const eng2 = trEngineRef.current;
      const lbl = trManualRef.current ? 'Revela frase'
        : (trRunningRef.current && !trPausedRef.current ? 'Pausa'
          : (eng2 && eng2.pos > 0 && eng2.pos < eng2.n ? 'Continua' : 'Comença'));
      trPlayBtnRef.current.textContent = lbl;
    }
  }, []);

  const trBuild = useCallback(() => {
    const container = trTextRef.current; if (!container) return;
    const eng = trEngineRef.current ?? new RevealEngine();
    trEngineRef.current = eng;
    eng.setText(trSrcRef.current?.value ?? '', container);
    if (trStageRef.current) trStageRef.current.scrollTop = 0;
    trUpdateStatus();
  }, [trUpdateStatus]);

  const trBroadcastShow = useCallback(() => {
    const eng = trEngineRef.current; if (!eng) return;
    const payload = { type: 'TEXTREVEAL_SHOW' as const, text: trSrcRef.current?.value ?? '', pos: eng.pos, cps: trCps(), fadeMs: trFadeMs() };
    R.bcRef.current?.postMessage(payload);
    R.wsRef.current?.send(JSON.stringify(payload));
  }, [trCps, trFadeMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manté trResendShowRef apuntant a la versió actual (els handlers de BC/WS es
  // creen abans que trBroadcastShow existeixi, per això va via ref).
  useEffect(() => {
    trResendShowRef.current = () => { if (trActiveRef.current) trBroadcastShow(); };
  }, [trBroadcastShow]);

  const sendTextRevealToPlayer = useCallback(() => {
    let eng = trEngineRef.current;
    if (!eng || eng.n === 0) { trBuild(); eng = trEngineRef.current; }
    if (!eng || eng.n === 0) return;
    // Sinergia: en llançar text, amaguem l'expositor d'imatge (crossfade al jugador) i el diàleg
    if (expositorActiveRef.current) hideExpositorOnPlayer();
    dialogEndRef.current();
    trBroadcastShow();
    trActiveRef.current = true;
    setTextRevealActive(true);
    const shown = (trSrcRef.current?.value ?? '').replace(/\s+/g, ' ').trim();
    logJournal('text', `Text als jugadors: «${shown.length > 70 ? `${shown.slice(0, 70).trimEnd()}…` : shown}»`);
  }, [trBuild, trBroadcastShow, hideExpositorOnPlayer]);

  const trPlay = useCallback(() => {
    let eng = trEngineRef.current;
    if (!eng || eng.n === 0) { trBuild(); eng = trEngineRef.current; }
    if (!eng || eng.n === 0) return;
    if (eng.pos >= eng.n) eng.reset();
    trPausedRef.current = false; trRunningRef.current = true;
    trUpdateStatus();
  }, [trBuild, trUpdateStatus]);

  const trPause = useCallback(() => {
    trPausedRef.current = true; trUpdateStatus();
  }, [trUpdateStatus]);

  const trNextSentence = useCallback(() => {
    let eng = trEngineRef.current;
    if (!eng || eng.n === 0) { trBuild(); eng = trEngineRef.current; }
    if (!eng || eng.n === 0) return;
    const ref = Math.max(eng.pos, eng.target);
    const nb = eng.nextBoundary(ref);
    if (nb < 0) return;
    eng.target = nb; trPausedRef.current = false; trRunningRef.current = true;
    trUpdateStatus();
  }, [trBuild, trUpdateStatus]);

  const trPrevSentence = useCallback(() => {
    const eng = trEngineRef.current; if (!eng || eng.n === 0) return;
    eng.snapTo(eng.prevBoundary(Math.round(eng.pos)));
    trUpdateStatus();
  }, [trUpdateStatus]);

  const trReset = useCallback(() => {
    const eng = trEngineRef.current; if (!eng) return;
    eng.reset(); trPausedRef.current = true;
    if (trStageRef.current) trStageRef.current.scrollTop = 0;
    trUpdateStatus();
  }, [trUpdateStatus]);

  // ── Revelador de text: text que deixa un mòdul de la Història ───────────────
  // Obre la pestanya Text i hi escriu el text; el DM el mostra als jugadors quan vulgui.
  const showTextInReveal = useCallback((text: string) => {
    trPrefillRef.current = text;
    openShowTab('text');
    setTrPrefillNonce(n => n + 1);
  }, [openShowTab]);
  useEffect(() => {
    const txt = trPrefillRef.current;
    const ta = trSrcRef.current;
    if (txt === null || !textRevealOpen || !ta) return;
    trPrefillRef.current = null;
    ta.value = txt;
    trBuild();
    trEngineRef.current?.reset();
    trRunningRef.current = false; trPausedRef.current = true;
    trUpdateStatus();
  }, [textRevealOpen, trPrefillNonce, trBuild, trUpdateStatus]);

  // ── Història: el que un mòdul pot fer sobre l'escena, i el diari ───────────
  const story = useStory(R, {
    setLibEnemies, setPos, broadcast: () => _broadcastState({}), notify,
    showText: showTextInReveal, startDialog: dlg.start, sceneTokens: sceneTokenList,
  });
  useJournalWatchers(R, { rooms, defeated, players, bgLoaded, bgName });

  // ── Revelador de text: RAF loop (preview + streaming TEXTREVEAL_SYNC) ───────
  useEffect(() => {
    if (!textRevealOpen) { trBuild(); return; }
    trBuild();
    const tick = (ts: number) => {
      trRafRef.current = requestAnimationFrame(tick);
      const eng = trEngineRef.current; if (!eng) return;
      const dt = trLastTsRef.current ? Math.min(80, ts - trLastTsRef.current) : 16;
      trLastTsRef.current = ts;
      eng.tick(dt);

      const cps = trCps();
      const fadeMs = trFadeMs();
      if (eng.n && trRunningRef.current && !trPausedRef.current) {
        eng.advance(dt, cps, trDramaticRef.current, trManualRef.current);
        const moving = trManualRef.current ? (eng.pos < eng.target - 1e-6) : (eng.pos < eng.n || eng.dwell > 0);
        const fading = eng.solid < eng.passed;
        if (!moving && !fading) {
          trRunningRef.current = false;
          if (!trManualRef.current && eng.pos >= eng.n) trPausedRef.current = true;
        }
      }
      eng.render(fadeMs, trStageRef.current);
      trUpdateStatus();

      if (trActiveRef.current && ts - trLastSyncRef.current >= 33) {
        trLastSyncRef.current = ts;
        const payload = { type: 'TEXTREVEAL_SYNC' as const, pos: eng.pos, cps, fadeMs };
        R.bcRef.current?.postMessage(payload);
        R.wsRef.current?.send(JSON.stringify(payload));
      }
    };
    trRafRef.current = requestAnimationFrame(tick);
    return () => { if (trRafRef.current) cancelAnimationFrame(trRafRef.current); trLastTsRef.current = 0; };
  }, [textRevealOpen, trBuild, trCps, trFadeMs, trUpdateStatus]);

  // ── Revelador de text: teclat (només quan el panell és obert) ───────────────
  useEffect(() => {
    if (!textRevealOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      switch (e.key) {
        case ' ': e.preventDefault(); trManualRef.current ? trNextSentence() : (trPausedRef.current ? trPlay() : trPause()); break;
        case 'ArrowRight': e.preventDefault(); trManualRef.current ? trNextSentence() : trPlay(); break;
        case 'ArrowLeft': e.preventDefault(); trManualRef.current ? trPrevSentence() : trReset(); break;
        case 'r': case 'R': trReset(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [textRevealOpen, trNextSentence, trPlay, trPause, trPrevSentence, trReset]);

  // ── Computed ───────────────────────────────────────────────────────────────
  // Enemics de l'escena que poden entrar en una cinemàtica de grup (biblioteca).
  const sceneFoes = useMemo(() => [
    ...libEnemies.map(en => ({ id: `lib_${en.id}`, name: en.name })),
  ], [libEnemies]);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="full-stage dm-root" style={{ display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>

      {/* ── Barra superior ───────────────────────────────────────────────── */}
      <TopBar
        mapName={bgLoaded ? bgName : null}
        sidebarOpen={sideOpen} onToggleSidebar={toggleSide}
        mode={mode} onModeChange={switchMode}
        undoLabel={undoNext.undo} onUndo={undo} redoLabel={undoNext.redo} onRedo={redo}
        playerScreens={playerScreens} camAr={camAr} onOpenPlayer={openPlayerWindow}
        phosphor={phosphor} onTogglePhosphor={() => setPhosphor(!phosphor)}
        onOpenBoard={() => { if (!openBoard()) notify("El navegador no ha deixat obrir el tauler de missions: permet les finestres emergents d'aquesta pàgina."); }}
        autosaveEnabled={autosaveEnabled} autosaveAt={autosaveAt} autosaveFailing={autosaveFailing}
        onToggleAutosave={toggleAutosave} onSaveNow={() => void autosaveNow()}
        onExport={saveSession} onImport={f => void openSession(f)}
        onOpenServer={serverSessionsEnabled ? () => setShowServerSessions(true) : undefined}
        bgOpacity={bgOpacity} onBgOpacityChange={onBgOpacityChange}
        gridVisible={gridVisible} onToggleGrid={toggleGridVisible}
        enemyHighlight={enemyHighlight} highlightLocked={highlightLocked}
        onToggleEnemyHighlight={onToggleEnemyHighlight} onToggleHighlightLocked={onToggleHighlightLocked}
        onShowShortcuts={toggleShortcuts}
        pixel={pixel} onSetPixel={setPixel}
      />

      {/* Context d'apilament propi (zIndex 0): els menús de la barra queden sempre per sobre
          del que hi ha a l'escenari. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative', zIndex: 0 }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      {/* Plegable: s'anima l'amplada del contenidor i el contingut manté els seus 270 px (no es
          reorganitza a mig plegar). `inert` perquè el Tab no entri al que no es veu. El canvas
          ja s'adapta sol a la mida nova (el tick la mira cada frame). */}
      {/* Mòbil: el lateral és un calaix per sobre del mapa (el mapa es queda tota l'amplada). */}
      {compact && sideOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 29, background: 'rgba(0,0,0,0.45)' }} />
      )}
      <div style={compact ? {
        position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 30, width: 'min(310px, 88vw)', background: C.bg,
        borderRight: `1px solid ${C.border}`, boxShadow: sideOpen ? SHADOW.menu : 'none', overflow: 'hidden',
        transform: sideOpen ? 'none' : 'translateX(-105%)', transition: 'transform .22s ease',
        paddingLeft: 'env(safe-area-inset-left)', paddingBottom: 'env(safe-area-inset-bottom)',
      } : { width: sidebarOpen ? SIDEBAR_W : 0, flexShrink: 0, overflow: 'hidden', borderRight: sidebarOpen ? `1px solid ${C.border}` : 'none', transition: 'width .2s ease' }}>
      <div inert={!sideOpen} style={{ width: compact ? '100%' : SIDEBAR_W, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {/* Mapa només a Preparar (i primera). Escena i Biblioteca, als dos modes: col·locar
              enemics és preparar, però afegir-ne un a mitja partida també passa. */}
          {(mode === 'preparar'
            ? [['mapa', 'Mapa'], ['escena', 'Escena'], ['biblioteca', 'Biblioteca']] as const
            : [['escena', 'Escena'], ['biblioteca', 'Biblioteca']] as const
          ).map(([tab, label]) => (
            <button key={tab} onClick={() => setSidebarTab(tab)}
              style={{ flex: 1, padding: '8px 4px', fontSize: FS.xs, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', border: 'none', cursor: 'pointer', background: sidebarTab === tab ? tint(C.accent, 0.09) : 'transparent', color: sidebarTab === tab ? C.accent : C.dim, borderBottom: sidebarTab === tab ? `2px solid ${C.accent}` : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content (barra de desplaçament pròpia: discreta i amagada en repòs) */}
        <ScrollArea style={{ flex: 1 }}>
          {sidebarTab === 'escena' && (
            <>
              <PlayersPanel
                players={players} newPName={newPName} setNewPName={setNewPName}
                newPColor={newPColor} setNewPColor={setNewPColor}
                newPHpMax={newPHpMax} setNewPHpMax={setNewPHpMax}
                onAdd={() => { addPlayer(newPName, newPColor, newPHpMax); setNewPName(''); }}
                onAdjustHp={adjustPlayerHp} onLoadParty={loadParty}
                selectedToken={selectedToken} onSelect={selectToken} onMenu={openTokenMenu} defeated={defeated}
                pixel={pixel} onSetPortrait={(id, url) => setPlayerLook(id, { portrait: url })}
              />
              <SceneEnemiesPanel
                libEnemies={libEnemies} defeated={defeated} selectedToken={selectedToken}
                onSelect={selectToken} onMenu={openTokenMenu}
                onToggleLibVis={toggleLibEnemyVisibility} onAdjustLibHp={adjustLibEnemyHp}
                onRemoveLib={removeLibEnemy}
                onOpenLibrary={() => setSidebarTab('biblioteca')} pixel={pixel}
              />
            </>
          )}
          {sidebarTab === 'mapa' && mode === 'preparar' && (
            <>
              {pixel && (
                <PixelMapPanel tileMapSize={tileMapSize}
                  onCreate={(c, r) => void openTileMap(c, r)} onImportTmx={f => void openTmx(f)}
                  onEdit={() => setDrawTool('tiles')} />
              )}
              <ImportPanel
                bgLoaded={bgLoaded} bgName={bgName}
                onLoadBg={f => void openNewMap(f)} onLoadDemo={() => void openDemo()}
              />
              {bgLoaded && (
                <RoomsPanel
                  rooms={rooms} lights={lights} wallsCount={walls.length}
                  selectedLightId={lightSelectedId}
                  hoveredRoomRef={R.rHoveredRoomId}
                  onSetRoomDark={handleSetRoomDark} onToggleRoomReveal={handleToggleRoomReveal}
                  onRenameRoom={renameRoom} onDeleteRoom={deleteRoom}
                  onAddDoor={handleAddDoorToRoom} onResetExplored={onResetExplored}
                  onSelectLight={selectLight} onRemoveLight={removeLight}
                />
              )}
            </>
          )}
          {sidebarTab === 'biblioteca' && (
            <EnemyLibraryPanel
              libEnemies={libEnemies}
              onAddEnemy={addLibEnemy}
              onAddDbEnemy={addDbEnemy}
              pixel={pixel && pack.status === 'ready'}
            />
          )}
        </ScrollArea>
      </div>
      </div>

      {/* ── Main canvas area ──────────────────────────────────────────────── */}
      <div ref={R.stageRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}
        onDragEnter={onStageDragEnter} onDragLeave={onStageDragLeave}
        onDragOver={e => { if (isFileDrag(e)) e.preventDefault(); }} onDrop={onStageDrop}>
        <NoticeStack notices={notices} onClose={dismissNotice} />
        <div ref={R.bgTransitionRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
        <canvas
          ref={R.canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, touchAction: 'none', cursor: panning ? 'grabbing' : spaceHeld ? 'grab' : (drawToolState === 'pen' || drawToolState === 'eraser' || drawToolState === 'pointer') ? 'none' : (areaSelectMode || drawToolState === 'wall' || drawToolState === 'light') ? 'crosshair' : canvasCursor }}
          {...canvasPointer}
          onContextMenu={onContextMenu}
          onDoubleClick={onDoubleClick}
        />
        <RightRail
          canShow={mode === 'jugar' || showPanelOpen || expositorActive || textRevealActive || !!dlg.ui || !!sheetShowId}
          showOpen={showPanelOpen} showActive={expositorActive || textRevealActive || !!dlg.ui || !!sheetShowId} onToggleShow={toggleShowPanel}
          storyOpen={storyOpen} onToggleStory={() => setStoryOpen(v => !v)} />
        <CanvasHUD
          gridCalibrating={gridCalibrating} hasMap={bgLoaded}
          zoom={zoom} onZoomChange={onZoomChange} onResetView={onResetView}
          privateView={shiftPanActive} tempShared={ctrlPanActive}
          onSetPrivate={setPrivateView} onSendView={sendPrivateView} onEndTemp={toggleCtrlPan}
        />
        <FloatingToolbar
          mode={mode}
          drawTool={drawToolState} drawColor={drawColor} setDrawColor={setDrawColor}
          drawSize={drawSize} setDrawSize={setDrawSize}
          paintedZones={paintedZones}
          onSetDrawTool={setDrawTool}
          onClearDraw={clearDrawing} onClearPaintedZones={clearPaintedZones}
          bcRef={R.bcRef} wsRef={R.wsRef}
          lightRadiusFt={newLightRadiusFt} lightSelected={lightSelectedId !== null} onSetLightRadius={setLightRadius}
          areaSelectMode={areaSelectMode} onToggleAreaSelect={toggleAreaSelect}
          disabled={!bgLoaded}
          pixel={pixel} tilesAvailable={!!tileMapSize}
          tilePanel={<TilePalette brush={tileBrush} onBrush={setTileBrush} />}
          grid={{
            gridVisible, gridSize, gridSnap, gridAutoSize, gridLineWidth, gridCalibrating,
            rGridVisible: R.rGridVisible, rGridSize: R.rGridSize, rGridSnap: R.rGridSnap,
            rGridAutoSize: R.rGridAutoSize, rGridLineWidth: R.rGridLineWidth,
            rGridCalibrating: R.rGridCalibrating, rTokenSizeOverride: R.rTokenSizeOverride,
            setGridVisible, setGridSize, setGridSnap, setGridAutoSize, setGridLineWidth,
            setGridCalibrating, setTokenSizeOverride,
            onSnapAll: snapAllTokens, onSizeAll: sizeAllTokens, onBroadcast: _broadcastState,
            gridCalibRef: R.gridCalibRef, gridCalibCurrRef: R.gridCalibCurrRef,
          }}
        />
        {/* Els torns són de la partida: a Preparar no surten (el combat continua igual). */}
        {bgLoaded && mode === 'jugar' && <TurnTracker
          turn={turn}
          players={players}
          libEnemies={libEnemies}
          defeated={defeated}
          conditions={conditions}
          tokenGroupsRef={R.rTokenGroups}
          onStart={startTurnCombat}
          onEnd={finishCombat}
          onAdvance={advanceTurn}
          onAdvanceRound={advanceRound}
          onRecoverTurn={recoverTurn}
          onReorder={reorderTurn}
          pixel={pixel}
        />}
        {/* Expositor floating panel */}
        {expositorOpen && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, width: SHOW_PANEL_W, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)', overflowY: 'auto', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            <ShowPanelHeader tab="imatge" onTab={openShowTab} imageActive={expositorActive} textActive={textRevealActive} dialogActive={!!dlg.ui} sheetActive={!!sheetShowId}
              hint="Espai: reinicia / pausa el moviment" onClose={closeShowPanel} />
            {/* Preview area with KB animation and pan/zoom */}
            <div
              ref={expositorPreviewRef}
              style={{ height: 260, background: '#000', position: 'relative', overflow: 'hidden', cursor: expositorLocalSrc ? (expositorDragRef.current ? 'grabbing' : 'grab') : 'pointer' }}
              onClick={e => { if (!expositorLocalSrc) expositorInputRef.current?.click(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); fileDragDepth.current = 0; setFileOver(false); const f = e.dataTransfer.files[0]; if (f) loadExpositorFile(f); }}
              onDragOver={e => e.preventDefault()}
              onMouseDown={e => {
                if (e.button !== 0 || !expositorLocalSrc) return;
                e.preventDefault();
                expositorDragRef.current = { sx: e.clientX, sy: e.clientY, px: expositorPan.current.x, py: expositorPan.current.y };
              }}
              onMouseMove={e => {
                if (!expositorDragRef.current) return;
                expositorPan.current = {
                  x: expositorDragRef.current.px + (e.clientX - expositorDragRef.current.sx),
                  y: expositorDragRef.current.py + (e.clientY - expositorDragRef.current.sy),
                };
              }}
              onMouseUp={() => { expositorDragRef.current = null; }}
              onMouseLeave={() => { expositorDragRef.current = null; }}
              onWheel={e => {
                if (!expositorLocalSrc) return;
                e.preventDefault();
                expositorZoom.current = Math.max(0.3, Math.min(6, expositorZoom.current * (e.deltaY < 0 ? 1.1 : 0.9)));
              }}
            >
              {expositorLocalSrc && (
                <>
                  {expositorLocalType === 'image' && (
                    <div style={{ position: 'absolute', inset: -40, backgroundImage: `url(${expositorLocalSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(28px) brightness(0.22) saturate(0.45)', transform: 'scale(1.1)', pointerEvents: 'none' }} />
                  )}
                  <div
                    ref={expositorInnerRef}
                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', transformOrigin: 'center center', userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {expositorLocalType === 'image' && (
                      <img src={expositorLocalSrc} alt="" draggable={false} style={{ maxWidth: SHOW_PANEL_W, maxHeight: 260, objectFit: 'contain', display: 'block' }} />
                    )}
                    {expositorLocalType === 'video' && (
                      <video src={expositorLocalSrc} muted autoPlay loop playsInline draggable={false} style={{ maxWidth: SHOW_PANEL_W, maxHeight: 260, objectFit: 'contain', display: 'block' }} />
                    )}
                  </div>
                  <div style={{ position: 'absolute', bottom: 6, right: 8, color: 'rgba(255,255,255,0.3)', fontSize: FS.xs, pointerEvents: 'none', letterSpacing: '0.08em' }}>
                    roda: zoom · arrossega: mou · espai: reinicia
                  </div>
                </>
              )}
              {!expositorLocalSrc && (
                <div title="Arrossega o clica per carregar imatge / vídeo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: C.dim }}>
                  <ImageIcon size={28} color={C.dim} />
                </div>
              )}
            </div>
            <input ref={expositorInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) loadExpositorFile(f); (e.target as HTMLInputElement).value = ''; }} />
            <div style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
              <button
                onClick={sendExpositorToPlayer}
                disabled={!expositorLocalSrc}
                style={{ flex: 1, padding: '7px', borderRadius: RADIUS.md, border: 'none', background: expositorLocalSrc ? C.accent : 'rgba(255,255,255,0.05)', cursor: expositorLocalSrc ? 'pointer' : 'default', color: expositorLocalSrc ? C.onAccent : C.dim, fontWeight: 700, fontSize: FS.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {expositorActive ? <><CheckIcon size={13} /> Mostrant als jugadors</> : <><PlayIcon size={12} /> Mostrar als jugadors</>}
              </button>
              <button
                onClick={() => expositorInputRef.current?.click()}
                style={{ padding: '7px 10px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.dim, fontSize: FS.sm }}>
                Fitxer
              </button>
              <button
                onClick={hideExpositorOnPlayer}
                disabled={!expositorActive}
                style={{ padding: '7px 10px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', cursor: expositorActive ? 'pointer' : 'default', color: expositorActive ? C.dim : 'rgba(255,255,255,0.15)', fontSize: FS.sm }}>
                Ocultar
              </button>
            </div>
          </div>
        )}

        {/* Revelador de text floating panel */}
        {textRevealOpen && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, width: SHOW_PANEL_W, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)', display: 'flex', flexDirection: 'column', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            <ShowPanelHeader tab="text" onTab={openShowTab} imageActive={expositorActive} textActive={textRevealActive} dialogActive={!!dlg.ui} sheetActive={!!sheetShowId}
              hint="Espai: revela / pausa · ←→ navega · R reinicia" onClose={closeShowPanel} />

            <div style={{ overflowY: 'auto', minHeight: 0 }}>
              {/* Editor */}
              <textarea
                ref={trSrcRef}
                placeholder="Enganxa aquí el text que vols anar revelant…&#10;&#10;Per exemple, la narració d'obertura d'una escena."
                onChange={() => { if (trPausedRef.current && (trEngineRef.current?.pos ?? 0) === 0) trBuild(); }}
                style={{ width: '100%', height: 110, resize: 'vertical', border: 'none', borderBottom: `1px solid ${C.border}`, outline: 'none', background: 'rgba(255,255,255,0.02)', color: C.text, fontFamily: FONT_SERIF, fontSize: FS.lg, lineHeight: 1.5, padding: '10px 12px', display: 'block' }}
              />

              {/* Controls */}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.sm, color: C.dim, marginBottom: 4 }}>
                      <span>Velocitat</span><b ref={trSpeedLblRef} style={{ color: C.text, fontWeight: 600 }}>mitjana</b>
                    </div>
                    <input ref={trSpeedRef} type="range" min={1} max={100} defaultValue={50}
                      onInput={e => { if (trSpeedLblRef.current) trSpeedLblRef.current.textContent = speedLabel(+(e.target as HTMLInputElement).value); }}
                      style={{ width: '100%', accentColor: C.accent }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.sm, color: C.dim, marginBottom: 4 }}>
                      <span>Suavitat</span><b ref={trSmoothLblRef} style={{ color: C.text, fontWeight: 600 }}>suau</b>
                    </div>
                    <input ref={trSmoothRef} type="range" min={1} max={100} defaultValue={55}
                      onInput={e => { if (trSmoothLblRef.current) trSmoothLblRef.current.textContent = smoothLabel(+(e.target as HTMLInputElement).value); if (!trRunningRef.current || trPausedRef.current) { trEngineRef.current?.recompute(); } }}
                      style={{ width: '100%', accentColor: C.accent }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { const nv = !trDramatic; setTrDramatic(nv); trDramaticRef.current = nv; }}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: RADIUS.md, border: `1px solid ${trDramatic ? C.accent : C.border}`, background: trDramatic ? `${C.accent}18` : 'transparent', color: trDramatic ? C.accent : C.dim, cursor: 'pointer', fontSize: FS.sm, fontWeight: 600 }}>
                    Pauses dramàtiques
                  </button>
                  <button
                    onClick={() => {
                      const nv = !trManual; setTrManual(nv); trManualRef.current = nv;
                      const eng = trEngineRef.current; if (eng) eng.target = eng.pos;
                      trRunningRef.current = nv; trPausedRef.current = !nv;
                      trUpdateStatus();
                    }}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: RADIUS.md, border: `1px solid ${trManual ? C.accent : C.border}`, background: trManual ? `${C.accent}18` : 'transparent', color: trManual ? C.accent : C.dim, cursor: 'pointer', fontSize: FS.sm, fontWeight: 600 }}>
                    Control manual (frase a frase)
                  </button>
                </div>
              </div>

              {/* Preview stage */}
              <div
                ref={trStageRef}
                onClick={() => { if (trManualRef.current) trNextSentence(); }}
                style={{ height: 300, overflowY: 'auto', scrollBehavior: 'smooth', padding: '8% 9% 16%', background: 'radial-gradient(130% 90% at 50% 0%, #1a1611 0%, #0a0806 62%)', cursor: trManual ? 'pointer' : 'default' }}
              >
                <div
                  ref={trTextRef}
                  style={{ fontFamily: FONT_SERIF, fontSize: '1.5rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '24em', margin: '0 auto', letterSpacing: '0.005em', color: '#ece3d0' }}
                />
              </div>

              {/* Status bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', borderTop: `1px solid ${C.border}`, fontSize: FS.sm, color: C.dim }}>
                <span ref={trCounterRef} style={{ minWidth: 80 }}>—</span>
                <div style={{ flex: 1, height: 3, background: C.border, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                  <div ref={trProgRef} style={{ height: '100%', width: '0%', background: C.text }} />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '8px 10px', display: 'flex', gap: 6, flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
              <button
                ref={trPlayBtnRef}
                onClick={() => { trManualRef.current ? trNextSentence() : (trPausedRef.current ? trPlay() : trPause()); }}
                style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.text, cursor: 'pointer', fontWeight: 700, fontSize: FS.sm }}>
                Comença
              </button>
              <button
                onClick={trReset}
                style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: FS.sm }}>
                Reinicia
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={sendTextRevealToPlayer}
                style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: 'none', background: C.accent, color: C.onAccent, cursor: 'pointer', fontWeight: 700, fontSize: FS.sm, display: 'flex', alignItems: 'center', gap: 6 }}>
                {textRevealActive ? <><CheckIcon size={13} /> Mostrant als jugadors</> : <><PlayIcon size={12} /> Mostrar als jugadors</>}
              </button>
              <button
                onClick={hideTextRevealOnPlayer}
                disabled={!textRevealActive}
                style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', cursor: textRevealActive ? 'pointer' : 'default', color: textRevealActive ? C.dim : 'rgba(255,255,255,0.15)', fontSize: FS.sm }}>
                Ocultar
              </button>
            </div>
          </div>
        )}

        {/* Diàleg: pestanya del panell «Mostrar als jugadors» */}
        {dialogOpen && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, width: SHOW_PANEL_W, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)', display: 'flex', flexDirection: 'column', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            <ShowPanelHeader tab="dialeg" onTab={openShowTab} imageActive={expositorActive} textActive={textRevealActive} dialogActive={!!dlg.ui} sheetActive={!!sheetShowId}
              hint="Espai/→ avança · ← enrere · Esc acaba" onClose={closeShowPanel} />
            <DialogPanel draft={dialogDraft} onDraft={setDialogDraft} tokens={sceneTokenList} saved={dlg.dialogs}
              running={!!dlg.ui} onStart={startDraft} onEnd={dlg.end} onSave={saveDraft} onDelete={dlg.deleteDialog} />
          </div>
        )}
        {/* Fitxa: pestanya del panell «Mostrar als jugadors» */}
        {sheetOpen && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, width: SHOW_PANEL_W, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)', display: 'flex', flexDirection: 'column', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            <ShowPanelHeader tab="fitxa" onTab={openShowTab} imageActive={expositorActive} textActive={textRevealActive} dialogActive={!!dlg.ui} sheetActive={!!sheetShowId}
              hint="Una targeta al costat del mapa" onClose={closeShowPanel} />
            <SheetPanel characters={chars.characters} status={chars.status} pending={chars.pending}
              selected={sheetSel} onSelect={setSheetSel} parts={sheetParts} onParts={setSheetParts}
              showingId={sheetShowId} onShow={showSheet} onHide={hideSheet} />
          </div>
        )}
        {xpAward && (
          <XpAwardDialog key={xpAward.awardId} award={xpAward} busy={xpBusy}
            onConfirm={(a, total) => void confirmXpAward(a, total)} onClose={() => setXpAward(null)} />
        )}
        {/* Història: mòdul actiu, biblioteca de mòduls i diari de la sessió (només DM) */}
        {storyOpen && (
          <StoryPanel tab={storyTab} onTab={setStoryTab} onClose={() => setStoryOpen(false)} story={story} notify={notify}
            noteFocus={noteFocus} onGoLibrary={() => setStoryTab('moduls')} avoidTurnBar={turn.active && mode === 'jugar'} />
        )}
        {/* Barra de control del DM mentre corre un diàleg */}
        {dlg.ui && (
          <DialogControls ui={dlg.ui} onAdvance={dlg.advance} onBack={dlg.back} onChoose={dlg.choose} onEnd={dlg.end} />
        )}

        {!bgLoaded && (
          <WelcomeScreen
            pixel={pixel} compact={compact} spritesStatus={pack.status}
            autosaveMeta={autosaveMeta} recovering={recovering}
            onOpenMap={f => void openNewMap(f)} onOpenSession={f => void openSession(f)} onOpenTmx={f => void openTmx(f)}
            onOpenDemo={() => void openDemo()}
            onCreateTileMap={() => void openTileMap(32, 22)}
            onRecover={() => void recoverAutosave()} onDiscardAutosave={() => void discardAutosave()}
            onTogglePixel={() => setPixel(!pixel)}
          />
        )}

        {/* Fitxer arrossegant-se per sobre: tot el canvas és zona de deixar-lo anar. */}
        {fileOver && (
          <div style={{ position: 'absolute', inset: 10, zIndex: 40, pointerEvents: 'none', borderRadius: RADIUS.lg, border: `2px dashed ${C.accent}`, background: tint(C.accent, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: C.float, border: `1px solid ${C.accent}`, borderRadius: RADIUS.lg, padding: '12px 18px', color: C.bright, fontSize: FS.lg, fontWeight: 700, textAlign: 'center' }}>
              Deixa anar per carregar-lo
              <div style={{ fontSize: FS.sm, color: C.dim, fontWeight: 500, marginTop: 4 }}>
                Imatge o vídeo → mapa{bgLoaded ? ' (substitueix l\'actual)' : ''} · .json → partida · .tmx → caselles
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      <SpellMenuOverlay
        spellMenu={spellMenu} onClose={() => setSpellMenu(null)}
        onAddSpell={(type) => {
          if (AREA_SPELL_DATA[type] && spellMenu?.points?.[0]) {
            const origin = spellMenu.points[0];
            R.rAttackPending.current = null;
            R.rAreaPlacementPending.current = { type: type as import('@/types').SpellType, origin };
            R.rSpellPreview.current = { mode: 'area_place', origin, center: origin, spellType: type };
            setSpellMenu(null);
          } else {
            // Direccionals: el traç es llança tal com s'ha dibuixat (l'abast és només un avís)
            const clamped = spellMenu?.points ?? [];
            // En combat, primer el pop-up del dany; l'animació surt en confirmar-lo.
            if (onSpellCast(type, clamped)) setSpellMenu(null);
            else addSpell(type, clamped, setSpellMenu);
          }
        }}
      />
      <ShapeMenuOverlay
        shapeMenu={shapeMenu} onClose={() => setShapeMenu(null)}
        onAddZone={(element) => addPaintedZone(element, shapeMenu, setShapeMenu)}
      />
      {spellPrompt && (() => {
        const targets: SpellTarget[] = [];
        for (const k of spellPrompt.keys) {
          const pl = k.startsWith('pl_') ? players.find(p => `pl_${p.id}` === k) : undefined;
          const en = k.startsWith('lib_') ? libEnemies.find(e => `lib_${e.id}` === k) : undefined;
          if (pl) {
            const ch = characterFor(pl, chars.characters);
            const dex = ch ? sheetOf(ch).abilities?.dex : undefined;
            targets.push({ key: k, name: pl.name, hp: pl.hp, hpMax: pl.hpMax, conditions: conditions[k] ?? [],
              ac: ch?.ac, dexMod: dex !== undefined ? abilityMod(dex) : undefined });
          }
          else if (en) targets.push({ key: k, name: en.name, hp: en.hp ?? en.hpMax, hpMax: en.hpMax, defenses: en.defenses, conditions: conditions[k] ?? [] });
        }
        if (targets.length === 0) return null;
        return (
          <SpellEffectPopup key={`${spellPrompt.type}:${spellPrompt.keys.join(',')}`} spellType={spellPrompt.type}
            anchor={spellPrompt.anchor} targets={targets} onClose={() => setSpellPrompt(null)}
            onCastOnly={() => { addSpell(spellPrompt.type, spellPrompt.points, () => {}); setSpellPrompt(null); }}
            onApply={outs => {
              // Ara sí: l'animació, i el dany i els estats quan l'efecte arriba als afectats.
              const { type: st, points: pts } = spellPrompt;
              addSpell(st, pts, () => {});
              setSpellPrompt(null);
              window.setTimeout(() => {
                for (const o of outs) {
                  if (o.delta !== 0) {
                    if (o.key.startsWith('pl_')) adjustPlayerHp(parseInt(o.key.slice(3)), -o.delta, 'spell');
                    else adjustLibEnemyHp(parseInt(o.key.slice(4)), -o.delta, 'spell');
                  }
                  for (const c of o.addConditions) toggleCondition(o.key, c);
                  if (o.note) notify(o.note, 'info');
                }
              }, spellImpactS(st, pts, R.rGridSize.current, R.rAppStyle.current === 'pixel', SPELL_EFFECTS[st]?.impactS ?? 0.4) * 1000);
            }} />
        );
      })()}
      {damagePrompt && (() => {
        const k = damagePrompt.targetKey;
        const pl = k.startsWith('pl_') ? players.find(p => `pl_${p.id}` === k) : undefined;
        const en = k.startsWith('lib_') ? libEnemies.find(e => `lib_${e.id}` === k) : undefined;
        const tgt = pl ? { name: pl.name, hp: pl.hp, hpMax: pl.hpMax }
          : en ? { name: en.name, hp: en.hp ?? en.hpMax, hpMax: en.hpMax, defenses: en.defenses } : null;
        if (!tgt) return null;
        return (
          <DamagePopup key={k} prompt={damagePrompt} target={tgt} onClose={() => setDamagePrompt(null)}
            onApply={amount => {
              if (amount > 0) {
                if (pl) adjustPlayerHp(pl.id, -amount, damagePrompt.hitKind);
                else if (en) adjustLibEnemyHp(en.id, -amount, damagePrompt.hitKind);
              }
              setDamagePrompt(null);
            }} />
        );
      })()}
      <ContextMenuOverlay
        contextMenu={contextMenu} conditions={conditions} defeated={defeated}
        rDefeated={R.rDefeated} defeatedAnimRef={R.defeatedAnimRef}
        rConditions={R.rConditions}
        edit={{
          players, libEnemies, tokenSizeOverride, gridSize,
          onRenamePlayer: renamePlayer, onAdjustPlayerHp: adjustPlayerHp, onSetPlayerHpMax: setPlayerHpMaxAndSheet,
          onSetPlayerSpeed: setPlayerSpeed, onSetPlayerVision: setPlayerVision, onSetPlayerCanMove: setPlayerCanMove,
          onAdjustLibHp: adjustLibEnemyHp, onSetLibProps: setLibEnemyProps,
          onSetTokenSize: setTokenSize,
          pixel, onSetPlayerLook: setPlayerLook,
        }}
        onRemovePlayer={removePlayer}
        onClose={() => setContextMenu(null)}
        floatPos={menuFloat} onFloat={setMenuFloat}
        onToggleCondition={toggleCondition} onDeletePaintedZone={deletePaintedZone} onDeleteAreaSpell={deleteAreaSpell}
        onOpenSceneConfig={openSceneConfig} onBroadcast={_broadcastState} onBeforeTokens={_recordTokens}
        setDefeated={setDefeated} setConditions={setConditions}
        removeLibEnemy={removeLibEnemy}
        onCreateGroup={onCreateGroup} onDissolveGroup={onDissolveGroup} onLeaveGroup={onLeaveGroup}
        onSetRoomDark={handleSetRoomDark} onToggleRoomReveal={handleToggleRoomReveal}
        onRenameRoom={renameRoom} onDeleteRoom={deleteRoom}
        onAddDoor={handleAddDoorToRoom}
        onResetExplored={onResetExplored}
        onCastSpell={castFromToken}
        onAttack={attackFromToken}
        dialogs={dlg.dialogs}
        onSpeak={dlg.speak}
        onPlayDialog={dlg.playSaved}
        onEditDialogs={(key: string) => { setDialogDraft(d => ({ ...EMPTY_DRAFT, cps: d.cps, owner: key })); openShowTab('dialeg'); }}
        characters={characterMenu}
      />
      <SceneConfigOverlay key={String(sceneConfigMenu?.id ?? '')}
        sceneConfigMenu={sceneConfigMenu}
        sceneFoes={sceneFoes}
        libEnemies={libEnemies}
        onClose={() => setSceneConfigMenu(null)}
        onLaunchBossIntro={launchBossIntro}
        setLibEnemyProps={setLibEnemyProps}
      />

      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}

      {showServerSessions && (
        <ServerSessionsPanel
          onClose={() => setShowServerSessions(false)}
          onSaveNew={name => serverSaveSession(name)}
          onOverwrite={(id, name) => serverSaveSession(name, id)}
          onLoad={openServerSession}
        />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
    </div>
  );
}
