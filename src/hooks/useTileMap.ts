'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { DMRefs } from './useDMRefs';
import type { Wall, Room, Door, LightSource } from '@/types';
import { TILE, emptyTileMap, cloneTileMap, type TileMap } from '@/lib/tilemap/model';
import { applyBrush, rectCells, lineCells, isRectBrush, type TileBrush, type Cell } from '@/lib/tilemap/editor';
import { bakeTileMap, repaintCells, tileLiveOf } from '@/lib/tilemap/render';
import { tileWalls, tileDoors, tileLights, keepRoomFace } from '@/lib/tilemap/geometry';
import { parseTmx } from '@/lib/tilemap/tmx';
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
  broadcast: (extra?: Record<string, unknown>) => void;
  pushMapEdit: (label: string) => void;
  /** Criatures d'un `.tmx`: s'afegeixen com a enemics de la biblioteca. */
  addCreatures: (list: { name: string; x: number; y: number }[]) => void;
  /** Hi ha mapa de caselles (per a la UI). */
  setHasTileMap: (v: boolean) => void;
}

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
    const faces = detectRooms(walls).filter(f => !m || keepRoomFace(m, f));
    const rooms = reconcileRooms(R.rRooms.current, faces);
    doors = pruneDoors(walls, doors);
    R.rWalls.current = walls; d.setWalls(walls);
    R.rRooms.current = rooms; d.setRooms(rooms);
    R.rDoors.current = doors; d.setDoors(doors);
    R.rLights.current = lights; d.setLights(lights);
    R.rTileLive.current = m ? tileLiveOf(m) : null;
    d.broadcast({});
  }, [R]);

  /** Cuina el mapa sencer i el posa de fons (la primera vegada, com un mapa nou). */
  const bakeAll = useCallback(async (first: boolean) => {
    const m = R.rTileMap.current; if (!m) return;
    const cv = bakeTileMap(m); if (!cv) return;
    R.rTileCanvas.current = cv;
    const blob = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/png'));
    if (!blob) return;
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
    R.rTileRestore.current = (opts) => {
      const m = R.rTileMap.current;
      Dref.current.setHasTileMap(!!m);
      if (!m) { R.rTileCanvas.current = null; R.rTileLive.current = null; return; }
      if (opts?.rebake === false) {
        R.rTileCanvas.current = bakeTileMap(m);
        R.rTileLive.current = tileLiveOf(m);
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

  const tileDown = useCallback((mx: number, my: number, erase: boolean, shift: boolean) => {
    const m = R.rTileMap.current; if (!m) return;
    const cell = cellAt(mx, my);
    const brush = erase ? { kind: 'erase' as const } : R.rTileBrush.current;
    const rect = isRectBrush(brush) || shift;
    R.rTileDrag.current = { start: cell, last: cell, erase, rect, before: m };
    if (!rect) paint([cell], brush);
  }, [R, paint]);

  const tileMove = useCallback((mx: number, my: number) => {
    const cell = cellAt(mx, my);
    R.rTileHover.current = cell;
    const drag = R.rTileDrag.current; if (!drag) return;
    if (cell.c === drag.last.c && cell.r === drag.last.r) return;
    if (!drag.rect) paint(lineCells(drag.last, cell), drag.erase ? { kind: 'erase' } : R.rTileBrush.current);
    drag.last = cell;
  }, [R, paint]);

  const tileUp = useCallback(() => {
    const drag = R.rTileDrag.current; if (!drag) return false;
    if (drag.rect) {
      const brush = drag.erase ? { kind: 'erase' as const } : R.rTileBrush.current;
      // Rectangle amb un pinzell normal (Maj) = omplir-lo; l'eina Sala fa vora de paret.
      paint(rectCells(drag.start, drag.last), brush);
    }
    R.rTileDrag.current = null;
    if (R.rTileMap.current === drag.before) return true;   // no ha canviat res
    // Desfer: l'entrada guarda el mapa d'abans (i les parets/portes/llums d'abans).
    const after = R.rTileMap.current;
    R.rTileMap.current = drag.before;
    Dref.current.pushMapEdit('pintar caselles');
    R.rTileMap.current = after;
    regenGeometry();
    scheduleSend();
    return true;
  }, [R, paint, regenGeometry, scheduleSend]);

  const tileLeave = useCallback(() => { R.rTileHover.current = null; }, [R]);

  return { createTileMap, importTmx, tileDown, tileMove, tileUp, tileLeave, bakeAll };
}
