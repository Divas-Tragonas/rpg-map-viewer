'use client';
import { useCallback, useRef } from 'react';
import { pointInPolygon, getBBox, segmentsIntersect, segmentIntersection } from '@/lib/geometry';
import { nearestWallHit, doorEndOnWall, doorAt } from '@/lib/rooms/doors';
import { vertexAt, wallsAtVertex, moveVertex, wallAt } from '@/lib/rooms/walls';
import { ELEMENTS_BY_ID, WAND_CURSOR, AREA_SPELL_DATA, SPELL_BY_TYPE, PERSISTENT_SPELLS, spellRangeFt } from '@/constants';
import { aimSpell, aimAttack, spellAimPoint } from '@/lib/spellcast';
import { gridOf, snapTokenCenter } from '@/lib/rules/cells';
import { cellAt, cellKey, paintCell } from '@/lib/rules/terrain';
import { tokenMenuFor } from '@/lib/token-menu';
import { tokenAt, tokenBounds, updateTokenSpread, clearTokenSpread } from '@/lib/render/token-geom';

const AREA_TYPES = PERSISTENT_SPELLS;
const AREA_SETTLED = (sp: import('@/types').Spell) => {
  const DUR: Record<string, number> = { sleep: 3.0, grease: 3.5 };
  return (performance.now() - sp.startTime) / 1000 > (DUR[sp.type] ?? 2.5);
};
import type { ContextMenuState, PosMap, Wall, StrokeData } from '@/types';
import type { DMRefs } from './useDMRefs';

/**
 * Eina Terreny: marca (o esborra) com a terreny difícil la casella de la graella sota el
 * cursor. Retorna si ha canviat res (per enviar el STATE només llavors).
 */
function paintTerrainAt(R: DMRefs, mx: number, my: number, erase: boolean): boolean {
  const gs = R.rGridSize.current;
  if (gs <= 0) return false;
  const gox = ((R.rGridOriginX.current % gs) + gs) % gs;
  const goy = ((R.rGridOriginY.current % gs) + gs) % gs;
  const next = paintCell(R.rDifficult.current, cellKey(...cellAt({ x: mx, y: my }, gs, gox, goy)), erase);
  if (next === R.rDifficult.current) return false;
  R.rDifficult.current = next;
  return true;
}

/** Treu la màgia que esperava el clic de destí (i la seva previsualització). */
function cancelPendingSpell(R: DMRefs): void {
  R.rAreaPlacementPending.current = null; R.rAttackPending.current = null; R.rSpellPreview.current = null;
}

interface MouseHandlerSetters {
  setPos: (v: PosMap | ((p: PosMap) => PosMap)) => void;
  setActiveDrag: (v: string | number | null) => void;
  setSelectedToken: (v: string | number | null) => void;
  setShapeMenu: (v: { points: { x: number; y: number }[]; bbox: import('@/types').BBox; cx: number; cy: number } | null) => void;
  setSpellMenu: (v: import('@/types').SpellMenuState | null) => void;
  setActiveSpells: (v: import('@/types').Spell[]) => void;
  setPaintedZones: (v: import('@/types').PaintedZone[]) => void;
  setContextMenu: (v: import('@/types').ContextMenuState | null) => void;
  onUndoChange: () => void;
  setDmPrivateActive: (v: boolean) => void;
  setCanvasCursor: (c: string) => void;
  setWalls: (v: import('@/types').Wall[]) => void;
  setRooms: (v: import('@/types').Room[]) => void;
  redetectRooms: () => void;
  addDoor: (a: { x: number; y: number }, b: { x: number; y: number }) => void;
  removeDoor: (id: string) => void;
  toggleDoor: (id: string) => void;
  addLight: (x: number, y: number) => void;
  removeLight: (id: string) => void;
  selectLight: (id: string | null) => void;
  setLights: (v: import('@/types').LightSource[]) => void;
  /** Desa l'estat del mapa a l'historial abans d'un canvi (Ctrl+Z de parets/sales/llums). */
  pushMapEdit: (label: string) => void;
  /** Revela o amaga una sala fosca (desfeible). */
  setRoomRevealed: (id: string, revealed: boolean) => void;
  /** Desfer: en prémer s'arma l'ordre (captura l'«abans»), en deixar anar s'apila si ha canviat res. */
  beginTokenDrag: (keys: string[]) => void;
  beginMapGesture: (label: string) => void;
  beginZoneDrag: () => void;
  endUndoGesture: () => void;
  /** Hi ha un arrossegament del mapa en curs (el DM hi posa el cursor de mà tancada). */
  setPanning: (v: boolean) => void;
  /** Eina Caselles (estil Píxel): pintar i esborrar al mapa de caselles. Veure `useTileMap`. */
  tileTool?: {
    /** `sx`/`sy`: posició de pantalla (on s'obre el menú de capes del clic dret). */
    down: (mx: number, my: number, erase: boolean, shift: boolean, sx: number, sy: number) => void;
    /** `shift`: amb el pinzell «Moure», l'objecte s'enganxa a la casella. */
    move: (mx: number, my: number, shift?: boolean) => void;
    up: () => boolean;
    leave: () => void;
    /** Mantenir premut a la pantalla tàctil: menú de capes de l'element del punt. */
    menu: (mx: number, my: number, sx: number, sy: number) => boolean;
  };
  notify: import('@/types').Notify;
  /** Obre el pop-up de dany al costat del token objectiu d'un atac. */
  openDamage: (p: import('@/types').DamagePrompt) => void;
  /** Gasta una peça de munició de l'atacant (token `pl_*`) en apuntar un atac que en gasta. */
  spendAmmo: (attackerKey: string, ammo: string) => void;
  /**
   * Conjur a punt de llançar-se: en combat, si toca tokens, obre el pop-up (`SpellEffectPopup`) i
   * retorna `true` (l'animació es llança en confirmar-lo). `false` = llançar-lo ara.
   */
  onSpellCast: (type: string, points: import('@/types').Point[], power?: import('@/types').CastPower) => boolean;
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

/**
 * @param commitStroke  Afegeix un traç acabat a l'historial (amb el límit de traços cuits a la
 *   base) i a la pila de desfer (`commitStroke` a `useDMActions`). Ve per paràmetre, com
 *   `_broadcastState`: aquest hook no rep l'objecte d'accions sencer.
 */
export function useMouseHandlers(R: DMRefs, S: MouseHandlerSetters, _broadcastState: BroadcastFn, commitStroke: (stroke: StrokeData) => void) {
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

  // Punt de paret amb imant: 1) s'enganxa a un vèrtex de paret existent (tancament),
  // 2) s'enganxa a l'aresta d'una paret existent si el cursor hi és a prop (unions en T,
  // tot queda "sobre rails"), 3) snap a la graella si està actiu.
  // `skip`: parets que no compten per a l'imant. En moure un vèrtex, les seves pròpies
  // parets hi són (encara) i el cursor s'hi imantaria a sobre, o sigui que no es mouria.
  const snapWall = useCallback((mx: number, my: number, sc: number, skip?: Set<Wall>) => {
    const vtol = 12 / sc;   // imant a vèrtexs
    const etol = 9 / sc;    // imant a arestes
    const walls = skip && skip.size > 0 ? R.rWalls.current.filter(w => !skip.has(w)) : R.rWalls.current;
    let best: { x: number; y: number } | null = null, bestD = vtol;
    for (const w of walls) {
      for (const v of [w.a, w.b]) {
        const d = Math.hypot(mx - v.x, my - v.y);
        if (d < bestD) { bestD = d; best = v; }
      }
    }
    if (best) return { x: best.x, y: best.y, onVertex: true };
    // Snap a la línia (projecció sobre el segment més proper dins de tolerància)
    let edge: { x: number; y: number } | null = null, edgeD = etol;
    for (const w of walls) {
      const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
      const len2 = dx * dx + dy * dy; if (len2 < 1e-6) continue;
      let t = ((mx - w.a.x) * dx + (my - w.a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const qx = w.a.x + t * dx, qy = w.a.y + t * dy;
      const d = Math.hypot(mx - qx, my - qy);
      if (d < edgeD) { edgeD = d; edge = { x: qx, y: qy }; }
    }
    if (edge) return { x: edge.x, y: edge.y, onVertex: true };
    let px = mx, py = my;
    if (R.rGridSnap.current && R.rGridSize.current > 0) {
      const gs = R.rGridSize.current;
      const gox = ((R.rGridOriginX.current % gs) + gs) % gs;
      const goy = ((R.rGridOriginY.current % gs) + gs) % gs;
      px = Math.round((px - gox) / gs) * gs + gox;
      py = Math.round((py - goy) / gs) * gs + goy;
    }
    return { x: px, y: py, onVertex: false };
  }, []);

  // Comença a arrossegar el mapa. Amb la vista privada (MAJ) activa mou només la vista del
  // DM; si no, la compartida (com sempre ha fet el botó central). `onClick` s'executa en
  // deixar anar si al final no s'ha arrossegat (veure `panDragRef`).
  const startPan = useCallback((e: React.MouseEvent, onClick?: () => void) => {
    if (R.rShiftPanToggle.current) {
      R.panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: R.dmLocalPan.current.x, startPanY: R.dmLocalPan.current.y, private: true, onClick };
    } else {
      R.panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: R.rPanOffset.current.x, startPanY: R.rPanOffset.current.y, onClick };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Botó central, o Espai + clic amb qualsevol eina: arrossegar el mapa.
    if (e.button === 1 || (e.button === 0 && R.rSpaceHeld.current)) {
      e.preventDefault();
      startPan(e);
      S.setPanning(true);
      return;
    }
    // Area (marquee) selection mode — RTS-style box select (toggled with "A").
    // Takes priority over every tool so a left-drag always rubber-bands.
    if (e.button === 0 && R.rAreaSelectMode.current) {
      const { mx: amx, my: amy } = mc(e);
      R.rAreaSelectRect.current = { x0: amx, y0: amy, x1: amx, y1: amy, add: e.ctrlKey || e.metaKey };
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
    // Atac triat al menú d'un token: el clic tria l'objectiu i tanca l'apuntat (dins o fora
    // d'abast: és només un avís). Amb qualsevol eina, com les màgies del grimori.
    if (e.button === 0 && R.rAttackPending.current) {
      const pend = R.rAttackPending.current;
      const { mx: amx, my: amy, sc: asc } = mc(e);
      const target = tokenAt(R, amx, amy, asc);
      cancelPendingSpell(R);
      // Clic sobre un altre token: pop-up de dany al seu costat (el DM hi posa el que han tret els daus).
      if (target && target.key !== pend.key) {
        if (pend.ammo) S.spendAmmo(pend.key, pend.ammo);
        const b = tokenBounds(target), toX = (x: number) => e.clientX + (x - amx) * asc, toY = (y: number) => e.clientY + (y - amy) * asc;
        // Cos a cos (amb envestida) o a distància: una llançadissa a tocar és cos a cos.
        const pv = aimAttack(R, pend, { x: amx, y: amy }, gridOf(R.rGridSize.current, R.rGridOriginX.current, R.rGridOriginY.current), asc);
        const near = pv?.mode === 'attack' && (pv.ft === null || pv.ft <= 5);
        const hitKind = pend.kind === 'ranged' ? 'ranged' as const : pend.kind === 'thrown' && !near ? 'ranged' as const : 'melee' as const;
        S.openDamage({ targetKey: target.key, label: pend.label, damageType: pend.damageType, hitKind, attackerKey: pend.key, outOfRange: pv?.mode === 'attack' && pv.zone === 'out',
          anchor: { l: toX(b.l), r: toX(b.r), t: toY(b.t), b: toY(b.b) } });
      }
      e.preventDefault(); return;
    }
    // Clic que fixa el destí d'una màgia triada (a la roda o al grimori d'un token):
    // centre de l'àrea o punta del raig, limitat a l'abast. Amb qualsevol eina: la màgia
    // del grimori es llança sense haver de canviar a l'eina Màgies.
    if (e.button === 0 && R.rAreaPlacementPending.current && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      const { mx: pmx, my: pmy, sc: psc } = mc(e);
      const { type, origin, power } = R.rAreaPlacementPending.current;
      // L'abast és un avís (vermell al cursor): el clic fixa el destí allà on és, fora d'abast també.
      // Clicada sobre un token (o la seva figureta, que a l'app Píxel queda per sobre de la casella),
      // una màgia que l'apunta (raig, con, un sol objectiu) va al centre del token: si no, el raig podia
      // no tocar-lo i les que esclaten al terra quedaven al cap o a un costat (`spellAimPoint`).
      let target = spellAimPoint(R, R.rAreaPlacementPending.current, { x: pmx, y: pmy }, psc);
      // Alè (con o línia de longitud fixa): surt del llançador cap on s'ha clicat, amb la seva llargada.
      const gsz = R.rGridSize.current;
      if (power?.lineFt && gsz > 0) {
        const dx = target.x - origin.x, dy = target.y - origin.y, d = Math.hypot(dx, dy);
        if (d > 0) { const L = (power.lineFt / 5) * gsz; target = { x: origin.x + dx / d * L, y: origin.y + dy / d * L }; }
      }
      // En combat, si toca algun token: primer el pop-up (dany, salvacions, estats) i, en
      // confirmar-lo, l'animació. Si no, es llança ja.
      if (S.onSpellCast(type, [origin, target], power)) {
        R.rAreaPlacementPending.current = null; R.rSpellPreview.current = null;
        e.preventDefault(); return;
      }
      const sp = { id: Date.now().toString(), type, points: [origin, target], startTime: performance.now(), ...(power?.aoeFt ? { aoeFt: power.aoeFt } : {}) };
      const ns = [...R.rActiveSpells.current, sp];
      R.rActiveSpells.current = ns; S.setActiveSpells(ns);
      R.bcRef.current?.postMessage({ type: 'SPELL', spell: { ...sp, startTime: 0 } });
      R.wsRef.current?.send(JSON.stringify({ type: 'SPELL', spell: { ...sp, startTime: 0 } }));
      R.rAreaPlacementPending.current = null; R.rSpellPreview.current = null;
      e.preventDefault(); return;
    }
    // Eina Terreny: botó esquerre marca terreny difícil, el dret l'esborra (arrossegant).
    if (R.rDrawTool.current === 'terrain' && (e.button === 0 || e.button === 2)) {
      e.preventDefault();
      if (R.rGridSize.current <= 0) { S.notify('El terreny difícil va per caselles: primer cal configurar la graella.', 'warn'); return; }
      const { mx: tmx, my: tmy } = mc(e);
      const erase = e.button === 2;
      R.rTerrainDrag.current = { erase };
      if (paintTerrainAt(R, tmx, tmy, erase)) _broadcastState({});
      return;
    }
    // Eina Caselles: botó esquerre pinta, el dret esborra (arrossegant o en rectangle amb Maj).
    if (R.rDrawTool.current === 'tiles' && S.tileTool && (e.button === 0 || e.button === 2)) {
      const { mx: tmx, my: tmy } = mc(e);
      S.tileTool.down(tmx, tmy, e.button === 2, e.shiftKey, e.clientX, e.clientY);
      e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    const { mx, my, sc } = mc(e);

    // Eina "Parets": cada clic col·loca un vèrtex i tanca el tram amb l'anterior.
    // En enganxar-se a un vèrtex/aresta existent es tanca la geometria → detecció de sala.
    if (R.rDrawTool.current === 'wall') {
      // Mode de col·locació de porta (actiu just després de tancar una sala, o des del
      // menú de sala): DOS clics. Primer clic → marca l'inici de la porta sobre la paret
      // més propera; segon clic → en fixa el final (l'amplada) sobre la mateixa paret.
      // Maj+2n clic la col·loca i CONTINUA en mode porta (per posar més entrades seguides).
      if (R.rDoorPlacement.current) {
        const gs = R.rGridSize.current;
        // Snap només si el grid-snap està actiu (si no, la porta es col·loca lliure).
        const grid = (gs > 0 && R.rGridSnap.current) ? { gs, gox: ((R.rGridOriginX.current % gs) + gs) % gs, goy: ((R.rGridOriginY.current % gs) + gs) % gs } : null;
        const dp = R.rDoorPlacement.current;
        if (!dp.anchor) {
          // Primer clic: fixar l'inici imantat a la paret més propera.
          const hit = nearestWallHit(R.rWalls.current, { x: mx, y: my }, grid);
          if (hit) R.rDoorPlacement.current = { roomId: dp.roomId, anchor: { wall: hit.wall, s: hit.s } };
          e.preventDefault(); return;
        }
        // Segon clic: fixar el final sobre la mateixa paret i crear la porta.
        const end = doorEndOnWall(dp.anchor.wall, { x: mx, y: my }, grid);
        if (end) {
          const s0 = Math.min(dp.anchor.s, end.s), s1 = Math.max(dp.anchor.s, end.s);
          if (s1 - s0 > 1) {
            const at = (t: number) => ({ x: dp.anchor!.wall.a.x + end.ux * t, y: dp.anchor!.wall.a.y + end.uy * t });
            S.addDoor(at(s0), at(s1));
          }
        }
        if (e.shiftKey || R.rShiftHeld.current) {
          R.rDoorPlacement.current = { roomId: dp.roomId }; // continua: nou inici
        } else {
          R.rDoorPlacement.current = null;
        }
        R.rDoorPreview.current = null;
        e.preventDefault(); return;
      }
      // Sense cap cadena en curs, clicar sobre un vèrtex existent el mou en lloc de
      // començar una paret nova: és l'única manera d'arreglar una cantonada mal posada
      // sense esborrar la sala sencera.
      if (!R.rWallPenLast.current) {
        const v = vertexAt(R.rWalls.current, { x: mx, y: my }, 11 / sc);
        if (v) {
          // S'apila en deixar anar, i només si s'ha mogut (un clic sense moure no és cap canvi).
          S.beginMapGesture('moure vèrtex');
          R.rWallVertexDrag.current = { orig: v, base: R.rWalls.current };
          R.rWallVertexHover.current = v;
          e.preventDefault(); return;
        }
      }
      const snap = snapWall(mx, my, sc);
      const p = { x: snap.x, y: snap.y };
      const last = R.rWallPenLast.current;
      if (last) {
        if (Math.hypot(p.x - last.x, p.y - last.y) > 0.5) {
          const wall = { a: last, b: p };
          // Al registre de desfer abans del canvi (com els altres canvis del mapa).
          S.pushMapEdit('afegir paret');
          const prevRooms = R.rRooms.current.length;
          const prevIds = new Set(R.rRooms.current.map(r => r.id));
          R.rWalls.current = [...R.rWalls.current, wall];
          R.rWallChain.current = [...R.rWallChain.current, wall];
          R.rWallPenLast.current = p;
          S.setWalls(R.rWalls.current);
          S.redetectRooms();
          // Si aquest tram ha completat una geometria nova, acabar la cadena: cal
          // tornar a clicar per començar-ne una altra (no encadenar directament).
          // I obrir el mode de col·locació de porta per a la sala acabada de tancar:
          // tota sala nova necessita una entrada (Esc l'omet).
          if (R.rRooms.current.length > prevRooms) {
            R.rWallPenLast.current = null;
            R.rWallChain.current = [];
            R.rWallCursor.current = null;
            const newRoom = R.rRooms.current.find(r => !prevIds.has(r.id));
            R.rDoorPlacement.current = { roomId: newRoom?.id ?? null };
            R.rDoorPreview.current = null;
          }
        }
      } else {
        R.rWallPenLast.current = p;
        R.rWallChain.current = [];
        R.rWallCursor.current = { x: p.x, y: p.y, onVertex: snap.onVertex };
      }
      e.preventDefault(); return;
    }

    // Eina "Llums": clic sobre una llum existent la selecciona (i arma un drag per moure-la);
    // clic en buit col·loca una llum nova amb el radi per defecte.
    if (R.rDrawTool.current === 'light') {
      const gs = R.rGridSize.current > 0 ? R.rGridSize.current : 70;
      const hitR = Math.max(gs * 0.3, 14 / sc);
      for (let i = R.rLights.current.length - 1; i >= 0; i--) {
        const ls = R.rLights.current[i];
        if (Math.hypot(mx - ls.x, my - ls.y) <= hitR) {
          S.selectLight(ls.id);
          R.rLightDrag.current = { id: ls.id, ox: mx - ls.x, oy: my - ls.y };
          S.beginMapGesture('moure llum');
          e.preventDefault(); return;
        }
      }
      S.addLight(mx, my);
      e.preventDefault(); return;
    }

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
        const hitTok = tokenAt(R, mx, my, sc);
        const hp = hitTok && getTokenPos(R, hitTok.key);
        if (hitTok && hp) {
          clearTokenSpread();
          R.dragRef.current = { id: hitTok.key, ox: mx - hp.x, oy: my - hp.y };
          S.beginTokenDrag([String(hitTok.key)]);
          S.setActiveDrag(hitTok.key); S.setSelectedToken(hitTok.key); R.rSelectedToken.current = hitTok.key; S.setCanvasCursor('grabbing');
          e.preventDefault(); return;
        }
        // Painted zones
        for (let i = R.rPaintedZones.current.length - 1; i >= 0; i--) {
          const zone = R.rPaintedZones.current[i];
          if (pointInPolygon(mx, my, zone.points)) {
            R.zoneDragRef.current = { zoneId: zone.id, startMx: mx, startMy: my, origPoints: zone.points.map(p => ({ ...p })), origBbox: { ...zone.bbox } };
            S.beginZoneDrag();
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

    // Selects `id` and arms a drag — solo, or in lockstep with the rest of the selection when it
    // has >1 member. Un clic normal SUBSTITUEIX la selecció (només queda el darrer token clicat);
    // per afegir-ne més cal mantenir Ctrl (o ⌘), com a la resta de sistemes.
    const selectAndArmDrag = (id: number | string, ep: { x: number; y: number }) => {
      const additive = e.ctrlKey || e.metaKey;
      let sel = R.rMultiSelected.current;
      const inMulti = sel.size > 1 && sel.has(id);
      if (!additive && !inMulti) sel = new Set();   // clic net: res del que hi havia queda seleccionat
      const reclickingGroupMember = inMulti;
      sel.add(id);
      R.rMultiSelected.current = new Set(sel);
      sel = R.rMultiSelected.current;
      S.setSelectedToken(id); R.rSelectedToken.current = id;
      R.dragRef.current = { id, ox: mx - ep.x, oy: my - ep.y };
      // Tornar a clicar un membre de la selecció: si es deixa anar sense arrossegar, Ctrl el treu i
      // un clic normal es queda només amb ell.
      R.pendingDeselectRef.current = reclickingGroupMember ? { id, mx, my, only: !additive } : null;
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
      S.beginTokenDrag([String(id), ...[...(R.groupDragRef.current?.keys() ?? [])].map(String)]);
      S.setActiveDrag(id); S.setCanvasCursor('grabbing');
    };

    // Token sota el cursor: el de més amunt tal com es veu (el seleccionat a sobre, i amb el
    // ventall dels apilats obert, on es veu cada un). El ventall es tanca en començar a arrossegar.
    const hitTok = tokenAt(R, mx, my, sc);
    const hitPos = hitTok && getTokenPos(R, hitTok.key);
    if (hitTok && hitPos) {
      clearTokenSpread();
      selectAndArmDrag(hitTok.key, hitPos);
      e.preventDefault(); return;
    }


    // Clic sobre una porta (cursor normal, mode selecció) = obrir/tancar-la.
    if (R.rDrawTool.current === 'none') {
      const hitDoor = doorAt(R.rDoors.current, { x: mx, y: my }, 9 / sc);
      if (hitDoor) {
        S.setSelectedToken(null); R.rSelectedToken.current = null;
        R.rMultiSelected.current = new Set(); R.groupDragRef.current = null;
        S.toggleDoor(hitDoor.id); e.preventDefault(); return;
      }
    }

    // Clic en buit: deseleccionar i, si és damunt d'una sala, revelar-la. Però si en lloc de
    // clicar s'ARROSSEGA, el que es fa és moure el mapa (i no es revela res ni es perd la
    // selecció). Per això l'acció del clic es desa i s'executa en deixar anar sense moure's.
    const hovR = R.rHoveredRoomId.current;
    const clickAction = () => {
      S.setSelectedToken(null); R.rSelectedToken.current = null;
      R.rMultiSelected.current = new Set(); R.groupDragRef.current = null;

      // Clic sobre la sala fosca ressaltada (la de l'ull) = commutar-la: revelar-la o tornar-la
      // a amagar, d'un sol gest. Un clic sense voler es desfà amb Ctrl+Z. Els tokens i les
      // portes de dins la sala tenen prioritat (s'han resolt abans i ja han sortit).
      if (hovR) {
        const rm = R.rRooms.current.find(r => r.id === hovR);
        if (rm && rm.dark) { S.setRoomRevealed(hovR, !rm.revealed); return; }
      }
    };
    startPan(e, clickAction);
    e.preventDefault();
  }, [mc, _broadcastState, startPan]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update screen-space cursor even during pan
    if (R.rDrawTool.current === 'pen' || R.rDrawTool.current === 'eraser' || R.rDrawTool.current === 'shape') {
      const rect0 = getCanvasRect();
      R.rCursorScreenPos.current = { x: e.clientX - rect0.left, y: e.clientY - rect0.top };
    }
    if (R.panDragRef.current) {
      const pd = R.panDragRef.current;
      const { startX, startY, startPanX, startPanY, private: isPrivate } = pd;
      // Mentre no es passa de 4px és un clic (pot acabar revelant una sala): el mapa no es mou.
      if (!pd.moved) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
        pd.moved = true; S.setPanning(true);
      }
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

    const { mx, my, sc } = mc(e);

    if (R.rDrawTool.current === 'tiles' && S.tileTool) { S.tileTool.move(mx, my, e.shiftKey); return; }
    if (R.rTerrainDrag.current) {
      if (paintTerrainAt(R, mx, my, R.rTerrainDrag.current.erase)) _broadcastState({});
      return;
    }

    // Màgia triada esperant el destí: centre de l'àrea o punta del raig; fora d'abast = avís en vermell, no es talla.
    // Abans de les branques de cada eina: la del grimori es pot llançar amb qualsevol eina.
    if (R.rAttackPending.current) {
      const pv = aimAttack(R, R.rAttackPending.current, { x: mx, y: my }, gridOf(R.rGridSize.current, R.rGridOriginX.current, R.rGridOriginY.current), sc);
      if (!pv) { cancelPendingSpell(R); return; }   // l'atacant ja no hi és
      R.rSpellPreview.current = pv;
      return;
    }
    if (R.rAreaPlacementPending.current) {
      const pend = R.rAreaPlacementPending.current;
      R.rSpellPreview.current = aimSpell(R, pend, { x: mx, y: my }, pend.power ? pend.power.rangeFt : spellRangeFt(pend.type), gridOf(R.rGridSize.current, R.rGridOriginX.current, R.rGridOriginY.current), sc);
      return;
    }

    // Paret en curs (eina "Parets"): línia elàstica de l'últim vèrtex al cursor amb imant.
    if (R.rDrawTool.current === 'wall') {
      // Mode porta (dos clics): sense inici encara, la previsualització és el punt d'inici
      // imantat a la paret més propera (segment degenerat = marca de punt). Amb inici
      // fixat, la previsualització és el segment de porta de l'inici al cursor projectat.
      if (R.rDoorPlacement.current) {
        const gs = R.rGridSize.current;
        // Snap només si el grid-snap està actiu (si no, la porta es col·loca lliure).
        const grid = (gs > 0 && R.rGridSnap.current) ? { gs, gox: ((R.rGridOriginX.current % gs) + gs) % gs, goy: ((R.rGridOriginY.current % gs) + gs) % gs } : null;
        const dp = R.rDoorPlacement.current;
        if (!dp.anchor) {
          const hit = nearestWallHit(R.rWalls.current, { x: mx, y: my }, grid);
          R.rDoorPreview.current = hit ? { a: hit.point, b: hit.point } : null;
        } else {
          const end = doorEndOnWall(dp.anchor.wall, { x: mx, y: my }, grid);
          if (end) {
            const s0 = Math.min(dp.anchor.s, end.s), s1 = Math.max(dp.anchor.s, end.s);
            const at = (t: number) => ({ x: dp.anchor!.wall.a.x + end.ux * t, y: dp.anchor!.wall.a.y + end.uy * t });
            R.rDoorPreview.current = { a: at(s0), b: at(s1) };
          }
        }
        R.rWallCursor.current = null;
        return;
      }
      // Arrossegant un vèrtex: es recalcula sempre des del conjunt ORIGINAL de parets, així
      // el moviment no acumula error i tornar al punt de sortida el deixa exactament igual.
      const vd = R.rWallVertexDrag.current;
      if (vd) {
        const moving = new Set(wallsAtVertex(vd.base, vd.orig));
        const snap = snapWall(mx, my, sc, moving);
        R.rWalls.current = moveVertex(vd.base, vd.orig, { x: snap.x, y: snap.y });
        S.setWalls(R.rWalls.current);
        R.rWallVertexHover.current = { x: snap.x, y: snap.y };
        R.rWallCursor.current = null;
        return;
      }
      // Sense cadena en curs, ressaltar el vèrtex sota el cursor (es pot agafar i moure).
      R.rWallVertexHover.current = R.rWallPenLast.current
        ? null
        : vertexAt(R.rWalls.current, { x: mx, y: my }, 11 / sc);
      R.rWallCursor.current = R.rWallVertexHover.current ? null : snapWall(mx, my, sc);
      return;
    }

    // Moure una llum (eina "Llums"): reposiciona-la sota el cursor i propaga throttled.
    if (R.rLightDrag.current) {
      const d = R.rLightDrag.current;
      R.rLights.current = R.rLights.current.map(l => l.id === d.id ? { ...l, x: mx - d.ox, y: my - d.oy } : l);
      const now = Date.now();
      if (now - R.dmPreviewBcastRef.current > 48) { R.dmPreviewBcastRef.current = now; _broadcastState({}); }
      return;
    }

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
      // Sala fosca sota el cursor (per a l'ull de revelar)
      let hovRoom: string | null = null;
      for (let i = R.rRooms.current.length - 1; i >= 0; i--) {
        const rm = R.rRooms.current[i];
        if (rm.dark && pointInPolygon(mx, my, rm.points)) { hovRoom = rm.id; break; }
      }
      R.rHoveredRoomId.current = hovRoom;
      // Porta sota el cursor: es destaca (com un botó) i el cursor passa a "pointer".
      const prevHovDoor = R.rHoveredDoorId.current;
      const hovDoor = doorAt(R.rDoors.current, { x: mx, y: my }, 9 / sc)?.id ?? null;
      R.rHoveredDoorId.current = hovDoor;
      if (hovDoor !== prevHovDoor) S.setCanvasCursor(hovDoor ? 'pointer' : 'default');
      // Tokens apilats: s'obren en ventall sota el cursor (offset visual, l'anima el rAF).
      if (!R.rAreaSelectMode.current) updateTokenSpread(R, mx, my, sc, R.rGridSize.current);
    } else {
      clearTokenSpread();
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
      // Centre de casella o vèrtex segons quantes caselles ocupa (una criatura gran, 2×2, va al vèrtex).
      if (String(tid).startsWith('pl_')) {
        const Rv = R.rTokenSizeOverride.current[tid] ?? 22;
        return { x: snapTokenCenter(p.x + Rv, gox, gs, Rv) - Rv, y: snapTokenCenter(p.y + Rv, goy, gs, Rv) - Rv };
      }
      const en = R.rLibEnemies.current.find(e => `lib_${e.id}` === String(tid));
      const Rl = R.rTokenSizeOverride.current[String(tid)] ?? en?.R ?? 22;
      return { x: snapTokenCenter(p.x, gox, gs, Rl), y: snapTokenCenter(p.y, goy, gs, Rl) };
    };
    const np = snapTokenPos({ x: mx - ox, y: my - oy }, id);
    const nextPos = { ...R.rPos.current, [id]: np };
    delete R.rMovePath.current[String(id)];  // el DM mana: cancel·la l'animació de camí pendent
    if (R.groupDragRef.current) {
      for (const [sid, off] of R.groupDragRef.current) {
        nextPos[sid] = snapTokenPos({ x: mx - off.ox, y: my - off.oy }, sid);
        delete R.rMovePath.current[String(sid)];
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
    const pan = R.panDragRef.current;
    R.panDragRef.current = null; R.isDrawingRef.current = false; R.lastDrawRef.current = null;
    if (pan) {
      S.setPanning(false);
      // No s'ha arrossegat: era un clic en buit (deseleccionar / revelar la sala).
      if (!pan.moved) pan.onClick?.();
      else _broadcastState({});  // posició final exacta (durant el drag anava throttled)
      return;
    }
    if (R.rTerrainDrag.current) { R.rTerrainDrag.current = null; return; }
    if (S.tileTool?.up()) return;

    // Final del moviment d'un vèrtex: ara sí que es re-detecten les sales (durant el drag
    // només s'han mogut les parets, que és barat; `redetectRooms` reconcilia noms i estats
    // i poda les portes que hagin perdut la seva paret).
    if (R.rWallVertexDrag.current) {
      R.rWallVertexDrag.current = null;
      S.redetectRooms();
      S.endUndoGesture();
      return;
    }

    // Finalize light drag: sync React state + broadcast final position.
    if (R.rLightDrag.current) {
      R.rLightDrag.current = null;
      S.setLights([...R.rLights.current]);
      S.endUndoGesture();
      _broadcastState({});
      return;
    }

    // Finalize marquee (area) selection — collect every token whose center is inside the box
    if (R.rAreaSelectRect.current) {
      const rect = R.rAreaSelectRect.current;
      R.rAreaSelectRect.current = null;
      const left = Math.min(rect.x0, rect.x1), right = Math.max(rect.x0, rect.x1);
      const top = Math.min(rect.y0, rect.y1), bottom = Math.max(rect.y0, rect.y1);
      const dragDist = Math.hypot(rect.x1 - rect.x0, rect.y1 - rect.y0);
      // Additive només amb Ctrl (⌘); si no, el rectangle substitueix la selecció.
      const sel = new Set<number | string>(rect.add ? R.rMultiSelected.current : []);
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
      S.endUndoGesture();
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

    if (R.dragRef.current) { setPos({ ...R.rPos.current }); S.endUndoGesture(); }
    if (R.pendingDeselectRef.current) {
      const { id, only } = R.pendingDeselectRef.current;
      R.pendingDeselectRef.current = null;
      const sel = new Set(R.rMultiSelected.current);
      if (only) { sel.clear(); sel.add(id); } else sel.delete(id);
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
        const stroke = { points: pts, color: R.rDrawColor.current, size: R.rDrawSize.current, tool: R.rDrawTool.current };
        // A l'historial (amb el límit de traços) i a la pila de desfer.
        commitStroke(stroke);
        R.rAutosaveDirty.current = true;  // el dibuix no passa per _broadcastState
      }
    }
    _broadcastState({});
  }, [mc, _broadcastState, commitStroke]);

  const onMouseLeaveCanvas = useCallback(() => {
    if (S.tileTool) { S.tileTool.up(); S.tileTool.leave(); }
    R.rTerrainDrag.current = null;
    if (R.panDragRef.current) {
      if (R.panDragRef.current.moved) _broadcastState({});
      R.panDragRef.current = null; S.setPanning(false);
    }
    if (R.dragRef.current) { S.setPos?.({ ...R.rPos.current }); S.endUndoGesture(); }
    R.dragRef.current = null; S.setActiveDrag(null); R.groupDragRef.current = null; R.pendingDeselectRef.current = null;
    R.rHoveredRoomId.current = null;
    R.rWallCursor.current = null;
    R.rDoorPreview.current = null;
    R.rHoveredDoorId.current = null;
    R.rHoveredPaintedZoneId.current = null;
    R.rCursorScreenPos.current = null;
    clearTokenSpread();
    if (R.rDrawTool.current === 'pointer') {
      R.rPointerPos.current = null;
      R.bcRef.current?.postMessage({ type: 'POINTER', pos: null });
      R.wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: null }));
    }
  }, [_broadcastState]); // eslint-disable-line react-hooks/exhaustive-deps

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // L'eina Caselles fa servir el clic dret a onMouseDown/onMouseUp (esborrar o menú de capes). A la
    // pantalla tàctil no n'hi ha: mantenir premut (`longPress`, de `useCanvasPointer`) obre el menú.
    if (R.rDrawTool.current === 'tiles') {
      if ((e as unknown as { longPress?: boolean }).longPress && S.tileTool) { const { mx, my } = mc(e); S.tileTool.menu(mx, my, e.clientX, e.clientY); }
      return;
    }
    if (R.rDrawTool.current === 'terrain') return;
    // Clic dret amb una màgia per col·locar: la cancel·la (com Esc)
    if (R.rAreaPlacementPending.current || R.rAttackPending.current) { cancelPendingSpell(R); return; }
    const { mx, my, sc } = mc(e);
    // Eina Parets: clic dret sobre una porta l'elimina (la paret es tanca de nou).
    if (R.rDrawTool.current === 'wall') {
      const hitDoor = doorAt(R.rDoors.current, { x: mx, y: my }, 10 / sc);
      if (hitDoor) { S.removeDoor(hitDoor.id); return; }
      // Sense porta a sota: esborrar el tram de paret (abans només es podia desfer
      // l'última amb Backspace; qualsevol altra obligava a eliminar la sala).
      const hitWall = wallAt(R.rWalls.current, { x: mx, y: my }, 10 / sc);
      if (hitWall) {
        S.pushMapEdit('esborrar paret');
        R.rWalls.current = R.rWalls.current.filter(w => w !== hitWall);
        S.setWalls(R.rWalls.current);
        S.redetectRooms();
        return;
      }
    }
    // Eina "Llums": clic dret sobre una llum l'elimina.
    if (R.rDrawTool.current === 'light') {
      const gs = R.rGridSize.current > 0 ? R.rGridSize.current : 70;
      const hitR = Math.max(gs * 0.3, 14 / sc);
      for (let i = R.rLights.current.length - 1; i >= 0; i--) {
        const ls = R.rLights.current[i];
        if (Math.hypot(mx - ls.x, my - ls.y) <= hitR) { S.removeLight(ls.id); return; }
      }
      return;
    }
    for (let i = R.rActiveSpells.current.length - 1; i >= 0; i--) {
      const sp = R.rActiveSpells.current[i];
      if (!AREA_TYPES.has(sp.type) || !AREA_SETTLED(sp)) continue;
      const center = sp.points[sp.points.length - 1];
      const data = AREA_SPELL_DATA[sp.type as string];
      if (!center || !data) continue;
      const radius = (data.aoeRadiusFt / 5) * R.rGridSize.current;
      if (Math.hypot(mx - center.x, my - center.y) <= radius) {
        S.setContextMenu({ id: sp.id, name: `${data.emoji} ${SPELL_BY_TYPE.get(sp.type)?.title ?? sp.type}`, x: e.clientX, y: e.clientY, isAreaSpell: true });
        return;
      }
    }
    for (const zone of R.rPaintedZones.current) {
      if (pointInPolygon(mx, my, zone.points)) {
        const el = ELEMENTS_BY_ID.get(zone.element);
        R.rSelectedPaintedZoneId.current = zone.id;
        S.setContextMenu({ id: zone.id, name: el ? `${el.emoji} Zona de ${el.label.toLowerCase()}` : `Zona: ${zone.element}`, x: e.clientX, y: e.clientY, isPaintedZone: true });
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
    const maybeMultiMenu = (id: number | string, anchor?: ContextMenuState['anchor']): boolean => {
      if (sel.size <= 1 || !sel.has(id)) return false;
      S.setContextMenu({ id, name: `${sel.size} seleccionats`, x: e.clientX, y: e.clientY, isMultiSelect: true, ids: [...sel], existingGroupId: groupOfSelection([...sel]), anchor });
      return true;
    };

    const hitTok = tokenAt(R, mx, my, sc);
    if (hitTok) {
      // Capsa del token a la finestra: el menú s'hi col·loca al costat, sense tapar-lo.
      const b = tokenBounds(hitTok), toX = (x: number) => e.clientX + (x - mx) * sc, toY = (y: number) => e.clientY + (y - my) * sc;
      const anchor = { l: toX(b.l), r: toX(b.r), t: toY(b.t), b: toY(b.b) };
      if (maybeMultiMenu(hitTok.key, anchor)) return;
      S.setContextMenu(tokenMenuFor(R, hitTok.key, e.clientX, e.clientY, anchor));
      return;
    }
    // Sala detectada (eina Parets) — prioritat més baixa (àrea gran sota els tokens)
    for (let i = R.rRooms.current.length - 1; i >= 0; i--) {
      const rm = R.rRooms.current[i];
      if (pointInPolygon(mx, my, rm.points)) {
        S.setContextMenu({ id: rm.id, name: rm.name, x: e.clientX, y: e.clientY, isRoom: true, roomDark: rm.dark, roomRevealed: rm.revealed });
        return;
      }
    }
    R.rSelectedPaintedZoneId.current = null;
    S.setContextMenu(null);
  }, [mc]);

  // Double click on a grouped token selects every member of its group.
  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (R.rDrawTool.current !== 'none' || R.rAreaSelectMode.current) return;
    const { mx, my, sc } = mc(e);

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

    const hitTok = tokenAt(R, mx, my, sc);
    if (hitTok) selectGroupOrSolo(hitTok.key);
  }, [mc]);

  return { onMouseDown, onMouseMove, onMouseUp, onMouseLeaveCanvas, onContextMenu, onDoubleClick, mc };
}
