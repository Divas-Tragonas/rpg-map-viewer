import { CONDITIONS_BY_ID } from '@/constants';

export function drawConditionSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, id: string): void {
  const s = r * 0.52;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.16;
  switch (id) {
    case 'grappled': {
      ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.ellipse(x - s * 0.32, y, s * 0.36, s * 0.58, Math.PI / 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + s * 0.32, y, s * 0.36, s * 0.58, Math.PI / 4, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'frightened': {
      ctx.fillRect(x - r * 0.1, y - s * 0.85, r * 0.2, s * 1.1);
      ctx.beginPath(); ctx.arc(x, y + s * 0.65, r * 0.14, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'stunned': {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const sx = x + Math.cos(a) * s * 0.55, sy = y + Math.sin(a) * s * 0.55;
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const ra = j * Math.PI * 2 / 5 - Math.PI / 2, rr = j % 2 === 0 ? r * 0.2 : r * 0.09;
          j === 0 ? ctx.moveTo(sx + Math.cos(ra) * rr, sy + Math.sin(ra) * rr) : ctx.lineTo(sx + Math.cos(ra) * rr, sy + Math.sin(ra) * rr);
        }
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'blinded': {
      ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.ellipse(x, y - s * 0.12, s * 0.75, s * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - s * 0.12, s * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = r * 0.2;
      ctx.beginPath(); ctx.moveTo(x - s * 0.85, y + s * 0.65); ctx.lineTo(x + s * 0.85, y - s * 0.65); ctx.stroke();
      break;
    }
    case 'prone': {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.9); ctx.lineTo(x - s * 0.7, y - s * 0.15);
      ctx.lineTo(x - s * 0.2, y - s * 0.15); ctx.lineTo(x - s * 0.2, y - s * 0.9);
      ctx.lineTo(x + s * 0.2, y - s * 0.9); ctx.lineTo(x + s * 0.2, y - s * 0.15);
      ctx.lineTo(x + s * 0.7, y - s * 0.15); ctx.closePath(); ctx.fill();
      break;
    }
    case 'deafened': {
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(x + s * 0.1, y - s * 0.2, s * 0.52, Math.PI * 0.8, Math.PI * 2.2);
      ctx.lineTo(x + s * 0.62, y + s * 0.45); ctx.lineTo(x + s * 0.12, y + s * 0.72); ctx.stroke();
      ctx.lineWidth = r * 0.2;
      ctx.beginPath(); ctx.moveTo(x - s * 0.8, y + s * 0.7); ctx.lineTo(x + s * 0.8, y - s * 0.7); ctx.stroke();
      break;
    }
    case 'poisoned': {
      ctx.lineWidth = r * 0.13;
      ctx.beginPath(); ctx.ellipse(x, y - s * 0.18, s * 0.63, s * 0.58, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillRect(x - s * 0.52, y + s * 0.42, r * 0.13, s * 0.38);
      ctx.fillRect(x - s * 0.18, y + s * 0.42, r * 0.13, s * 0.38);
      ctx.fillRect(x + s * 0.16, y + s * 0.42, r * 0.13, s * 0.38);
      ctx.beginPath(); ctx.arc(x - s * 0.28, y - s * 0.28, r * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s * 0.28, y - s * 0.28, r * 0.14, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'charmed': {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.75);
      ctx.bezierCurveTo(x - s * 1.0, y, x - s * 1.0, y - s * 0.6, x, y - s * 0.1);
      ctx.bezierCurveTo(x + s * 1.0, y - s * 0.6, x + s * 1.0, y, x, y + s * 0.75);
      ctx.fill(); break;
    }
    case 'unconscious': {
      ctx.font = `bold ${r * 1.05}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Z', x + s * 0.3, y - s * 0.3);
      ctx.font = `bold ${r * 0.72}px system-ui`;
      ctx.fillText('z', x - s * 0.15, y + s * 0.45);
      ctx.textBaseline = 'alphabetic'; break;
    }
    case 'invisible': {
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.12, s * 0.68, Math.PI, 0);
      ctx.lineTo(x + s * 0.68, y + s * 0.62);
      ctx.bezierCurveTo(x + s * 0.38, y + s * 0.32, x + s * 0.08, y + s * 0.68, x, y + s * 0.44);
      ctx.bezierCurveTo(x - s * 0.08, y + s * 0.68, x - s * 0.38, y + s * 0.32, x - s * 0.68, y + s * 0.62);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.22, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s * 0.25, y - s * 0.22, r * 0.12, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'paralyzed': {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.25, y - s * 0.95); ctx.lineTo(x - s * 0.3, y + s * 0.05);
      ctx.lineTo(x + s * 0.1, y + s * 0.05); ctx.lineTo(x - s * 0.25, y + s * 0.95);
      ctx.lineTo(x + s * 0.3, y - s * 0.05); ctx.lineTo(x - s * 0.1, y - s * 0.05);
      ctx.closePath(); ctx.fill(); break;
    }
    case 'petrified': {
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.9); ctx.lineTo(x + s * 0.65, y - s * 0.18);
      ctx.lineTo(x + s * 0.65, y + s * 0.18); ctx.lineTo(x, y + s * 0.9);
      ctx.lineTo(x - s * 0.65, y + s * 0.18); ctx.lineTo(x - s * 0.65, y - s * 0.18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.9); ctx.lineTo(x + s * 0.65, y - s * 0.18); ctx.lineTo(x, y + s * 0.18); ctx.closePath(); ctx.fill();
      break;
    }
    case 'restrained': {
      ctx.lineWidth = r * 0.12;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85); ctx.lineTo(x + Math.cos(a + Math.PI) * s * 0.85, y + Math.sin(a + Math.PI) * s * 0.85); ctx.stroke();
      }
      [0.28, 0.58, 0.85].forEach(rr => { ctx.beginPath(); ctx.arc(x, y, s * rr, 0, Math.PI * 2); ctx.stroke(); });
      break;
    }
    case 'incapacitated': {
      ctx.lineWidth = r * 0.22;
      ctx.beginPath(); ctx.moveTo(x - s * 0.7, y - s * 0.7); ctx.lineTo(x + s * 0.7, y + s * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s * 0.7, y - s * 0.7); ctx.lineTo(x - s * 0.7, y + s * 0.7); ctx.stroke();
      break;
    }
  }
}

export function drawConditionBadges(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, condIds: string[], sc: number): void {
  if (!condIds || condIds.length === 0) return;
  const badgeR = Math.max(7 / sc, R * 0.28);
  const maxVis = 5, visible = condIds.slice(0, maxVis), extra = condIds.length - maxVis;
  const total = visible.length + (extra > 0 ? 1 : 0);
  const spacing = badgeR * 2.2;
  const startX = cx - ((total - 1) * spacing) / 2;
  const badgeY = cy - R - badgeR * 1.3;
  visible.forEach((id, i) => {
    const cond = CONDITIONS_BY_ID.get(id); if (!cond) return;
    const bx = startX + i * spacing;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(bx + 1 / sc, badgeY + 1 / sc, badgeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cond.bg;
    ctx.beginPath(); ctx.arc(bx, badgeY, badgeR, 0, Math.PI * 2); ctx.fill();
    ctx.save(); drawConditionSymbol(ctx, bx, badgeY, badgeR, id); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8 / sc;
    ctx.beginPath(); ctx.arc(bx, badgeY, badgeR, 0, Math.PI * 2); ctx.stroke();
  });
  if (extra > 0) {
    const bx = startX + visible.length * spacing;
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.arc(bx, badgeY, badgeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${badgeR * 0.9}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`+${extra}`, bx, badgeY); ctx.textBaseline = 'alphabetic';
  }
}
