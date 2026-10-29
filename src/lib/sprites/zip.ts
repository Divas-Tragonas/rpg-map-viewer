/**
 * Lector mínim de fitxers .zip al navegador, sense dependències: llegeix el directori
 * central i descomprimeix només les entrades que es demanen (`deflate-raw` amb
 * `DecompressionStream`, o «stored» tal qual).
 *
 * Existeix per carregar el paquet de sprites tal com el ven l'autor (un .zip de 25 MB amb
 * PSD i milers de PNG solts): només en necessitem una desena de fulls, i descomprimir-ho
 * tot seria lent i inútil.
 */

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;

interface Entry { name: string; method: number; compSize: number; offset: number }

function findEocd(dv: DataView): number {
  // El registre final és als últims 22 bytes + el comentari (màx. 64 KB).
  const min = Math.max(0, dv.byteLength - 22 - 0xffff);
  for (let i = dv.byteLength - 22; i >= min; i--) if (dv.getUint32(i, true) === SIG_EOCD) return i;
  return -1;
}

function listEntries(buf: ArrayBuffer): Entry[] {
  const dv = new DataView(buf);
  const eocd = findEocd(dv);
  if (eocd < 0) throw new Error('No és un fitxer .zip');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== SIG_CEN) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out.push({ name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Response(stream).arrayBuffer();
}

/**
 * Extreu del .zip les entrades que `want` accepta (rep el camí complet dins del zip).
 * Les carpetes `__MACOSX` s'ignoren sempre.
 */
export async function extractZip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Map<string, ArrayBuffer>> {
  const dv = new DataView(buf);
  const res = new Map<string, ArrayBuffer>();
  for (const e of listEntries(buf)) {
    if (e.name.endsWith('/') || e.name.startsWith('__MACOSX') || !want(e.name)) continue;
    const nameLen = dv.getUint16(e.offset + 26, true), extraLen = dv.getUint16(e.offset + 28, true);
    const start = e.offset + 30 + nameLen + extraLen;
    const raw = new Uint8Array(buf, start, e.compSize);
    if (e.method === 0) res.set(e.name, raw.slice().buffer);
    else if (e.method === 8) res.set(e.name, await inflate(raw));
  }
  return res;
}
