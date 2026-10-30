/**
 * Dibuix de sprites del paquet Oryx al canvas: retalls dels fulls, sempre amb el suavitzat
 * APAGAT (pixel art: escalat amb el veí més proper, sense desenfocar).
 */
import { sheet, figureGradeKey, type SheetId } from './pack';
import { CREATURES, ITEMS, PORTRAIT_PARTS } from './manifest';
import { CREATURE_VARIANTS } from './variants';

export const TILE = 48;
/**
 * Animació d'espera de l'autor: 1-2-3-2 (els fitxers solts `nom_4` són el fotograma 2). La
 * 4a columna del full és una altra postura: ciclar-la feia que les figures donessin una
 * sotragada a cada volta.
 */
const CREATURE_CYCLE = [0, 1, 2, 1];
const CREATURE_FRAME_MS = 300;

export function creatureNames(): string[] { return Object.keys(CREATURES); }
/**
 * Variant de color d'una figureta (`scripts/oryx-variants.py`): viatja dins del nom (`goblin~2`),
 * o sigui que la porten sols el STATE, la partida, el rètol, els diàlegs i les cinemàtiques, sense
 * camps nous ni canvis a la API. Un sufix que no és una variant (el recolor lliure de la v4.45,
 * `goblin~14=c0392b`) es llegeix com l'original.
 */
export function parseSprite(s: string): { name: string; variant: number } {
  const i = s.indexOf('~');
  if (i < 0) return { name: s, variant: 0 };
  const name = s.slice(0, i), v = Number(s.slice(i + 1));
  return { name, variant: Number.isInteger(v) && v > 0 && v <= (CREATURE_VARIANTS[name]?.length ?? 0) ? v : 0 };
}
export const spriteName = (name: string, variant: number) => variant ? `${name}~${variant}` : name;
/** Colors de les variants d'una criatura (buit si no en té). */
export const creatureVariants = (name: string): readonly string[] => CREATURE_VARIANTS[name] ?? [];

/** La figureta existeix? Accepta el nom amb variant. */
export const hasCreature = (n: string | undefined | null): n is string => !!n && parseSprite(n).name in CREATURES;

const FRAMES = 3;  // fotogrames de l'animació d'espera (els 3 primers del full)
const variantSheet = (variant: number) => `heroes_v${variant}` as SheetId;
/** El full que pinta exactament aquesta figureta ja hi és? (per no desar a les memòries cau l'original en lloc de la variant) */
export const sheetReady = (sprite: string) => { const v = parseSprite(sprite).variant; return !!sheet(v ? variantSheet(v) : 'heroes'); };

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
 * Amb variant es pinta del seu full; si encara no s'ha carregat, de l'original.
 */
export function drawCreature(ctx: CanvasRenderingContext2D, sprite: string, frame: number,
  dx: number, dy: number, size: number, flip = false): boolean {
  const { name, variant } = parseSprite(sprite);
  const p = CREATURES[name]; if (!p) return false;
  const id = variant && sheet(variantSheet(variant)) ? variantSheet(variant) : 'heroes';
  if (!sheet(id)) return false;
  const sx = p[0] + (frame % FRAMES) * TILE;
  if (!flip) return blit(ctx, id, sx, p[1], TILE, TILE, dx, dy, size, size);
  ctx.save();
  ctx.translate(dx + size, dy); ctx.scale(-1, 1);
  blit(ctx, id, sx, p[1], TILE, TILE, 0, 0, size, size);
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
  const key = `${figureGradeKey()}|${sprite}`;
  const hit = _gray.get(key); if (hit) return hit;
  if (!hasCreature(sprite) || !sheetReady(sprite)) return null;
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  const g = c.getContext('2d')!;
  drawCreature(g, sprite, 0, 0, 0, TILE);  // amb la variant: el gris d'un goblin vermell no és el d'un de verd
  const d = g.getImageData(0, 0, TILE, TILE);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = l * 0.8;
  }
  g.putImageData(d, 0, 0);
  _gray.set(key, c);
  return c;
}

/**
 * Retall d'un full tenyit per lluminositat amb una rampa de colors (fosc → clar): els efectes
 * del full en gris o d'un altre color passats a la paleta d'una escola (`PAL`). Un sol cop per
 * retall i rampa. Null mentre el full no hi és.
 */
const _tintedRegions = new Map<string, HTMLCanvasElement>();
export function tintedRegion(id: SheetId, sx: number, sy: number, w: number, h: number,
  stops: readonly (readonly number[])[]): HTMLCanvasElement | null {
  const key = `${id}:${sx},${sy},${w},${h}:${stops.join('|')}`;
  const hit = _tintedRegions.get(key); if (hit) return hit;
  const img = sheet(id); if (!img) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    if (!d.data[i + 3]) continue;
    const l = Math.min(0.999, (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / 255) * (stops.length - 1);
    const k = Math.floor(l), f = l - k, a = stops[k], b = stops[k + 1];
    for (let j = 0; j < 3; j++) d.data[i + j] = a[j] + (b[j] - a[j]) * f;
  }
  g.putImageData(d, 0, 0);
  _tintedRegions.set(key, c);
  return c;
}

/** Miniatura d'una criatura en un dataURL (per a la UI: selectors, files, rètol). */
const _thumbs = new Map<string, string>();
export function creatureThumb(sprite: string): string | null {
  const key = `${figureGradeKey()}|${sprite}`;
  const hit = _thumbs.get(key); if (hit) return hit;
  if (!hasCreature(sprite) || !sheetReady(sprite)) return null;
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  drawCreature(c.getContext('2d')!, sprite, 0, 0, 0, TILE);
  const url = c.toDataURL();
  _thumbs.set(key, url);
  return url;
}
