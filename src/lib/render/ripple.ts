/**
 * Ona d'una criatura invisible (v5.45): quan ataca, llança un conjur, rep un cop o el DM fa «Fer
 * soroll», a les pantalles es veu una distorsió breu on és (sabeu on és, però no el veieu). Tres
 * anells que s'eixamplen i s'esvaeixen, sense color fort (no és una màgia). Viatja com un `SPELL`.
 */
export const RIPPLE_DUR = 1.6;

export function drawRipple(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], t: number, dur: number, sc: number, gridSize: number): void {
  const p = points[0];
  if (!p) return;
  const gs = gridSize > 0 ? gridSize : 70;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const k = (t / dur) - i * 0.18;
    if (k <= 0 || k >= 1) continue;
    const r = gs * (0.25 + k * 0.9);
    const a = (1 - k) * 0.55;
    ctx.globalAlpha = a;
    ctx.lineWidth = Math.max(1.5 / sc, gs * 0.05 * (1 - k));
    ctx.strokeStyle = 'rgba(210,240,255,1)';
    ctx.beginPath();
    // Lleugerament deformat: sembla aire que es mou, no un cercle dibuixat.
    for (let j = 0; j <= 48; j++) {
      const ang = (j / 48) * Math.PI * 2;
      const rr = r * (1 + 0.04 * Math.sin(ang * 5 + t * 9 + i));
      const x = p.x + Math.cos(ang) * rr, y = p.y + Math.sin(ang) * rr * 0.92;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
