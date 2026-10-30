/**
 * Dibuix de sprites del paquet Oryx al canvas: retalls dels fulls, sempre amb el suavitzat
 * APAGAT (pixel art: escalat amb el veí més proper, sense desenfocar).
 */
import { sheet, type SheetId } from './pack';
import { CREATURES, ITEMS, PORTRAIT_PARTS } from './manifest';
import { parseSprite, findFamilies, recolorPixels, type Families } from './recolor';

export const TILE = 48;
/**
 * Animació d'espera de l'autor: 1-2-3-2 (els fitxers solts `nom_4` són el fotograma 2). La
 * 4a columna del full és una altra postura: ciclar-la feia que les figures donessin una
 * sotragada a cada volta.
 */
const CREATURE_CYCLE = [0, 1, 2, 1];
const CREATURE_FRAME_MS = 300;

export function creatureNames(): string[] { return Object.keys(CREATURES); }
/** La figureta existeix? Accepta el nom amb recolor (`wizard~14=c0392b`, veure `recolor.ts`). */
export const hasCreature = (n: string | undefined | null): n is string => !!n && parseSprite(n).name in CREATURES;

/** Fotogrames de l'animació d'espera d'una criatura (els 3 primers del full, en fila). */
const FRAMES = 3;
function creatureStrip(name: string): ImageData | null {
  const p = CREATURES[name], img = sheet('heroes');
  if (!p || !img) return null;
  const c = document.createElement('canvas'); c.width = TILE * FRAMES; c.height = TILE;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, p[0], p[1], TILE * FRAMES, TILE, 0, 0, TILE * FRAMES, TILE);
  return g.getImageData(0, 0, TILE * FRAMES, TILE);
}

/** Famílies de color d'una criatura (per al selector del recolor). Es calculen un sol cop. */
const _families = new Map<string, Families>();
export function creatureFamilies(name: string): Families | null {
  const hit = _families.get(name); if (hit) return hit;
  const strip = creatureStrip(name); if (!strip) return null;
  const f = findFamilies(strip.data);
  _families.set(name, f);
  return f;
}

/**
 * Fotogrames ja recolorits d'una figureta amb recolor (null si no en té o el full encara no
 * hi és). Un canvas per nom complet: tots els tokens iguals el comparteixen.
 */
const _tinted = new Map<string, HTMLCanvasElement>();
function tintedStrip(sprite: string): HTMLCanvasElement | null {
  const hit = _tinted.get(sprite); if (hit) return hit;
  const { name, tints } = parseSprite(sprite);
  if (!Object.keys(tints).length) return null;
  const fam = creatureFamilies(name), strip = creatureStrip(name);
  if (!fam || !strip) return null;
  recolorPixels(strip.data, fam, tints);
  const c = document.createElement('canvas'); c.width = strip.width; c.height = TILE;
  c.getContext('2d')!.putImageData(strip, 0, 0);
  _tinted.set(sprite, c);
  return c;
}

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
  return CREATURE_CYCLE[Math.floor(now / CREATURE_FRAME_MS + seed * 1.7) % CREATURE_CYCLE.length];
}

/**
 * Criatura dins del quadrat (dx,dy,size). `flip` → mirall horitzontal (mira cap a l'esquerra).
 * `sprite` pot portar recolor: es pinta des dels fotogrames recolorits.
 */
export function drawCreature(ctx: CanvasRenderingContext2D, sprite: string, frame: number,
  dx: number, dy: number, size: number, flip = false): boolean {
  const name = parseSprite(sprite).name;
  const p = CREATURES[name]; if (!p) return false;
  const img = sheet('heroes'); if (!img) return false;
  const tinted = tintedStrip(sprite);
  const draw = (x: number) => {
    if (!tinted) { blit(ctx, 'heroes', p[0] + (frame % FRAMES) * TILE, p[1], TILE, TILE, x, dy, size, size); return; }
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tinted, (frame % FRAMES) * TILE, 0, TILE, TILE, x, dy, size, size);
    ctx.imageSmoothingEnabled = prev;
  };
  if (!flip) { draw(dx); return true; }
  ctx.save();
  ctx.translate(dx + size, 0); ctx.scale(-1, 1);
  draw(0);
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
export function grayCreature(sprite: string): HTMLCanvasElement | null {
  const hit = _gray.get(sprite); if (hit) return hit;
  if (!sheet('heroes') || !hasCreature(sprite)) return null;
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  const g = c.getContext('2d')!;
  drawCreature(g, sprite, 0, 0, 0, TILE);  // amb el recolor: el gris d'un goblin vermell no és el d'un de verd
  const d = g.getImageData(0, 0, TILE, TILE);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = l * 0.8;
  }
  g.putImageData(d, 0, 0);
  _gray.set(sprite, c);
  return c;
}

/** Miniatura d'una criatura en un dataURL (per a la UI: selectors, files, rètol). */
const _thumbs = new Map<string, string>();
export function creatureThumb(sprite: string): string | null {
  const hit = _thumbs.get(sprite); if (hit) return hit;
  if (!sheet('heroes') || !hasCreature(sprite)) return null;
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  drawCreature(c.getContext('2d')!, sprite, 0, 0, 0, TILE);
  const url = c.toDataURL();
  _thumbs.set(sprite, url);
  return url;
}
