import type { FrameContext } from './types';
import type { Room } from '@/types';
import { C, DEFAULT_VISION_FT } from '@/constants';
import { visibilityPolygon } from '@/lib/rooms/visibility';
import { effectiveWalls } from '@/lib/rooms/doors';

const REVEAL_LERP = 0.09;

// Capa de foscor reutilitzada entre frames (mateixa mida que el canvas principal).
let _darkCanvas: HTMLCanvasElement | null = null;

interface Light { x: number; y: number; r: number; }

// Fonts de llum: cada token de jugador visible i no derrotat emet llum dins del seu radi
// de visió (`Player.visionFt`, per defecte DEFAULT_VISION_FT; 0 = sense llum). El centre
// segueix la posició suavitzada (LERP) perquè la llum es mogui fluida amb el token.
function collectLights(fc: FrameContext): Light[] {
  const gs = fc.rGridSize.current > 0 ? fc.rGridSize.current : 70;
  const lights: Light[] = [];
  for (const pl of fc.rPlayers.current) {
    if (!pl.visible) continue;
    const key = `pl_${pl.id}`;
    if (fc.rDefeated.current[key]) continue;
    const visionFt = pl.visionFt ?? DEFAULT_VISION_FT;
    if (visionFt <= 0) continue;
    const R = fc.rTokenSizeOverride.current[key] ?? 22;
    const pos = fc.visualPosRef.current[key] ?? fc.pp[key];
    if (!pos) continue;
    lights.push({ x: pos.x + R, y: pos.y + R, r: (visionFt / 5) * gs });
  }
  return lights;
}

// Esborra de la capa de foscor la zona il·luminada per cada llum: el polígon de
// visibilitat (les parets bloquegen la llum; s'escola per les obertures/portes) retallat
// amb un gradient radial perquè la sala "es vagi il·luminant" gradualment amb la distància.
function carveLights(octx: CanvasRenderingContext2D, lights: Light[], walls: { a: { x: number; y: number }; b: { x: number; y: number } }[]): void {
  octx.globalCompositeOperation = 'destination-out';
  for (const li of lights) {
    const poly = visibilityPolygon({ x: li.x, y: li.y }, walls, li.r);
    if (poly.length < 3) continue;
    octx.save();
    octx.beginPath();
    poly.forEach((p, i) => i === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y));
    octx.closePath();
    octx.clip();
    const g = octx.createRadialGradient(li.x, li.y, 0, li.x, li.y, li.r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.92)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g;
    octx.fillRect(li.x - li.r, li.y - li.r, li.r * 2, li.r * 2);
    octx.restore();
  }
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
    // Parets efectives: amb els trams de porta retallats (la llum passa per les portes).
    const walls = effectiveWalls(fc.rWalls?.current ?? [], fc.rDoors?.current ?? []);
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
      carveLights(octx, lights, walls);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(off, 0, 0);
      ctx.restore();
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

// Marca de porta (només DM): brancals perpendiculars als extrems + línia discontínua al
// forat. Es dibuixa dins la transformació de mapa; `alpha` permet fer-la servir de preview.
function drawDoorMark(ctx: CanvasRenderingContext2D, d: { a: { x: number; y: number }; b: { x: number; y: number } }, sc: number, alpha: number): void {
  const dx = d.b.x - d.a.x, dy = d.b.y - d.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const nx = -dy / len, ny = dx / len;
  const j = 7 / sc;  // semi-llargada dels brancals
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(63,185,80,${0.95 * alpha})`;
  ctx.lineWidth = 3.5 / sc;
  ctx.beginPath();
  ctx.moveTo(d.a.x - nx * j, d.a.y - ny * j); ctx.lineTo(d.a.x + nx * j, d.a.y + ny * j);
  ctx.moveTo(d.b.x - nx * j, d.b.y - ny * j); ctx.lineTo(d.b.x + nx * j, d.b.y + ny * j);
  ctx.stroke();
  ctx.strokeStyle = `rgba(120,220,140,${0.75 * alpha})`;
  ctx.lineWidth = 2 / sc;
  ctx.setLineDash([5 / sc, 4 / sc]);
  ctx.beginPath(); ctx.moveTo(d.a.x, d.a.y); ctx.lineTo(d.b.x, d.b.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Parets dibuixades pel DM (no es mostren al jugador). Dins de la transformació de mapa.
 * El traç sòlid usa les parets EFECTIVES (amb el forat de cada porta retallat) i cada
 * porta es dibuixa amb la seva marca (brancals verds + línia discontínua).
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
  for (const d of doors) drawDoorMark(ctx, d, sc, 1);
}

/**
 * Mode de col·locació de porta (s'activa sol en tancar una sala): previsualització de la
 * porta imantada a la paret sota el cursor + rètol d'ajuda. Espai de pantalla (després de
 * ctx.restore()), com renderWallDraft.
 */
export function renderDoorDraft(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  if (!fc.rDoorPlacement?.current) return;
  const prev = fc.rDoorPreview?.current ?? null;
  const { sc, ox, oy } = fc;
  const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 240);
  if (prev) {
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(sc, sc);
    drawDoorMark(ctx, prev, sc, pulse);
    ctx.restore();
    const mx = ox + ((prev.a.x + prev.b.x) / 2) * sc;
    const my = oy + ((prev.a.y + prev.b.y) / 2) * sc;
    ctx.save();
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const gs = fc.rGridSize.current > 0 ? fc.rGridSize.current : 70;
    const ft = Math.round((Math.hypot(prev.b.x - prev.a.x, prev.b.y - prev.a.y) / gs) * 5);
    const text = `🚪 Porta ${ft} ft · Clic: col·locar · +/−: amplada · Maj+clic: una altra · Esc: ometre`;
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
