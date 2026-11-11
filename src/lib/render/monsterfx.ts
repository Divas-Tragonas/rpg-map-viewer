import type { Point } from '@/types';

/**
 * Efectes de les criatures a l'app Clàssica (v5 snapshot 9): un sol pintor paramètric en lloc d'un
 * per poder. A l'app Píxel els pinta `drawPixelSpell` amb els efectes del paquet Oryx.
 * L'alè de foc i el raig necròtic tenen efecte propi (`dragonbreath.ts`, `necrotic.ts`).
 *  - `proj`: un projectil lluminós viatja del llançador al destí abans de l'efecte.
 *  - `shape`: `cone` (alè que s'obre cap al destí), `line` (franja), `burst` (esclat al destí) o
 *    `self` (esclat al voltant del llançador).
 */
interface FxDef { color: string; glow: string; proj?: boolean; shape: 'cone' | 'line' | 'burst' | 'self' }

export const MONSTER_FX: Record<string, FxDef> = {
  breath_cold:   { color: '#7dd3fc', glow: '#e0f7ff', shape: 'cone' },
  breath_poison: { color: '#84cc16', glow: '#d9f99d', shape: 'cone' },
  breath_acid:   { color: '#a3e635', glow: '#ecfccb', shape: 'line' },
  fire_bolt:     { color: '#fb923c', glow: '#fff1c2', proj: true, shape: 'burst' },
  eye_ray:       { color: '#a855f7', glow: '#f3e8ff', proj: true, shape: 'burst' },
  hold:          { color: '#ec4899', glow: '#fce7f3', proj: true, shape: 'burst' },
  dread:         { color: '#7c3aed', glow: '#ddd6fe', shape: 'self' },
  cloud:         { color: '#65a30d', glow: '#bef264', shape: 'burst' },
  vanish:        { color: '#e9d5ff', glow: '#ffffff', shape: 'self' },
  thunder:       { color: '#60a5fa', glow: '#dbeafe', shape: 'self' },
  entangle:      { color: '#4d7c0f', glow: '#a3e635', shape: 'burst' },
  radiant_bolt:  { color: '#facc15', glow: '#fffbeb', proj: true, shape: 'burst' },
  acid_arrow:    { color: '#84cc16', glow: '#ecfccb', proj: true, shape: 'burst' },
};

export const MONSTER_FX_DUR = 1.8;
const TRAVEL = 0.35;

export function drawMonsterFx(ctx: CanvasRenderingContext2D, type: string, pts: Point[], e: number, dur: number, sc: number, gridSize: number, seed: number, aoeFt?: number): void {
  const d = MONSTER_FX[type]; if (!d || !pts.length) return;
  const from = pts[0], to = pts[pts.length - 1];
  const cell = gridSize > 0 ? gridSize : 48 / sc;
  const fade = Math.max(0, Math.min(1, (dur - e) / 0.5));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const t0 = d.proj ? TRAVEL : 0;
  if (d.proj && e < TRAVEL) {
    const k = e / TRAVEL, x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k;
    for (let i = 3; i >= 0; i--) {
      const kk = Math.max(0, k - i * 0.05);
      ctx.globalAlpha = i === 0 ? 0.95 : 0.25;
      ctx.fillStyle = i === 0 ? d.glow : d.color;
      ctx.beginPath(); ctx.arc(from.x + (to.x - from.x) * kk, from.y + (to.y - from.y) * kk, cell * (i === 0 ? 0.16 : 0.12), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.5; ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(x, y, cell * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  if (e >= t0) {
    const k = e - t0, grow = Math.min(1, k / 0.35);
    const ang = Math.atan2(to.y - from.y, to.x - from.x), len = Math.hypot(to.x - from.x, to.y - from.y);
    if (d.shape === 'cone' || d.shape === 'line') {
      const half = d.shape === 'cone' ? Math.atan(0.5) : 0;
      const w = d.shape === 'line' ? cell * 0.5 : 0;
      for (let layer = 0; layer < 3; layer++) {
        ctx.globalAlpha = fade * (0.18 + layer * 0.12);
        ctx.fillStyle = layer === 2 ? d.glow : d.color;
        const L = len * grow * (1 - layer * 0.15);
        ctx.beginPath();
        if (d.shape === 'cone') {
          ctx.moveTo(from.x, from.y);
          ctx.arc(from.x, from.y, L, ang - half * (1 - layer * 0.25), ang + half * (1 - layer * 0.25));
        } else {
          const nx = -Math.sin(ang), ny = Math.cos(ang), ww = w * (1 - layer * 0.3);
          ctx.moveTo(from.x + nx * ww, from.y + ny * ww); ctx.lineTo(from.x + nx * ww + Math.cos(ang) * L, from.y + ny * ww + Math.sin(ang) * L);
          ctx.lineTo(from.x - nx * ww + Math.cos(ang) * L, from.y - ny * ww + Math.sin(ang) * L); ctx.lineTo(from.x - nx * ww, from.y - ny * ww);
        }
        ctx.closePath(); ctx.fill();
      }
      // Guspires que s'escampen dins de la forma.
      ctx.fillStyle = d.glow;
      for (let i = 0; i < 24; i++) {
        const r1 = ((seed * (i + 3) * 7919) % 1000) / 1000, r2 = ((seed * (i + 7) * 104729) % 1000) / 1000;
        const a = ang + (d.shape === 'cone' ? (r1 - 0.5) * 2 * Math.atan(0.5) : 0);
        const dist = len * grow * (0.15 + 0.85 * ((r2 + k * 0.6) % 1));
        const off = d.shape === 'line' ? (r1 - 0.5) * cell * 0.8 : 0;
        ctx.globalAlpha = fade * 0.8;
        ctx.beginPath(); ctx.arc(from.x + Math.cos(a) * dist - Math.sin(ang) * off, from.y + Math.sin(a) * dist + Math.cos(ang) * off, cell * 0.06, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const at = d.shape === 'self' ? from : to;
      const R = Math.max(cell * 0.6, aoeFt ? (aoeFt / 5) * cell : cell * 0.6);
      for (let ring = 0; ring < 3; ring++) {
        const p = Math.min(1, (k - ring * 0.12) / 0.6);
        if (p <= 0) continue;
        ctx.globalAlpha = fade * (1 - p) * 0.8;
        ctx.strokeStyle = ring === 0 ? d.glow : d.color; ctx.lineWidth = cell * 0.12;
        ctx.beginPath(); ctx.arc(at.x, at.y, R * p, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = fade * 0.22; ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(at.x, at.y, R * grow, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
