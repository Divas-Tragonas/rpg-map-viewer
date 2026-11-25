import type { Point } from '@/types';
import { wake } from '@/lib/render/wake';

/**
 * Previsualització del moviment forçat (v5.44, només DM): per a cada token que serà empès o estirat,
 * una fletxa de on és fins on acabarà i la seva silueta al destí. En vermell si s'atura abans
 * d'hora (paret o criatura), amb una creu on xoca. Estat de mòdul (com la foscor): el posen el
 * pop-up dels conjurs i l'acció manual, i el pinta la capa «air» de `renderSpells`.
 */
export interface ForcedArrow { from: Point; to: Point; R: number; blocked: boolean; label?: string }

let _arrows: ForcedArrow[] | null = null;

export function setForcedPreview(list: ForcedArrow[] | null): void {
  _arrows = list && list.length ? list : null;
  wake();
}

export const hasForcedPreview = () => _arrows !== null;

export function renderForcedPreview(ctx: CanvasRenderingContext2D, sc: number): void {
  if (!_arrows) return;
  const lw = 2.5 / sc;
  for (const a of _arrows) {
    const col = a.blocked ? '#f85149' : '#e6edf3';
    ctx.save();
    // Silueta al destí.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(a.to.x, a.to.y, a.R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash([6 / sc, 4 / sc]);
    ctx.beginPath(); ctx.arc(a.to.x, a.to.y, a.R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Fletxa.
    const dx = a.to.x - a.from.x, dy = a.to.y - a.from.y, d = Math.hypot(dx, dy);
    if (d > 1) {
      const ux = dx / d, uy = dy / d, head = Math.min(14 / sc, d * 0.4);
      ctx.beginPath(); ctx.moveTo(a.from.x, a.from.y); ctx.lineTo(a.to.x - ux * head * 0.6, a.to.y - uy * head * 0.6); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(a.to.x, a.to.y);
      ctx.lineTo(a.to.x - ux * head - uy * head * 0.55, a.to.y - uy * head + ux * head * 0.55);
      ctx.lineTo(a.to.x - ux * head + uy * head * 0.55, a.to.y - uy * head - ux * head * 0.55);
      ctx.closePath(); ctx.fill();
    }
    if (a.label) {
      ctx.font = `700 ${12 / sc}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3 / sc; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(a.label, a.to.x, a.to.y - a.R - 4 / sc);
      ctx.fillStyle = col; ctx.fillText(a.label, a.to.x, a.to.y - a.R - 4 / sc);
    }
    ctx.restore();
  }
}
