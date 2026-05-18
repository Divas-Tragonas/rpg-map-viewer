import type { StrokeData, StrokeAnimState } from '@/types';
import type { FrameContext } from './types';

export function replayStroke(ctx2: CanvasRenderingContext2D, stroke: StrokeData): void {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return;
  if (stroke.tool === 'pen') {
    ctx2.globalCompositeOperation = 'source-over';
    ctx2.strokeStyle = stroke.color; ctx2.lineWidth = stroke.size;
    ctx2.lineCap = 'round'; ctx2.lineJoin = 'round';
    ctx2.beginPath(); ctx2.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx2.lineTo(pts[i].x, pts[i].y);
    ctx2.stroke();
  } else {
    ctx2.globalCompositeOperation = 'destination-out';
    for (const pt of pts) { ctx2.beginPath(); ctx2.arc(pt.x, pt.y, stroke.size * 4, 0, Math.PI * 2); ctx2.fill(); }
    ctx2.globalCompositeOperation = 'source-over';
  }
}

export function advanceStrokeAnim(fc: FrameContext): void {
  const { activeStrokeAnim, strokeQueueRef, drawCanvasRef } = fc;
  const oc = drawCanvasRef.current; if (!oc) return;
  const ctx2 = oc.getContext('2d');  if (!ctx2) return;

  if (!activeStrokeAnim.current && strokeQueueRef.current.length > 0) {
    activeStrokeAnim.current = strokeQueueRef.current.shift()!;
  }
  const anim = activeStrokeAnim.current;
  if (!anim) return;

  const pts = anim.points;
  const ptsPerFrame = anim.ptsPerFrame;
  const end = Math.min(anim.idx + ptsPerFrame, pts.length);

  if (anim.tool === 'pen') {
    ctx2.globalCompositeOperation = 'source-over';
    ctx2.strokeStyle = anim.color; ctx2.lineWidth = anim.size;
    ctx2.lineCap = 'round'; ctx2.lineJoin = 'round';
    ctx2.beginPath(); ctx2.moveTo(pts[anim.idx - 1].x, pts[anim.idx - 1].y);
    for (let i = anim.idx; i < end; i++) ctx2.lineTo(pts[i].x, pts[i].y);
    ctx2.stroke();
  } else {
    ctx2.globalCompositeOperation = 'destination-out';
    for (let i = anim.idx; i < end; i++) { ctx2.beginPath(); ctx2.arc(pts[i].x, pts[i].y, anim.size * 4, 0, Math.PI * 2); ctx2.fill(); }
    ctx2.globalCompositeOperation = 'source-over';
  }

  anim.idx = end;
  if (anim.idx >= pts.length) activeStrokeAnim.current = null;
}
