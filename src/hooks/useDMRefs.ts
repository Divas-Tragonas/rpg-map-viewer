'use client';
import { useRef } from 'react';
import type {
  MapStructure, VisMap, PosMap, Player, Spell, PaintedZone,
  ConditionsMap, DefeatedMap, TokenSizeMap, StrokeAnimState, StrokeData,
  Point, DrawTool, PSDInfo, BBox, LibEnemy, PsdEnemyOverrides, SpellPreview, AreaSpellPending,
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
  // Area (marquee) selection — RTS-style box select, toggled with "A"
  const rAreaSelectMode  = useRef(false);
  const rAreaSelectRect  = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const groupDragRef     = useRef<Map<number | string, { ox: number; oy: number }> | null>(null);
  const pendingDeselectRef = useRef<{ id: number | string; mx: number; my: number } | null>(null);
  const rHighlightAlpha  = useRef(0);
  const rGridDmAlpha     = useRef(0);
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
    rGridVisible, rGridSize, rGridSnap, rGridAutoSize, rTokenSizeOverride, rGridLineWidth,
    rGridOriginX, rGridOriginY, rGridCalibrating, rEnemyHighlight, rHighlightLocked,
    rSelectedToken, rMultiSelected, rTokenGroups, rAreaSelectMode, rAreaSelectRect, groupDragRef, pendingDeselectRef, rHighlightAlpha, rGridDmAlpha, rActiveSpells, rPsdInfo,
    rDMPreviewActive, rDMPreviewZoom, rDMPreviewPan,
    rPsdEnemyOverrides, rPsdEnemyImgCache,
    dragRef, rafRef, drawCanvasRef, isDrawingRef, lastDrawRef, rHoveredRoom, bcRef, wsRef,
    panDragRef, rPanOffset, roomAnimRef, visualPosRef, currentStrokeRef, strokeQueueRef,
    activeStrokeAnim, rDeathCanvas, shapePointsRef, isShapeDrawingRef, bgBufferRef,
    drawChangedRef, dmLocalPan, dmLocalZoom, dmPrivateReturnAnim, dmShiftReturnAnim,
    visualZoomRef, visualPanRef,
    zoneDragRef, areaSpellDragRef, defeatedAnimRef, _ctx2dRef, invisAlphaRef, strokeHistoryRef,
    rPointerPos, rShiftHeld, rHoveredPaintedZoneId, rSelectedPaintedZoneId, rCursorScreenPos, pointerThrottleRef, bgTransitionRef, gridCalibRef, gridCalibCurrRef,
    gridCalibHoverRef, highlightStartRef, dmPreviewBcastRef, zoneAppearRef,
    isSpellLineDrawingRef, spellLineStartRef, rSpellPreview, rAreaPlacementPending,
    cinematicActiveRef, cinematicDataRef, cinematicStartRef, cinematicCamRef,
    cinematicOrigZoomRef, cinematicOrigPanRef,
    cinematicTimelineRef, triggerBossIntroRef, skipBossIntroRef,
    rCtrlPanToggle, rCtrlPanSnapshot, rShiftPanToggle,
  };
}

export type DMRefs = ReturnType<typeof useDMRefs>;
