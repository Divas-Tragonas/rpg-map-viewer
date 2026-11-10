// Còpia del fons per a les pantalles de jugador.
//
// El DM carrega el mapa tal com és (sovint un PNG de 20–40 MB i 6000–10000 px de costat) i
// abans l'enviava igual a totes les pantalles: la tablet o la TV el rebien sencer per la
// xarxa i el descodificaven a mida completa, molt més gran que la seva pantalla. Ara reben
// una còpia reduïda (costat màxim `PLAYER_BG_MAX_SIDE`) i recomprimida. El DM, el desat i
// el desat automàtic segueixen amb el fitxer original.
//
// Les coordenades del mapa NO canvien: són les del fitxer original, i el DM n'envia la mida
// al STRUCT (`bgSize`) perquè el jugador no les dedueixi de la còpia (veure `mapSizeFor`).

/** Costat màxim de la còpia. 4096² és també el sostre segur d'un canvas a iOS. */
export const PLAYER_BG_MAX_SIDE = 4096;
/** Per sota d'aquesta mida de fitxer no val la pena tocar res. */
const MIN_BYTES = 1.5 * 1024 * 1024;
const QUALITY = 0.9;

export interface BgCopy { buffer: ArrayBuffer; mimeType: string }

/** Un PNG animat (APNG) porta un bloc `acTL` abans de les dades: no es pot aplanar. */
function isAnimatedPng(buf: ArrayBuffer): boolean {
  const u8 = new Uint8Array(buf, 0, Math.min(buf.byteLength, 4096));
  for (let i = 0; i + 3 < u8.length; i++) {
    if (u8[i] === 0x61 && u8[i + 1] === 0x63 && u8[i + 2] === 0x54 && u8[i + 3] === 0x4c) return true;
  }
  return false;
}

const toBlob = (cv: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>(res => cv.toBlob(res, type, QUALITY));

/**
 * Còpia reduïda d'una imatge de fons, o `null` si no surt a compte (o no es pot fer): llavors
 * s'envia l'original, com sempre. Només PNG i JPEG estàtics: un GIF o un WebP poden ser
 * animats, i un vídeo no es toca.
 */
export async function reduceBgForPlayers(buf: ArrayBuffer, mime: string): Promise<BgCopy | null> {
  if (mime !== 'image/png' && mime !== 'image/jpeg') return null;
  if (buf.byteLength < MIN_BYTES) return null;
  if (mime === 'image/png' && isAnimatedPng(buf)) return null;
  if (typeof createImageBitmap !== 'function') return null;
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(new Blob([buf], { type: mime })); } catch { return null; }
  try {
    const k = Math.min(1, PLAYER_BG_MAX_SIDE / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * k));
    cv.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    // WebP (amb transparència). Safari no en sap codificar i torna un PNG: llavors JPEG si
    // l'original ja ho era (sense transparència), o el PNG mateix si s'ha reduït.
    let blob = await toBlob(cv, 'image/webp');
    if (blob && blob.type !== 'image/webp') {
      blob = mime === 'image/jpeg' ? await toBlob(cv, 'image/jpeg') : (k < 1 ? blob : null);
    }
    if (!blob || blob.size === 0) return null;
    if (blob.size > buf.byteLength * 0.8) return null;  // no s'hi guanya prou
    return { buffer: await blob.arrayBuffer(), mimeType: blob.type };
  } catch {
    return null;
  } finally {
    bmp.close();
  }
}
