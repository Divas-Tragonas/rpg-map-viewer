'use client';
import { useCallback, useRef } from 'react';
import { pointInPolygon, getBBox, segmentsIntersect, segmentIntersection } from '@/lib/geometry';
import { ELEMENTS_BY_ID, WAND_CURSOR, AREA_SPELL_DATA } from '@/constants';

const AREA_TYPES = new Set(['sleep', 'grease']);
const AREA_SETTLED = (sp: import('@/types').Spell) => {
  const DUR: Record<string, number> = { sleep: 3.0, grease: 3.5 };
  return (performance.now() - sp.startTime) / 1000 > (DUR[sp.type] ?? 2.5);
};
import type { PosMap, VisMap } from '@/types';
import type { DMRefs } from './useDMRefs';

interface MouseHandlerSetters {
  setVis: (v: VisMap | ((p: VisMap) => VisMap)) => void;
  setPos: (v: PosMap | ((p: PosMap) => PosMap)) => void;
  setActiveDrag: (v: string | number | null) => void;
  setSelectedToken: (v: string | number | null) => void;
  setShapeMenu: (v: { points: { x: number; y: number }[]; bbox: import('@/types').BBox; cx: number; cy: number } | null) => void;
  setSpellMenu: (v: import('@/types').SpellMenuState | null) => void;
  setActiveSpells: (v: import('@/types').Spell[]) => void;
  setPaintedZones: (v: import('@/types').PaintedZone[]) => void;
  setContextMenu: (v: import('@/types').ContextMenuState | null) => void;
  setCanUndo: (v: boolean) => void;
  setDmPrivateActive: (v: boolean) => void;
  setCanvasCursor: (c: string) => void;
}

type BroadcastFn = (extra?: Record<string, unknown>) => void;

function getTokenPos(R: DMRefs, id: number | string): { x: number; y: number } | null {
  const p = R.rPos.current[id];
  if (p) return p;
  if (typeof id === 'string' && id.startsWith('pl_')) {
    const plId = parseInt(id.replace('pl_', ''));
    const pl = R.rPlayers.current.find(p => p.id === plId);
    if (pl) return { x: pl.x, y: pl.y };
  }
  return null;
}

function mapCoords(e: React.MouseEvent | MouseEvent, r: DOMRect, media: HTMLImageElement | HTMLVideoElement | null, rZoom: { current: number }, rPanOffset: { current: { x: number; y: number } }, dmLocalPan: { current: { x: number; y: number } }, dmLocalZoom: { current: number }) {
  const W = r.width, H = r.height;
  let mw = 1920, mh = 1080;
  if (media?.tagName === 'IMG' && (media as HTMLImageElement).naturalWidth) { mw = (media as HTMLImageElement).naturalWidth; mh = (media as HTMLImageElement).naturalHeight; }
  if (media?.tagName === 'VIDEO' && (media as HTMLVideoElement).videoWidth) { mw = (media as HTMLVideoElement).videoWidth; mh = (media as HTMLVideoElement).videoHeight; }
  const totalZoom = rZoom.current * dmLocalZoom.current;
  const sc = Math.min(W / mw, H / mh) * totalZoom;
  const pan = { x: rPanOffset.current.x + dmLocalPan.current.x, y: rPanOffset.current.y + dmLocalPan.current.y };
  return { mx: (e.clientX - r.left - (W - mw * sc) / 2 - pan.x) / sc, my: (e.clientY - r.top - (H - mh * sc) / 2 - pan.y) / sc, sc };
}

export function useMouseHandlers(R: DMRefs, S: MouseHandlerSetters, _broadcastState: BroadcastFn) {
  // getBoundingClientRect pot forçar un reflow i es cridava a cada mousemove; el rect del
  // canvas només canvia quan canvia el layout, així que es cacheja amb un refresc curt.
  const rectCacheRef = useRef<{ rect: DOMRect; t: number } | null>(null);
  const getCanvasRect = useCallback(() => {
    const now = performance.now();
    if (!rectCacheRef.current || now - rectCacheRef.current.t > 400) {
      rectCacheRef.current = { rect: R.canvasRef.current!.getBoundingClientRect(), t: now };
    }
    return rectCacheRef.current.rect;
  }, []);

  const mc = useCallback((e: React.MouseEvent | MouseEvent) => {
    return mapCoords(e, getCanvasRect(), R.mediaRef.current, R.rZoom, R.rPanOffset, R.dmLocalPan, R.dmLocalZoom);
  }, [getCanvasRect]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      if (R.rShiftPanToggle.current) {
        R.panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: R.dmLocalPan.current.x, startPanY: R.dmLocalPan.current.y, private: true };
      } else {
        R.panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: R.rPanOffset.current.x, startPanY: R.rPanOffset.current.y };
      }
      return;
    }
    // Area (marquee) selection mode — RTS-style box select (toggled with "A").
    // Takes priority over every tool so a left-drag always rubber-bands.
    if (e.button === 0 && R.rAreaSelectMode.current) {
      const { mx: amx, my: amy } = mc(e);
      R.rAreaSelectRect.current = { x0: amx, y0: amy, x1: amx, y1: amy };
      e.preventDefault(); return;
    }
    // Shift + left click in shape tool = straight-line spell drawing
    if (e.button === 0 && (e.shiftKey || R.rShiftHeld.current) && R.rDrawTool.current === 'shape') {
      const { mx: smx, my: smy } = mc(e);
      R.isSpellLineDrawingRef.current = true;
      R.spellLineStartRef.current = { x: smx, y: smy };
      R.rSpellPreview.current = { mode: 'line', start: { x: smx, y: smy }, end: { x: smx, y: smy } };
      e.preventDefault(); return;
    }
    // Alt + click = pick origin + open area spell menu
    if (e.button === 0 && e.altKey && R.rDrawTool.current === 'shape') {
      const { mx: amx, my: amy } = mc(e);
      S.setSpellMenu({ points: [{ x: amx, y: amy }], cx: e.clientX, cy: e.clientY, mode: 'area' });
      e.preventDefault(); return;
    }
    // Click to confirm pending area spell placement
    if (e.button === 0 && R.rAreaPlacementPending.current && R.rDrawTool.current === 'shape' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      const { mx: pmx, my: pmy } = mc(e);
      const { type, origin } = R.rAreaPlacementPending.current;
      const sp = { id: Date.now().toString(), type, points: [origin, { x: pmx, y: pmy }], startTime: performance.now() };
      const ns = [...R.rActiveSpells.current, sp];
      R.rActiveSpells.current = ns; S.setActiveSpells(ns);
      R.bcRef.current?.postMessage({ type: 'SPELL', spell: { ...sp, startTime: 0 } });
      R.wsRef.current?.send(JSON.stringify({ type: 'SPELL', spell: { ...sp, startTime: 0 } }));
      R.rAreaPlacementPending.current = null; R.rSpellPreview.current = null;
      e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    const { mx, my } = mc(e);

    if (R.rGridCalibrating.current) {
      R.gridCalibRef.current = { sx: mx, sy: my };
      R.gridCalibCurrRef.current = { cx: mx, cy: my };
      e.preventDefault(); return;
    }

    const tool = R.rDrawTool.current;
    if (tool === 'pen' || tool === 'eraser') {
      R.isDrawingRef.current = true; R.lastDrawRef.current = { mx, my };
      R.currentStrokeRef.current = [{ x: mx, y: my }];
      e.preventDefault(); return;
    }
    if (tool === 'shape') {
      if (e.ctrlKey) {
        // Tokens have highest priority for CTRL+drag in shape tool
        for (let i = R.rLibEnemies.current.length - 1; i >= 0; i--) {
          const len = R.rLibEnemies.current[i];
          const lep = R.rPos.current[`lib_${len.id}`] || { x: 0, y: 0 };
          const lR = R.rTokenSizeOverride.current[`lib_${len.id}`] ?? len.R;
          if (Math.hypot(mx - lep.x, my - lep.y) <= lR) {
            R.dragRef.current = { id: `lib_${len.id}`, ox: mx - lep.x, oy: my - lep.y };
            S.setActiveDrag(`lib_${len.id}`); S.setSelectedToken(`lib_${len.id}`); R.rSelectedToken.current = `lib_${len.id}`; S.setCanvasCursor('grabbing');
            e.preventDefault(); return;
          }
        }
        for (let i = R.rPlayers.current.length - 1; i >= 0; i--) {
          const pl = R.rPlayers.current[i];
          const ppos = R.rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
          const pR = R.rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
          if (Math.hypot(mx - (ppos.x + pR), my - (ppos.y + pR)) <= pR + 4) {
            R.dragRef.current = { id: `pl_${pl.id}`, ox: mx - ppos.x, oy: my - ppos.y };
            S.setActiveDrag(`pl_${pl.id}`); S.setSelectedToken(`pl_${pl.id}`); R.rSelectedToken.current = `pl_${pl.id}`; S.setCanvasCursor('grabbing');
            e.preventDefault(); return;
          }
        }
        const sShape = R.rStruct.current;
        if (sShape) {
          for (const zone of sShape.enemyRooms) {
            for (let i = zone.enemies.length - 1; i >= 0; i--) {
              const en = zone.enemies[i];
              const ep = R.rPos.current[en.id]; if (!ep) continue;
              const Rv = R.rTokenSizeOverride.current[en.id] ?? Math.max(Math.min(en.w, en.h) / 2, 22);
              if (Math.hypot(mx - ep.x, my - ep.y) <= Rv) {
                R.dragRef.current = { id: en.id, ox: mx - ep.x, oy: my - ep.y };
                S.setActiveDrag(en.id); S.setSelectedToken(en.id); R.rSelectedToken.current = en.id; S.setCanvasCursor('grabbing');
                e.preventDefault(); return;
              }
            }
          }
        }
        // Painted zones
        for (let i = R.rPaintedZones.current.length - 1; i >= 0; i--) {
          const zone = R.rPaintedZones.current[i];
          if (pointInPolygon(mx, my, zone.points)) {
            R.zoneDragRef.current = { zoneId: zone.id, startMx: mx, startMy: my, origPoints: zone.points.map(p => ({ ...p })), origBbox: { ...zone.bbox } };
            S.setCanvasCursor('grabbing'); e.preventDefault(); return;
          }
        }
        // Area spells (lowest priority)
        for (let i = R.rActiveSpells.current.length - 1; i >= 0; i--) {
          const sp = R.rActiveSpells.current[i];
          if (!AREA_TYPES.has(sp.type) || !AREA_SETTLED(sp)) continue;
          const center = sp.points[sp.points.length - 1];
          const data = AREA_SPELL_DATA[sp.type as string];
          if (!center || !data) continue;
          const radius = (data.aoeRadiusFt / 5) * R.rGridSize.current;
          if (Math.hypot(mx - center.x, my - center.y) <= radius) {
            R.areaSpellDragRef.current = { spellId: sp.id, startMx: mx, startMy: my, origCx: center.x, origCy: center.y };
            S.setCanvasCursor('grabbing'); e.preventDefault(); return;
          }
        }
      }
      R.isShapeDrawingRef.current = true; R.shapePointsRef.current = [{ x: mx, y: my }];
      e.preventDefault(); return;
    }

    // Measuring ruler (tool 4/"Senyal"): click cycle — start point, then fixed end point, then clear.
    if (tool === 'pointer') {
      // El click també col·loca l'indicador de punter: en pantalles tàctils (Safari en
      // tablet) el tap no genera un mousemove fiable abans del mousedown, i sense això
      // el jugador no veia cap indicador en clicar.
      R.rPointerPos.current = { x: mx, y: my };
      R.bcRef.current?.postMessage({ type: 'POINTER', pos: { x: mx, y: my } });
      R.wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: { x: mx, y: my } }));
      const m = R.rMeasure.current;
      const next = !m.a ? { a: { x: mx, y: my }, b: null }
        : !m.b ? { a: m.a, b: { x: mx, y: my } }
        : { a: null, b: null };
      R.rMeasure.current = next;
      R.bcRef.current?.postMessage({ type: 'MEASURE', a: next.a, b: next.b });
      R.wsRef.current?.send(JSON.stringify({ type: 'MEASURE', a: next.a, b: next.b }));
      e.preventDefault(); return;
    }

    // Selects `id` (adding to the multi-selection if one is already active) and arms
    // a drag — solo, or in lockstep with the rest of the selection when it has >1 member.
    const selectAndArmDrag = (id: number | string, ep: { x: number; y: number }) => {
      const sel = R.rMultiSelected.current;
      const reclickingGroupMember = sel.size > 1 && sel.has(id);
      sel.add(id);
      R.rMultiSelected.current = new Set(sel);
      S.setSelectedToken(id); R.rSelectedToken.current = id;
      R.dragRef.current = { id, ox: mx - ep.x, oy: my - ep.y };
      R.pendingDeselectRef.current = reclickingGroupMember ? { id, mx, my } : null;
      if (sel.size > 1) {
        const offsets = new Map<number | string, { ox: number; oy: number }>();
        for (const sid of sel) {
          if (sid === id) continue;
          const p = getTokenPos(R, sid);
          if (p) offsets.set(sid, { ox: mx - p.x, oy: my - p.y });
        }
        R.groupDragRef.current = offsets;
      } else {
        R.groupDragRef.current = null;
      }
      S.setActiveDrag(id); S.setCanvasCursor('grabbing');
    };

    // Check lib enemies first (they are on top)
    for (let i = R.rLibEnemies.current.length - 1; i >= 0; i--) {
      const len = R.rLibEnemies.current[i];
      const lep = R.rPos.current[`lib_${len.id}`] || { x: 0, y: 0 };
      const lR = R.rTokenSizeOverride.current[`lib_${len.id}`] ?? len.R;
      if (Math.hypot(mx - lep.x, my - lep.y) <= lR) {
        selectAndArmDrag(`lib_${len.id}`, lep);
        e.preventDefault(); return;
      }
    }

    for (let i = R.rPlayers.current.length - 1; i >= 0; i--) {
      const pl = R.rPlayers.current[i];
      const ppos = R.rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
      const pR = R.rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
      if (Math.hypot(mx - (ppos.x + pR), my - (ppos.y + pR)) <= pR + 4) {
        selectAndArmDrag(`pl_${pl.id}`, ppos);
        e.preventDefault(); return;
      }
    }

    const s = R.rStruct.current;
    if (s) {
      for (const room of s.enemyRooms) {
        for (let i = room.enemies.length - 1; i >= 0; i--) {
          const en = room.enemies[i];
          const ep = R.rPos.current[en.id]; if (!ep) continue;
          const Rv = R.rTokenSizeOverride.current[en.id] ?? Math.max(Math.min(en.w, en.h) / 2, 22);
          if (Math.hypot(mx - ep.x, my - ep.y) <= Rv) {
            selectAndArmDrag(en.id, ep);
            e.preventDefault(); return;
          }
        }
      }
    }

    S.setSelectedToken(null); R.rSelectedToken.current = null;
    R.rMultiSelected.current = new Set(); R.groupDragRef.current = null;

    const hovZ = R.rHoveredRoom.current;
    if (hovZ) {
      const { id, lx, ly, lw, lh } = hovZ;
      if (mx >= lx && mx <= lx + lw && my >= ly && my <= ly + lh) {
        const currentlyVisible = !!R.rVis.current[id];
        if (currentlyVisible) {
          // Always hide a visible room
          const nv = { ...R.rVis.current, [id]: false };
          R.rVis.current = nv; S.setVis(nv); _broadcastState({});
          e.preventDefault();
        } else if (R.rShiftPanToggle.current) {
          // Only reveal a hidden room when SHIFT mode is active
          const nv = { ...R.rVis.current, [id]: true };
          R.rVis.current = nv; S.setVis(nv); _broadcastState({});
          e.preventDefault();
        }
      }
    }
  }, [mc, _broadcastState]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update screen-space cursor even during pan
    if (R.rDrawTool.current === 'pen' || R.rDrawTool.current === 'eraser' || R.rDrawTool.current === 'shape') {
      const rect0 = getCanvasRect();
      R.rCursorScreenPos.current = { x: e.clientX - rect0.left, y: e.clientY - rect0.top };
    }
    if (R.panDragRef.current) {
      const { startX, startY, startPanX, startPanY, private: isPrivate } = R.panDragRef.current;
      const nx = startPanX + (e.clientX - startX), ny = startPanY + (e.clientY - startY);
      if (isPrivate) {
        R.dmLocalPan.current = { x: nx, y: ny }; S.setDmPrivateActive(true);
        const now = Date.now();
        if (now - R.dmPreviewBcastRef.current > 48) { R.dmPreviewBcastRef.current = now; _broadcastState({}); }
      } else {
        R.rPanOffset.current = { x: nx, y: ny };
        // Mateix throttle que el pan privat: el jugador suavitza el pan amb LERP, així que
        // ~20Hz és fluid i evitem serialitzar l'estat sencer a cada mousemove. L'estat
        // final exacte s'envia sempre al mouseup.
        const now = Date.now();
        if (now - R.dmPreviewBcastRef.current > 48) { R.dmPreviewBcastRef.current = now; _broadcastState({}); }
      }
      return;
    }

    const { mx, my } = mc(e);

    // Update marquee selection rectangle
    if (R.rAreaSelectRect.current) {
      R.rAreaSelectRect.current = { ...R.rAreaSelectRect.current, x1: mx, y1: my };
      return;
    }

    if (R.rGridCalibrating.current) {
      R.gridCalibHoverRef.current = { hx: mx, hy: my };
      if (R.gridCalibRef.current) { R.gridCalibCurrRef.current = { cx: mx, cy: my }; return; }
    }

    if (R.areaSpellDragRef.current) {
      const { spellId, startMx, startMy, origCx, origCy } = R.areaSpellDragRef.current;
      const dx = mx - startMx, dy = my - startMy;
      const sp = R.rActiveSpells.current.find(s => s.id === spellId);
      if (sp) {
        sp.points = sp.points.map((p, i) => i === sp.points.length - 1 ? { x: origCx + dx, y: origCy + dy } : p);
        const now2 = Date.now();
        if (now2 - R.dmPreviewBcastRef.current > 48) { R.dmPreviewBcastRef.current = now2; _broadcastState({}); }
      }
      return;
    }

    const tool = R.rDrawTool.current;

    if (tool === 'none' && !R.dragRef.current && !R.isDrawingRef.current) {
      const s2 = R.rStruct.current;
      if (s2) {
        let overEnemy = false;
        for (const room of (s2.enemyRooms || [])) {
          for (const en of room.enemies) {
            const ep = R.rPos.current[en.id]; if (!ep) continue;
            const Rv = R.rTokenSizeOverride.current[en.id] ?? Math.max(Math.min(en.w, en.h) / 2, 22);
            if (Math.hypot(mx - ep.x, my - ep.y) <= Rv) { overEnemy = true; break; }
          }
          if (overEnemy) break;
        }
        let found = null;
        if (!overEnemy) {
          for (const l of (s2.roomLayers || [])) {
            const lp = R.rPos.current[l.id] || { x: l.left + l.w / 2, y: l.top + l.h / 2 };
            const lx = lp.x - l.w / 2, ly = lp.y - l.h / 2;
            if (mx >= lx && mx <= lx + l.w && my >= ly && my <= ly + l.h) {
              if (!R.rShiftPanToggle.current && !R.rVis.current[l.id]) continue;
              found = { id: l.id, lx, ly, lw: l.w, lh: l.h }; break;
            }
          }
        }
        R.rHoveredRoom.current = found;
      }
    }

    if (tool === 'pen' || tool === 'eraser' || tool === 'shape') {
      const rect2 = getCanvasRect();
      R.rCursorScreenPos.current = { x: e.clientX - rect2.left, y: e.clientY - rect2.top };
    }

    if (tool === 'pointer') {
      R.rPointerPos.current = { x: mx, y: my };
      const now = performance.now();
      if (now - R.pointerThrottleRef.current > 33) {
        R.pointerThrottleRef.current = now;
        R.bcRef.current?.postMessage({ type: 'POINTER', pos: { x: mx, y: my } });
        R.wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: { x: mx, y: my } }));
      }
      return;
    }

    if (R.zoneDragRef.current) {
      const { zoneId, startMx, startMy, origPoints, origBbox } = R.zoneDragRef.current;
      const dx = mx - startMx, dy = my - startMy;
      const newPoints = origPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
      const nb = origBbox;
      const newBbox = { left: nb.left + dx, top: nb.top + dy, right: nb.right + dx, bottom: nb.bottom + dy, cx: nb.cx + dx, cy: nb.cy + dy, w: nb.w, h: nb.h };
      R.rPaintedZones.current = R.rPaintedZones.current.map(z => z.id === zoneId ? { ...z, points: newPoints, bbox: newBbox } : z);
      return;
    }

    // Update spell line preview end point
    if (R.isSpellLineDrawingRef.current && R.spellLineStartRef.current) {
      R.rSpellPreview.current = { mode: 'line', start: R.spellLineStartRef.current, end: { x: mx, y: my } };
      return;
    }
    // Update area placement preview center
    if (R.rAreaPlacementPending.current) {
      const pend = R.rAreaPlacementPending.current;
      R.rSpellPreview.current = { mode: 'area_place', origin: pend.origin, center: { x: mx, y: my }, spellType: pend.type };
      return;
    }

    // Track hovered painted zone for highlight when shape tool is active
    if (tool === 'shape') {
      let hovPZ: string | null = null;
      for (let i = R.rPaintedZones.current.length - 1; i >= 0; i--) {
        if (pointInPolygon(mx, my, R.rPaintedZones.current[i].points)) {
          hovPZ = R.rPaintedZones.current[i].id;
          break;
        }
      }
      R.rHoveredPaintedZoneId.current = hovPZ;
      const newCursor = R.zoneDragRef.current ? 'grabbing' : (hovPZ && e.ctrlKey) ? 'grab' : WAND_CURSOR;
      S.setCanvasCursor(newCursor);
    }

    if (R.isShapeDrawingRef.current && tool === 'shape') {
      const pts = R.shapePointsRef.current;
      const last = pts[pts.length - 1];
      // Mutate in place (not spread) — this ref is read directly by the RAF preview,
      // so an O(n) copy on every mousemove would make drawing large zones itself laggy.
      if (Math.hypot(mx - last.x, my - last.y) > 6 / R.rZoom.current) {
        pts.push({ x: mx, y: my });
        // A spell trace that crosses itself is auto-detected as an area effect — the
        // enclosed loop counts as a closed circle the moment the two points cross.
        const n = pts.length;
        if (n >= 4) {
          const a1 = pts[n - 2], a2 = pts[n - 1];
          for (let i = 0; i < n - 3; i++) {
            const ix = segmentsIntersect(a1, a2, pts[i], pts[i + 1]) ? segmentIntersection(a1, a2, pts[i], pts[i + 1]) : null;
            if (ix) {
              R.isShapeDrawingRef.current = false;
              R.shapePointsRef.current = [];
              const canvas = R.canvasRef.current!;
              const rect = canvas.getBoundingClientRect();
              const media = R.mediaRef.current;
              let imw = 1920, imh = 1080;
              if (media?.tagName === 'IMG' && (media as HTMLImageElement).naturalWidth) { imw = (media as HTMLImageElement).naturalWidth; imh = (media as HTMLImageElement).naturalHeight; }
              if (media?.tagName === 'VIDEO' && (media as HTMLVideoElement).videoWidth) { imw = (media as HTMLVideoElement).videoWidth; imh = (media as HTMLVideoElement).videoHeight; }
              const isc = Math.min(rect.width / imw, rect.height / imh) * R.rZoom.current;
              const pan = R.rPanOffset.current;
              const iox = (rect.width - imw * isc) / 2 + pan.x, ioy = (rect.height - imh * isc) / 2 + pan.y;
              S.setSpellMenu({ points: [ix], cx: rect.left + iox + ix.x * isc, cy: rect.top + ioy + ix.y * isc, mode: 'area' });
              break;
            }
          }
        }
      }
      return;
    }

    if (R.isDrawingRef.current && (tool === 'pen' || tool === 'eraser')) {
      const oc = R.drawCanvasRef.current; if (!oc) return;
      const ctx2 = oc.getContext('2d')!;
      const last = R.lastDrawRef.current || { mx, my };
      if (tool === 'pen') {
        ctx2.globalCompositeOperation = 'source-over';
        ctx2.strokeStyle = R.rDrawColor.current; ctx2.lineWidth = R.rDrawSize.current;
        ctx2.lineCap = 'round'; ctx2.lineJoin = 'round';
        ctx2.beginPath(); ctx2.moveTo(last.mx, last.my); ctx2.lineTo(mx, my); ctx2.stroke();
      } else {
        ctx2.globalCompositeOperation = 'destination-out';
        ctx2.beginPath(); ctx2.arc(mx, my, R.rDrawSize.current * 4, 0, Math.PI * 2); ctx2.fill();
        ctx2.globalCompositeOperation = 'source-over';
      }
      R.lastDrawRef.current = { mx, my }; R.drawChangedRef.current = true;
      R.currentStrokeRef.current.push({ x: mx, y: my }); return;
    }

    if (!R.dragRef.current) return;
    if (R.pendingDeselectRef.current) {
      const pd = R.pendingDeselectRef.current;
      if (Math.hypot(mx - pd.mx, my - pd.my) > 3 / R.rZoom.current) R.pendingDeselectRef.current = null;
    }
    const { id, ox, oy } = R.dragRef.current;
    // Snap aplicat a cada token individualment (l'àncora i tots els membres del grup);
    // abans només snapava l'àncora i la resta del grup quedava desalineada de la graella.
    const snapTokenPos = (p: { x: number; y: number }, tid: number | string) => {
      if (!R.rGridSnap.current || R.rGridSize.current <= 0) return p;
      const gs = R.rGridSize.current;
      const gox = ((R.rGridOriginX.current % gs) + gs) % gs;
      const goy = ((R.rGridOriginY.current % gs) + gs) % gs;
      const snapCC = (v: number, origin: number) => Math.round((v - origin - gs / 2) / gs) * gs + origin + gs / 2;
      if (String(tid).startsWith('pl_')) {
        const Rv = R.rTokenSizeOverride.current[tid] ?? 22;
        return { x: snapCC(p.x + Rv, gox) - Rv, y: snapCC(p.y + Rv, goy) - Rv };
      }
      return { x: snapCC(p.x, gox), y: snapCC(p.y, goy) };
    };
    const np = snapTokenPos({ x: mx - ox, y: my - oy }, id);
    const nextPos = { ...R.rPos.current, [id]: np };
    if (R.groupDragRef.current) {
      for (const [sid, off] of R.groupDragRef.current) {
        nextPos[sid] = snapTokenPos({ x: mx - off.ox, y: my - off.oy }, sid);
      }
    }
    R.rPos.current = nextPos;
  }, [mc, _broadcastState]);

  const onMouseUp = useCallback((
    setPos: (v: PosMap | ((p: PosMap) => PosMap)) => void,
    snapAllTokens: () => void,
    sizeAllTokens: () => void,
    setGridSize: (v: number) => void,
    setGridOriginX: (v: number) => void,
    setGridOriginY: (v: number) => void,
    setGridCalibrating: (v: boolean) => void,
  ) => {
    R.panDragRef.current = null; R.isDrawingRef.current = false; R.lastDrawRef.current = null;

    // Finalize marquee (area) selection — collect every token whose center is inside the box
    if (R.rAreaSelectRect.current) {
      const rect = R.rAreaSelectRect.current;
      R.rAreaSelectRect.current = null;
      const left = Math.min(rect.x0, rect.x1), right = Math.max(rect.x0, rect.x1);
      const top = Math.min(rect.y0, rect.y1), bottom = Math.max(rect.y0, rect.y1);
      const dragDist = Math.hypot(rect.x1 - rect.x0, rect.y1 - rect.y0);
      // Additive: every marquee accumulates onto the existing selection
      const sel = new Set<number | string>(R.rMultiSelected.current);
      if (dragDist > 4 / R.rZoom.current) {
        const inside = (x: number, y: number) => x >= left && x <= right && y >= top && y <= bottom;
        for (const len of R.rLibEnemies.current) {
          const lep = R.rPos.current[`lib_${len.id}`] || { x: 0, y: 0 };
          if (inside(lep.x, lep.y)) sel.add(`lib_${len.id}`);
        }
        for (const pl of R.rPlayers.current) {
          const ppos = R.rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
          const pR = R.rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
          if (inside(ppos.x + pR, ppos.y + pR)) sel.add(`pl_${pl.id}`);
        }
        const st = R.rStruct.current;
        if (st) for (const room of st.enemyRooms) for (const en of room.enemies) {
          const ep = R.rPos.current[en.id]; if (!ep) continue;
          if (inside(ep.x, ep.y)) sel.add(en.id);
        }
      }
      R.rMultiSelected.current = sel;
      const last = sel.size > 0 ? [...sel][sel.size - 1] : null;
      R.rSelectedToken.current = last; S.setSelectedToken(last);
      return;
    }

    // Finalize straight-line spell
    if (R.isSpellLineDrawingRef.current) {
      R.isSpellLineDrawingRef.current = false;
      const preview = R.rSpellPreview.current;
      R.rSpellPreview.current = null;
      if (preview && preview.mode === 'line') {
        const { start, end } = preview;
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        if (dist > 5) {
          const canvas3 = R.canvasRef.current!;
          const r4 = canvas3.getBoundingClientRect();
          const media3 = R.mediaRef.current;
          let mw3 = 1920, mh3 = 1080;
          if (media3?.tagName === 'IMG' && (media3 as HTMLImageElement).naturalWidth) { mw3 = (media3 as HTMLImageElement).naturalWidth; mh3 = (media3 as HTMLImageElement).naturalHeight; }
          if (media3?.tagName === 'VIDEO' && (media3 as HTMLVideoElement).videoWidth) { mw3 = (media3 as HTMLVideoElement).videoWidth; mh3 = (media3 as HTMLVideoElement).videoHeight; }
          const sc4 = Math.min(r4.width / mw3, r4.height / mh3) * R.rZoom.current;
          const pan4 = R.rPanOffset.current;
          const ox4 = (r4.width - mw3 * sc4) / 2 + pan4.x, oy4 = (r4.height - mh3 * sc4) / 2 + pan4.y;
          const midX = (start.x + end.x) / 2, midY = (start.y + end.y) / 2;
          const cxScreen = r4.left + ox4 + midX * sc4, cyScreen = r4.top + oy4 + midY * sc4;
          S.setSpellMenu({ points: [start, end], cx: cxScreen, cy: cyScreen, mode: 'line' });
        }
      }
      R.spellLineStartRef.current = null;
      return;
    }

    if (R.rGridCalibrating.current && R.gridCalibRef.current && R.gridCalibCurrRef.current) {
      const { sx, sy } = R.gridCalibRef.current;
      const { cx, cy } = R.gridCalibCurrRef.current;
      const dx = cx - sx, dy = cy - sy;
      const sz = Math.max(8, Math.max(Math.abs(dx), Math.abs(dy)));
      const finalSz = Math.round(sz);
      const qx = dx >= 0 ? sx : sx - sz, qy = dy >= 0 ? sy : sy - sz;
      R.rGridSize.current = finalSz; setGridSize(finalSz);
      R.rGridOriginX.current = qx; setGridOriginX(qx);
      R.rGridOriginY.current = qy; setGridOriginY(qy);
      R.rGridCalibrating.current = false; setGridCalibrating(false);
      R.gridCalibRef.current = null; R.gridCalibCurrRef.current = null;
      if (R.rGridSnap.current) snapAllTokens();
      if (R.rGridAutoSize.current) sizeAllTokens();
      if (!R.rGridSnap.current && !R.rGridAutoSize.current) _broadcastState({});
      return;
    }

    if (R.zoneDragRef.current) {
      R.zoneDragRef.current = null;
      S.setPaintedZones([...R.rPaintedZones.current]);
      _broadcastState({}); return;
    }

    if (R.areaSpellDragRef.current) { R.areaSpellDragRef.current = null; _broadcastState({}); return; }

    if (R.isShapeDrawingRef.current) {
      R.isShapeDrawingRef.current = false;
      const pts = R.shapePointsRef.current;
      R.shapePointsRef.current = [];
      if (pts.length >= 3) {
        const first = pts[0], last = pts[pts.length - 1];
        const canvas = R.canvasRef.current!;
        const r2 = canvas.getBoundingClientRect();
        const m2 = R.mediaRef.current;
        let mw2 = 1920, mh2 = 1080;
        if (m2?.tagName === 'IMG' && (m2 as HTMLImageElement).naturalWidth) { mw2 = (m2 as HTMLImageElement).naturalWidth; mh2 = (m2 as HTMLImageElement).naturalHeight; }
        if (m2?.tagName === 'VIDEO' && (m2 as HTMLVideoElement).videoWidth) { mw2 = (m2 as HTMLVideoElement).videoWidth; mh2 = (m2 as HTMLVideoElement).videoHeight; }
        const sc3 = Math.min(r2.width / mw2, r2.height / mh2) * R.rZoom.current;
        const closeDist = Math.hypot((last.x - first.x) * sc3, (last.y - first.y) * sc3);
        const pan = R.rPanOffset.current;
        const ox2 = (r2.width - mw2 * sc3) / 2 + pan.x, oy2 = (r2.height - mh2 * sc3) / 2 + pan.y;
        if (closeDist < 45 && pts.length >= 8) {
          const bbox = getBBox(pts);
          S.setShapeMenu({ points: pts, bbox, cx: r2.left + ox2 + bbox.cx * sc3, cy: r2.top + oy2 + bbox.cy * sc3 });
          return;
        }
        if (closeDist >= 45) {
          const bbox2 = getBBox(pts);
          S.setSpellMenu({ points: pts, cx: r2.left + ox2 + bbox2.cx * sc3, cy: r2.top + oy2 + bbox2.cy * sc3 });
          return;
        }
      }
      _broadcastState({}); return;
    }

    if (R.dragRef.current) setPos({ ...R.rPos.current });
    if (R.pendingDeselectRef.current) {
      const { id } = R.pendingDeselectRef.current;
      R.pendingDeselectRef.current = null;
      const sel = new Set(R.rMultiSelected.current);
      sel.delete(id);
      R.rMultiSelected.current = sel;
      const next = sel.size > 0 ? [...sel][sel.size - 1] : null;
      R.rSelectedToken.current = next; S.setSelectedToken(next);
    }
    R.dragRef.current = null; S.setActiveDrag(null); R.groupDragRef.current = null;
    S.setCanvasCursor(R.rDrawTool.current === 'shape' ? WAND_CURSOR : 'default');

    if (R.drawChangedRef.current) {
      R.drawChangedRef.current = false;
      const pts = R.currentStrokeRef.current;
      R.currentStrokeRef.current = [];
      if (pts.length > 1) {
        const strokeMsg = { type: 'STROKE', points: pts, color: R.rDrawColor.current, size: R.rDrawSize.current, tool: R.rDrawTool.current };
        R.bcRef.current?.postMessage(strokeMsg);
        R.wsRef.current?.send(JSON.stringify(strokeMsg));
        R.strokeHistoryRef.current.push({ points: pts, color: R.rDrawColor.current, size: R.rDrawSize.current, tool: R.rDrawTool.current });
        S.setCanUndo(true);
      }
    }
    _broadcastState({});
  }, [mc, _broadcastState]);

  const onMouseLeaveCanvas = useCallback(() => {
    R.panDragRef.current = null;
    if (R.dragRef.current) S.setPos?.({ ...R.rPos.current });
    R.dragRef.current = null; S.setActiveDrag(null); R.groupDragRef.current = null; R.pendingDeselectRef.current = null;
    R.rHoveredRoom.current = null;
    R.rHoveredPaintedZoneId.current = null;
    R.rCursorScreenPos.current = null;
    if (R.rDrawTool.current === 'pointer') {
      R.rPointerPos.current = null;
      R.bcRef.current?.postMessage({ type: 'POINTER', pos: null });
      R.wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: null }));
    }
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { mx, my } = mc(e);
    for (let i = R.rActiveSpells.current.length - 1; i >= 0; i--) {
      const sp = R.rActiveSpells.current[i];
      if (!AREA_TYPES.has(sp.type) || !AREA_SETTLED(sp)) continue;
      const center = sp.points[sp.points.length - 1];
      const data = AREA_SPELL_DATA[sp.type as string];
      if (!center || !data) continue;
      const radius = (data.aoeRadiusFt / 5) * R.rGridSize.current;
      if (Math.hypot(mx - center.x, my - center.y) <= radius) {
        S.setContextMenu({ id: sp.id, name: `${data.emoji} ${sp.type}`, x: e.clientX, y: e.clientY, isAreaSpell: true });
        return;
      }
    }
    for (const zone of R.rPaintedZones.current) {
      if (pointInPolygon(mx, my, zone.points)) {
        const el = ELEMENTS_BY_ID.get(zone.element);
        R.rSelectedPaintedZoneId.current = zone.id;
        S.setContextMenu({ id: zone.id, name: `Zona: ${el?.label || zone.element}`, x: e.clientX, y: e.clientY, isPaintedZone: true });
        return;
      }
    }
    // Group the whole current selection fully belongs to, if any (used to offer
    // "dissoldre grup" instead of "crear grup" in the multi-select context menu).
    const groupOfSelection = (ids: (number | string)[]): string | undefined => {
      const gids = new Set(ids.map(tid => R.rTokenGroups.current.get(tid)));
      if (gids.size !== 1) return undefined;
      const gid = [...gids][0];
      if (!gid) return undefined;
      let memberCount = 0;
      for (const g of R.rTokenGroups.current.values()) if (g === gid) memberCount++;
      return memberCount === ids.length ? gid : undefined;
    };

    // If the right-clicked token is part of an active multi-selection, show the group menu instead
    const sel = R.rMultiSelected.current;
    const maybeMultiMenu = (id: number | string): boolean => {
      if (sel.size <= 1 || !sel.has(id)) return false;
      S.setContextMenu({ id, name: `${sel.size} seleccionats`, x: e.clientX, y: e.clientY, isMultiSelect: true, ids: [...sel], existingGroupId: groupOfSelection([...sel]) });
      return true;
    };

    // Check lib enemies
    for (let i = R.rLibEnemies.current.length - 1; i >= 0; i--) {
      const len = R.rLibEnemies.current[i];
      const lep = R.rPos.current[`lib_${len.id}`] || { x: 0, y: 0 };
      const lR = R.rTokenSizeOverride.current[`lib_${len.id}`] ?? len.R;
      if (Math.hypot(mx - lep.x, my - lep.y) <= lR) {
        if (maybeMultiMenu(`lib_${len.id}`)) return;
        S.setContextMenu({ id: `lib_${len.id}`, name: len.name, x: e.clientX, y: e.clientY, isLibEnemy: true, libEnemyId: len.id, tokenPos: lep, existingGroupId: R.rTokenGroups.current.get(`lib_${len.id}`) });
        return;
      }
    }
    for (let i = R.rPlayers.current.length - 1; i >= 0; i--) {
      const pl = R.rPlayers.current[i];
      const ppos = R.rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
      const pR = R.rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
      if (Math.hypot(mx - (ppos.x + pR), my - (ppos.y + pR)) <= pR + 4) {
        if (maybeMultiMenu(`pl_${pl.id}`)) return;
        S.setContextMenu({ id: `pl_${pl.id}`, name: pl.name, x: e.clientX, y: e.clientY, existingGroupId: R.rTokenGroups.current.get(`pl_${pl.id}`) }); return;
      }
    }
    const s2 = R.rStruct.current; if (!s2) return;
    for (const room of s2.enemyRooms) {
      for (let i = room.enemies.length - 1; i >= 0; i--) {
        const en = room.enemies[i];
        const ep = R.rPos.current[en.id]; if (!ep) continue;
        const Rv = R.rTokenSizeOverride.current[en.id] ?? Math.max(Math.min(en.w, en.h) / 2, 22);
        if (Math.hypot(mx - ep.x, my - ep.y) <= Rv) {
          if (maybeMultiMenu(en.id)) return;
          S.setContextMenu({ id: en.id, name: en.name, x: e.clientX, y: e.clientY, existingGroupId: R.rTokenGroups.current.get(en.id) }); return;
        }
      }
    }
    R.rSelectedPaintedZoneId.current = null;
    S.setContextMenu(null);
  }, [mc]);

  // Double click on a grouped token selects every member of its group.
  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (R.rDrawTool.current !== 'none' || R.rAreaSelectMode.current) return;
    const { mx, my } = mc(e);

    const selectGroupOrSolo = (id: number | string) => {
      const gid = R.rTokenGroups.current.get(id);
      if (gid) {
        const members = new Set<number | string>();
        for (const [tid, g] of R.rTokenGroups.current) if (g === gid) members.add(tid);
        R.rMultiSelected.current = members;
      } else {
        R.rMultiSelected.current = new Set();
      }
      R.rSelectedToken.current = id; S.setSelectedToken(id);
    };

    for (let i = R.rLibEnemies.current.length - 1; i >= 0; i--) {
      const len = R.rLibEnemies.current[i];
      const lep = R.rPos.current[`lib_${len.id}`] || { x: 0, y: 0 };
      const lR = R.rTokenSizeOverride.current[`lib_${len.id}`] ?? len.R;
      if (Math.hypot(mx - lep.x, my - lep.y) <= lR) { selectGroupOrSolo(`lib_${len.id}`); return; }
    }
    for (let i = R.rPlayers.current.length - 1; i >= 0; i--) {
      const pl = R.rPlayers.current[i];
      const ppos = R.rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
      const pR = R.rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
      if (Math.hypot(mx - (ppos.x + pR), my - (ppos.y + pR)) <= pR + 4) { selectGroupOrSolo(`pl_${pl.id}`); return; }
    }
    const s3 = R.rStruct.current;
    if (s3) {
      for (const room of s3.enemyRooms) {
        for (let i = room.enemies.length - 1; i >= 0; i--) {
          const en = room.enemies[i];
          const ep = R.rPos.current[en.id]; if (!ep) continue;
          const Rv = R.rTokenSizeOverride.current[en.id] ?? Math.max(Math.min(en.w, en.h) / 2, 22);
          if (Math.hypot(mx - ep.x, my - ep.y) <= Rv) { selectGroupOrSolo(en.id); return; }
        }
      }
    }
  }, [mc]);

  return { onMouseDown, onMouseMove, onMouseUp, onMouseLeaveCanvas, onContextMenu, onDoubleClick, mc };
}
