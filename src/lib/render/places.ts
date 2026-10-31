/**
 * Marques dels llocs d'una missió al mapa del DM (no es veuen a les pantalles de jugador): al
 * poble, una etiqueta davant de la porta de cada lloc on es pot entrar; dins d'un lloc, la
 * sortida. Doble clic a una marca = entrar-hi o sortir (veure `useMissionScenes`).
 * Es pinten en espai de pantalla (mida fixa a qualsevol zoom), com el punter del DM.
 */
import { C } from '@/constants';

export interface PlaceMark {
  /** Escena on porta (un lloc, o el poble per a la sortida). */
  id: string;
  /** Centre de la casella, en px de mapa. */
  x: number;
  y: number;
  label: string;
  kind: 'enter' | 'exit';
}

const FONT = '600 11px system-ui, sans-serif';
const H = 22;

/** Rectangle de l'etiqueta en px de pantalla (el comparteixen el dibuix i el doble clic). */
export function markBox(ctx: CanvasRenderingContext2D | null, m: PlaceMark, sc: number, ox: number, oy: number) {
  let tw = m.label.length * 6.2;
  if (ctx) { ctx.save(); ctx.font = FONT; tw = ctx.measureText(m.label).width; ctx.restore(); }
  const w = tw + 30, sx = ox + m.x * sc, sy = oy + m.y * sc;
  // L'etiqueta va damunt de la casella; el cercle, a la casella.
  return { x: sx - w / 2, y: sy - H / 2 - Math.max(14, 24 * sc), w, h: H, sx, sy, r: Math.max(10, 20 * sc) };
}

export function placeMarkAt(marks: PlaceMark[], px: number, py: number, sc: number, ox: number, oy: number): PlaceMark | null {
  for (const m of marks) {
    const b = markBox(null, m, sc, ox, oy);
    if (px >= b.x - 4 && px <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4) return m;
    if (Math.hypot(px - b.sx, py - b.sy) <= b.r) return m;
  }
  return null;
}

// Transformació de l'últim fotograma pintat: el doble clic la fa servir per trobar la marca.
let _view: { sc: number; ox: number; oy: number } | null = null;
export const lastPlaceView = () => _view;

export function renderPlaceMarks(ctx: CanvasRenderingContext2D, marks: PlaceMark[], hover: string | null, sc: number, ox: number, oy: number): void {
  _view = { sc, ox, oy };
  if (!marks.length) return;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.font = FONT; ctx.textBaseline = 'middle';
  for (const m of marks) {
    const b = markBox(ctx, m, sc, ox, oy);
    const on = hover === m.id;
    const col = m.kind === 'exit' ? C.ok : C.accent;
    // Cercle a la casella de la porta: es veu on cal portar la colla.
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.strokeStyle = col; ctx.globalAlpha = on ? 0.95 : 0.35 + 0.25 * pulse; ctx.lineWidth = on ? 2.5 : 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(b.sx, b.sy, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Etiqueta damunt de la casella.
    const y = b.y;
    ctx.globalAlpha = on ? 1 : 0.88;
    ctx.fillStyle = 'rgba(13,17,23,0.88)';
    ctx.beginPath(); ctx.roundRect(b.x, y, b.w, b.h, 6); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = on ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(b.x + 0.5, y + 0.5, b.w - 1, b.h - 1, 6); ctx.stroke();
    // Icona: porta (entrar) o fletxa (sortir).
    const ix = b.x + 9, iy = y + H / 2;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    if (m.kind === 'enter') {
      ctx.strokeRect(ix - 4, iy - 6, 8, 12);
      ctx.fillStyle = col; ctx.fillRect(ix + 1.5, iy - 0.5, 1.5, 1.5);
    } else {
      ctx.beginPath(); ctx.moveTo(ix + 4, iy); ctx.lineTo(ix - 4, iy); ctx.moveTo(ix - 1, iy - 3); ctx.lineTo(ix - 4, iy); ctx.lineTo(ix - 1, iy + 3); ctx.stroke();
    }
    ctx.fillStyle = on ? '#fff' : '#e6edf3';
    ctx.fillText(m.label, b.x + 20, iy + 0.5);
  }
  ctx.restore();
}
