import type { FrameContext } from './types';
import type { Room } from '@/types';
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
  }
  return { canvas: _exploredCanvas, scale: _exploredScale };
}

// Acumula els polígons de visibilitat actuals a la màscara d'explorat (alpha opac).
function accumulateExplored(polys: { poly: { x: number; y: number }[] }[], mw: number, mh: number): void {
  const ex = ensureExplored(mw, mh);
  const ectx = ex.canvas.getContext('2d')!;
  ectx.save();
  ectx.setTransform(ex.scale, 0, 0, ex.scale, 0, 0);
  ectx.fillStyle = 'rgba(255,255,255,1)';
  for (const { poly } of polys) {
    if (poly.length < 3) continue;
    ectx.beginPath();
    poly.forEach((p, i) => i === 0 ? ectx.moveTo(p.x, p.y) : ectx.lineTo(p.x, p.y));
    ectx.closePath(); ectx.fill();
  }
  ectx.restore();
}

interface Light { x: number; y: number; r: number; intensity: number; }

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
    lights.push({ x: pos.x + R, y: pos.y + R, r: a.r, intensity: a.i });
  }
  for (const k of _lightAnim.keys()) if (!seen.has(k)) _lightAnim.delete(k);
  return lights;
}

// Fa avançar l'obertura animada de les portes cap al seu estat (obert/tancat) i retorna
// les parets efectives per a la LLUM (forats de porta animats). La col·lisió usa a part la
// versió binària (effectiveWalls).
function lightWalls(fc: FrameContext): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  const allWalls = fc.rWalls?.current ?? [];
  const allDoors = fc.rDoors?.current ?? [];
  const present = new Set<string>();
  for (const d of allDoors) {
    present.add(d.id);
    const tgt = d.open !== false ? 1 : 0;
    let f = _doorAnim.get(d.id);
    if (f === undefined) f = tgt;
    f += (tgt - f) * DOOR_LERP;
    if (Math.abs(tgt - f) < 0.01) f = tgt;
    _doorAnim.set(d.id, f);
  }
  for (const k of _doorAnim.keys()) if (!present.has(k)) _doorAnim.delete(k);
  return effectiveWallsAnimated(allWalls, allDoors, id => _doorAnim.get(id) ?? 0);
}

// Esborra de la capa de foscor la zona il·luminada per cada llum: el polígon de
// visibilitat (les parets bloquegen la llum; s'escola per les obertures/portes obertes)
// retallat amb un gradient radial perquè la sala "es vagi il·luminant" amb la distància.
// La llum s'atura EXACTAMENT a les parets (el polígon les respecta): res de blur ni
// d'engreix, que feien vessar un marge de llum a la sala del costat. El gradient radial ja
// dóna la vora exterior suau al radi de visió.
function carveLights(octx: CanvasRenderingContext2D, polys: { li: Light; poly: { x: number; y: number }[] }[], sc: number): void {
  const off = octx.canvas;
  if (!_lightCanvas) _lightCanvas = document.createElement('canvas');
  const lc = _lightCanvas;
  if (lc.width !== off.width || lc.height !== off.height) { lc.width = off.width; lc.height = off.height; }
  const lctx = lc.getContext('2d')!;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, lc.width, lc.height);
  lctx.setTransform(octx.getTransform());
  // Gruix (px de pantalla → unitats de mapa) del traç interior que segella la vora.
  const edge = 5 / (sc > 0 ? sc : 1);
  for (const { li, poly } of polys) {
    const g = lctx.createRadialGradient(li.x, li.y, 0, li.x, li.y, li.r);
    // Plena brillantor fins al 90% del radi i esvaïment només a l'últim tram: així una sala
    // més petita que el radi queda del tot il·luminada fins a les seves parets, sense un
    // marge fosc arran de paret. La intensitat (0..1) escala l'esborrat (esvaïment en morir).
    const iv = li.intensity;
    g.addColorStop(0, `rgba(0,0,0,${iv})`);
    g.addColorStop(0.9, `rgba(0,0,0,${iv})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.save();
    lctx.beginPath();
    poly.forEach((p, i) => i === 0 ? lctx.moveTo(p.x, p.y) : lctx.lineTo(p.x, p.y));
    lctx.closePath();
    lctx.clip();
    lctx.fillStyle = g;
    lctx.fillRect(li.x - li.r, li.y - li.r, li.r * 2, li.r * 2);
    // Traç de la vora del polígon RETALLAT a l'interior (el clip encara és actiu): esborra
    // el fil fosc que quedava arran de paret (el polígon queda un pèl per dins) SENSE vessar
    // cap enfora — la meitat exterior del traç queda fora del clip i es descarta.
    lctx.strokeStyle = g;
    lctx.lineJoin = 'round';
    lctx.lineWidth = edge;
    lctx.stroke();
    lctx.restore();
  }
  octx.save();
  octx.globalCompositeOperation = 'destination-out';
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.drawImage(lc, 0, 0);
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
  const { isDM, sc } = fc;
  const anim = fc.roomRevealAnimRef?.current ?? {};
  const hovId = fc.rHoveredRoomId?.current ?? null;

  // Farcir amb el polígon exacte + contorn del mateix color eixampla la foscor uns
  // píxels cap enfora, de manera que dues sales contigües se solapin i no quedi cap
  // fil visible del mapa a la paret compartida.
  const seamW = Math.max(2, 2.5 / sc);

  // 1) Actualitzar l'animació de revelat i recollir la foscor a pintar de cada sala.
  const fills: { room: Room; alpha: number }[] = [];
  const animOut: Record<string, number> = fc.roomRevealAnimRef ? fc.roomRevealAnimRef.current : {};
  for (const room of rooms) {
    const tgt = room.dark && !room.revealed ? 1 : 0;
    const prev = anim[room.id] ?? tgt;
    const next = prev + (tgt - prev) * REVEAL_LERP;
    animOut[room.id] = Math.abs(next - tgt) < 0.004 ? tgt : next;
    const a = animOut[room.id] ?? tgt;
    if (room.dark && a > 0.004) fills.push({ room, alpha: isDM ? 0.14 + a * 0.5 : a });
  }

  // 2) Capa de foscor amb la llum dels tokens de jugador retallada (línia de visió).
  if (fills.length > 0) {
    const lights = collectLights(fc);
    // Parets efectives per a la llum: amb els forats de porta ANIMATS (obrir/tancar suau).
    const walls = lights.length > 0 ? lightWalls(fc) : [];
    if (lights.length === 0) {
      // Sense fonts de llum: pintar la foscor directament (com sempre).
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineWidth = seamW; ctx.setLineDash([]);
      for (const f of fills) {
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
      for (const f of fills) {
        octx.fillStyle = `rgba(3,4,7,${f.alpha})`;
        octx.strokeStyle = `rgba(3,4,7,${f.alpha})`;
        roomPath(octx, f.room); octx.fill(); octx.stroke();
      }
      // Polígons de visibilitat de cada llum (calculats un cop).
      const polys: { li: Light; poly: { x: number; y: number }[] }[] = [];
      for (const li of lights) {
        const poly = visibilityPolygon({ x: li.x, y: li.y }, walls, li.r);
        if (poly.length >= 3) polys.push({ li, poly });
      }
      // Esborra la llum actual del tot (línia de visió), sense vessament fora de les parets.
      carveLights(octx, polys, sc);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(off, 0, 0);
      ctx.restore();

      // ── Terra explorada (memòria estil AoE) ──────────────────────────────────────
      // A les zones ja vistes però ARA fosques (no il·luminades) es mostra el mapa de fons
      // ATENUAT: saps el terreny, però els tokens (dibuixats sota la foscor opaca) queden
      // amagats. Regió = explorat ∩ fosc-no-il·luminat (= on `off` encara té alpha). Les
      // zones no explorades es queden negres; les il·luminades ara es veuen en viu.
      const media = fc.mediaEl;
      const mediaReady = !!media && ((media.tagName === 'IMG' && (media as HTMLImageElement).naturalWidth > 0) || (media.tagName === 'VIDEO' && (media as HTMLVideoElement).videoWidth > 0));
      if (media && mediaReady && polys.length > 0) {
        accumulateExplored(polys, fc.mw, fc.mh);
        const ex = ensureExplored(fc.mw, fc.mh);
        if (!_memCanvas) _memCanvas = document.createElement('canvas');
        const mem = _memCanvas;
        if (mem.width !== main.width || mem.height !== main.height) { mem.width = main.width; mem.height = main.height; }
        const mctx = mem.getContext('2d')!;
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.clearRect(0, 0, mem.width, mem.height);
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
        mctx.drawImage(off, 0, 0);
        mctx.globalCompositeOperation = 'source-over';
        // Composita el terreny memoritzat, atenuat, damunt de la foscor (amaga els tokens).
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = MEM_DIM;
        ctx.drawImage(mem, 0, 0);
        ctx.restore();
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

  // 3) DM: contorns, noms i ull per sobre de la foscor.
  for (const room of rooms) {
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
  // Vèrtexs (de les parets originals: els extrems de porta no són vèrtexs editables)
  ctx.fillStyle = 'rgba(255,220,90,0.95)';
  const r = 3 / sc;
  for (const w of allWalls) {
    ctx.beginPath(); ctx.arc(w.a.x, w.a.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w.b.x, w.b.y, r, 0, Math.PI * 2); ctx.fill();
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
