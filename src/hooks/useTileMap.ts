'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { DMRefs } from './useDMRefs';
import type { Wall, Room, Door, LightSource } from '@/types';
import { TILE, emptyTileMap, cloneTileMap, fitTileMap, type TileMap, type TileFit } from '@/lib/tilemap/model';
import { applyBrush, rectCells, lineCells, isRectBrush, type TileBrush, type Cell } from '@/lib/tilemap/editor';
import { bakeTileMap, repaintCells, tileLiveOf } from '@/lib/tilemap/render';
import { tileWalls, tileDoors, tileLights, tileRoomFaces, extendRoomFace, hidePatches, pruneNoRoom } from '@/lib/tilemap/geometry';
import { getBBox } from '@/lib/geometry';
import { parseTmx } from '@/lib/tilemap/tmx';
import { objectAt, objectCells, anchorCenter, placeObjectAt } from '@/lib/tilemap/objects';
import {
  itemAt, refreshItem, layerOpsFor, applyLayerOp, rotateItem, removeItem, pruneOverlays,
  type TileItem, type LayerOp,
} from '@/lib/tilemap/layers';

/** Menú del clic dret sobre un objecte o un decorat (posició de pantalla i què es pot fer). */
export interface TileMenuState { x: number; y: number; item: TileItem; ops: Record<LayerOp, boolean> }
export type TileMenuAction = LayerOp | 'rotate' | 'delete';
import { detectRooms, reconcileRooms } from '@/lib/rooms/detect';
import { pruneDoors } from '@/lib/rooms/doors';

interface Deps {
  setWalls: (v: Wall[]) => void;
  setRooms: (v: Room[]) => void;
  setDoors: (v: Door[]) => void;
  setLights: (v: LightSource[]) => void;
  setGrid: (gs: number) => void;
  loadBg: (f: File) => Promise<void>;
  replaceBgImage: (b: Blob) => Promise<boolean>;
  /** Mou tot el contingut del mapa quan el llenç es reajusta (veure `shiftWorld`). */
  shiftWorld: (dc: number, dr: number, from: { cols: number; w: number; h: number }, to: { cols: number; w: number; h: number }) => void;
  /** Afegeix passos al desfer/refer de l'última ordre apilada. */
  extendLastUndo: (extra: { undo: () => void; redo: () => void }) => void;
  broadcast: (extra?: Record<string, unknown>) => void;
  pushMapEdit: (label: string) => void;
  /** Criatures d'un `.tmx`: s'afegeixen com a enemics de la biblioteca. */
  addCreatures: (list: { name: string; x: number; y: number }[]) => void;
  /** Hi ha mapa de caselles (per a la UI). */
  setHasTileMap: (v: boolean) => void;
  /** Obre el menú de capes (clic dret sobre un objecte o un decorat). */
  openTileMenu: (menu: TileMenuState) => void;
}

/** Parts vives del mapa més el que cal amagar de les peces que sobresurten de les sales (`hidePatches`). */
const liveOf = (m: TileMap, rooms: Room[]) => ({ ...tileLiveOf(m), hide: hidePatches(m, rooms.map(r => r.points)) });

/** Retard del cuinat després d'un traç: el DM veu el canvi a l'instant (cuinat local), els jugadors en rebre'l. */
const BAKE_DEBOUNCE = 350;

/**
 * Mapa de caselles al DM: crear-lo, editar-lo amb l'eina Caselles, cuinar-lo com a fons i
 * mantenir al dia la geometria que se'n deriva (parets, portes, llums, sales).
 */
export function useTileMap(R: DMRefs, D: Deps) {
  const bakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Dref = useRef(D);
  useEffect(() => { Dref.current = D; });

  /** Parets, portes, llums i sales a partir del mapa (les dibuixades a mà es conserven). */
  const regenGeometry = useCallback(() => {
    const m = R.rTileMap.current;
    const d = Dref.current;
    const manualWalls = R.rWalls.current.filter(w => !w.tile);
    const manualDoors = R.rDoors.current.filter(x => !x.id.startsWith('td_'));
    const manualLights = R.rLights.current.filter(l => !l.id.startsWith('tl_'));
    let walls = manualWalls, doors = manualDoors, lights = manualLights;
    if (m) {
      const gen = tileWalls(m);
      walls = [...manualWalls, ...gen.walls.map(w => ({ ...w, tile: true }))];
      doors = [...manualDoors, ...tileDoors(gen.doorSegs, R.rDoors.current)];
      lights = [...manualLights, ...tileLights(m)];
    }
    // Amb mapa de caselles, cada sala s'emporta les cares de paret que hi miren (es foscaran amb ella).
    const faces = m ? tileRoomFaces(m, detectRooms(walls)) : detectRooms(walls);
    const rooms = reconcileRooms(R.rRooms.current, faces);
    doors = pruneDoors(walls, doors);
    R.rWalls.current = walls; d.setWalls(walls);
    R.rRooms.current = rooms; d.setRooms(rooms);
    R.rDoors.current = doors; d.setDoors(doors);
    R.rLights.current = lights; d.setLights(lights);
    R.rTileLive.current = m ? liveOf(m, rooms) : null;
    d.broadcast({});
  }, [R]);

  /** Cuina el mapa sencer i el posa de fons (la primera vegada, com un mapa nou). */
  const bakeAll = useCallback(async (first: boolean) => {
    const m = R.rTileMap.current; if (!m) return;
    const cv = bakeTileMap(m); if (!cv) return;
    R.rTileCanvas.current = cv;
    const blob = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/png'));
    if (!blob || R.rTileCanvas.current !== cv) return;   // un cuinat més nou ja el substitueix
    if (first || !(await Dref.current.replaceBgImage(blob))) {
      await Dref.current.loadBg(new File([blob], 'mapa de caselles.png', { type: 'image/png' }));
    }
  }, [R]);

  /** Envia el cuinat (ja repintat per caselles) com a fons nou, amb un petit retard. */
  const scheduleSend = useCallback(() => {
    if (bakeTimer.current) clearTimeout(bakeTimer.current);
    bakeTimer.current = setTimeout(async () => {
      bakeTimer.current = null;
      const cv = R.rTileCanvas.current; if (!cv) return;
      const blob = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/png'));
      if (blob) await Dref.current.replaceBgImage(blob);
    }, BAKE_DEBOUNCE);
  }, [R]);

  // Desfer / carregar partida: el mapa ha canviat per fora de l'editor.
  useEffect(() => {
    R.rTileRegen.current = regenGeometry;
    R.rTileRestore.current = (opts) => {
      const m = R.rTileMap.current;
      R.rTileSel.current = null;   // els índexs dels objectes ja no valen
      Dref.current.setHasTileMap(!!m);
      if (!m) { R.rTileCanvas.current = null; R.rTileLive.current = null; return; }
      if (opts?.rebake === false) {
        R.rTileCanvas.current = bakeTileMap(m);
        // Partides desades abans de la v5.20: les sales no portaven les cares de paret.
        const rooms = R.rRooms.current;
        const ext = rooms.map(r => { const p = extendRoomFace(m, r.points); return p === r.points ? r : { ...r, points: p, bbox: getBBox(p) }; });
        if (ext.some((r, i) => r !== rooms[i])) { R.rRooms.current = ext; Dref.current.setRooms(ext); }
        R.rTileLive.current = liveOf(m, R.rRooms.current);
        return;
      }
      const cv = bakeTileMap(m);
      if (cv && R.rTileCanvas.current && cv.width === R.rTileCanvas.current.width && cv.height === R.rTileCanvas.current.height) {
        R.rTileCanvas.current = cv; scheduleSend();
      } else void bakeAll(false);
      regenGeometry();
    };
  }, [R, bakeAll, regenGeometry, scheduleSend]);

  const adoptMap = useCallback(async (m: TileMap) => {
    R.rTileMap.current = m;
    Dref.current.setHasTileMap(true);
    // La graella del mapa és la de les caselles: 48 px, origen a la cantonada.
    Dref.current.setGrid(TILE);
    await bakeAll(true);
    regenGeometry();
  }, [R, bakeAll, regenGeometry]);

  /** Mapa de caselles nou, buit (negre): es comença pintant sales. */
  const createTileMap = useCallback((cols: number, rows: number) => adoptMap(emptyTileMap(cols, rows)), [adoptMap]);

  /** Importa un `.tmx` de Tiled. Les criatures de les capes de criatures passen a tokens. */
  const importTmx = useCallback(async (file: File) => {
    const { map, creatures } = await parseTmx(await file.text());
    await adoptMap(map);
    if (creatures.length) Dref.current.addCreatures(creatures.map(c => ({ name: c.name, x: (c.c + 0.5) * TILE, y: (c.r + 0.5) * TILE })));
  }, [adoptMap]);

  // ── Eina Caselles (ratolí) ──────────────────────────────────────────────────
  const cellAt = (mx: number, my: number): Cell => ({ c: Math.floor(mx / TILE), r: Math.floor(my / TILE) });

  const paint = useCallback((cells: Cell[], brush: TileBrush) => {
    const drag = R.rTileDrag.current; if (!drag) return;
    const m = R.rTileMap.current; if (!m) return;
    // La còpia es fa un sol cop per traç (el desfer guarda `drag.before`, el d'abans).
    const work = m === drag.before ? cloneTileMap(m) : m;
    const touched = applyBrush(work, brush, cells);
    R.rTileMap.current = work;
    if (R.rTileCanvas.current && touched.length) repaintCells(R.rTileCanvas.current, work, touched);
  }, [R]);

  /**
   * Pinzell «Moure»: l'objecte agafat va on és el cursor, al píxel (fora de la graella). Amb Maj,
   * el centre de l'àncora s'enganxa al centre de la casella (torna a la graella).
   */
  const moveObject = useCallback((mx: number, my: number, snap: boolean) => {
    const drag = R.rTileDrag.current, mv = drag?.move; if (!drag || !mv) return;
    const m = R.rTileMap.current; if (!m) return;
    const o = m.objects[mv.idx]; if (!o) return;
    let x = mx - mv.gx, y = my - mv.gy;
    if (snap) { x = (Math.floor(x / TILE) + 0.5) * TILE; y = (Math.floor(y / TILE) + 0.5) * TILE; }
    const next = placeObjectAt(m, o, x, y);
    if (next.c === o.c && next.r === o.r && next.ox === o.ox && next.oy === o.oy) return;
    const work = m === drag.before ? cloneTileMap(m) : m;
    work.objects[mv.idx] = next;
    R.rTileMap.current = work;
    // Les caselles d'on surt i les d'on arriba.
    if (R.rTileCanvas.current) repaintCells(R.rTileCanvas.current, work, [...objectCells(work, o, 'overlap'), ...objectCells(work, next, 'overlap')]);
  }, [R]);

  const tileMove = useCallback((mx: number, my: number, shift = false) => {
    const cell = cellAt(mx, my);
    R.rTileHover.current = cell;
    R.rTileHoverPx.current = { x: mx, y: my };
    const drag = R.rTileDrag.current; if (!drag) return;
    if (drag.move) { moveObject(mx, my, shift); return; }
    if (cell.c === drag.last.c && cell.r === drag.last.r) return;
    drag.menu = undefined;   // ja no és un clic: esborra (la línia de sota inclou la casella d'on ha sortit)
    if (!drag.rect) paint(lineCells(drag.last, cell), drag.erase ? { kind: 'erase' } : R.rTileBrush.current);
    drag.last = cell;
  }, [R, paint, moveObject]);

  /** Posa el llenç ajustat (mapa nou, contingut mogut, fons cuinat a la mida nova). */
  const applyFit = useCallback((fit: TileFit, before: TileMap) => {
    const sz = (m: TileMap) => ({ cols: m.cols, w: m.cols * TILE, h: m.rows * TILE });
    Dref.current.shiftWorld(fit.dc, fit.dr, sz(before), sz(fit.map));
    R.rTileMap.current = fit.map;
    Dref.current.setHasTileMap(true);
    regenGeometry();
    void bakeAll(false);
  }, [R, regenGeometry, bakeAll]);

  /**
   * Tanca una edició del mapa: `R.rTileMap` ja té el mapa nou (i el cuinat local, repintat) i
   * `before` és el d'abans. Entrada de desfer, geometria nova, llenç ajustat i fons als jugadors.
   */
  const commit = useCallback((before: TileMap, label: string) => {
    // Desfer: l'entrada guarda el mapa d'abans (i les parets/portes/llums d'abans).
    const after = R.rTileMap.current;
    if (!after) return;
    pruneOverlays(after);   // la còpia és d'aquesta edició: es pot tocar
    pruneNoRoom(after);     // sales eliminades que ja no cauen a terra
    R.rTileMap.current = before;
    Dref.current.pushMapEdit(label);
    R.rTileMap.current = after;
    regenGeometry();
    // El llenç és sempre la zona pintada + el marge: si ha canviat, s'ajusta (i es mou tot).
    const fit = fitTileMap(after);
    if (fit) {
      applyFit(fit, after);
      const sz = (m: TileMap) => ({ cols: m.cols, w: m.cols * TILE, h: m.rows * TILE });
      Dref.current.extendLastUndo({
        // Desfer: tot torna al marc d'abans del reajust; l'ordre de pintar ja farà la resta.
        undo: () => { Dref.current.shiftWorld(-fit.dc, -fit.dr, sz(fit.map), sz(after)); R.rTileMap.current = after; },
        redo: () => applyFit(fit, after),
      });
    } else scheduleSend();
  }, [R, regenGeometry, scheduleSend, applyFit]);

  const tileUp = useCallback(() => {
    const drag = R.rTileDrag.current; if (!drag) return false;
    if (drag.rect) {
      const brush = drag.erase ? { kind: 'erase' as const } : R.rTileBrush.current;
      // Rectangle amb un pinzell normal (Maj) = omplir-lo; l'eina Sala fa vora de paret.
      paint(rectCells(drag.start, drag.last), brush);
    }
    R.rTileDrag.current = null;
    if (drag.menu) {
      // Clic dret sense arrossegar sobre un objecte o un decorat: menú de capes.
      const m = R.rTileMap.current, it = m && refreshItem(m, drag.menu.item);
      if (m && it) Dref.current.openTileMenu({ x: drag.menu.sx, y: drag.menu.sy, item: it, ops: layerOpsFor(m, it) });
      return true;
    }
    if (R.rTileMap.current === drag.before) return true;   // no ha canviat res
    commit(drag.before, drag.move ? 'moure un objecte' : 'pintar caselles');
    return true;
  }, [R, paint, commit]);

  /**
   * Canvia un sol element (menú de capes, girar): còpia del mapa, canvi, repintat i un pas del desfer.
   * `false` si l'element ja no hi és o no ha canviat res.
   */
  const editItem = useCallback((item: TileItem, label: string, fn: (work: TileMap, it: TileItem) => number[] | null): boolean => {
    const m = R.rTileMap.current;
    if (!m || R.rTileDrag.current) return false;
    const it = refreshItem(m, item); if (!it) return false;
    const work = cloneTileMap(m);
    const touched = fn(work, it);
    if (!touched) return false;
    R.rTileMap.current = work;
    if (fn === removeItem) R.rTileSel.current = null;   // els índexs dels objectes canvien
    if (R.rTileCanvas.current) repaintCells(R.rTileCanvas.current, work, touched);
    commit(m, label);
    return true;
  }, [R, commit]);

  /** Gira 90° l'objecte o el decorat del punt (px de mapa); si no n'hi ha cap, l'objecte triat amb «Moure». */
  const rotateAt = useCallback((x: number, y: number): boolean => {
    const m = R.rTileMap.current; if (!m) return false;
    const sel = R.rTileSel.current;
    const item = itemAt(m, x, y) ?? (sel != null && m.objects[sel] ? { kind: 'object' as const, idx: sel, obj: m.objects[sel] } : null);
    if (!item) return false;
    return editItem(item, item.kind === 'object' ? 'girar un objecte' : 'girar un decorat', rotateItem);
  }, [R, editItem]);
  const tileDown = useCallback((mx: number, my: number, erase: boolean, shift: boolean, sx = 0, sy = 0) => {
    const m = R.rTileMap.current; if (!m) return;
    const cell = cellAt(mx, my);
    const brush = erase ? { kind: 'erase' as const } : R.rTileBrush.current;
    // Clic dret sobre un objecte o un decorat: si no s'arrossega, menú de capes (en deixar anar);
    // si s'arrossega, esborra com sempre (també la casella d'on ha sortit).
    if (erase && !shift) {
      const item = itemAt(m, mx, my);
      if (item) { R.rTileDrag.current = { start: cell, last: cell, erase, rect: false, before: m, menu: { item, sx, sy } }; return; }
    }
    if (brush.kind === 'rotate') { rotateAt(mx, my); return; }
    if (brush.kind === 'move') {
      // Clic a un objecte: el tria (la R el gira) i es pot arrossegar. Clic en buit: cap triat.
      const idx = objectAt(m, mx, my);
      R.rTileSel.current = idx >= 0 ? idx : null;
      if (idx < 0) return;
      const a = anchorCenter(m.objects[idx]);
      R.rTileDrag.current = { start: cell, last: cell, erase: false, rect: false, before: m, move: { idx, gx: mx - a.x, gy: my - a.y } };
      return;
    }
    R.rTileSel.current = null;   // pintar o esborrar pot treure objectes: els índexs canvien
    const rect = isRectBrush(brush) || shift;
    R.rTileDrag.current = { start: cell, last: cell, erase, rect, before: m };
    if (!rect) paint([cell], brush);
  }, [R, paint, rotateAt]);


  /** Tecla R: gira el que hi ha sota el cursor (o l'objecte triat). */
  const rotateUnderCursor = useCallback((): boolean => {
    const p = R.rTileHoverPx.current;
    return rotateAt(p?.x ?? -1, p?.y ?? -1);
  }, [R, rotateAt]);

  /** Mantenir premut (pantalla tàctil): el menú de capes de l'element del punt, si n'hi ha. */
  const tileMenuAt = useCallback((mx: number, my: number, sx: number, sy: number): boolean => {
    const m = R.rTileMap.current; if (!m) return false;
    const it = itemAt(m, mx, my); if (!it) return false;
    Dref.current.openTileMenu({ x: sx, y: sy, item: it, ops: layerOpsFor(m, it) });
    return true;
  }, [R]);

  /** Una ordre del menú de capes. */
  const tileMenuAction = useCallback((item: TileItem, a: TileMenuAction): boolean => {
    const what = item.kind === 'object' ? 'un objecte' : 'un decorat';
    if (a === 'rotate') return editItem(item, `girar ${what}`, rotateItem);
    if (a === 'delete') return editItem(item, `esborrar ${what}`, removeItem);
    const label = { front: 'portar al davant', forward: 'portar endavant', backward: 'enviar enrere', back: 'enviar al fons' }[a];
    return editItem(item, `${label} ${what}`, (w, it) => applyLayerOp(w, it, a));
  }, [editItem]);

  const tileLeave = useCallback(() => { R.rTileHover.current = null; R.rTileHoverPx.current = null; }, [R]);

  return { createTileMap, importTmx, tileDown, tileMove, tileUp, tileLeave, bakeAll, rotateUnderCursor, tileMenuAt, tileMenuAction };
}
