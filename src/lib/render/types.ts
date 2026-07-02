import type { MutableRefObject } from 'react';
import type {
  MapStructure, VisMap, PosMap, Player, PaintedZone, Spell, SpellPreview,
  ConditionsMap, DefeatedMap, TokenSizeMap, StrokeAnimState, StrokeData, Point, DrawTool,
} from '@/types';

export interface GridCalib {
  sx: number;
  sy: number;
}

export interface GridCalibCurr {
  cx: number;
  cy: number;
}

export interface GridCalibHover {
  hx: number;
  hy: number;
}

export interface CinematicCamera {
  active: boolean;
  tgtZoom: number;
  curZoom: number;
  tgtPan: { x: number; y: number };
  curPan: { x: number; y: number };
}

export interface RoomAnimMap {
  [id: string]: number;
}

export interface FrameContext {
  sc: number;
  ox: number;
  oy: number;
  mw: number;
  mh: number;
  isDM: boolean;
  s: MapStructure;
  v: VisMap;
  pp: PosMap;

  rLayerImages:     MutableRefObject<Record<number, HTMLCanvasElement>>;
  rHoveredRoom:     MutableRefObject<{ id: number; lx: number; ly: number; lw: number; lh: number } | null>;
  roomAnimRef:      MutableRefObject<RoomAnimMap>;
  rPaintedZones:    MutableRefObject<PaintedZone[]>;
  rContextMenu:     MutableRefObject<unknown>;
  zoneAppearRef:    MutableRefObject<Record<string, number>>;
  txCache:          Record<string, HTMLCanvasElement>;

  isShapeDrawingRef: MutableRefObject<boolean>;
  shapePointsRef:    MutableRefObject<{ x: number; y: number }[]>;

  activeStrokeAnim: MutableRefObject<StrokeAnimState | null>;
  strokeQueueRef:   MutableRefObject<StrokeAnimState[]>;
  drawCanvasRef:    MutableRefObject<HTMLCanvasElement | null>;

  rActiveSpells:    MutableRefObject<Spell[]>;
  setActiveSpells:  (spells: Spell[]) => void;
  rSpellPreview?:   MutableRefObject<SpellPreview | null>;

  rConditions:      MutableRefObject<ConditionsMap>;
  rDefeated:        MutableRefObject<DefeatedMap>;
  rDeathCanvas:     MutableRefObject<HTMLCanvasElement | null>;
  defeatedAnimRef:  MutableRefObject<Record<string, number>>;
  invisAlphaRef:    MutableRefObject<Record<string, number>>;

  rEnemyHighlight:  MutableRefObject<boolean>;
  rHighlightAlpha:  MutableRefObject<number>;
  rHighlightLocked: MutableRefObject<boolean>;
  highlightStartRef:MutableRefObject<number | null>;

  visualPosRef:     MutableRefObject<PosMap>;
  rPlayers:         MutableRefObject<Player[]>;
  rTokenSizeOverride: MutableRefObject<TokenSizeMap>;

  rGridVisible:     MutableRefObject<boolean>;
  rGridSize:        MutableRefObject<number>;
  rGridLineWidth:   MutableRefObject<number>;
  rGridOriginX:     MutableRefObject<number>;
  rGridOriginY:     MutableRefObject<number>;
  rGridCalibrating: MutableRefObject<boolean>;
  rGridDmAlpha:     MutableRefObject<number>;

  gridCalibRef:     MutableRefObject<GridCalib | null>;
  gridCalibCurrRef: MutableRefObject<GridCalibCurr | null>;
  gridCalibHoverRef:MutableRefObject<GridCalibHover | null>;

  rPointerPos:      MutableRefObject<{ x: number; y: number } | null>;
  rMeasure?:        MutableRefObject<{ a: Point | null; b: Point | null }>;
  rDrawTool?:       MutableRefObject<DrawTool>;
  rSelectedToken:   MutableRefObject<number | string | null>;
  rMultiSelected:   MutableRefObject<Set<number | string>>;

  rLibEnemies:         MutableRefObject<import('@/types').LibEnemy[]>;
  rPsdEnemyOverrides:  MutableRefObject<import('@/types').PsdEnemyOverrides>;
  rPsdEnemyImgCache:   MutableRefObject<Record<number, HTMLCanvasElement>>;

  zoneDragRef?: MutableRefObject<{ zoneId: string; startMx: number; startMy: number; origPoints: { x: number; y: number }[]; origBbox: { left: number; top: number; right: number; bottom: number; cx: number; cy: number; w: number; h: number } } | null>;
  rHoveredPaintedZoneId?: MutableRefObject<string | null>;
  rSelectedPaintedZoneId?: MutableRefObject<string | null>;
}
