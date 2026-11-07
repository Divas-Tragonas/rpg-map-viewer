// GENERAT per `scripts/fx-atlas.py` a partir de `assets/fx-packs/`: no editar a mà.
// Full: `public/sprites/fx_anims.png` (SheetId `anims`). Una fila per animació; tots els
// fotogrames d'una animació tenen la mateixa caixa (w×h) i van seguits d'esquerra a dreta.

export interface FxAnim {
  /** Cantonada del primer fotograma dins del full. */
  x: number; y: number;
  /** Mida de cada fotograma (px d'art). */
  w: number; h: number;
  /** Fotogrames i ms per fotograma. */
  n: number; ms: number;
  /** En bucle (si no, es reprodueix un cop). */
  loop: boolean;
  /** Centre de la casella original de l'autor, mesurat des de la cantonada del fotograma. */
  ox: number; oy: number;
}

export const FX_ANIMS = {
  /** Esclat de foc vist de dalt: bola, anell i fum (bola de foc). */
  fire_explosion: { x: 0, y: 0, w: 61, h: 64, n: 12, ms: 70, loop: false, ox: 31, oy: 32 },
  /** Esclat de foc petit (raig de foc, mans ardents, alès). */
  fire_burst: { x: 0, y: 64, w: 30, h: 31, n: 12, ms: 60, loop: false, ox: 15, oy: 16 },
  /** Flametes arran de terra (brases, zones de foc). */
  burning_ground: { x: 0, y: 95, w: 29, h: 11, n: 12, ms: 83, loop: true, ox: 14, oy: -3 },
  /** Punxes de gel que surten de terra. */
  ice_spikes: { x: 0, y: 106, w: 32, h: 18, n: 10, ms: 70, loop: false, ox: 16, oy: 3 },
  /** Remolí de neu (alè de fred, zones de gel). */
  snow_swirl: { x: 0, y: 124, w: 24, h: 18, n: 12, ms: 90, loop: true, ox: 12, oy: 9 },
  /** Cristall de gel que brilla (zones de gel). */
  frost_crystal: { x: 0, y: 142, w: 18, h: 22, n: 12, ms: 110, loop: true, ox: 9, oy: 10 },
  /** Esclat de gel: nucli i anell de glaç. */
  ice_burst: { x: 0, y: 164, w: 58, h: 58, n: 10, ms: 60, loop: false, ox: 29, oy: 29 },
  /** Espurnes elèctriques (Paralitzat, xoc, zones de llamp). */
  crackle: { x: 0, y: 222, w: 30, h: 29, n: 8, ms: 70, loop: true, ox: 15, oy: 14 },
  /** Arc elèctric horitzontal que s'enrajola (raig elèctric). */
  chain_arc: { x: 0, y: 251, w: 64, h: 30, n: 8, ms: 60, loop: true, ox: 32, oy: 16 },
  /** Esclat de tro: nucli groc i anell de llamps. */
  thunder_burst: { x: 0, y: 281, w: 60, h: 60, n: 9, ms: 65, loop: false, ox: 30, oy: 30 },
  /** Font d'espurnes (prestidigitació, beneït, zones de màgia). */
  spark_fountain: { x: 0, y: 341, w: 30, h: 15, n: 12, ms: 80, loop: true, ox: 15, oy: -1 },
  /** Bassal d'àcid que bull (zones de verí). */
  acid_puddle: { x: 0, y: 356, w: 18, h: 10, n: 12, ms: 100, loop: true, ox: 9, oy: -3 },
  /** Esquitx d'àcid (fletxa àcida, alè d'àcid). */
  acid_splash: { x: 0, y: 366, w: 28, h: 17, n: 10, ms: 70, loop: false, ox: 12, oy: 1 },
  /** Núvol de verí gran (núvols, alè de verí). */
  poison_cloud: { x: 0, y: 383, w: 42, h: 34, n: 12, ms: 100, loop: true, ox: 21, oy: 17 },
  /** Núvol de verí petit (Enverinat). */
  poison_puff: { x: 0, y: 417, w: 20, h: 16, n: 12, ms: 110, loop: true, ox: 10, oy: 8 },
  /** Raig fosc que cau i esclat d'ombra (necròtic, terror). */
  dark_bolt: { x: 0, y: 433, w: 63, h: 83, n: 11, ms: 75, loop: false, ox: 31, oy: 43 },
  /** Cúpula de foc de perfil (impacte del raig de foc a la figura). */
  fire_dome: { x: 0, y: 516, w: 58, h: 48, n: 7, ms: 70, loop: false, ox: 29, oy: 23 },
  /** Llamp que cau del cel i esclata (flama sagrada, raig radiant). */
  sky_strike: { x: 0, y: 564, w: 56, h: 126, n: 10, ms: 70, loop: false, ox: 28, oy: 62 },
  /** Esfera elèctrica que esclata (agafada electritzant). */
  spark_orb: { x: 0, y: 690, w: 30, h: 30, n: 7, ms: 70, loop: false, ox: 15, oy: 15 },
  /** Impacte blanc amb esquerdes (projectil màgic, cops de conjur; es tenyeix). */
  impact_star: { x: 0, y: 720, w: 32, h: 34, n: 4, ms: 60, loop: false, ox: 11, oy: 11 },
  /** Remolí de vent (desaparèixer). */
  whirlwind: { x: 0, y: 754, w: 34, h: 45, n: 19, ms: 55, loop: false, ox: 17, oy: 21 },
  /** Esquitx de sang (cops forts). */
  bleed: { x: 0, y: 799, w: 27, h: 24, n: 6, ms: 70, loop: false, ox: 14, oy: 12 },
  /** Núvol de pols (cop que tomba, taumatúrgia). */
  dust_cloud: { x: 0, y: 823, w: 24, h: 25, n: 7, ms: 70, loop: false, ox: 12, oy: 13 },
  /** Cors (Encisat). */
  status_charmed: { x: 0, y: 848, w: 20, h: 18, n: 9, ms: 110, loop: true, ox: 10, oy: 12 },
  /** Estrelles que giren (Atordit). */
  status_stunned: { x: 0, y: 866, w: 22, h: 12, n: 8, ms: 100, loop: true, ox: 11, oy: 16 },
  /** Impacte elèctric groc. */
  zap_yellow: { x: 0, y: 878, w: 24, h: 25, n: 6, ms: 60, loop: false, ox: 11, oy: 13 },
  /** Llampec curt amb parpelleig (raig elèctric). */
  bolt_blue: { x: 0, y: 903, w: 24, h: 24, n: 12, ms: 55, loop: false, ox: 12, oy: 12 },
  /** Esclat de fulles (enredar). */
  nature_impact: { x: 0, y: 927, w: 24, h: 23, n: 6, ms: 70, loop: false, ox: 12, oy: 12 },
  /** Liana que es retorça (Retingut, enredar). */
  vines: { x: 0, y: 950, w: 21, h: 15, n: 5, ms: 110, loop: true, ox: 10, oy: 4 },
  /** Esquitx d'aigua (zones d'aigua). */
  water_splash: { x: 0, y: 965, w: 23, h: 23, n: 8, ms: 75, loop: false, ox: 11, oy: 12 },
  /** Gotes que pugen i brillen (curació, tenyit de poció; sense el doll del principi, que tenyit semblava sang). */
  heal_rise: { x: 0, y: 988, w: 18, h: 22, n: 13, ms: 60, loop: false, ox: 9, oy: 11 },
} as const satisfies Record<string, FxAnim>;

export type FxAnimId = keyof typeof FX_ANIMS;
