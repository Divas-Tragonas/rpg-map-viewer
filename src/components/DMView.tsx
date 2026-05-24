'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, BC_CHANNEL, WAND_CURSOR, AREA_SPELL_DATA } from '@/constants';
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
import { ImportPanel } from '@/components/dm/ImportPanel';
import { LayerTree } from '@/components/dm/LayerTree';
import { PlayersPanel } from '@/components/dm/PlayersPanel';
import { DrawToolsPanel } from '@/components/dm/DrawToolsPanel';
import { GridPanel } from '@/components/dm/GridPanel';
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
  const [roomsLocked, setRoomsLocked] = useState(true);
  const [drawToolState, setDrawToolState] = useState<DrawTool>('none');
  const [drawColor, setDrawColor] = useState('#f85149');
  const [drawSize, setDrawSize] = useState(6);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'mapa' | 'eines' | 'enemics'>('mapa');
  const [libEnemies, setLibEnemies] = useState<LibEnemy[]>([]);
  const [psdEnemyOverrides, setPsdEnemyOverrides] = useState<PsdEnemyOverrides>({});
  const [ctxEditName, setCtxEditName] = useState('');
  const [ctxEditHpMax, setCtxEditHpMax] = useState(0);
  const [selectedToken, setSelectedToken] = useState<string | number | null>(null);
  const [dmPrivateActive, setDmPrivateActive] = useState(false);
  const [ctrlPanActive, setCtrlPanActive] = useState(false);
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

  // ── Refs ──────────────────────────────────────────────────────────────────
  const R = useDMRefs();

  // ── Cinematic ─────────────────────────────────────────────────────────────
  const { triggerBossIntro, skipBossIntro } = useCinematic(R);

  // ── setDrawTool wrapper (updates ref + state synchronously) ───────────────
  const setDrawTool = useCallback((fn: DrawTool | ((t: DrawTool) => DrawTool)) => {
    setDrawToolState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      R.rDrawTool.current = next;
      if (prev === 'pointer' && next !== 'pointer') R.rPointerPos.current = null;
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
    addPlayer, removePlayer, adjustPlayerHp, loadParty, clearDrawing, undoStroke,
    saveSession, loadSession, addSpell, deleteLayer, toggleVis, resetToken,
    addPaintedZone, deletePaintedZone, deleteAreaSpell, clearPaintedZones, toggleCondition, openPlayerWindow,
    addLibEnemy, adjustLibEnemyHp, adjustPsdEnemyHp, setPsdEnemyProps, setLibEnemyProps,
    removeLibEnemy, toggleLibEnemyVisibility,
  } = useDMActions(R, S);

  // ── BC setup (DM only receives PLAYER_READY) ──────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel(BC_CHANNEL);
    R.bcRef.current = bc;
    bc.onmessage = (e) => { if (e.data?.type === 'PLAYER_READY') _sendFullState(); };
    return () => { bc.close(); R.bcRef.current = null; };
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
    R.rRoomsLocked.current = roomsLocked; R.rDefeated.current = defeated;
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
    roomsLocked, defeated, gridVisible, gridSize, gridSnap, gridAutoSize, tokenSizeOverride,
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
    setActiveSpells, setPaintedZones, setContextMenu, setRoomsLocked, setCanUndo,
    setDmPrivateActive, setCanvasCursor,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { onMouseDown, onMouseMove, onMouseUp, onMouseLeaveCanvas, onContextMenu } =
    useMouseHandlers(R, mouseSetters, _broadcastState);

  const handleMouseUp = useCallback(() => {
    onMouseUp(setPos, snapAllTokens, sizeAllTokens, setGridSize, setGridOriginX, setGridOriginY, setGridCalibrating);
  }, [onMouseUp, setPos, snapAllTokens, sizeAllTokens, setGridSize, setGridOriginX, setGridOriginY, setGridCalibrating]);

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  useKeyboardHandlers(R, {
    setDrawTool, setCtrlHeld, setRoomsLocked, undoStroke, skipBossIntro,
    broadcastState: () => _broadcastState({}),
    setCtrlPanActive,
  });

  // ── Canvas-level callbacks ────────────────────────────────────────────────
  const onResetView = useCallback(() => {
    R.rZoom.current = 1; setZoom(1);
    R.rPanOffset.current = { x: 0, y: 0 };
    _broadcastState({});
  }, [_broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  const onResetPrivate = useCallback(() => { R.dmPrivateReturnAnim.current = true; }, [R]);

  const onToggleRoomsLocked = useCallback(() => {
    const next = !R.rRoomsLocked.current;
    R.rRoomsLocked.current = next; setRoomsLocked(next);
  }, [R]);

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
    if (expositorActiveRef.current && R.bcRef.current) {
      file.arrayBuffer().then(buf => {
        R.bcRef.current?.postMessage({ type: 'EXPOSITOR_SHOW', buffer: buf, mimeType: file.type });
      });
    }
  }, [expositorLocalSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendExpositorToPlayer = useCallback(async () => {
    const file = expositorFileRef.current;
    if (!file || !R.bcRef.current) return;
    const buf = await file.arrayBuffer();
    R.bcRef.current.postMessage({ type: 'EXPOSITOR_SHOW', buffer: buf, mimeType: file.type });
    expositorActiveRef.current = true;
    setExpositorActive(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hideExpositorOnPlayer = useCallback(() => {
    R.bcRef.current?.postMessage({ type: 'EXPOSITOR_HIDE' });
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
          R.bcRef.current?.postMessage({
            type: 'EXPOSITOR_SYNC',
            zoom: userZ * kb.scale,
            panXNorm: userPx / pw,
            panYNorm: userPy / ph,
            kbTxPct: kb.tx,
            kbTyPct: kb.ty,
          });
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
          {(['mapa', 'eines', 'enemics'] as const).map(tab => (
            <button key={tab} onClick={() => setSidebarTab(tab)}
              style={{ flex: 1, padding: '7px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', border: 'none', cursor: 'pointer', background: sidebarTab === tab ? `${C.accent}18` : 'transparent', color: sidebarTab === tab ? C.accent : C.dim, borderBottom: sidebarTab === tab ? `2px solid ${C.accent}` : '2px solid transparent' }}>
              {tab === 'mapa' ? 'Mapa' : tab === 'eines' ? 'Eines' : 'Enemics'}
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
                onRemove={removePlayer} onAdjustHp={adjustPlayerHp} onLoadParty={loadParty}
              />
            </>
          )}
          {sidebarTab === 'eines' && (
            <>
              <DrawToolsPanel
                drawTool={drawToolState} drawColor={drawColor} setDrawColor={setDrawColor}
                drawSize={drawSize} setDrawSize={setDrawSize}
                canUndo={canUndo} paintedZones={paintedZones}
                onSetDrawTool={setDrawTool} onUndo={undoStroke}
                onClearDraw={clearDrawing} onClearPaintedZones={clearPaintedZones}
                bcRef={R.bcRef}
              />
              <GridPanel
                gridVisible={gridVisible} gridSize={gridSize} gridSnap={gridSnap}
                gridAutoSize={gridAutoSize} gridLineWidth={gridLineWidth} gridCalibrating={gridCalibrating}
                rGridVisible={R.rGridVisible} rGridSize={R.rGridSize} rGridSnap={R.rGridSnap}
                rGridAutoSize={R.rGridAutoSize} rGridLineWidth={R.rGridLineWidth}
                rGridCalibrating={R.rGridCalibrating} rTokenSizeOverride={R.rTokenSizeOverride}
                setGridVisible={setGridVisible} setGridSize={setGridSize} setGridSnap={setGridSnap}
                setGridAutoSize={setGridAutoSize} setGridLineWidth={setGridLineWidth}
                setGridCalibrating={setGridCalibrating} setTokenSizeOverride={setTokenSizeOverride}
                onSnapAll={snapAllTokens} onSizeAll={sizeAllTokens} onBroadcast={_broadcastState}
                gridCalibRef={R.gridCalibRef} gridCalibCurrRef={R.gridCalibCurrRef}
              />
            </>
          )}
          {sidebarTab === 'enemics' && (
            <EnemyLibraryPanel
              libEnemies={libEnemies}
              defeated={defeated}
              onAddEnemy={addLibEnemy}
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
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, cursor: (drawToolState === 'pen' || drawToolState === 'eraser' || drawToolState === 'pointer') ? 'none' : canvasCursor }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={onMouseLeaveCanvas}
          onContextMenu={onContextMenu}
        />
        <CanvasHUD
          dmPrivateActive={dmPrivateActive} ctrlPanActive={ctrlPanActive} struct={struct} vis={vis}
          roomsLocked={roomsLocked} enemyHighlight={enemyHighlight}
          highlightLocked={highlightLocked} gridCalibrating={gridCalibrating}
          onResetView={onResetView} onResetPrivate={onResetPrivate}
          onToggleRoomsLocked={onToggleRoomsLocked}
          onToggleEnemyHighlight={onToggleEnemyHighlight}
          onToggleHighlightLocked={onToggleHighlightLocked}
        />
        <button
          onClick={() => setExpositorOpen(v => !v)}
          title="Expositor d'Imatges i Vídeo per als jugadors"
          style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: expositorOpen ? `${C.accent}22` : 'rgba(10,13,18,.92)', border: `1px solid ${expositorOpen ? C.accent : (expositorActive ? C.accent + '88' : C.border)}`, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: expositorOpen ? C.accent : (expositorActive ? C.accent + 'cc' : C.dim), fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
          {expositorActive ? '◉ Expositor' : 'Expositor'}
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
        {!bgLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', color: C.dim }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🗺</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Carrega una imatge o vídeo de fons</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>Arrossega a la zona "Img/Vídeo" del panell esquerre</div>
              <div style={{ fontSize: 16, marginTop: 12, color: '#fff', fontWeight: 700, letterSpacing: '0.06em' }}>v3.28</div>
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
        bcRef={R.bcRef}
        onTriggerBossIntro={triggerBossIntro}
      />
      <SceneConfigOverlay
        sceneConfigMenu={sceneConfigMenu} rLayerImages={R.rLayerImages}
        rPsdEnemyImgCache={R.rPsdEnemyImgCache}
        libEnemies={libEnemies} psdEnemyOverrides={psdEnemyOverrides}
        bcRef={R.bcRef}
        onClose={() => setSceneConfigMenu(null)}
        onTriggerBossIntro={triggerBossIntro}
        setPsdEnemyProps={setPsdEnemyProps}
        setLibEnemyProps={setLibEnemyProps}
      />

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
    </div>
  );
}
