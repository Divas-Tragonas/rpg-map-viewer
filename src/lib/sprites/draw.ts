/**
 * Dibuix de sprites del paquet Oryx al canvas: retalls dels fulls, sempre amb el suavitzat
 * APAGAT (pixel art: escalat amb el veí més proper, sense desenfocar).
 */
import { sheet, type SheetId } from './pack';
import { CREATURES, ITEMS, PORTRAIT_PARTS } from './manifest';

export const TILE = 48;
/** Fotogrames d'una criatura i durada de cadascun (l'animació d'espera de l'autor). */
const CREATURE_FRAMES = 4;
const CREATURE_FRAME_MS = 260;

export function creatureNames(): string[] { return Object.keys(CREATURES); }
export const hasCreature = (n: string | undefined | null): n is string => !!n && n in CREATURES;

/** Retall genèric d'un full, a (dx,dy,dw,dh). Retorna false si el full encara no hi és. */
export function blit(ctx: CanvasRenderingContext2D, id: SheetId, sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number): boolean {
  const img = sheet(id); if (!img) return false;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = prev;
  return true;
}

/** Fotograma de l'animació d'espera ara mateix. `seed` desfasa criatures iguals (que no ballin a l'uníson). */
export function creatureFrame(now: number, seed = 0): number {
  return Math.floor(now / CREATURE_FRAME_MS + seed * 1.7) % CREATURE_FRAMES;
}

/** Criatura dins del quadrat (dx,dy,size). `flip` → mirall horitzontal (mira cap a l'esquerra). */
export function drawCreature(ctx: CanvasRenderingContext2D, name: string, frame: number,
  dx: number, dy: number, size: number, flip = false): boolean {
  const p = CREATURES[name]; if (!p) return false;
  const img = sheet('heroes'); if (!img) return false;
  const sx = p[0] + (frame % CREATURE_FRAMES) * TILE;
  if (!flip) return blit(ctx, 'heroes', sx, p[1], TILE, TILE, dx, dy, size, size);
  ctx.save();
  ctx.translate(dx + size, dy); ctx.scale(-1, 1);
  blit(ctx, 'heroes', sx, p[1], TILE, TILE, 0, 0, size, size);
  ctx.restore();
  return true;
}

export function drawItem(ctx: CanvasRenderingContext2D, name: string, dx: number, dy: number, size: number): boolean {
  const p = ITEMS[name]; if (!p) return false;
  return blit(ctx, 'items', p[0], p[1], TILE, TILE, dx, dy, size, size);
}

export function drawPortraitPart(ctx: CanvasRenderingContext2D, name: string, dx: number, dy: number, size: number): boolean {
  const p = PORTRAIT_PARTS[name]; if (!p) return false;
  return blit(ctx, 'portraits', p[0], p[1], TILE, TILE, dx, dy, size, size);
}

/** Retrat ja fet (`uf_portraits_example.png`, graella 6×6 de 48 px). */
export const FACE_COUNT = 36;
export function drawFace(ctx: CanvasRenderingContext2D, i: number, dx: number, dy: number, size: number): boolean {
  return blit(ctx, 'faces', (i % 6) * TILE, Math.floor(i / 6) * TILE, TILE, TILE, dx, dy, size, size);
}

// Versió en grisos d'una criatura (derrotada). Es fa un sol cop per criatura i fotograma 0:
// `ctx.filter` no existeix a Safari (la pantalla de jugador sovint és un iPad).
const _gray = new Map<string, HTMLCanvasElement>();
export function grayCreature(name: string): HTMLCanvasElement | null {
  const hit = _gray.get(name); if (hit) return hit;
  const p = CREATURES[name], img = sheet('heroes');
  if (!p || !img) return null;
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  const g = c.getContext('2d')!;
  g.drawImage(img, p[0], p[1], TILE, TILE, 0, 0, TILE, TILE);
  const d = g.getImageData(0, 0, TILE, TILE);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = l * 0.8;
  }
  g.putImageData(d, 0, 0);
  _gray.set(name, c);
  return c;
}

/** Miniatura d'una criatura en un dataURL (per a la UI: selectors, files, rètol). */
const _thumbs = new Map<string, string>();
export function creatureThumb(name: string): string | null {
  const hit = _thumbs.get(name); if (hit) return hit;
  if (!sheet('heroes') || !CREATURES[name]) return null;
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  drawCreature(c.getContext('2d')!, name, 0, 0, 0, TILE);
  const url = c.toDataURL();
  _thumbs.set(name, url);
  return url;
}
