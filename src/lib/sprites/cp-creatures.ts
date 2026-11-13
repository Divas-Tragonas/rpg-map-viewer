// GENERAT per `scripts/craftpix-creatures.py` — no editar a mà (tocar el script i tornar-lo a executar).
// Criatures dels paquets de CraftPix a `public/sprites/cp_creatures.png`: una per fila, 3 fotogrames de `CP_CELL` px.

export const CP_CELL = 64;
/** Nom → [x, y] del primer fotograma. */
export const CP_CREATURES: Record<string, readonly [number, number]> = {
  cp_boar: [0, 0],
  cp_deer: [0, 64],
  cp_fox: [0, 128],
  cp_hare: [0, 192],
  cp_black_grouse: [0, 256],
  cp_plant1: [0, 320],
  cp_plant2: [0, 384],
  cp_plant3: [0, 448],
  cp_monk1: [0, 512],
  cp_monk2: [0, 576],
  cp_monk3: [0, 640],
  cp_monk4: [0, 704],
  cp_priest: [0, 768],
  cp_citizen1: [0, 832],
  cp_citizen2: [0, 896],
  cp_fighter: [0, 960],
};
/** Nom → [etiqueta, grup]. */
export const CP_INFO: Record<string, readonly [string, string]> = {
  cp_boar: ["Senglar", "Animals de caça"],
  cp_deer: ["Cérvol", "Animals de caça"],
  cp_fox: ["Guineu", "Animals de caça"],
  cp_hare: ["Llebre", "Animals de caça"],
  cp_black_grouse: ["Gall de bruc", "Animals de caça"],
  cp_plant1: ["Planta depredadora vermella", "Plantes depredadores"],
  cp_plant2: ["Planta depredadora 2", "Plantes depredadores"],
  cp_plant3: ["Planta depredadora 3", "Plantes depredadores"],
  cp_monk1: ["Monjo 1", "Monjos i clergues"],
  cp_monk2: ["Monjo 2", "Monjos i clergues"],
  cp_monk3: ["Monjo 3", "Monjos i clergues"],
  cp_monk4: ["Monjo 4", "Monjos i clergues"],
  cp_priest: ["Sacerdot", "Monjos i clergues"],
  cp_citizen1: ["Ciutadà 1", "Ciutadans"],
  cp_citizen2: ["Ciutadà 2", "Ciutadans"],
  cp_fighter: ["Lluitador", "Ciutadans"],
};
