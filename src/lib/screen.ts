import type { DMRefs } from '@/hooks/useDMRefs';
import type { Point } from '@/types';

/**
 * Coordenades de mapa → píxels de la finestra al DM (la inversa de `mapCoords` de
 * `useMouseHandlers`). Per col·locar un pop-up al costat d'un punt del mapa.
 */
export function mapToClient(R: DMRefs, p: Point): Point | null {
  const cv = R.canvasRef.current;
  if (!cv) return null;
  const r = cv.getBoundingClientRect();
  const media = R.mediaRef.current as HTMLImageElement | HTMLVideoElement | null;
  let mw = 1920, mh = 1080;
  if (media?.tagName === 'IMG' && (media as HTMLImageElement).naturalWidth) { mw = (media as HTMLImageElement).naturalWidth; mh = (media as HTMLImageElement).naturalHeight; }
  if (media?.tagName === 'VIDEO' && (media as HTMLVideoElement).videoWidth) { mw = (media as HTMLVideoElement).videoWidth; mh = (media as HTMLVideoElement).videoHeight; }
  const sc = Math.min(r.width / mw, r.height / mh) * R.rZoom.current * R.dmLocalZoom.current;
  const pan = { x: R.rPanOffset.current.x + R.dmLocalPan.current.x, y: R.rPanOffset.current.y + R.dmLocalPan.current.y };
  return { x: r.left + (r.width - mw * sc) / 2 + pan.x + p.x * sc, y: r.top + (r.height - mh * sc) / 2 + pan.y + p.y * sc };
}
