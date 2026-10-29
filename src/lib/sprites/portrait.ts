/**
 * Generador de retrats (peces de `uf_portraits.png`): categories en ordre de capa, de baix a
 * dalt. L'ordre l'he tret del PSD de l'autor: el cap va sota la roba (l'armadura tapa el
 * coll) i la caputxa per sobre del cabell.
 */
import { PORTRAIT_PARTS } from './manifest';
import { drawPortraitPart, drawFace, TILE } from './draw';

export interface PortraitCategory { id: string; label: string; required?: boolean; parts: string[] }

const names = Object.keys(PORTRAIT_PARTS);
const pick = (re: RegExp) => names.filter(n => re.test(n));
// Les peces de cabell rapat són les mateixes per a home i dona (surten dues vegades al full).
const uniqueHair = pick(/^(f|m)_hair_/).filter(n => !(n.startsWith('m_hair_buzz') && names.includes(n.replace(/^m_/, 'f_'))));

export const PORTRAIT_CATEGORIES: PortraitCategory[] = [
  { id: 'bg', label: 'Fons', parts: ['background', 'background_border'] },
  { id: 'head', label: 'Cap', required: true, parts: [...pick(/^head_(human|elf|drow|orc|beast|cyclops)/), 'ghostly_female'] },
  { id: 'body', label: 'Roba', parts: pick(/^(armor_|chamoise_|shirt_|tunic_|cloak_|beast_fur|pauldrons|strap)/) },
  { id: 'marks', label: 'Marques', parts: pick(/^(tattoo_|scar_|mole|bloody|bandage|neck_extension)/) },
  { id: 'eyes', label: 'Ulls i celles', parts: pick(/^(f_ey|m_eyebrows|glowing_eyes)/) },
  { id: 'beard', label: 'Barba', parts: pick(/^m_(beard|goatee|mustache|soul_patch)/) },
  { id: 'hair', label: 'Cabell', parts: uniqueHair },
  { id: 'head2', label: 'Al cap', parts: pick(/^(hooded_cloak_|helmet_|crown|head_band|bandana|beast_horns|horns_orc)/) },
  { id: 'extra', label: 'Complements', parts: pick(/^(earring_|eye_patch|jewel_|necklace|nosering)/) },
];

/** Tria per categoria: nom de la peça o null. */
export type PortraitChoice = Record<string, string | null>;

export const partLabel = (n: string) => n.replace(/^(f|m)_/, '').replace(/_/g, ' ');

export function randomPortrait(): PortraitChoice {
  const r = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const head = r(PORTRAIT_CATEGORIES[1].parts);
  const fem = /female/.test(head);
  const hair = PORTRAIT_CATEGORIES[6].parts.filter(n => n.startsWith(fem ? 'f_' : 'm_') || n.includes('buzz'));
  return {
    bg: 'background', head, body: r(PORTRAIT_CATEGORIES[2].parts),
    marks: Math.random() < 0.25 ? r(PORTRAIT_CATEGORIES[3].parts) : null,
    eyes: r(PORTRAIT_CATEGORIES[4].parts.filter(n => n.startsWith(fem ? 'f_' : 'm_'))) ?? null,
    beard: !fem && Math.random() < 0.5 ? r(PORTRAIT_CATEGORIES[5].parts) : null,
    hair: r(hair), head2: Math.random() < 0.3 ? r(PORTRAIT_CATEGORIES[7].parts) : null,
    extra: Math.random() < 0.3 ? r(PORTRAIT_CATEGORIES[8].parts) : null,
  };
}

/** Pinta el retrat compost al quadrat (dx, dy, size). */
export function drawPortrait(ctx: CanvasRenderingContext2D, choice: PortraitChoice, dx: number, dy: number, size: number) {
  for (const cat of PORTRAIT_CATEGORIES) {
    const p = choice[cat.id];
    if (p) drawPortraitPart(ctx, p, dx, dy, size);
  }
}

/** dataURL PNG de 48 px (la mida original: es mostra sempre amb `image-rendering: pixelated`). */
export function portraitDataUrl(choice: PortraitChoice | { face: number }): string {
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  const ctx = c.getContext('2d')!;
  if ('face' in choice) drawFace(ctx, choice.face as number, 0, 0, TILE);
  else drawPortrait(ctx, choice as PortraitChoice, 0, 0, TILE);
  return c.toDataURL('image/png');
}
