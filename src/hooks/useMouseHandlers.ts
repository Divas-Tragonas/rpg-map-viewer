'use client';
import { useCallback } from 'react';
import { pointInPolygon, getBBox } from '@/lib/geometry';
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

function mapCoords(e: React.MouseEvent | MouseEvent, canvas: HTMLCanvasElement, media: HTMLImageElement | HTMLVideoElement | null, rZoom: { current: number }, rPanOffset: { current: { x: number; y: number } }, dmLocalPan: { current: { x: number; y: number } }, dmLocalZoom: { current: number }) {
  const r = canvas.getBoundingClientRect();
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
  const mc = useCallback((e: React.MouseEvent | MouseEvent) => {
    return mapCoords(e, R.canvasRef.current!, R.mediaRef.current, R.rZoom, R.rPanOffset, R.dmLocalPan, R.dmLocalZoom);
  }, []);

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
      const rect0 = R.canvasRef.current!.getBoundingClientRect();
      R.rCursorScreenPos.current = { x: e.clientX - rect0.left, y: e.clientY - rect0.top };
    }
    if (R.panDragRef.current) {
      const { startX, startY, startPanX, startPanY, private: isPrivate } = R.panDragRef.current;
      const nx = startPanX + (e.clientX - startX), ny = startPanY + (e.clientY - startY);
      if (isPrivate) {
        R.dmLocalPan.current = { x: nx, y: ny }; S.setDmPrivateActive(true);
        const now = Date.now();
        if (now - R.dmPreviewBcastRef.current > 48) { R.dmPreviewBcastRef.current = now; _broadcastState({}); }
      } else { R.rPanOffset.current = { x: nx, y: ny }; _broadcastState({}); }
      return;
    }

    const { mx, my } = mc(e);

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
      const rect2 = R.canvasRef.current!.getBoundingClientRect();
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
      if (Math.hypot(mx - last.x, my - last.y) > 3 / R.rZoom.current) {
        R.shapePointsRef.current = [...pts, { x: mx, y: my }];
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
    let np = { x: mx - ox, y: my - oy };
    if (R.rGridSnap.current && R.rGridSize.current > 0) {
      const gs = R.rGridSize.current;
      const gox = ((R.rGridOriginX.current % gs) + gs) % gs;
      const goy = ((R.rGridOriginY.current % gs) + gs) % gs;
      const snapCC = (v: number, origin: number) => Math.round((v - origin - gs / 2) / gs) * gs + origin + gs / 2;
      if (String(id).startsWith('pl_')) {
        const Rv = R.rTokenSizeOverride.current[id] ?? 22;
        np = { x: snapCC(np.x + Rv, gox) - Rv, y: snapCC(np.y + Rv, goy) - Rv };
      } else {
        np = { x: snapCC(np.x, gox), y: snapCC(np.y, goy) };
      }
    }
    const nextPos = { ...R.rPos.current, [id]: np };
    if (R.groupDragRef.current) {
      for (const [sid, off] of R.groupDragRef.current) {
        nextPos[sid] = { x: mx - off.ox, y: my - off.oy };
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
    // If the right-clicked token is part of an active multi-selection, show the group menu instead
    const sel = R.rMultiSelected.current;
    const maybeMultiMenu = (id: number | string): boolean => {
      if (sel.size <= 1 || !sel.has(id)) return false;
      S.setContextMenu({ id, name: `${sel.size} seleccionats`, x: e.clientX, y: e.clientY, isMultiSelect: true, ids: [...sel] });
      return true;
    };

    // Check lib enemies
    for (let i = R.rLibEnemies.current.length - 1; i >= 0; i--) {
      const len = R.rLibEnemies.current[i];
      const lep = R.rPos.current[`lib_${len.id}`] || { x: 0, y: 0 };
      const lR = R.rTokenSizeOverride.current[`lib_${len.id}`] ?? len.R;
      if (Math.hypot(mx - lep.x, my - lep.y) <= lR) {
        if (maybeMultiMenu(`lib_${len.id}`)) return;
        S.setContextMenu({ id: `lib_${len.id}`, name: len.name, x: e.clientX, y: e.clientY, isLibEnemy: true, libEnemyId: len.id, tokenPos: lep });
        return;
      }
    }
    for (let i = R.rPlayers.current.length - 1; i >= 0; i--) {
      const pl = R.rPlayers.current[i];
      const ppos = R.rPos.current[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
      const pR = R.rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
      if (Math.hypot(mx - (ppos.x + pR), my - (ppos.y + pR)) <= pR + 4) {
        if (maybeMultiMenu(`pl_${pl.id}`)) return;
        S.setContextMenu({ id: `pl_${pl.id}`, name: pl.name, x: e.clientX, y: e.clientY }); return;
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
          S.setContextMenu({ id: en.id, name: en.name, x: e.clientX, y: e.clientY }); return;
        }
      }
    }
    R.rSelectedPaintedZoneId.current = null;
    S.setContextMenu(null);
  }, [mc]);

  return { onMouseDown, onMouseMove, onMouseUp, onMouseLeaveCanvas, onContextMenu, mc };
}
