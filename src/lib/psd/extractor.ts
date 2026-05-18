import type { ParsedPSD } from '@/types';

export async function extractLayerImages(
  buffer: ArrayBuffer,
  parsedResult: ParsedPSD,
  targetLayerIds: number[],
): Promise<Record<number, HTMLCanvasElement>> {
  const { layers, channelDataOffset, bitDepth } = parsedResult;
  if (!channelDataOffset || channelDataOffset <= 0 || layers.length === 0) return {};
  const targetSet = new Set(targetLayerIds);
  const results: Record<number, HTMLCanvasElement> = {};

  const BL = buffer.byteLength;
  const bytes = new Uint8Array(buffer);
  let p = channelDataOffset;

  for (const layer of layers) {
    const lw = layer.w, lh = layer.h;
    const isTarget = targetSet.has(layer.id);
    const chInfos = layer.channelInfo || [];
    const decoded: Record<string, Uint8Array> | null = isTarget ? {} : null;

    for (const ch of chInfos) {
      const chEnd = Math.min(p + ch.len, BL);
      if (p + 2 > BL) { p = chEnd; continue; }
      const compression = (bytes[p] << 8) | bytes[p + 1];
      p += 2;

      if (isTarget && lw > 0 && lh > 0 && decoded) {
        const pixelCount = lw * lh;
        const unpacked = new Uint8Array(pixelCount);

        if (compression === 0) {
          const raw = bytes.subarray(p, Math.min(p + pixelCount * (bitDepth === 16 ? 2 : 1), chEnd));
          if (bitDepth === 16) {
            for (let i = 0; i < pixelCount && i * 2 + 1 < raw.length; i++) unpacked[i] = raw[i * 2];
          } else {
            unpacked.set(raw.subarray(0, pixelCount));
          }
        } else if (compression === 1) {
          const rowCounts: number[] = [];
          for (let r = 0; r < lh && p + 2 <= chEnd; r++) {
            const rc = (bytes[p] << 8) | bytes[p + 1]; p += 2;
            rowCounts.push(rc);
          }
          let outOff = 0;
          for (let r = 0; r < rowCounts.length && p < chEnd; r++) {
            const rc = rowCounts[r];
            const rowSrc = bytes.subarray(p, Math.min(p + rc, chEnd));
            const rowDst = unpacked.subarray(outOff, outOff + lw);
            unpackBitsLocal(rowSrc, rowDst);
            p += rc; outOff += lw;
          }
        } else if (compression === 2 || compression === 3) {
          try {
            if (typeof DecompressionStream !== 'undefined') {
              const compData = bytes.subarray(p, chEnd);
              const ds = new DecompressionStream('deflate-raw');
              const writer = ds.writable.getWriter();
              writer.write(compData); writer.close();
              const reader = ds.readable.getReader();
              const chunks: Uint8Array[] = [];
              let done = false;
              while (!done) {
                const { value, done: d } = await reader.read();
                if (value) chunks.push(value);
                done = d;
              }
              let off = 0;
              for (const chunk of chunks) {
                if (bitDepth === 16) {
                  for (let i = 0; i < chunk.length && off < pixelCount; i += 2) unpacked[off++] = chunk[i];
                } else {
                  for (let i = 0; i < chunk.length && off < pixelCount; i++) unpacked[off++] = chunk[i];
                }
              }
            }
          } catch { /* ignore */ }
        }

        decoded[String(ch.id)] = unpacked;
      }

      p = chEnd;
    }

    if (isTarget && lw > 0 && lh > 0 && decoded) {
      const r = decoded['0'] || new Uint8Array(lw * lh).fill(0);
      const g = decoded['1'] || r;
      const b = decoded['2'] || r;
      const a = decoded['-1'] || new Uint8Array(lw * lh).fill(255);

      const imgData = new ImageData(lw, lh);
      const px = imgData.data;
      for (let i = 0; i < lw * lh; i++) {
        px[i * 4] = r[i]; px[i * 4 + 1] = g[i]; px[i * 4 + 2] = b[i]; px[i * 4 + 3] = a[i];
      }
      const oc = document.createElement('canvas');
      oc.width = lw; oc.height = lh;
      oc.getContext('2d')!.putImageData(imgData, 0, 0);
      results[layer.id] = oc;
    }
  }

  return results;
}

function unpackBitsLocal(src: Uint8Array, unpacked: Uint8Array): void {
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
