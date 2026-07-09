'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, BC_CHANNEL, WAND_CURSOR, AREA_SPELL_DATA, feetFromRadius } from '@/constants';
import type {
  MapStructure, VisMap, PosMap, Player, PSDInfo, Spell, PaintedZone,
  ConditionsMap, DefeatedMap, TokenSizeMap, DrawTool,
  ContextMenuState, SceneConfigMenuState, SpellMenuState, ShapeMenuState, Point,
  LibEnemy, PsdEnemyOverrides,
} from '@/types';
import { useDMRefs } from '@/hooks/useDMRefs';
import { useCinematic } from '@/hooks/useCinematic';
import { useDMActions } from '@/hooks/useDMActions';
import { useRafLoop } from '@/hooks/useRafLoop';
import { useMouseHandlers } from '@/hooks/useMouseHandlers';
import { useWheelZoom } from '@/hooks/useWheelZoom';
import { useKeyboardHandlers } from '@/hooks/useKeyboardHandlers';
import { createSyncSocket } from '@/lib/ws';
import { RevealEngine, cpsFromSlider, fadeMsFromSlider, speedLabel, smoothLabel } from '@/lib/textreveal';
import { ImportPanel } from '@/components/dm/ImportPanel';
import { LayerTree } from '@/components/dm/LayerTree';
import { PlayersPanel } from '@/components/dm/PlayersPanel';
import { FloatingToolbar } from '@/components/dm/FloatingToolbar';
import { EnemyLibraryPanel } from '@/components/dm/EnemyLibraryPanel';
import { BottomControls } from '@/components/dm/BottomControls';
import { CanvasHUD } from '@/components/dm/CanvasHUD';
import { SpellMenuOverlay } from '@/components/dm/SpellMenuOverlay';
import { ShapeMenuOverlay } from '@/components/dm/ShapeMenuOverlay';
import { ContextMenuOverlay } from '@/components/dm/ContextMenuOverlay';
import { SceneConfigOverlay } from '@/components/dm/SceneConfigOverlay';

export function DMView() {
  // ── State ────────────────────────────────────────────────────────────────
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgName, setBgName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [struct, setStruct] = useState<MapStructure | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [psdInfo, setPsdInfo] = useState<PSDInfo | null>(null);
  const [layerImages, setLayerImages] = useState<Record<number, HTMLCanvasElement>>({});
  const [vis, setVis] = useState<VisMap>({});
  const [pos, setPos] = useState<PosMap>({});
  const [zoom, setZoom] = useState(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [conditions, setConditions] = useState<ConditionsMap>({});
  const [defeated, setDefeated] = useState<DefeatedMap>({});
  const [paintedZones, setPaintedZones] = useState<PaintedZone[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [activeDrag, setActiveDrag] = useState<string | number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
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
  const [drawColor, setDrawColor] = useState('#f85149');
  const [drawSize, setDrawSize] = useState(6);
  const [sidebarTab, setSidebarTab] = useState<'mapa' | 'enemics'>('mapa');
  const [libEnemies, setLibEnemies] = useState<LibEnemy[]>([]);
  const [psdEnemyOverrides, setPsdEnemyOverrides] = useState<PsdEnemyOverrides>({});
  const [ctxEditName, setCtxEditName] = useState('');
  const [ctxEditHpMax, setCtxEditHpMax] = useState(0);
  const [ctxEditSizeFt, setCtxEditSizeFt] = useState(5);
  const [selectedToken, setSelectedToken] = useState<string | number | null>(null);
  const [areaSelectMode, setAreaSelectMode] = useState(false);
  const [dmPrivateActive, setDmPrivateActive] = useState(false);
  const [ctrlPanActive, setCtrlPanActive] = useState(false);
  const [shiftPanActive, setShiftPanActive] = useState(false);
  const [canvasCursor, setCanvasCursor] = useState('default');
  const [enemyHighlight, setEnemyHighlight] = useState(false);
  const [highlightLocked, setHighlightLocked] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  // ── Revelador de text ──────────────────────────────────────────────────────
  const [textRevealOpen, setTextRevealOpen] = useState(false);
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

  // ── Refs ──────────────────────────────────────────────────────────────────
  const R = useDMRefs();

  // ── Cinematic ─────────────────────────────────────────────────────────────
  const { triggerBossIntro, skipBossIntro } = useCinematic(R);

  // ── setDrawTool wrapper (updates ref + state synchronously) ───────────────
  const setDrawTool = useCallback((fn: DrawTool | ((t: DrawTool) => DrawTool)) => {
    setDrawToolState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      R.rDrawTool.current = next;
      if (prev === 'pointer' && next !== 'pointer') { R.rPointerPos.current = null; R.rMeasure.current = { a: null, b: null }; }
      if (next === 'shape') setCanvasCursor(WAND_CURSOR);
      else if (next === 'none') setCanvasCursor('default');
      return next;
    });
  }, [R]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Setters object for useDMActions ────────────────────────────────────────
  const S = useMemo(() => ({
    setBgLoaded, setBgName, setPsdInfo, setStruct, setWarnings, setParseError, setParsing,
    setLayerImages, setVis, setPos, setZoom, setPlayers, setConditions, setDefeated,
    setPaintedZones, setExpanded, setCanUndo, setActiveSpells, setGridSize, setGridSnap,
    setGridLineWidth, setGridOriginX, setGridOriginY, setGridCalibrating, setTokenSizeOverride,
    setWarningsDismissed, setGridVisible, setGridAutoSize,
    setLibEnemies, setPsdEnemyOverrides,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────
  const {
    _broadcastState, _sendFullState, loadBg, loadPSD, loadDemo, snapAllTokens, sizeAllTokens,
    addPlayer, removePlayer, adjustPlayerHp, setPlayerHpMax, setPlayerSpeed, renamePlayer, loadParty, clearDrawing, undoStroke,
    saveSession, loadSession, addSpell, deleteLayer, toggleVis, resetToken,
    addPaintedZone, deletePaintedZone, deleteAreaSpell, clearPaintedZones, toggleCondition, openPlayerWindow,
    addLibEnemy, addDbEnemy, adjustLibEnemyHp, adjustPsdEnemyHp, setPsdEnemyProps, setLibEnemyProps,
    removeLibEnemy, toggleLibEnemyVisibility, setTokenSize,
  } = useDMActions(R, S);

  // ── BC setup (DM only receives PLAYER_READY) ──────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel(BC_CHANNEL);
    R.bcRef.current = bc;
    bc.onmessage = (e) => {
      const msg = e.data;
      if (msg?.type === 'PLAYER_READY') {
        _sendFullState();
        trResendShowRef.current();
      } else if (msg?.type === 'TOKEN_MOVE' && msg.id !== undefined && msg.x !== undefined && msg.y !== undefined) {
        // Moviment de token fet des de la pantalla de jugador (mateix ordinador, sense WS).
        // La pantalla de jugador només pot moure tokens de jugador (pl_*).
        if (!String(msg.id).startsWith('pl_')) return;
        const np = { ...R.rPos.current, [msg.id as string | number]: { x: msg.x as number, y: msg.y as number } };
        R.rPos.current = np;
        setPos(np);
      }
    };
    return () => { bc.close(); R.bcRef.current = null; };
  }, [_sendFullState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket setup (network sync for cross-device iPad/player) ───────────
  useEffect(() => {
    const ws = createSyncSocket('dm', (ev) => {
      let msg: { type: string; id?: number | string; x?: number; y?: number };
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      if (msg.type === 'PLAYER_READY') {
        _sendFullState();
        trResendShowRef.current();
      } else if (msg.type === 'TOKEN_MOVE' && msg.id !== undefined && msg.x !== undefined && msg.y !== undefined) {
        // La pantalla de jugador només pot moure tokens de jugador (pl_*).
        if (!String(msg.id).startsWith('pl_')) return;
        const np = { ...R.rPos.current, [msg.id]: { x: msg.x, y: msg.y } };
        R.rPos.current = np;
        setPos(np);
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

  // ── Draw / death canvas init ───────────────────────────────────────────────
  useEffect(() => {
    const oc = document.createElement('canvas');
    oc.width = 1920; oc.height = 1080;
    R.drawCanvasRef.current = oc;
    const dc = document.createElement('canvas');
    dc.width = 1920; dc.height = 1080;
    R.rDeathCanvas.current = dc;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync state → refs ─────────────────────────────────────────────────────
  useEffect(() => {
    R.rStruct.current = struct; R.rStruct2.current = struct;
    R.rVis.current = vis; R.rPos.current = pos; R.rZoom.current = zoom;
    R.rPlayers.current = players; R.rLibEnemies.current = libEnemies;
    R.rDrawColor.current = drawColor; R.rDrawSize.current = drawSize;
    R.rConditions.current = conditions; R.rPaintedZones.current = paintedZones;
    R.rDefeated.current = defeated;
    R.rGridVisible.current = gridVisible; R.rGridSize.current = gridSize;
    R.rGridSnap.current = gridSnap; R.rGridAutoSize.current = gridAutoSize;
    R.rTokenSizeOverride.current = tokenSizeOverride; R.rGridLineWidth.current = gridLineWidth;
    R.rGridOriginX.current = gridOriginX; R.rGridOriginY.current = gridOriginY;
    R.rGridCalibrating.current = gridCalibrating; R.rEnemyHighlight.current = enemyHighlight;
    R.rHighlightLocked.current = highlightLocked; R.rSelectedToken.current = selectedToken;
    R.rLayerImages.current = layerImages; R.rContextMenu.current = contextMenu;
    R.rActiveSpells.current = activeSpells;
    R.rPsdEnemyOverrides.current = psdEnemyOverrides;
  }, [
    struct, vis, pos, zoom, players, libEnemies, drawColor, drawSize, conditions, paintedZones,
    defeated, gridVisible, gridSize, gridSnap, gridAutoSize, tokenSizeOverride,
    gridLineWidth, gridOriginX, gridOriginY, gridCalibrating, enemyHighlight, highlightLocked,
    selectedToken, layerImages, contextMenu, activeSpells, psdEnemyOverrides,
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
  const mouseSetters = useMemo(() => ({
    setVis, setPos, setActiveDrag, setSelectedToken, setShapeMenu, setSpellMenu,
    setActiveSpells, setPaintedZones, setContextMenu, setCanUndo,
    setDmPrivateActive, setCanvasCursor,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { onMouseDown, onMouseMove, onMouseUp, onMouseLeaveCanvas, onContextMenu, onDoubleClick } =
    useMouseHandlers(R, mouseSetters, _broadcastState);

  const handleMouseUp = useCallback(() => {
    onMouseUp(setPos, snapAllTokens, sizeAllTokens, setGridSize, setGridOriginX, setGridOriginY, setGridCalibrating);
  }, [onMouseUp, setPos, snapAllTokens, sizeAllTokens, setGridSize, setGridOriginX, setGridOriginY, setGridCalibrating]);

  // ── Multi-selection group delete (Delete/Backspace removes lib enemies in the selection) ──
  const onDeleteSelection = useCallback(() => {
    for (const id of R.rMultiSelected.current) {
      if (typeof id === 'string' && id.startsWith('lib_')) removeLibEnemy(parseInt(id.replace('lib_', '')));
    }
    R.rMultiSelected.current = new Set();
  }, [removeLibEnemy]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  useKeyboardHandlers(R, {
    setDrawTool, undoStroke, skipBossIntro,
    broadcastState: () => _broadcastState({}),
    setCtrlPanActive, setShiftPanActive, setZoom,
    setAreaSelectMode,
    onDeleteSelection,
  });

  // ── Canvas-level callbacks ────────────────────────────────────────────────
  const onResetView = useCallback(() => {
    R.rZoom.current = 1; setZoom(1);
    R.rPanOffset.current = { x: 0, y: 0 };
    _broadcastState({});
  }, [_broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  const onResetPrivate = useCallback(() => { R.dmPrivateReturnAnim.current = true; }, [R]);

  const onToggleEnemyHighlight = useCallback(() => {
    const next = !R.rEnemyHighlight.current;
    R.rEnemyHighlight.current = next; setEnemyHighlight(next);
    if (next) R.highlightStartRef.current = performance.now();
    else { R.rHighlightAlpha.current = 0; R.highlightStartRef.current = null; }
    _broadcastState({});
  }, [_broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Update ctxEditName when contextMenu changes
  useEffect(() => {
    if (!contextMenu) return;
    if (typeof contextMenu.id === 'number') {
      const ov = R.rPsdEnemyOverrides.current[contextMenu.id] || {};
      setCtxEditName(ov.name ?? contextMenu.name);
      setCtxEditHpMax(ov.hpMax ?? 0);
    } else if (contextMenu.isLibEnemy && contextMenu.libEnemyId !== undefined) {
      const le = R.rLibEnemies.current.find(e => e.id === contextMenu.libEnemyId);
      setCtxEditName(le?.name ?? contextMenu.name);
      setCtxEditHpMax(0);
    } else {
      setCtxEditName(contextMenu.name);
      setCtxEditHpMax(0);
    }

    // Current token diameter (px), falling back to each token type's default when unset.
    const key = String(contextMenu.id);
    let radiusPx = R.rTokenSizeOverride.current[key];
    if (radiusPx == null) {
      if (contextMenu.isLibEnemy && contextMenu.libEnemyId !== undefined) {
        radiusPx = R.rLibEnemies.current.find(e => e.id === contextMenu.libEnemyId)?.R ?? 25;
      } else if (typeof contextMenu.id === 'string' && contextMenu.id.startsWith('pl_')) {
        radiusPx = 22;
      } else if (typeof contextMenu.id === 'number' && R.rStruct.current) {
        let found: number | undefined;
        for (const room of R.rStruct.current.enemyRooms) {
          const en = room.enemies.find(e => e.id === contextMenu.id);
          if (en) { found = Math.max(Math.min(en.w, en.h) / 2, 22); break; }
        }
        radiusPx = found ?? 25;
      } else {
        radiusPx = 25;
      }
    }
    setCtxEditSizeFt(feetFromRadius(radiusPx, R.rGridSize.current));
  }, [contextMenu]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (trActiveRef.current) hideTextRevealOnPlayer();
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
      if (e.code === 'Space' && !e.target || (e.target as HTMLElement)?.tagName !== 'INPUT') {
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
      else if (trManualRef.current) trCounterRef.current.innerHTML = `Frase <b style="color:${C.accent}">${eng!.sentenceIndex()}</b> / ${eng!.bounds.length}`;
      else trCounterRef.current.innerHTML = `<b style="color:${C.accent}">${Math.round(eng!.pos / n * 100)}%</b> revelat`;
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
    // Sinergia: en llançar text, amaguem l'expositor d'imatge (crossfade al jugador)
    if (expositorActiveRef.current) hideExpositorOnPlayer();
    trBroadcastShow();
    trActiveRef.current = true;
    setTextRevealActive(true);
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
  const activeCount = struct
    ? struct.enemyRooms.reduce((n, z) => n + z.enemies.filter(e => vis[e.id]).length, 0)
    : 0;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <ImportPanel
          bgLoaded={bgLoaded} bgName={bgName} parsing={parsing} struct={struct}
          psdInfo={psdInfo} parseError={parseError} warnings={warnings}
          warningsDismissed={warningsDismissed} setWarningsDismissed={setWarningsDismissed}
          onLoadBg={loadBg} onLoadPSD={loadPSD} onLoadDemo={loadDemo}
        />

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {(['mapa', 'enemics'] as const).map(tab => (
            <button key={tab} onClick={() => setSidebarTab(tab)}
              style={{ flex: 1, padding: '7px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', border: 'none', cursor: 'pointer', background: sidebarTab === tab ? `${C.accent}18` : 'transparent', color: sidebarTab === tab ? C.accent : C.dim, borderBottom: sidebarTab === tab ? `2px solid ${C.accent}` : '2px solid transparent' }}>
              {tab === 'mapa' ? 'Mapa' : 'Enemics'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {sidebarTab === 'mapa' && (
            <>
              {struct && (
                <LayerTree
                  struct={struct} vis={vis} expanded={expanded}
                  activeDrag={activeDrag} selectedToken={selectedToken}
                  psdEnemyOverrides={psdEnemyOverrides} defeated={defeated}
                  setExpanded={setExpanded} setSelectedToken={setSelectedToken}
                  rSelectedToken={R.rSelectedToken}
                  onToggleVis={toggleVis} onDeleteLayer={deleteLayer} onResetToken={resetToken}
                  onAdjustPsdHp={adjustPsdEnemyHp}
                />
              )}
              <PlayersPanel
                players={players} newPName={newPName} setNewPName={setNewPName}
                newPColor={newPColor} setNewPColor={setNewPColor}
                newPHpMax={newPHpMax} setNewPHpMax={setNewPHpMax}
                onAdd={() => { addPlayer(newPName, newPColor, newPHpMax); setNewPName(''); }}
                onRemove={removePlayer} onAdjustHp={adjustPlayerHp} onSetHpMax={setPlayerHpMax} onSetSpeed={setPlayerSpeed} onRename={renamePlayer} onLoadParty={loadParty}
              />
            </>
          )}
          {sidebarTab === 'enemics' && (
            <EnemyLibraryPanel
              libEnemies={libEnemies}
              defeated={defeated}
              onAddEnemy={addLibEnemy}
              onAddDbEnemy={addDbEnemy}
              onRemove={removeLibEnemy}
              onToggleVisibility={toggleLibEnemyVisibility}
              onAdjustHp={adjustLibEnemyHp}
            />
          )}
        </div>

        <BottomControls
          zoom={zoom} onZoomChange={onZoomChange} psdInfo={psdInfo} struct={struct}
          activeCount={activeCount} layerImagesCount={Object.keys(layerImages).length}
          onSave={saveSession} onLoad={loadSession} onOpenPlayer={openPlayerWindow}
        />
      </div>

      {/* ── Main canvas area ──────────────────────────────────────────────── */}
      <div ref={R.stageRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
        <div ref={R.bgTransitionRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
        <canvas
          ref={R.canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, cursor: (drawToolState === 'pen' || drawToolState === 'eraser' || drawToolState === 'pointer') ? 'none' : areaSelectMode ? 'crosshair' : canvasCursor }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={onMouseLeaveCanvas}
          onContextMenu={onContextMenu}
          onDoubleClick={onDoubleClick}
        />
        <CanvasHUD
          ctrlPanActive={ctrlPanActive} shiftPanActive={shiftPanActive} areaSelectMode={areaSelectMode} struct={struct} vis={vis}
          enemyHighlight={enemyHighlight}
          highlightLocked={highlightLocked} gridCalibrating={gridCalibrating}
          onResetView={onResetView} onResetPrivate={onResetPrivate}
          onToggleEnemyHighlight={onToggleEnemyHighlight}
          onToggleHighlightLocked={onToggleHighlightLocked}
        />
        <FloatingToolbar
          drawTool={drawToolState} drawColor={drawColor} setDrawColor={setDrawColor}
          drawSize={drawSize} setDrawSize={setDrawSize}
          canUndo={canUndo} paintedZones={paintedZones}
          onSetDrawTool={setDrawTool} onUndo={undoStroke}
          onClearDraw={clearDrawing} onClearPaintedZones={clearPaintedZones}
          bcRef={R.bcRef} wsRef={R.wsRef}
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
        <button
          onClick={() => setExpositorOpen(v => { if (!v) setTextRevealOpen(false); return !v; })}
          title="Expositor d'Imatges i Vídeo per als jugadors"
          style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: expositorOpen ? `${C.accent}22` : 'rgba(10,13,18,.92)', border: `1px solid ${expositorOpen ? C.accent : (expositorActive ? C.accent + '88' : C.border)}`, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: expositorOpen ? C.accent : (expositorActive ? C.accent + 'cc' : C.dim), fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
          {expositorActive ? '◉ Expositor' : 'Expositor'}
        </button>
        <button
          onClick={() => setTextRevealOpen(v => { if (!v) setExpositorOpen(false); return !v; })}
          title="Revelador de text per als jugadors"
          style={{ position: 'absolute', top: 12, left: 104, zIndex: 10, background: textRevealOpen ? `${C.accent}22` : 'rgba(10,13,18,.92)', border: `1px solid ${textRevealOpen ? C.accent : (textRevealActive ? C.accent + '88' : C.border)}`, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: textRevealOpen ? C.accent : (textRevealActive ? C.accent + 'cc' : C.dim), fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
          {textRevealActive ? '◉ Text' : 'Text'}
        </button>

        {/* Expositor floating panel */}
        {expositorOpen && (
          <div style={{ position: 'absolute', top: 42, left: 12, zIndex: 20, width: 480, background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: C.bright, fontWeight: 700, fontSize: 12 }}>Expositor de Campanya</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: C.dim, fontSize: 10 }}>Espai: reset/pausa KB</span>
                <button onClick={() => setExpositorOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            </div>
            {/* Preview area with KB animation and pan/zoom */}
            <div
              ref={expositorPreviewRef}
              style={{ height: 260, background: '#000', position: 'relative', overflow: 'hidden', cursor: expositorLocalSrc ? (expositorDragRef.current ? 'grabbing' : 'grab') : 'pointer' }}
              onClick={e => { if (!expositorLocalSrc) expositorInputRef.current?.click(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadExpositorFile(f); }}
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
                      <img src={expositorLocalSrc} alt="" draggable={false} style={{ maxWidth: 480, maxHeight: 260, objectFit: 'contain', display: 'block' }} />
                    )}
                    {expositorLocalType === 'video' && (
                      <video src={expositorLocalSrc} muted autoPlay loop playsInline draggable={false} style={{ maxWidth: 480, maxHeight: 260, objectFit: 'contain', display: 'block' }} />
                    )}
                  </div>
                  <div style={{ position: 'absolute', bottom: 6, right: 8, color: 'rgba(255,255,255,0.3)', fontSize: 9, pointerEvents: 'none', letterSpacing: '0.08em' }}>
                    scroll zoom · drag pan · espai reset
                  </div>
                </>
              )}
              {!expositorLocalSrc && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: C.dim }}>
                  <div style={{ fontSize: 28 }}>🖼</div>
                  <div style={{ fontSize: 11 }}>Arrossega o clica per carregar imatge / vídeo</div>
                </div>
              )}
            </div>
            <input ref={expositorInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) loadExpositorFile(f); (e.target as HTMLInputElement).value = ''; }} />
            <div style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
              <button
                onClick={sendExpositorToPlayer}
                disabled={!expositorLocalSrc}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: expositorLocalSrc ? C.accent : 'rgba(255,255,255,0.05)', cursor: expositorLocalSrc ? 'pointer' : 'default', color: expositorLocalSrc ? '#0d1117' : C.dim, fontWeight: 700, fontSize: 11 }}>
                {expositorActive ? '✓ Mostrant als jugadors' : '▶ Mostrar als jugadors'}
              </button>
              <button
                onClick={() => expositorInputRef.current?.click()}
                style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.dim, fontSize: 11 }}>
                Fitxer
              </button>
              <button
                onClick={hideExpositorOnPlayer}
                disabled={!expositorActive}
                style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: expositorActive ? 'pointer' : 'default', color: expositorActive ? C.dim : 'rgba(255,255,255,0.15)', fontSize: 11 }}>
                Ocultar
              </button>
            </div>
          </div>
        )}

        {/* Revelador de text floating panel */}
        {textRevealOpen && (
          <div style={{ position: 'absolute', top: 42, left: 12, zIndex: 20, width: 620, maxHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ color: C.bright, fontWeight: 700, fontSize: 12 }}>Revelador de Text</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: C.dim, fontSize: 10 }}>Espai: revela/pausa · ←→ navega · R reinicia</span>
                <button onClick={() => setTextRevealOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', minHeight: 0 }}>
              {/* Editor */}
              <textarea
                ref={trSrcRef}
                placeholder="Enganxa aquí el text que vols anar revelant…&#10;&#10;Per exemple, la narració d'obertura d'una escena."
                onChange={() => { if (trPausedRef.current && (trEngineRef.current?.pos ?? 0) === 0) trBuild(); }}
                style={{ width: '100%', height: 110, resize: 'vertical', border: 'none', borderBottom: `1px solid ${C.border}`, outline: 'none', background: 'rgba(255,255,255,0.02)', color: C.text, fontFamily: "'EB Garamond',Georgia,serif", fontSize: 14, lineHeight: 1.5, padding: '10px 12px', display: 'block' }}
              />

              {/* Controls */}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim, marginBottom: 4 }}>
                      <span>Velocitat</span><b ref={trSpeedLblRef} style={{ color: C.accent, fontWeight: 600 }}>mitjana</b>
                    </div>
                    <input ref={trSpeedRef} type="range" min={1} max={100} defaultValue={50}
                      onInput={e => { if (trSpeedLblRef.current) trSpeedLblRef.current.textContent = speedLabel(+(e.target as HTMLInputElement).value); }}
                      style={{ width: '100%', accentColor: C.accent }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim, marginBottom: 4 }}>
                      <span>Suavitat</span><b ref={trSmoothLblRef} style={{ color: C.accent, fontWeight: 600 }}>suau</b>
                    </div>
                    <input ref={trSmoothRef} type="range" min={1} max={100} defaultValue={55}
                      onInput={e => { if (trSmoothLblRef.current) trSmoothLblRef.current.textContent = smoothLabel(+(e.target as HTMLInputElement).value); if (!trRunningRef.current || trPausedRef.current) { trEngineRef.current?.recompute(); } }}
                      style={{ width: '100%', accentColor: C.accent }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { const nv = !trDramatic; setTrDramatic(nv); trDramaticRef.current = nv; }}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: `1px solid ${trDramatic ? C.accent : C.border}`, background: trDramatic ? `${C.accent}18` : 'transparent', color: trDramatic ? C.accent : C.dim, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                    Pauses dramàtiques
                  </button>
                  <button
                    onClick={() => {
                      const nv = !trManual; setTrManual(nv); trManualRef.current = nv;
                      const eng = trEngineRef.current; if (eng) eng.target = eng.pos;
                      trRunningRef.current = nv; trPausedRef.current = !nv;
                      trUpdateStatus();
                    }}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: `1px solid ${trManual ? C.accent : C.border}`, background: trManual ? `${C.accent}18` : 'transparent', color: trManual ? C.accent : C.dim, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
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
                  style={{ fontFamily: "'EB Garamond','Iowan Old Style',Palatino,Georgia,serif", fontSize: '1.5rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '24em', margin: '0 auto', letterSpacing: '0.005em', color: '#ece3d0' }}
                />
              </div>

              {/* Status bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.dim }}>
                <span ref={trCounterRef} style={{ minWidth: 80 }}>—</span>
                <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div ref={trProgRef} style={{ height: '100%', width: '0%', background: C.accent }} />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '8px 10px', display: 'flex', gap: 6, flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
              <button
                ref={trPlayBtnRef}
                onClick={() => { trManualRef.current ? trNextSentence() : (trPausedRef.current ? trPlay() : trPause()); }}
                style={{ padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.accent}`, background: `${C.accent}18`, color: C.accent, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
                Comença
              </button>
              <button
                onClick={trReset}
                style={{ padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 11 }}>
                Reinicia
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={sendTextRevealToPlayer}
                style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: C.accent, color: '#0d1117', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
                {textRevealActive ? '✓ Mostrant als jugadors' : '▶ Mostrar als jugadors'}
              </button>
              <button
                onClick={hideTextRevealOnPlayer}
                disabled={!textRevealActive}
                style={{ padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: textRevealActive ? 'pointer' : 'default', color: textRevealActive ? C.dim : 'rgba(255,255,255,0.15)', fontSize: 11 }}>
                Ocultar
              </button>
            </div>
          </div>
        )}

        {!bgLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', color: C.dim }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🗺</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Carrega una imatge o vídeo de fons</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>Arrossega a la zona "Img/Vídeo" del panell esquerre</div>
              <div style={{ fontSize: 16, marginTop: 12, color: '#fff', fontWeight: 700, letterSpacing: '0.06em' }}>v3.75</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      <SpellMenuOverlay
        spellMenu={spellMenu} onClose={() => setSpellMenu(null)}
        onAddSpell={(type) => {
          if (AREA_SPELL_DATA[type] && spellMenu?.points?.[0]) {
            const origin = spellMenu.points[0];
            R.rAreaPlacementPending.current = { type: type as import('@/types').SpellType, origin };
            R.rSpellPreview.current = { mode: 'area_place', origin, center: origin, spellType: type };
            setSpellMenu(null);
          } else {
            addSpell(type, spellMenu?.points ?? [], setSpellMenu);
          }
        }}
      />
      <ShapeMenuOverlay
        shapeMenu={shapeMenu} onClose={() => setShapeMenu(null)}
        onAddZone={(element) => addPaintedZone(element, shapeMenu, setShapeMenu)}
      />
      <ContextMenuOverlay
        contextMenu={contextMenu} conditions={conditions} defeated={defeated}
        rDefeated={R.rDefeated} defeatedAnimRef={R.defeatedAnimRef}
        rConditions={R.rConditions}
        rLibEnemies={R.rLibEnemies}
        rPsdEnemyOverrides={R.rPsdEnemyOverrides}
        rPlayers={R.rPlayers}
        ctxEditName={ctxEditName} setCtxEditName={setCtxEditName}
        ctxEditHpMax={ctxEditHpMax} setCtxEditHpMax={setCtxEditHpMax}
        ctxEditSizeFt={ctxEditSizeFt} setCtxEditSizeFt={setCtxEditSizeFt}
        onSetTokenSize={setTokenSize}
        onClose={() => setContextMenu(null)}
        onToggleCondition={toggleCondition} onDeletePaintedZone={deletePaintedZone} onDeleteAreaSpell={deleteAreaSpell}
        onOpenSceneConfig={openSceneConfig} onBroadcast={_broadcastState}
        setDefeated={setDefeated} setConditions={setConditions}
        adjustLibEnemyHp={adjustLibEnemyHp}
        adjustPsdEnemyHp={adjustPsdEnemyHp}
        adjustPlayerHp={adjustPlayerHp}
        setPsdEnemyProps={setPsdEnemyProps}
        setLibEnemyProps={setLibEnemyProps}
        removeLibEnemy={removeLibEnemy}
        bcRef={R.bcRef} wsRef={R.wsRef}
        onTriggerBossIntro={triggerBossIntro}
        onCreateGroup={onCreateGroup} onDissolveGroup={onDissolveGroup} onLeaveGroup={onLeaveGroup}
      />
      <SceneConfigOverlay
        sceneConfigMenu={sceneConfigMenu} rLayerImages={R.rLayerImages}
        rPsdEnemyImgCache={R.rPsdEnemyImgCache}
        libEnemies={libEnemies} psdEnemyOverrides={psdEnemyOverrides}
        bcRef={R.bcRef} wsRef={R.wsRef}
        onClose={() => setSceneConfigMenu(null)}
        onTriggerBossIntro={triggerBossIntro}
        setPsdEnemyProps={setPsdEnemyProps}
        setLibEnemyProps={setLibEnemyProps}
      />

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
    </div>
  );
}
