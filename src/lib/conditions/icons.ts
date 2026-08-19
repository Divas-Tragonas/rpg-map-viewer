/**
 * Isotips vectorials dels estats (condicions) de D&D.
 *
 * Inspirats en la làmina oficial d'estats: una silueta blanca plena dins d'un
 * badge de color. Es guarden com a **paths SVG** (no bitmaps) en una caixa de
 * `ICON_BOX`×`ICON_BOX` unitats, de manera que es dibuixen a la **màxima
 * resolució possible** a qualsevol mida: al canvas via `Path2D` (vectorial, es
 * re-rasteritza a cada zoom) i al menú del DM via `<svg>` (idem).
 *
 * Cada icona és una llista de parts:
 *   - sense `w` → s'omple amb regla **evenodd**: els subpaths interiors fan de
 *     forat (ulls, boca, esquerdes...).
 *   - amb `w`   → es traça (gruix en unitats de la caixa); `dash` per a guions.
 *   - amb `bg`  → es pinta amb el **color del badge** en lloc de la tinta. És com
 *     es fa la barra del "prohibit": un tall ample de color de fons i, a sobre,
 *     una barra fina de tinta. Fer-ho amb evenodd deixava un escaquer allà on la
 *     barra creuava un forat de la silueta (la doble inversió tornava a omplir).
 */

export const ICON_BOX = 512;

export interface IconPart {
  /** Dades del path SVG, en unitats de `ICON_BOX`. */
  d: string;
  /** Gruix de traç. Si hi és, la part es traça en lloc d'omplir-se. */
  w?: number;
  /** Patró de guions (només per a parts traçades). */
  dash?: number[];
  /** Es pinta amb el color de fons del badge en lloc de la tinta. */
  bg?: true;
}

// ── Peces reutilitzades ────────────────────────────────────────────────────────

/** Cap i tors d'una figura humana dempeus, de cara. Base de mitja dotzena d'estats. */
const HUMAN_HEAD = 'M210 74A46 46 0 1 0 302 74A46 46 0 1 0 210 74Z';
const HUMAN_BODY =
  'M256 136C300 136 330 156 340 190L372 302C378 324 362 342 342 336C330 332 324 322 320 308' +
  'L306 262L306 342L330 452C334 472 320 486 302 486C288 486 278 478 274 462L256 382' +
  'L238 462C234 478 224 486 210 486C192 486 178 472 182 452L206 342L206 262L192 308' +
  'C188 322 182 332 170 336C150 342 134 324 140 302L172 190C182 156 212 136 256 136Z';
const HUMAN = HUMAN_HEAD + HUMAN_BODY;

/** Cara ovalada centrada (cx 256, cy 256, rx 170, ry 182). */
const FACE = 'M86 256A170 182 0 1 0 426 256A170 182 0 1 0 86 256Z';

// ── Icones ────────────────────────────────────────────────────────────────────

export const CONDITION_ICONS: Record<string, IconPart[]> = {

  // Cara amb una bena tapant els ulls.
  blinded: [{
    d: FACE +
      'M104 212H408V274H104Z' +
      'M186 326C210 378 302 378 326 326C318 384 194 384 186 326Z',
  }],

  // Cara amb cors als ulls i somriure.
  charmed: [{
    d: FACE +
      'M188 268C136 224 140 176 172 176C186 176 188 190 188 190C188 190 190 176 204 176C236 176 240 224 188 268Z' +
      'M324 268C272 224 276 176 308 176C322 176 324 190 324 190C324 190 326 176 340 176C372 176 376 224 324 268Z' +
      'M180 322C202 372 310 372 332 322C324 380 188 380 180 322Z',
  }],

  // Orella amb un tall diagonal (no hi sents).
  deafened: [
    {
      d: 'M256 42C152 42 84 128 84 244C84 322 112 372 130 418C150 466 200 484 244 470' +
        'C296 454 318 404 296 356C344 348 400 316 418 246C442 152 372 42 256 42Z' +
        'M268 132C196 132 156 190 156 250C156 296 176 322 206 344C226 358 244 342 236 322' +
        'C224 296 210 280 210 250C210 208 240 182 286 182C322 182 344 202 344 232' +
        'C344 258 330 272 312 286C296 298 302 318 322 316C358 312 388 278 388 232' +
        'C388 174 340 132 268 132Z',
    },
    { d: 'M118 451L442 111L398 69L74 409Z', bg: true },
    { d: 'M107 440L431 100L409 80L85 420Z' },
  ],

  // Figura ensorrada, cap cot i gotes de suor.
  exhaustion: [{
    d: 'M198 100A48 44 -16 1 0 294 100A48 44 -16 1 0 198 100Z' +
      'M246 156C292 156 326 182 334 224L348 306C352 328 336 344 316 341C300 339 292 328 290 314L282 264L282 344' +
      'L300 452C303 472 289 486 271 486C256 486 246 477 243 462L234 400L222 462C219 477 208 486 193 486' +
      'C175 486 161 472 164 452L182 344L182 264L174 314C171 328 163 339 148 341C128 344 112 328 116 306' +
      'L130 224C138 182 172 156 218 156Z' +
      'M400 66C400 66 440 118 440 140A40 40 0 0 1 360 140C360 118 400 66 400 66Z' +
      'M462 194C462 194 488 226 488 240A26 26 0 0 1 436 240C436 226 462 194 462 194Z',
  }],

  // Testa de bèstia amb ulls furiosos i boca dentada.
  frightened: [{
    d: 'M256 60C354 60 430 130 430 236C430 342 354 452 256 452C158 452 82 342 82 236C82 130 158 60 256 60Z' +
      'M126 184L228 222L208 264L116 232Z' +
      'M386 184L284 222L304 264L396 232Z' +
      'M152 336A104 52 0 1 0 360 336A104 52 0 1 0 152 336Z' +
      'M184 290L206 336H162Z' + 'M256 288L280 340H232Z' + 'M328 290L350 336H306Z' +
      'M220 386L198 340H242Z' + 'M292 386L270 340H314Z',
  }],

  // Mà oberta que agafa.
  grappled: [{
    d: 'M82 340L82 210C82 188 99 171 121 171C143 171 160 188 160 210L160 292L172 292' +
      'L172 126C172 104 189 87 211 87C233 87 250 104 250 126L250 286L262 286' +
      'L262 106C262 84 279 67 301 67C323 67 340 84 340 106L340 290L352 290' +
      'L352 152C352 130 369 113 391 113C413 113 430 130 430 152L430 340' +
      'C430 420 366 482 256 482C146 482 82 420 82 340Z',
  }],

  // Silueta humana només insinuada: contorn de guions.
  invisible: [
    { d: HUMAN_HEAD, w: 26, dash: [34, 26] },
    { d: HUMAN_BODY, w: 26, dash: [34, 26] },
  ],

  // Figura amb un impacte al pit: ni accions ni reaccions.
  incapacitated: [{
    d: HUMAN +
      'M256 170L266.4 206.8L299.8 188.2L281.2 221.6L318 232L281.2 242.4L299.8 275.8L266.4 257.2L256 294' +
      'L245.6 257.2L212.2 275.8L230.8 242.4L194 232L230.8 221.6L212.2 188.2L245.6 206.8Z',
  }],

  // Figura travessada per una descàrrega, amb espurnes als costats.
  paralyzed: [
    {
      d: HUMAN +
        'M280 168L206 300H252L228 402L308 260H262Z',
    },
    { d: 'M92 196L128 238L96 262L134 308', w: 22 },
    { d: 'M420 196L384 238L416 262L378 308', w: 22 },
  ],

  // Figura de pedra, esquerdada i escantonada.
  petrified: [{
    d: HUMAN +
      'M246.4 134.2L211.5 206.6L253.5 246.3L215.5 317.1L239.5 376.3L219.8 449.8L236.2 454.2L256.5 375.7' +
      'L232.5 318.9L270.5 245.7L228.5 205.4L261.6 141.8Z' +
      'M311.9 253.6L280.5 299.8L308.5 344.7L289.2 382.8L302.8 389.2L323.5 343.3L295.5 300.2L324.1 262.4Z' +
      'M340 188L378 212L342 234Z',
  }],

  // Calavera amb bombolles de verí.
  poisoned: [{
    d: 'M256 52C348 52 418 118 418 208C418 272 384 320 336 344L336 396C336 418 318 436 296 436' +
      'L216 436C194 436 176 418 176 396L176 344C128 320 94 272 94 208C94 118 164 52 256 52Z' +
      'M140 200A46 52 0 1 0 232 200A46 52 0 1 0 140 200Z' +
      'M280 200A46 52 0 1 0 372 200A46 52 0 1 0 280 200Z' +
      'M256 246L286 306H226Z' +
      'M218 348H230V436H218Z' + 'M250 348H262V436H250Z' + 'M282 348H294V436H282Z' +
      'M414 82A30 30 0 1 0 474 82A30 30 0 1 0 414 82Z' +
      'M462 26A18 18 0 1 0 498 26A18 18 0 1 0 462 26Z',
  }],

  // Figura a terra, de quatre grapes.
  prone: [{
    d: 'M366 116A44 44 0 1 0 278 116A44 44 0 1 0 366 116Z' +
      'M302 172C346 164 382 186 390 226L404 296C408 318 392 334 372 332C358 330 350 320 347 306L338 262' +
      'L332 322L396 386C412 402 410 426 392 438C376 448 358 444 346 432L268 354L176 384C154 392 134 380 130 360' +
      'C126 340 138 322 158 316L262 282C274 278 282 266 284 252L292 200C294 184 298 174 302 172Z' +
      'M76 456H436V488H76Z',
  }],

  // Figura lligada amb cordes.
  restrained: [{
    d: HUMAN +
      'M148 196H364V228H148Z' +
      'M136 274H376V306H136Z' +
      'M176 352H336V384H176Z',
  }],

  // Cap atordit amb estrelles giravoltant.
  stunned: [{
    d: 'M194 296A62 62 0 1 0 318 296A62 62 0 1 0 194 296Z' +
      'M146 486C146 414 195 364 256 364C317 364 366 414 366 486Z' +
      'M120 70L135.3 110.9L179 112.8L144.8 140L156.4 182.2L120 158L83.6 182.2L95.2 140L61 112.8L104.7 110.9Z' +
      'M256 34L268.8 68.3L305.5 69.9L276.8 92.7L286.6 128.1L256 107.8L225.4 128.1L235.2 92.7L206.5 69.9L243.2 68.3Z' +
      'M392 70L407.3 110.9L451 112.8L416.8 140L428.4 182.2L392 158L355.6 182.2L367.2 140L333 112.8L376.7 110.9Z',
  }],

  // Cara amb els ulls closos i una línia plana.
  unconscious: [{
    d: FACE +
      'M148 214C174 246 216 246 242 214C216 262 174 262 148 214Z' +
      'M270 214C296 246 338 246 364 214C338 262 296 262 270 214Z' +
      'M140 330H218L236 300L256 366L272 330H372V352H258L244 388L226 322L216 352H140Z',
  }],

  // Cara amb els ulls en creu i la boca oberta.
  dying: [{
    d: FACE +
      'M150 178L186 214L222 178L240 196L204 232L240 268L222 286L186 250L150 286L132 268L168 232L132 196Z' +
      'M290 178L326 214L362 178L380 196L344 232L380 268L362 286L326 250L290 286L272 268L308 232L272 196Z' +
      'M200 344A56 42 0 1 0 312 344A56 42 0 1 0 200 344Z',
  }],
};

/** Path2D cachejats per id (es construeixen un cop; es reutilitzen a cada frame). */
const _path2d = new Map<string, { p: Path2D; w?: number; dash?: number[]; bg?: true }[]>();

export function conditionPaths(id: string): { p: Path2D; w?: number; dash?: number[]; bg?: true }[] | null {
  const cached = _path2d.get(id);
  if (cached) return cached;
  const parts = CONDITION_ICONS[id];
  if (!parts) return null;
  const built = parts.map(part => ({ p: new Path2D(part.d), w: part.w, dash: part.dash, bg: part.bg }));
  _path2d.set(id, built);
  return built;
}
