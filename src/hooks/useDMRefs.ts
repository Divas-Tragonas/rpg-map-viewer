'use client';
import { useRef } from 'react';
import type {
  MapStructure, VisMap, PosMap, Player, Spell, PaintedZone,
  ConditionsMap, DefeatedMap, TokenSizeMap, StrokeAnimState, StrokeData,
  Point, DrawTool, PSDInfo, BBox, LibEnemy, PsdEnemyOverrides, SpellPreview, AreaSpellPending,
  Wall, Room, Door, TurnState, CamRect,
} from '@/types';
import type { CinematicTimeline } from '@/lib/cinematic';
import type { SyncSocket } from '@/lib/ws';

export function useDMRefs() {
  const stageRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef  = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  // State mirror refs
  const rStruct       = useRef<MapStructure | null>(null);
  const rStruct2      = useRef<MapStructure | null>(null);
  const rVis          = useRef<VisMap>({});
  const rPos          = useRef<PosMap>({});
  const rZoom         = useRef(1);
  const rPlayers      = useRef<Player[]>([]);
  const rLibEnemies   = useRef<LibEnemy[]>([]);
  const rDrawTool     = useRef<DrawTool>('none');
  const rDrawColor    = useRef('#f85149');
  const rDrawSize     = useRef(6);
  const rLayerImages  = useRef<Record<number, HTMLCanvasElement>>({});
  const rLayerUrls    = useRef<Record<string, string>>({});
  const rConditions   = useRef<ConditionsMap>({});
  const rPaintedZones = useRef<PaintedZone[]>([]);
  // Parets + sales fosques (eina "Parets"). rWalls és la font de veritat del DM (no es
  // sincronitza); rRooms se'n deriva per detecció de cares i sí que viatja al jugador.
  const rWalls          = useRef<Wall[]>([]);
  const rRooms          = useRef<Room[]>([]);
  // Portes: forats a les parets per on passen llum i moviment. Sincronitzades al jugador.
  const rDoors          = useRef<Door[]>([]);
  // Punts de llum (torxes/llànties) col·locats pel DM. S'activen quan un token de jugador
  // és dins de la mateixa sala. Sincronitzats al jugador i persistits.
  const rLights         = useRef<import('@/types').LightSource[]>([]);
  const rLightSelected  = useRef<string | null>(null);   // llum seleccionada (per editar-ne el radi)
  const rNewLightRadiusFt = useRef(15);                  // radi per defecte de les llums noves (peus)
  const rLightDrag      = useRef<{ id: string; ox: number; oy: number } | null>(null); // drag d'una llum
  // Mode de col·locació de porta (s'activa sol en tancar una sala nova; Esc l'omet).
  // `anchor` = primer clic (inici de la porta) sobre una paret; el segon clic en fixa
  // l'amplada. Sense anchor, el proper clic marca l'inici.
  const rDoorPlacement  = useRef<{ roomId: string | null; anchor?: { wall: Wall; s: number } } | null>(null);
  const rDoorPreview    = useRef<{ a: Point; b: Point } | null>(null);
  // Amplada de la porta en col·locació, en caselles (+/− per canviar-la; es recorda).
  const rDoorWidthCells = useRef(1);
  // Porta sota el cursor en mode selecció (hover reactiu; clic = obrir/tancar).
  const rHoveredDoorId  = useRef<string | null>(null);
  const rWallPenLast    = useRef<Point | null>(null);   // últim vèrtex de la cadena activa (null = ploma amunt)
  const rWallChain      = useRef<Wall[]>([]);            // parets afegides a la cadena oberta actual (per cancel·lar amb Esc)
  const rWallCursor     = useRef<{ x: number; y: number; onVertex: boolean } | null>(null); // preview de la paret en curs
  const rHoveredRoomId  = useRef<string | null>(null);  // sala sota el cursor (ull, mode selecció)
  const roomRevealAnimRef = useRef<Record<string, number>>({}); // 1 = fosca opaca, 0 = revelada
  const rPsdEnemyOverrides = useRef<PsdEnemyOverrides>({});
  const rPsdEnemyImgCache  = useRef<Record<number, HTMLCanvasElement>>({});
  const rContextMenu  = useRef<unknown>(null);
  const rDefeated     = useRef<DefeatedMap>({});
  const rGridVisible  = useRef(false);
  const rGridSize     = useRef(70);
  const rGridSnap     = useRef(false);
  const rGridAutoSize = useRef(false);
  const rTokenSizeOverride = useRef<TokenSizeMap>({});
  const rGridLineWidth = useRef(1.5);
  const rGridOriginX   = useRef(0);
  const rGridOriginY   = useRef(0);
  const rGridCalibrating = useRef(false);
  const rEnemyHighlight  = useRef(false);
  const rHighlightLocked = useRef(false);
  const rSelectedToken   = useRef<number | string | null>(null);
  const rMultiSelected   = useRef<Set<number | string>>(new Set());
  // Token groups — tokenId -> groupId. A token belongs to at most one group.
  const rTokenGroups     = useRef<Map<number | string, string>>(new Map());
  // Sistema per torns (iniciativa). Mirall de l'estat `turn`; el tick i el drag el llegeixen.
  const rTurn            = useRef<TurnState>({ active: false, order: [], turnIndex: 0, round: 1, activeRemainingFt: 0 });
  // Historial de moviments del torn actiu (per Ctrl+Z). DM-only, es neteja a cada canvi de torn.
  const rMoveHistory     = useRef<Array<{ id: number | string; from: Point; spentFt: number }>>([]);
  // Area (marquee) selection — RTS-style box select, toggled with "A"
  const rAreaSelectMode  = useRef(false);
  const rAreaSelectRect  = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const groupDragRef     = useRef<Map<number | string, { ox: number; oy: number }> | null>(null);
  const pendingDeselectRef = useRef<{ id: number | string; mx: number; my: number } | null>(null);
  const rHighlightAlpha  = useRef(0);
  const rGridDmAlpha     = useRef(0);
  // Opacitat del mapa de fons NOMÉS a la pantalla del DM (ajuda visual per veure millor
  // sales/tokens/màgies; no afecta el que veuen els jugadors). 1 = opac.
  const rBgDmOpacity     = useRef(1);
  const rActiveSpells    = useRef<Spell[]>([]);
  const rPsdInfo         = useRef<PSDInfo | null>(null);
  const rDMPreviewActive = useRef(false);
  const rDMPreviewZoom   = useRef(1);
  const rDMPreviewPan    = useRef<Point>({ x: 0, y: 0 });

  // Interaction refs
  const dragRef         = useRef<{ id: number | string; ox: number; oy: number } | null>(null);
  const rafRef          = useRef<number>(0);
  const drawCanvasRef   = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef    = useRef(false);
  const lastDrawRef     = useRef<{ mx: number; my: number } | null>(null);
  const rHoveredRoom    = useRef<{ id: number; lx: number; ly: number; lw: number; lh: number } | null>(null);
  const bcRef           = useRef<BroadcastChannel | null>(null);
  const wsRef           = useRef<SyncSocket | null>(null);
  const panDragRef      = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; private?: boolean } | null>(null);
  const rPanOffset      = useRef<Point>({ x: 0, y: 0 });
  const roomAnimRef     = useRef<Record<string, number>>({});
  const visualPosRef    = useRef<PosMap>({});
  const currentStrokeRef  = useRef<Point[]>([]);
  const strokeQueueRef    = useRef<StrokeAnimState[]>([]);
  const activeStrokeAnim  = useRef<StrokeAnimState | null>(null);
  const rDeathCanvas      = useRef<HTMLCanvasElement | null>(null);
  const shapePointsRef    = useRef<Point[]>([]);
  const isShapeDrawingRef = useRef(false);
  const bgBufferRef       = useRef<{ buffer: ArrayBuffer; mimeType: string } | null>(null);
  const drawChangedRef    = useRef(false);
  const dmLocalPan        = useRef<Point>({ x: 0, y: 0 });
  const dmLocalZoom       = useRef(1);
  const dmPrivateReturnAnim = useRef(false);
  const dmShiftReturnAnim   = useRef(false);
  const visualZoomRef     = useRef(1);
  const visualPanRef      = useRef<Point>({ x: 0, y: 0 });
  const zoneDragRef       = useRef<{ zoneId: string; startMx: number; startMy: number; origPoints: Point[]; origBbox: BBox } | null>(null);
  const areaSpellDragRef  = useRef<{ spellId: string; startMx: number; startMy: number; origCx: number; origCy: number } | null>(null);
  const defeatedAnimRef   = useRef<Record<string, number>>({});
  const _ctx2dRef         = useRef<CanvasRenderingContext2D | null>(null);
  const invisAlphaRef     = useRef<Record<string, number>>({});
  const strokeHistoryRef  = useRef<StrokeData[]>([]);
  const rPointerPos       = useRef<Point | null>(null);
  // Measuring ruler (tool 4/"Senyal"): click cycle a(start) -> b(fixed end) -> clear.
  const rMeasure          = useRef<{ a: Point | null; b: Point | null }>({ a: null, b: null });
  const rShiftHeld          = useRef(false);
  const rHoveredPaintedZoneId    = useRef<string | null>(null);
  const rSelectedPaintedZoneId   = useRef<string | null>(null);
  const rCursorScreenPos  = useRef<{ x: number; y: number } | null>(null);
  const pointerThrottleRef = useRef(0);
  const bgTransitionRef   = useRef<HTMLDivElement | null>(null);
  const gridCalibRef      = useRef<{ sx: number; sy: number } | null>(null);
  const gridCalibCurrRef  = useRef<{ cx: number; cy: number } | null>(null);
  const gridCalibHoverRef = useRef<{ hx: number; hy: number } | null>(null);
  const highlightStartRef = useRef<number | null>(null);
  const dmPreviewBcastRef = useRef(0);
  // Enquadrament COMPARTIT del DM en coords de mapa (sense la vista privada Ctrl):
  // el recalcula `useRafLoop` cada frame i és el que viatja al jugador dins `cam`.
  const rDmCam            = useRef<CamRect | null>(null);
  // Pantalles de jugador connectades (missatge VIEWPORT): id → format i últim contacte.
  // Serveix per avisar el DM de quant de mapa veuen fora del seu marc.
  const rPlayerScreens    = useRef<Record<string, { w: number; h: number; ts: number }>>({});
  const zoneAppearRef     = useRef<Record<string, number>>({});
  // Pan toggle modes (tap key once to activate, tap again to deactivate + restore)
  const rCtrlPanToggle   = useRef(false);
  const rCtrlPanSnapshot = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const rShiftPanToggle  = useRef(false);

  // Spell drawing refs
  const isSpellLineDrawingRef  = useRef(false);
  const spellLineStartRef      = useRef<Point | null>(null);
  const rSpellPreview          = useRef<SpellPreview | null>(null);
  const rAreaPlacementPending  = useRef<AreaSpellPending | null>(null);

  // Cinematic refs
  const cinematicActiveRef   = useRef(false);
  const cinematicDataRef     = useRef<Record<string, Element | null> | null>(null);
  const cinematicStartRef    = useRef(0);
  const cinematicCamRef      = useRef({ active: false, tgtZoom: 1, tgtPan: { x: 0, y: 0 }, curZoom: 1, curPan: { x: 0, y: 0 } });
  const cinematicOrigZoomRef = useRef(1);
  const cinematicOrigPanRef  = useRef({ x: 0, y: 0 });
  const cinematicTimelineRef = useRef<CinematicTimeline | null>(null);
  const triggerBossIntroRef  = useRef<((data: Record<string, unknown>) => void) | null>(null);
  const skipBossIntroRef     = useRef<(() => void) | null>(null);

  return {
    stageRef, canvasRef, mediaRef,
    rStruct, rStruct2, rVis, rPos, rZoom, rPlayers, rLibEnemies, rDrawTool, rDrawColor, rDrawSize,
    rLayerImages, rLayerUrls, rConditions, rPaintedZones, rContextMenu, rDefeated,
    rWalls, rRooms, rDoors, rLights, rLightSelected, rNewLightRadiusFt, rLightDrag, rDoorPlacement, rDoorPreview, rDoorWidthCells, rHoveredDoorId, rWallPenLast, rWallChain, rWallCursor, rHoveredRoomId, roomRevealAnimRef,
    rGridVisible, rGridSize, rGridSnap, rGridAutoSize, rTokenSizeOverride, rGridLineWidth,
    rGridOriginX, rGridOriginY, rGridCalibrating, rEnemyHighlight, rHighlightLocked,
    rSelectedToken, rMultiSelected, rTokenGroups, rTurn, rMoveHistory, rAreaSelectMode, rAreaSelectRect, groupDragRef, pendingDeselectRef, rHighlightAlpha, rGridDmAlpha, rBgDmOpacity, rActiveSpells, rPsdInfo,
    rDMPreviewActive, rDMPreviewZoom, rDMPreviewPan,
    rPsdEnemyOverrides, rPsdEnemyImgCache,
    dragRef, rafRef, drawCanvasRef, isDrawingRef, lastDrawRef, rHoveredRoom, bcRef, wsRef,
    panDragRef, rPanOffset, roomAnimRef, visualPosRef, currentStrokeRef, strokeQueueRef,
    activeStrokeAnim, rDeathCanvas, shapePointsRef, isShapeDrawingRef, bgBufferRef,
    drawChangedRef, dmLocalPan, dmLocalZoom, dmPrivateReturnAnim, dmShiftReturnAnim,
    visualZoomRef, visualPanRef,
    zoneDragRef, areaSpellDragRef, defeatedAnimRef, _ctx2dRef, invisAlphaRef, strokeHistoryRef,
    rPointerPos, rMeasure, rShiftHeld, rHoveredPaintedZoneId, rSelectedPaintedZoneId, rCursorScreenPos, pointerThrottleRef, bgTransitionRef, gridCalibRef, gridCalibCurrRef,
    gridCalibHoverRef, highlightStartRef, dmPreviewBcastRef, rDmCam, rPlayerScreens, zoneAppearRef,
    isSpellLineDrawingRef, spellLineStartRef, rSpellPreview, rAreaPlacementPending,
    cinematicActiveRef, cinematicDataRef, cinematicStartRef, cinematicCamRef,
    cinematicOrigZoomRef, cinematicOrigPanRef,
    cinematicTimelineRef, triggerBossIntroRef, skipBossIntroRef,
    rCtrlPanToggle, rCtrlPanSnapshot, rShiftPanToggle,
  };
}

export type DMRefs = ReturnType<typeof useDMRefs>;
