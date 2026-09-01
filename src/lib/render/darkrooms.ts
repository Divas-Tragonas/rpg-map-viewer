import type { FrameContext } from './types';
import type { Room, Wall, Door, Point } from '@/types';
import { C, DEFAULT_VISION_FT } from '@/constants';
import { visibilityPolygon } from '@/lib/rooms/visibility';
import { effectiveWalls, effectiveWallsAnimated } from '@/lib/rooms/doors';

const REVEAL_LERP = 0.09;

// DEBUG de llum (tecla L): dibuixa les parets efectives que veu la llum (magenta) + el
// polígon de visió exacte (cian) + el radi (groc), per diagnosticar ombres "estranyes".
let _lightDebug = false;
export function toggleLightDebug(): boolean { _lightDebug = !_lightDebug; return _lightDebug; }

// Capa de foscor reutilitzada entre frames (mateixa mida que el canvas principal).
let _darkCanvas: HTMLCanvasElement | null = null;
// Capa de llum: s'hi acumulen tots els retalls de llum abans de compositar-los sobre la
// foscor amb `destination-out`.
let _lightCanvas: HTMLCanvasElement | null = null;
// Canvas temporal amb una còpia de la màscara d'UNIÓ (sala ∪ vessament) de cada llum, per
// poder fer-ne l'erosió morfològica sense llegir i escriure el mateix canvas alhora.
let _lightTmp2: HTMLCanvasElement | null = null;
// Rasteritzat ja acabat de cada llum (màscara erosionada + gradient), en coordenades locals
// del seu rectangle. Clau = `Light.key`. Es reutilitza mentre no canviï res que en determini
// els píxels, així moure UN token no obliga a refer la llum de tota la resta.
const _maskCache = new Map<string, { sig: string; cv: HTMLCanvasElement }>();
// Regió de `_lightCanvas` que va escriure el frame anterior (l'única que cal netejar).
let _lcDirty: { x: number; y: number; w: number; h: number } | null = null;

// ── Boira "explorada" (estil Age of Empires) ───────────────────────────────────────
// Màscara (alpha) en coords de MAP a resolució reduïda que acumula tot el que s'ha vist.
// A les zones explorades però no il·luminades ARA es mostra el mapa de fons ATENUAT (saps
// el terreny que hi ha) però NO els tokens (queden amagats sota la foscor). Persisteix per
// mapa (es reinicia quan canvia la mida). Local a cada pantalla.
let _exploredCanvas: HTMLCanvasElement | null = null;
let _exploredSig = '';
let _exploredScale = 1;
let _memCanvas: HTMLCanvasElement | null = null;
const EXPLORED_MAX = 1600;   // costat màxim (px) de la màscara d'explorat
const MEM_DIM = 0.38;        // brillantor del terreny memoritzat (0..1)

function ensureExplored(mw: number, mh: number): { canvas: HTMLCanvasElement; scale: number } {
  const scale = Math.min(1, EXPLORED_MAX / Math.max(mw, mh, 1));
  const w = Math.max(1, Math.round(mw * scale)), h = Math.max(1, Math.round(mh * scale));
  const sig = `${w}x${h}`;
  if (!_exploredCanvas || _exploredSig !== sig) {
    _exploredCanvas = _exploredCanvas ?? document.createElement('canvas');
    _exploredCanvas.width = w; _exploredCanvas.height = h;
    _exploredCanvas.getContext('2d')!.clearRect(0, 0, w, h);
    _exploredSig = sig; _exploredScale = scale;
    // La màscara s'ha reiniciat (mapa nou): cal tornar a acumular encara que res s'hagi mogut.
    _exploredDirty = true;
  }
  return { canvas: _exploredCanvas, scale: _exploredScale };
}

// Acumula a la màscara d'explorat NOMÉS la llum que cau DINS de sales fosques i dins del
// radi. Així una zona oberta (encara sense sala) que un token il·lumina NO queda marcada
// com explorada: quan després s'hi crea una sala fosca, surt negra fins que s'hi entra.
//
// RENDIMENT: el retall de sales fosques es construeix PER LLUM amb només les sales que
// toquen el seu cercle (bbox), no amb totes les del mapa. Com que després es retalla al
// radi, les sales que no el toquen no hi podien aportar res: el resultat és idèntic, però
// el retall passa de cobrir el mapa sencer (mig segon de rasterització amb desenes de
// sales, a cada frame en què algú es mou) a cobrir només l'entorn de la llum.
function accumulateExplored(
  polys: LightPoly[],
  darkRooms: Room[],
  mw: number, mh: number,
): void {
  if (darkRooms.length === 0) return;
  const ex = ensureExplored(mw, mh);
  const ectx = ex.canvas.getContext('2d')!;
  ectx.save();
  ectx.setTransform(ex.scale, 0, 0, ex.scale, 0, 0);
  ectx.fillStyle = 'rgba(255,255,255,1)';
  for (const { li, poly, roomPts } of polys) {
    const lx0 = li.x - li.r, ly0 = li.y - li.r, lx1 = li.x + li.r, ly1 = li.y + li.r;
    ectx.save();
    // Retall a la unió de les sales fosques que toquen el cercle de la llum...
    let anyRoom = false;
    ectx.beginPath();
    for (const rm of darkRooms) {
      const b = rm.bbox;
      if (b.right < lx0 || b.left > lx1 || b.bottom < ly0 || b.top > ly1) continue;
      if (rm.points.length < 3) continue;
      rm.points.forEach((p, i) => i === 0 ? ectx.moveTo(p.x, p.y) : ectx.lineTo(p.x, p.y));
      ectx.closePath();
      anyRoom = true;
    }
    if (!anyRoom) { ectx.restore(); continue; }
    ectx.clip();
    // ...i al radi de visió (perquè no marqui explorada la sala sencera més enllà del radi).
    ectx.beginPath(); ectx.arc(li.x, li.y, li.r, 0, Math.PI * 2); ectx.clip();
    if (poly.length >= 3) {
      ectx.beginPath();
      poly.forEach((p, i) => i === 0 ? ectx.moveTo(p.x, p.y) : ectx.lineTo(p.x, p.y));
      ectx.closePath(); ectx.fill();
    }
    if (roomPts && roomPts.length >= 3) {
      ectx.beginPath();
      roomPts.forEach((p, i) => i === 0 ? ectx.moveTo(p.x, p.y) : ectx.lineTo(p.x, p.y));
      ectx.closePath(); ectx.fill();
    }
    ectx.restore();
  }
  ectx.restore();
}

interface Light { key: string; x: number; y: number; r: number; intensity: number; }
interface LightPoly { li: Light; poly: Point[]; roomPts?: Point[] }

// Estat animat de cada llum (radi + intensitat), per suavitzar canvis de distància de
// visió i l'esvaïment de la llum en morir. Clau = id del token (pl_*). Mòdul-level com
// _darkCanvas (només corre una vista — DM o jugador — per finestra).
const _lightAnim = new Map<string, { r: number; i: number }>();
const LIGHT_R_LERP = 0.14;   // suavitzat del radi (canvi de visió)
const LIGHT_I_LERP = 0.09;   // suavitzat de la intensitat (esvaïment en morir)
// Obertura animada de cada porta (0 tancada … 1 oberta) NOMÉS per a la llum.
const _doorAnim = new Map<string, number>();
const DOOR_LERP = 0.16;

// Fonts de llum: cada token de jugador visible emet llum dins del seu radi de visió
// (`Player.visionFt`, per defecte DEFAULT_VISION_FT; 0 = sense llum). El radi és el de
// visió menys 1 casella (es veu una mica menys); el cegament el redueix a 1 casella. El
// centre segueix la posició suavitzada (LERP). En morir, la llum s'esvaeix a 0 DESPRÉS de
// l'animació de la X (defeatedAnimRef). Radi i intensitat s'animen suaument.
function collectLights(fc: FrameContext): Light[] {
  const gs = fc.rGridSize.current > 0 ? fc.rGridSize.current : 70;
  const lights: Light[] = [];
  const seen = new Set<string>();
  for (const pl of fc.rPlayers.current) {
    if (!pl.visible) continue;
    const key = `pl_${pl.id}`;
    const visionFt = pl.visionFt ?? DEFAULT_VISION_FT;
    if (visionFt <= 0) continue;
    const R = fc.rTokenSizeOverride.current[key] ?? 22;
    const pos = fc.visualPosRef.current[key] ?? fc.pp[key];
    if (!pos) continue;
    const blinded = (fc.rConditions.current[key] || []).includes('blinded');
    // Radi objectiu: cegat → 1 casella; si no, visionFt/5 − 1 casella (mínim 1).
    const targetCells = blinded ? 1 : Math.max(1, visionFt / 5 - 1);
    const targetR = targetCells * gs;
    // Intensitat objectiu: derrotat → es manté a 1 mentre dura la X (defeatedAnimRef 0→1) i
    // després baixa a 0 (la llum s'esvaeix); viu → 1.
    const isDefeated = !!fc.rDefeated.current[key];
    const deathProg = fc.defeatedAnimRef.current[key] ?? (isDefeated ? 1 : 0);
    const targetI = isDefeated ? (deathProg >= 0.999 ? 0 : 1) : 1;
    let a = _lightAnim.get(key);
    if (!a) { a = { r: targetR, i: targetI }; _lightAnim.set(key, a); }
    a.r += (targetR - a.r) * LIGHT_R_LERP;
    a.i += (targetI - a.i) * LIGHT_I_LERP;
    if (Math.abs(targetR - a.r) < 0.5) a.r = targetR;
    if (Math.abs(targetI - a.i) < 0.004) a.i = targetI;
    seen.add(key);
    if (a.i <= 0.01) continue; // llum apagada del tot
    lights.push({ key, x: pos.x + R, y: pos.y + R, r: a.r, intensity: a.i });
  }

  // Punts de llum (torxes/llànties): NOMÉS s'encenen si un token de jugador VISIBLE i no
  // derrotat és dins de la MATEIXA sala que la llum. Així una sala fosca sense ningú a dins
  // queda negra encara que hi hagi torxes; en entrar-hi un token, la seva zona s'il·lumina.
  const rooms = fc.rRooms?.current ?? [];
  const sources = fc.rLights?.current ?? [];
  if (sources.length > 0 && rooms.length > 0) {
    // Centres dels tokens de jugador visibles i vius (per comprovar "és dins de la sala").
    const tokenCenters: { x: number; y: number }[] = [];
    for (const pl of fc.rPlayers.current) {
      if (!pl.visible) continue;
      const key = `pl_${pl.id}`;
      if (fc.rDefeated.current[key]) continue;
      const R = fc.rTokenSizeOverride.current[key] ?? 22;
      const pos = fc.visualPosRef.current[key] ?? fc.pp[key];
      if (!pos) continue;
      tokenCenters.push({ x: pos.x + R, y: pos.y + R });
    }
    for (const ls of sources) {
      const key = `light_${ls.id}`;
      const room = roomAt(rooms, ls.x, ls.y);
      let active = false;
      if (room) {
        for (const t of tokenCenters) { if (pointInPoly(t.x, t.y, room.points)) { active = true; break; } }
      }
      const targetI = active ? 1 : 0;
      const targetR = Math.max(1, ls.radiusFt / 5) * gs;
      let a = _lightAnim.get(key);
      if (!a) { a = { r: targetR, i: targetI }; _lightAnim.set(key, a); }
      a.r += (targetR - a.r) * LIGHT_R_LERP;
      a.i += (targetI - a.i) * LIGHT_I_LERP;
      if (Math.abs(targetR - a.r) < 0.5) a.r = targetR;
      if (Math.abs(targetI - a.i) < 0.004) a.i = targetI;
      seen.add(key);
      if (a.i <= 0.01) continue;
      lights.push({ key, x: ls.x, y: ls.y, r: a.r, intensity: a.i });
    }
  }

  for (const k of _lightAnim.keys()) if (!seen.has(k)) _lightAnim.delete(k);
  return lights;
}

// Esborra de la memòria d'explorat el polígon d'una sala: torna a ser negra del tot (com si
// mai s'hi hagués entrat). Es crida al DM (localment) i al jugador (via RESET_EXPLORED).
export function clearExploredAt(points: { x: number; y: number }[]): void {
  // Força una acumulació d'explorat al proper frame encara que res no s'hagi mogut (si no,
  // la zona il·luminada ARA no es tornaria a memoritzar fins que algú es mogués).
  _exploredDirty = true;
  if (!_exploredCanvas || points.length < 3) return;
  const ectx = _exploredCanvas.getContext('2d')!;
  ectx.save();
  ectx.setTransform(_exploredScale, 0, 0, _exploredScale, 0, 0);
  ectx.globalCompositeOperation = 'destination-out';
  ectx.beginPath();
  points.forEach((p, i) => i === 0 ? ectx.moveTo(p.x, p.y) : ectx.lineTo(p.x, p.y));
  ectx.closePath();
  ectx.fill();
  // Un traç ample per esborrar també qualsevol vora fina que quedi arran de paret.
  ectx.lineJoin = 'round'; ectx.lineWidth = 6; ectx.strokeStyle = '#000'; ectx.stroke();
  ectx.restore();
}

// Versions de les geometries d'entrada: les mutacions de parets/portes sempre creen arrays
// NOUS (convenció del projecte), així que comparar la referència n'hi ha prou per saber si
// la geometria ha canviat. Serveix per a la signatura de la memòria cau de visibilitat.
let _wallsArrSeen: Wall[] | null = null;
let _wallsVer = 0;
let _doorsArrSeen: Door[] | null = null;
let _doorsVer = 0;
let _effWallsCache: { sig: string; walls: Wall[] } | null = null;
// Quantització de l'obertura animada de porta (passos per a l'animació completa): amb un
// valor continu, les parets efectives canviarien cada frame i la memòria cau de visibilitat
// no encertaria mai. 24 passos són prou suaus a ull nu.
const DOOR_STEPS = 24;

// Fa avançar l'obertura animada de les portes cap al seu estat (obert/tancat) i retorna
// les parets efectives per a la LLUM (forats de porta animats) + una signatura que canvia
// només quan aquestes parets canvien de veritat. La col·lisió usa a part la versió binària
// (effectiveWalls).
function lightWalls(fc: FrameContext): { walls: Wall[]; sig: string } {
  const allWalls = fc.rWalls?.current ?? [];
  const allDoors = fc.rDoors?.current ?? [];
  if (allWalls !== _wallsArrSeen) { _wallsArrSeen = allWalls; _wallsVer++; }
  if (allDoors !== _doorsArrSeen) { _doorsArrSeen = allDoors; _doorsVer++; }
  const present = new Set<string>();
  const quant = new Map<string, number>();
  let animKey = '';
  for (const d of allDoors) {
    present.add(d.id);
    const tgt = d.open !== false ? 1 : 0;
    let f = _doorAnim.get(d.id);
    if (f === undefined) f = tgt;
    f += (tgt - f) * DOOR_LERP;
    if (Math.abs(tgt - f) < 0.01) f = tgt;
    _doorAnim.set(d.id, f);
    const q = Math.round(f * DOOR_STEPS);
    quant.set(d.id, q / DOOR_STEPS);
    animKey += `${d.id}:${q};`;
  }
  for (const k of _doorAnim.keys()) if (!present.has(k)) _doorAnim.delete(k);
  const sig = `${_wallsVer}/${_doorsVer}/${animKey}`;
  if (_effWallsCache && _effWallsCache.sig === sig) return { walls: _effWallsCache.walls, sig };
  const walls = effectiveWallsAnimated(allWalls, allDoors, id => quant.get(id) ?? 0);
  _effWallsCache = { sig, walls };
  return { walls, sig };
}

// Memòria cau del polígon de visibilitat per llum: el raycasting és O(vèrtexs × parets) i
// es feia per llum i per frame, encara que ni la llum ni les parets s'haguessin mogut (el
// cas normal entre moviments). Amb molts tokens de jugador això era el pic de CPU.
const _visCache = new Map<string, { sig: string; poly: Point[] }>();
let _exploredDirty = false;

// Sala que conté el punt (la primera, com feia `rooms.find`). El descart per bbox evita
// recórrer el polígon sencer de cada sala: amb desenes de sales, aquesta cerca es feia una
// vegada per llum i per frame i el ray casting hi era el gruix del cost.
function roomAt(rooms: Room[], x: number, y: number): Room | undefined {
  for (const rm of rooms) {
    const b = rm.bbox;
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
    if (rm.points.length >= 3 && pointInPoly(x, y, rm.points)) return rm;
  }
  return undefined;
}

// Punt dins d'un polígon (ray casting parell/senar).
function pointInPoly(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Esborra de la capa de foscor la zona il·luminada per cada llum. La llum és la UNIÓ de:
//  (a) la SALA on és el token, retallada al radi (dins de la teva sala veus tot el radi,
//      sense ombres internes de mobles/murs/estructures — l'oclusió només compta per passar
//      a ALTRES sales), i
//  (b) el polígon de visibilitat (raycasting) per a la llum que s'escola per portes i
//      obertures cap a les sales del costat (allà sí que les parets fan ombra).
// Gradient radial (esvaïment al radi), aplicat UNA sola vegada sobre la unió.
//
// RENDIMENT (⚠️ no fer marxa enrere): el rasteritzat de la llum és, de llarg, el gruix del
// cost del frame a la pantalla de jugador, i creix amb el NOMBRE DE LLUMS (no amb el nombre
// de sales). Tres coses el mantenen a ratlla:
//  1. Cada llum només toca el seu propi rectangle de pantalla (rects explícits als
//     drawImage). Abans feia ~7 operacions sobre el canvas SENCER per llum.
//  2. El resultat de cada llum es guarda a `_maskCache` i es reutilitza mentre la seva
//     firma no canviï: moure UN token ja no obliga a rasteritzar la llum de tota la resta
//     (el cas normal a taula), i amb tothom quiet no se'n rasteritza cap.
//  3. `_lightCanvas` només es neteja i es composita a la finestra que ocupen les llums.
// Els `drawImage` són el que costa; els `fill` no surten ni al perfil (per això la màscara
// es torna a traçar dues vegades en lloc de copiar-se amb un blit).
function carveLights(octx: CanvasRenderingContext2D, polys: LightPoly[], wallsSig: string): void {
  const off = octx.canvas;
  if (!_lightCanvas) _lightCanvas = document.createElement('canvas');
  const lc = _lightCanvas;
  if (lc.width !== off.width || lc.height !== off.height) { lc.width = off.width; lc.height = off.height; _lcDirty = null; }
  const lctx = lc.getContext('2d')!;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  // Només cal netejar el que hi va deixar el frame anterior (les llums ocupen una part
  // petita de la pantalla): netejar el canvas sencer a cada frame era una passada de
  // pantalla completa de franc.
  if (_lcDirty) lctx.clearRect(_lcDirty.x, _lcDirty.y, _lcDirty.w, _lcDirty.h);
  else lctx.clearRect(0, 0, lc.width, lc.height);
  if (!_lightTmp2) _lightTmp2 = document.createElement('canvas');
  const tmp2 = _lightTmp2;
  if (tmp2.width !== off.width || tmp2.height !== off.height) { tmp2.width = off.width; tmp2.height = off.height; }
  const t2ctx = tmp2.getContext('2d')!;
  const T = octx.getTransform();
  const addPath = (c: CanvasRenderingContext2D, pts: { x: number; y: number }[]) => {
    c.beginPath();
    pts.forEach((p, i) => i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y));
    c.closePath();
  };
  let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
  const seen = new Set<string>();
  for (const { li, poly, roomPts } of polys) {
    // 0) Rectangle de pantalla que ocupa aquesta llum (el gradient ja la retalla al radi,
    //    així que res del que es pinti fora d'aquí sobreviuria al `source-in`).
    const cx = T.a * li.x + T.c * li.y + T.e;
    const cy = T.b * li.x + T.d * li.y + T.f;
    const rr = li.r * Math.abs(T.a) + 3;   // +3px de marge per a l'erosió i l'antialiàsing
    const bx = Math.max(0, Math.floor(cx - rr)), by = Math.max(0, Math.floor(cy - rr));
    const bw = Math.min(off.width, Math.ceil(cx + rr)) - bx;
    const bh = Math.min(off.height, Math.ceil(cy + rr)) - by;
    if (bw <= 0 || bh <= 0) continue;      // llum completament fora de pantalla
    if (bx < ux0) ux0 = bx;
    if (by < uy0) uy0 = by;
    if (bx + bw > ux1) ux1 = bx + bw;
    if (by + bh > uy1) uy1 = by + bh;
    seen.add(li.key);

    // 0b) Memòria cau del rasteritzat d'aquesta llum. Rasteritzar-la (màscara + erosió +
    //     gradient) és el gruix del cost del frame i es refeia per a TOTES les llums a cada
    //     frame, encara que només se n'hagués mogut una. La firma cobreix tot el que en
    //     determina els píxels: parets/portes, transformació de càmera, rectangle i
    //     posició/radi/intensitat de la llum (a ¼ de píxel de pantalla, per sota del que
    //     es pot distingir, perquè el LERP del token hi convergeixi de seguida).
    const ent = _maskCache.get(li.key);
    const q = (v: number) => Math.round(v * 4) / 4;
    const sig = `${wallsSig}|${T.a.toFixed(5)},${T.e.toFixed(2)},${T.f.toFixed(2)}|${bx},${by},${bw},${bh}|${q(cx)},${q(cy)},${q(rr)},${li.intensity.toFixed(3)}`;
    if (ent && ent.sig === sig && ent.cv.width === bw && ent.cv.height === bh) {
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.drawImage(ent.cv, 0, 0, bw, bh, bx, by, bw, bh);
      continue;
    }
    // El rasteritzat es fa directament al canvas de la memòria cau, en coordenades locals
    // del rectangle (origen a bx,by): així guardar-lo no costa cap còpia extra.
    const cv = ent?.cv ?? document.createElement('canvas');
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const cvx = cv.getContext('2d')!;

    // 1) Màscara d'UNIÓ (sala ∪ vessament per portes), plana i opaca. Pintar blanc sobre
    //    blanc NO dobla l'alfa a la zona de solapament → un sol "total" (clau per no
    //    destruir el gradient allà on la sala i el polígon de visió coincideixen).
    //    Es pinta DUES vegades, al canvas de la llum i a `tmp2`: l'erosió necessita una
    //    còpia intacta per no llegir i escriure el mateix canvas alhora, i tornar a traçar
    //    els dos polígons és més barat que copiar el rectangle amb un `drawImage` (els
    //    blits són el gruix del cost per llum; els `fill` no surten ni al perfil).
    const paintMask = (c: CanvasRenderingContext2D) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, bw, bh);
      c.save();
      c.beginPath(); c.rect(0, 0, bw, bh); c.clip();
      c.setTransform(T.a, T.b, T.c, T.d, T.e - bx, T.f - by);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#fff';
      if (roomPts && roomPts.length >= 3) { addPath(c, roomPts); c.fill(); }
      addPath(c, poly); c.fill();
    };
    paintMask(t2ctx);
    t2ctx.restore();
    paintMask(cvx);   // el `restore` d'aquest ve després del gradient (el retall hi val)

    // 1b) Erosió morfològica ~1px cap endins (smooth INTERIOR): la vora de la màscara
    //     s'endinsa 1px, així la llum s'atura ABANS de la paret i NO es pinta cap fil a la
    //     sala del costat (l'antialiàsing deixava d'esborrar foscor ~1px passada la paret).
    //     S'interseca la màscara amb ella mateixa desplaçada ±1px (destination-in), llegint
    //     de la còpia `tmp2`.
    cvx.setTransform(1, 0, 0, 1, 0, 0);
    cvx.globalCompositeOperation = 'destination-in';
    cvx.drawImage(tmp2, 0, 0, bw, bh, 1, 0, bw, bh);
    cvx.drawImage(tmp2, 0, 0, bw, bh, -1, 0, bw, bh);
    cvx.drawImage(tmp2, 0, 0, bw, bh, 0, 1, bw, bh);
    cvx.drawImage(tmp2, 0, 0, bw, bh, 0, -1, bw, bh);
    cvx.globalCompositeOperation = 'source-over';
    cvx.setTransform(T.a, T.b, T.c, T.d, T.e - bx, T.f - by);
    // 2) Aplicar el gradient radial UNA vegada sobre la unió (source-in).
    const g = cvx.createRadialGradient(li.x, li.y, 0, li.x, li.y, li.r);
    const iv = li.intensity;
    g.addColorStop(0, `rgba(0,0,0,${iv})`);
    g.addColorStop(0.9, `rgba(0,0,0,${iv})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cvx.globalCompositeOperation = 'source-in';
    cvx.fillStyle = g;
    cvx.fillRect(li.x - li.r, li.y - li.r, li.r * 2, li.r * 2);
    cvx.globalCompositeOperation = 'source-over';
    cvx.restore();   // treu el retall
    _maskCache.set(li.key, { sig, cv });
    // 3) Acumular aquesta llum a la capa de llum (només el seu rectangle: així el que hi
    //    hagi deixat una altra llum fora d'aquest rectangle no s'hi torna a sumar).
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.drawImage(cv, 0, 0, bw, bh, bx, by, bw, bh);
  }
  for (const k of _maskCache.keys()) if (!seen.has(k)) _maskCache.delete(k);
  if (ux1 <= ux0 || uy1 <= uy0) { _lcDirty = null; return; }  // cap llum a pantalla
  const uw = ux1 - ux0, uh = uy1 - uy0;
  _lcDirty = { x: ux0, y: uy0, w: uw, h: uh };
  // Fora de la unió dels rectangles de llum, `lc` és transparent i el `destination-out`
  // no hi canviaria res: compositar només aquesta finestra estalvia una passada de
  // pantalla completa per frame.
  octx.save();
  octx.globalCompositeOperation = 'destination-out';
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.drawImage(lc, ux0, uy0, uw, uh, ux0, uy0, uw, uh);
  octx.restore();
  octx.globalCompositeOperation = 'source-over';
}

function roomPath(ctx: CanvasRenderingContext2D, room: Room): void {
  ctx.beginPath();
  room.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
}

// Ull (obert/tancat) dibuixat en coords de mapa però a mida constant de pantalla (÷ sc).
function drawEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, sc: number, open: boolean): void {
  const s = 1 / sc;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = open ? 'rgba(255,255,255,0.92)' : 'rgba(28,28,28,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = open ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5; ctx.stroke();
  const col = open ? '#111' : '#eee';
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.bezierCurveTo(-8, -5, 8, -5, 8, 0); ctx.bezierCurveTo(8, 5, -8, 5, -8, 0); ctx.stroke();
  if (open) { ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(8, -5); ctx.stroke(); }
  ctx.restore();
}

/**
 * Sales detectades. Al jugador: foscor opaca a les sales fosques no revelades (fade suau
 * en revelar). Al DM: overlay semitransparent (per veure-hi a través) + contorn + nom +
 * ull en passar-hi per sobre. Les sales normals (no fosques) només es marquen al DM.
 * Es dibuixa dins de la transformació de mapa (ctx ja translladat/escalat).
 */
export function renderRooms(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const rRooms = fc.rRooms; if (!rRooms) return;
  const rooms = rRooms.current;
  if (!rooms || rooms.length === 0) return;
  const { isDM, sc, ox, oy } = fc;
  const anim = fc.roomRevealAnimRef?.current ?? {};
  const hovId = fc.rHoveredRoomId?.current ?? null;

  // Farcir amb el polígon exacte + contorn del mateix color eixampla la foscor uns
  // píxels cap enfora, de manera que dues sales contigües se solapin i no quedi cap
  // fil visible del mapa a la paret compartida.
  const seamW = Math.max(2, 2.5 / sc);

  // Rectangle visible en coords de mapa: tot el que hi queda fora no pot pintar ni un
  // píxel, però amb desenes de sales el cost de traçar-les totes (fill + stroke, i els
  // contorns/etiquetes del DM) es pagava igualment a cada frame. Es cullen només per a
  // PINTAR: la llista sencera (`fills`) segueix alimentant la memòria d'explorat, perquè
  // una sala que s'explora fora de pantalla ha de quedar memoritzada igualment.
  const vpad = seamW + 2;
  const vx0 = -ox / sc - vpad, vy0 = -oy / sc - vpad;
  const vx1 = (ctx.canvas.width - ox) / sc + vpad, vy1 = (ctx.canvas.height - oy) / sc + vpad;
  const onScreen = (room: Room): boolean => {
    const b = room.bbox;
    return !(b.right < vx0 || b.left > vx1 || b.bottom < vy0 || b.top > vy1);
  };

  // 1) Actualitzar l'animació de revelat i recollir la foscor a pintar de cada sala.
  const fills: { room: Room; alpha: number }[] = [];
  const visFills: { room: Room; alpha: number }[] = [];
  const animOut: Record<string, number> = fc.roomRevealAnimRef ? fc.roomRevealAnimRef.current : {};
  for (const room of rooms) {
    const tgt = room.dark && !room.revealed ? 1 : 0;
    const prev = anim[room.id] ?? tgt;
    const next = prev + (tgt - prev) * REVEAL_LERP;
    animOut[room.id] = Math.abs(next - tgt) < 0.004 ? tgt : next;
    const a = animOut[room.id] ?? tgt;
    if (room.dark && a > 0.004) {
      const f = { room, alpha: isDM ? 0.14 + a * 0.5 : a };
      fills.push(f);
      if (onScreen(room)) visFills.push(f);
    }
  }

  // 2) Capa de foscor amb la llum dels tokens de jugador retallada (línia de visió).
  if (fills.length > 0) {
    const lights = collectLights(fc);
    // Parets efectives per a la llum: amb els forats de porta ANIMATS (obrir/tancar suau).
    const lw = lights.length > 0 ? lightWalls(fc) : null;
    const walls = lw?.walls ?? [];
    if (lights.length === 0) {
      // Sense fonts de llum: pintar la foscor directament (com sempre).
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineWidth = seamW; ctx.setLineDash([]);
      for (const f of visFills) {
        ctx.fillStyle = `rgba(3,4,7,${f.alpha})`;
        ctx.strokeStyle = `rgba(3,4,7,${f.alpha})`;
        roomPath(ctx, f.room); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    } else {
      // Amb llums: la foscor es pinta en una capa fora de pantalla, s'hi esborren les
      // zones il·luminades (destination-out) i es composita el resultat sobre el mapa.
      const main = ctx.canvas;
      if (!_darkCanvas) _darkCanvas = document.createElement('canvas');
      const off = _darkCanvas;
      if (off.width !== main.width || off.height !== main.height) { off.width = main.width; off.height = main.height; }
      const octx = off.getContext('2d')!;
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, off.width, off.height);
      octx.setTransform(ctx.getTransform());
      octx.lineJoin = 'round'; octx.lineWidth = seamW; octx.setLineDash([]);
      for (const f of visFills) {
        octx.fillStyle = `rgba(3,4,7,${f.alpha})`;
        octx.strokeStyle = `rgba(3,4,7,${f.alpha})`;
        roomPath(octx, f.room); octx.fill(); octx.stroke();
      }
      // Polígons de visibilitat de cada llum + la sala que conté el token (perquè dins de la
      // seva sala vegi tot el radi, sense ombres internes).
      // El polígon de cada llum es recalcula NOMÉS si la llum s'ha mogut / ha canviat de
      // radi o si les parets efectives han canviat; si no, es reutilitza el de la memòria
      // cau (cas normal: entre moviments res no canvia i el raycasting era gratuït).
      const polys: LightPoly[] = [];
      const wallsSig = lw!.sig;
      let anyRecomputed = false;
      const seenVis = new Set<string>();
      for (const li of lights) {
        seenVis.add(li.key);
        const vsig = `${wallsSig}|${Math.round(li.x)},${Math.round(li.y)},${Math.round(li.r)}`;
        let ent = _visCache.get(li.key);
        if (!ent || ent.sig !== vsig) {
          ent = { sig: vsig, poly: visibilityPolygon({ x: li.x, y: li.y }, walls, li.r) };
          _visCache.set(li.key, ent);
          anyRecomputed = true;
        }
        if (ent.poly.length < 3) continue;
        const room = roomAt(rooms, li.x, li.y);
        polys.push({ li, poly: ent.poly, roomPts: room?.points });
      }
      for (const k of _visCache.keys()) if (!seenVis.has(k)) { _visCache.delete(k); anyRecomputed = true; }
      // Esborra la llum actual del tot: unió de la sala pròpia + vessament per portes.
      carveLights(octx, polys, wallsSig);

      // Rectangle de pantalla que cobreixen les sales fosques visibles. Fora d'aquí `off`
      // no té alpha (no s'hi ha pintat cap sala), o sigui que ni el compòsit de la foscor
      // ni el del terreny memoritzat hi poden canviar res: limitar-hi les passades de
      // pantalla completa estalvia reescalar el mapa sencer a cada frame quan la vista
      // no és tota fosca.
      let sbx0 = Infinity, sby0 = Infinity, sbx1 = -Infinity, sby1 = -Infinity;
      for (const f of visFills) {
        const b = f.room.bbox;
        sbx0 = Math.min(sbx0, ox + (b.left - seamW) * sc);
        sby0 = Math.min(sby0, oy + (b.top - seamW) * sc);
        sbx1 = Math.max(sbx1, ox + (b.right + seamW) * sc);
        sby1 = Math.max(sby1, oy + (b.bottom + seamW) * sc);
      }
      const dx0 = Math.max(0, Math.floor(sbx0)), dy0 = Math.max(0, Math.floor(sby0));
      const dw = Math.min(main.width, Math.ceil(sbx1)) - dx0;
      const dh = Math.min(main.height, Math.ceil(sby1)) - dy0;
      const hasDark = visFills.length > 0 && dw > 0 && dh > 0;

      if (hasDark) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(off, dx0, dy0, dw, dh, dx0, dy0, dw, dh);
        ctx.restore();
      }

      // ── Terra explorada (memòria estil AoE) ──────────────────────────────────────
      // A les zones ja vistes però ARA fosques (no il·luminades) es mostra el mapa de fons
      // ATENUAT: saps el terreny, però els tokens (dibuixats sota la foscor opaca) queden
      // amagats. Regió = explorat ∩ fosc-no-il·luminat (= on `off` encara té alpha). Les
      // zones no explorades es queden negres; les il·luminades ara es veuen en viu.
      const media = fc.mediaEl;
      const mediaReady = !!media && ((media.tagName === 'IMG' && (media as HTMLImageElement).naturalWidth > 0) || (media.tagName === 'VIDEO' && (media as HTMLVideoElement).videoWidth > 0));
      if (media && mediaReady && polys.length > 0) {
        // Acumula l'explorat NOMÉS dins de sales fosques (fills, TOTES, també les de fora
        // de pantalla: el que s'explora sense mirar-s'hi ha de quedar memoritzat igual) i
        // dins del radi. Si cap polígon de visió ha canviat, la màscara ja conté exactament
        // el mateix: saltar-ho estalvia un clip + fill per llum a cada frame quiet.
        if (anyRecomputed || _exploredDirty) {
          _exploredDirty = false;
          accumulateExplored(polys, fills.map(f => f.room), fc.mw, fc.mh);
        }
        // Totes les passades següents es limiten al rectangle de les sales fosques
        // visibles: el terreny memoritzat només es veu on `off` té alpha.
        if (hasDark) {
          const ex = ensureExplored(fc.mw, fc.mh);
          if (!_memCanvas) _memCanvas = document.createElement('canvas');
          const mem = _memCanvas;
          if (mem.width !== main.width || mem.height !== main.height) { mem.width = main.width; mem.height = main.height; }
          const mctx = mem.getContext('2d')!;
          mctx.setTransform(1, 0, 0, 1, 0, 0);
          mctx.clearRect(dx0, dy0, dw, dh);
          mctx.save();
          mctx.beginPath(); mctx.rect(dx0, dy0, dw, dh); mctx.clip();
          mctx.globalCompositeOperation = 'source-over';
          // 1) el terreny (mapa de fons) en coords de map
          mctx.setTransform(ctx.getTransform());
          mctx.drawImage(media, 0, 0, fc.mw, fc.mh);
          // 2) retallar-lo a les zones explorades
          mctx.globalCompositeOperation = 'destination-in';
          mctx.setTransform(ctx.getTransform());
          mctx.drawImage(ex.canvas, 0, 0, fc.mw, fc.mh);
          // 3) i a les que encara són fosques ara (alpha de `off` post-carve = fosc-no-lluminat)
          mctx.globalCompositeOperation = 'destination-in';
          mctx.setTransform(1, 0, 0, 1, 0, 0);
          mctx.drawImage(off, dx0, dy0, dw, dh, dx0, dy0, dw, dh);
          mctx.globalCompositeOperation = 'source-over';
          mctx.restore();
          // Composita el terreny memoritzat, atenuat, damunt de la foscor (amaga els tokens).
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = MEM_DIM;
          ctx.drawImage(mem, dx0, dy0, dw, dh, dx0, dy0, dw, dh);
          ctx.restore();
        }
      }

      // DEBUG (tecla L): parets efectives (magenta) + polígon de visió (cian) + radi (groc).
      if (_lightDebug) {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,0,255,0.95)'; ctx.lineWidth = Math.max(2 / sc, 4 / sc);
        ctx.beginPath();
        for (const w of walls) { ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,255,255,0.9)'; ctx.lineWidth = 1.5 / sc; ctx.setLineDash([6 / sc, 4 / sc]);
        for (const { poly } of polys) {
          ctx.beginPath();
          poly.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.closePath(); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,255,0,0.5)'; ctx.lineWidth = 1.5 / sc;
        for (const { li } of polys) { ctx.beginPath(); ctx.arc(li.x, li.y, li.r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
    }
  }

  if (!isDM) return;

  // 3) DM: contorns, noms i ull per sobre de la foscor (només les sales visibles).
  for (const room of rooms) {
    if (!onScreen(room)) continue;
    const tgt = room.dark && !room.revealed ? 1 : 0;
    const a = animOut[room.id] ?? tgt;
    const isHov = hovId === room.id;
    if (room.dark) {
      roomPath(ctx, room);
      ctx.strokeStyle = isHov ? 'rgba(255,255,255,0.85)' : `rgba(88,166,255,${0.55 + a * 0.25})`;
      ctx.lineWidth = (isHov ? 2.4 : 1.6) / sc; ctx.setLineDash([]);
      ctx.stroke();
    } else {
      roomPath(ctx, room);
      ctx.strokeStyle = isHov ? 'rgba(255,255,255,0.7)' : `${C.room}77`;
      ctx.lineWidth = (isHov ? 2 : 1.4) / sc;
      ctx.setLineDash([7 / sc, 5 / sc]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `${C.room}0d`; ctx.fill();
    }

    // Nom (o ull en hover) al centroide.
    const { cx, cy } = room.bbox;
    if (isHov) {
      drawEye(ctx, cx, cy, sc, room.dark ? tgt === 0 : true);
    } else {
      ctx.font = `600 ${12 / sc}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = room.dark ? (room.revealed ? 'rgba(255,255,255,0.4)' : 'rgba(180,205,255,0.7)') : `${C.room}cc`;
      const label = room.dark ? (room.revealed ? `${room.name} · obert` : `${room.name} · fosc`) : room.name;
      ctx.fillText(label, cx, cy);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }
}

// Marca de porta (només DM): rectangle de traç gruixut muntat sobre la paret, amb el
// MATEIX daurat que les parets. Oberta → buit per dins (el forat de la paret es veu a
// dins del rectangle); tancada → l'interior es pinta ple. En hover (mode selecció) es
// ressalta com un botó (traç més brillant i gruixut + halo), perquè es vegi que és
// clicable. Es dibuixa dins la transformació de mapa; `alpha` permet fer-la de preview.
function drawDoorMark(ctx: CanvasRenderingContext2D, d: { a: { x: number; y: number }; b: { x: number; y: number } }, sc: number, alpha: number, open: boolean, hovered = false): void {
  const dx = d.b.x - d.a.x, dy = d.b.y - d.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const nx = -dy / len, ny = dx / len;
  const h = 7 / sc;  // semi-gruix del rectangle (perpendicular a la paret)
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(d.a.x + nx * h, d.a.y + ny * h);
  ctx.lineTo(d.b.x + nx * h, d.b.y + ny * h);
  ctx.lineTo(d.b.x - nx * h, d.b.y - ny * h);
  ctx.lineTo(d.a.x - nx * h, d.a.y - ny * h);
  ctx.closePath();
  if (hovered) {
    // Halo exterior (reactiu de cursor, com un botó web)
    ctx.strokeStyle = 'rgba(255,220,90,0.35)';
    ctx.lineWidth = 9 / sc;
    ctx.stroke();
  }
  if (!open) {
    ctx.fillStyle = hovered ? 'rgba(240,190,50,0.72)' : `rgba(214,160,23,${0.55 * alpha})`;
    ctx.fill();
  }
  ctx.strokeStyle = hovered ? 'rgba(255,224,102,1)' : `rgba(214,160,23,${0.9 * alpha})`;
  ctx.lineWidth = (hovered ? 4 : 3) / sc;
  ctx.stroke();
  ctx.restore();
}

/**
 * Parets dibuixades pel DM (no es mostren al jugador). Dins de la transformació de mapa.
 * El traç sòlid usa les parets EFECTIVES (amb el forat de cada porta retallat) i cada
 * porta es dibuixa amb la seva marca (rectangle groc buit; tancada → farciment tènue).
 */
export function renderWalls(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const rWalls = fc.rWalls; if (!rWalls) return;
  const allWalls = rWalls.current;
  if (!allWalls || allWalls.length === 0) return;
  const doors = fc.rDoors?.current ?? [];
  const walls = effectiveWalls(allWalls, doors);
  const { sc } = fc;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(214,160,23,0.85)';
  ctx.lineWidth = Math.max(1.5 / sc, 3 / sc);
  ctx.beginPath();
  for (const w of walls) { ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); }
  ctx.stroke();
  // Vèrtexs (de les parets originals: els extrems de porta no són vèrtexs editables).
  // Amb l'eina Parets i sense cap cadena en curs es pinten més grossos: són nanses que
  // es poden agafar i moure, i si no es veuen ningú no ho endevina.
  const editable = fc.rDrawTool?.current === 'wall' && !fc.rWallPenLast?.current;
  ctx.fillStyle = 'rgba(255,220,90,0.95)';
  const r = (editable ? 4.5 : 3) / sc;
  for (const w of allWalls) {
    ctx.beginPath(); ctx.arc(w.a.x, w.a.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w.b.x, w.b.y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Nansa del vèrtex sota el cursor (o del que s'està movent).
  const hovV = fc.rWallVertexHover?.current ?? null;
  if (editable && hovV) {
    const dragging = !!fc.rWallVertexDrag?.current;
    ctx.beginPath(); ctx.arc(hovV.x, hovV.y, 8 / sc, 0, Math.PI * 2);
    ctx.fillStyle = dragging ? 'rgba(255,235,150,0.95)' : 'rgba(255,235,150,0.75)';
    ctx.fill();
    ctx.beginPath(); ctx.arc(hovV.x, hovV.y, 11 / sc, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2 / sc;
    ctx.stroke();
  }
  ctx.restore();
  const hovDoor = fc.rHoveredDoorId?.current ?? null;
  for (const d of doors) drawDoorMark(ctx, d, sc, 1, d.open !== false, d.id === hovDoor);
}

/**
 * Mode de col·locació de porta (s'activa sol en tancar una sala): previsualització de la
 * porta imantada a la paret sota el cursor + rètol d'ajuda. Espai de pantalla (després de
 * ctx.restore()), com renderWallDraft.
 */
export function renderDoorDraft(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const placement = fc.rDoorPlacement?.current;
  if (!placement) return;
  const prev = fc.rDoorPreview?.current ?? null;
  if (!prev) return;
  const { sc, ox, oy } = fc;
  const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 240);
  const hasAnchor = !!placement.anchor;
  const len = Math.hypot(prev.b.x - prev.a.x, prev.b.y - prev.a.y);

  ctx.save();
  ctx.translate(ox, oy); ctx.scale(sc, sc);
  if (hasAnchor && len > 1e-3) {
    // Segon pas: previsualització del segment de porta (interior pintat = tancada).
    drawDoorMark(ctx, prev, sc, pulse, false);
  } else {
    // Primer pas: marca del punt d'inici imantat a la paret.
    ctx.fillStyle = `rgba(255,220,90,${0.85 * pulse})`;
    ctx.beginPath(); ctx.arc(prev.a.x, prev.a.y, 5 / sc, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(214,160,23,0.9)'; ctx.lineWidth = 2 / sc;
    ctx.beginPath(); ctx.arc(prev.a.x, prev.a.y, 10 / sc, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  const mx = ox + ((prev.a.x + prev.b.x) / 2) * sc;
  const my = oy + ((prev.a.y + prev.b.y) / 2) * sc;
  ctx.save();
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const gs = fc.rGridSize.current > 0 ? fc.rGridSize.current : 70;
  const ft = Math.round((len / gs) * 5);
  const text = hasAnchor
    ? `🚪 Porta ${ft} ft · Clic: fixa el final · Maj+clic: una altra · Esc: desfés l'inici`
    : `🚪 Clic: marca l'inici de la porta · Esc: ometre`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10,13,18,0.85)';
  ctx.fillRect(mx - tw / 2 - 8, my - 36, tw + 16, 20);
  ctx.strokeStyle = 'rgba(63,185,80,0.55)'; ctx.lineWidth = 1;
  ctx.strokeRect(mx - tw / 2 - 8, my - 36, tw + 16, 20);
  ctx.fillStyle = '#7ee787';
  ctx.fillText(text, mx, my - 26);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.restore();
}

/**
 * Punts de llum (torxes/llànties) — NOMÉS al DM. Un solet groc de mida < mitja casella
 * amb un anell tènue que mostra el radi que il·lumina. El jugador no veu el marcador (només
 * la zona il·luminada, gestionada a renderRooms). La llum seleccionada es ressalta.
 * Es dibuixa dins la transformació de mapa (ctx ja translladat/escalat).
 */
export function renderLightSources(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const rLights = fc.rLights; if (!rLights) return;
  const lights = rLights.current;
  if (!lights || lights.length === 0) return;
  const { sc } = fc;
  const gs = fc.rGridSize.current > 0 ? fc.rGridSize.current : 70;
  const selId = fc.rLightSelected?.current ?? null;
  const rad = gs * 0.22;            // mida del solet: menys de mitja casella
  const ray = gs * 0.34;            // llargada dels raigs
  for (const ls of lights) {
    const sel = ls.id === selId;
    // Anell tènue del radi d'il·luminació (referència pel DM).
    ctx.save();
    ctx.setLineDash([6 / sc, 5 / sc]);
    ctx.strokeStyle = sel ? 'rgba(255,210,80,0.55)' : 'rgba(255,210,80,0.28)';
    ctx.lineWidth = 1.4 / sc;
    ctx.beginPath(); ctx.arc(ls.x, ls.y, Math.max(1, ls.radiusFt / 5) * gs, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // Raigs del sol.
    ctx.save();
    ctx.strokeStyle = sel ? '#ffe066' : 'rgba(255,200,50,0.95)';
    ctx.lineWidth = 2 / sc; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const c = Math.cos(ang), s = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(ls.x + c * rad * 1.15, ls.y + s * rad * 1.15);
      ctx.lineTo(ls.x + c * ray, ls.y + s * ray);
      ctx.stroke();
    }
    // Disc central.
    const g = ctx.createRadialGradient(ls.x, ls.y, 0, ls.x, ls.y, rad);
    g.addColorStop(0, '#fff4c0'); g.addColorStop(0.6, '#ffd24a'); g.addColorStop(1, '#f2a900');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ls.x, ls.y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = sel ? '#ffffff' : 'rgba(180,120,0,0.9)';
    ctx.lineWidth = (sel ? 2.2 : 1.4) / sc;
    ctx.beginPath(); ctx.arc(ls.x, ls.y, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/**
 * Paret en curs (eina "Parets") en espai de pantalla: línia elàstica de l'últim vèrtex al
 * cursor, distància en peus i anell d'imant quan el cursor s'enganxa a un vèrtex existent
 * (tancament). Es crida després de ctx.restore() (com la regla de mesura).
 */
export function renderWallDraft(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  if (fc.rDrawTool?.current !== 'wall') return;
  const last = fc.rWallPenLast?.current ?? null;
  const cur = fc.rWallCursor?.current ?? null;
  const { sc, ox, oy, rGridSize } = fc;
  ctx.save();
  if (cur) {
    const cx = ox + cur.x * sc, cy = oy + cur.y * sc;
    if (last) {
      const lx = ox + last.x * sc, ly = oy + last.y * sc;
      ctx.strokeStyle = 'rgba(255,210,0,0.7)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.setLineDash([]);
      const gs = rGridSize.current > 0 ? rGridSize.current : 70;
      const ft = Math.round((Math.hypot(cur.x - last.x, cur.y - last.y) / gs) * 5);
      const mx = (lx + cx) / 2, my = (ly + cy) / 2;
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const text = `${ft}ft`; const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(10,13,18,0.82)'; ctx.fillRect(mx - tw / 2 - 6, my - 19, tw + 12, 16);
      ctx.fillStyle = '#ffd200'; ctx.fillText(text, mx, my - 11);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
    // Punt del cursor / anell d'imant de tancament
    ctx.fillStyle = cur.onVertex ? '#3fb950' : 'rgba(255,220,60,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
    if (cur.onVertex) {
      ctx.strokeStyle = 'rgba(63,185,80,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (last) {
    const lx = ox + last.x * sc, ly = oy + last.y * sc;
    ctx.fillStyle = 'rgba(255,210,0,0.95)';
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
