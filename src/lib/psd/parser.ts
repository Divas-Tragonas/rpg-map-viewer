import type { ParsedPSD, PSDLayer } from '@/types';

function unpackBits(src: Uint8Array, unpacked: Uint8Array): void {
  let i = 0, j = 0;
  while (i < src.length && j < unpacked.length) {
    const n = src[i++];
    if (n === 128) continue;
    if (n < 128) {
      const count = n + 1;
      for (let k = 0; k < count && i < src.length && j < unpacked.length; k++) unpacked[j++] = src[i++];
    } else {
      const count = 256 - n + 1, val = src[i++];
      for (let k = 0; k < count && j < unpacked.length; k++) unpacked[j++] = val;
    }
  }
}

export function parsePSDStructure(buffer: ArrayBuffer): ParsedPSD {
  const result: ParsedPSD = { width: 0, height: 0, bitDepth: 8, layers: [], channelDataOffset: 0, error: null };
  try {
    const dv = new DataView(buffer);
    const BL = buffer.byteLength;
    let p = 0;

    const u8  = () => p < BL     ? dv.getUint8(p++)           : (p++, 0);
    const u16 = () => p + 2 <= BL ? (p += 2, dv.getUint16(p - 2)) : (p += 2, 0);
    const s16 = () => p + 2 <= BL ? (p += 2, dv.getInt16(p - 2))  : (p += 2, 0);
    const u32 = () => p + 4 <= BL ? (p += 4, dv.getUint32(p - 4)) : (p += 4, 0);
    const s32 = () => p + 4 <= BL ? (p += 4, dv.getInt32(p - 4))  : (p += 4, 0);
    const sk  = (n: number) => { p = Math.min(p + Math.max(0, n), BL); };
    const str = (n: number) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u8()); return s; };
    const pas = () => { const len = u8(), s = str(Math.min(len, BL - p)); sk(((len + 1 + 3) & ~3) - (len + 1)); return s; };
    const uni = () => { const c = u32(); let s = ''; for (let i = 0; i < c && p + 2 <= BL; i++) s += String.fromCharCode(u16()); return s; };

    if (str(4) !== '8BPS') { result.error = 'No es un archivo PSD válido'; return result; }
    if (u16() !== 1)       { result.error = 'Formato PSB no soportado. Guarda como PSD normal.'; return result; }
    sk(6); u16();
    result.height = u32(); result.width = u32();
    result.bitDepth = u16();
    if (u16() !== 3) { result.error = 'Solo soporta modo RGB. Ve a Imagen > Modo > Color RGB.'; return result; }

    sk(u32()); sk(u32());

    const lmLen = u32(); if (lmLen === 0) return result;
    const lmEnd = Math.min(p + lmLen, BL);
    const liLen = u32(); if (liLen === 0) { p = lmEnd; return result; }
    const liEnd = Math.min(p + liLen, lmEnd);

    let cnt = s16(); if (cnt < 0) cnt = -cnt;
    if (cnt > 5000) { result.error = `Demasiadas capas: ${cnt}`; return result; }

    for (let li = 0; li < cnt && p < liEnd - 8; li++) {
      const top = s32(), left = s32(), bottom = s32(), right = s32();
      const nch = Math.min(u16(), 64);
      const channelInfo: Array<{ id: number; len: number }> = [];
      for (let ci = 0; ci < nch; ci++) { const chId = s16(), chLen = u32(); channelInfo.push({ id: chId, len: chLen }); }
      str(4); str(4);
      const opacity = u8(); u8();
      const flags = u8(); const visible = !(flags & 2);
      sk(1);

      const xLen = u32(), xEnd = Math.min(p + xLen, liEnd, BL);
      sk(Math.min(u32(), xEnd - p));
      sk(Math.min(u32(), xEnd - p));
      let name = pas();
      let secType = 0, uniName: string | null = null;

      while (p + 12 <= xEnd) {
        const sig = str(4);
        if (sig !== '8BIM' && sig !== '8B64') { p = xEnd; break; }
        const key = str(4), bLen = u32();
        const bEnd = Math.min(p + ((bLen + 1) & ~1), xEnd, BL);
        if (bEnd <= p) { p = xEnd; break; }
        try {
          if ((key === 'lsct' || key === 'lsdk') && p + 4 <= bEnd) secType = u32();
          else if (key === 'luni' && p < bEnd) uniName = uni();
        } catch { /* ignore */ }
        p = bEnd;
      }
      p = xEnd;

      result.layers.push({
        id: li, name: uniName || name, top, left, bottom, right,
        w: Math.max(0, right - left), h: Math.max(0, bottom - top),
        visible, opacity, secType, channelInfo,
      });
    }

    result.channelDataOffset = p;
  } catch (err) {
    result.error = result.layers.length > 0
      ? `Lectura parcial (${result.layers.length} capas): ${(err as Error).message}`
      : (err as Error).message;
  }
  return result;
}
