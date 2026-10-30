/**
 * Missions preparades: un mapa concret amb la colla ja col·locada i el que aquell mapa demana
 * (de moment, l'ajust de color de les figuretes). Obrir-ne una és carregar una partida feta
 * (`missionState` → `applySessionState`), o sigui que tot el que ja funciona amb les partides
 * (desat, desat automàtic, sincronització amb els jugadors) hi funciona igual.
 *
 * De moment els mapes viuen al repositori (`public/missions/<id>/`); més endavant aniran al
 * back office. El mapa de cada missió es genera amb el seu script (`scripts/mission-*.py`).
 */
import type { FigureGrade, Player, TurnState } from '@/types';
import { DEFAULT_PARTY, DEFAULT_SPEED_FT } from '@/constants';

export interface Mission {
  id: string;
  name: string;
  /** Una línia sota el nom (on és, què s'hi fa). */
  subtitle: string;
  /** Mapa dins de `public/` (sense la barra del davant). */
  map: string;
  /** Mida de la casella del mapa en px. */
  cell: number;
  /** Casella de cada membre de la colla, en l'ordre de `DEFAULT_PARTY`. */
  party: [number, number][];
  /** Ajust de color perquè les figuretes del paquet lliguin amb el mapa. */
  figureGrade: FigureGrade;
}

export const MISSIONS: Mission[] = [
  {
    id: 'conyberry',
    name: 'Conyberry',
    subtitle: 'El poble abandonat del llac',
    map: 'missions/conyberry/mapa.png',
    cell: 48,
    // Al camí, al sud del pou.
    party: [[17, 13], [18, 13], [16, 14], [17, 14], [18, 14]],
    // Mesurat amb les figuretes damunt del mapa: una mica menys saturades i cap al to càlid de
    // l'aquarel·la, però més clares que el mapa, amb els negres a la tinta del mapa (`INK` de
    // `scripts/oryx-village.py`) i l'ombra cap a baix a la dreta que fan els arbres i les cases.
    // Amb l'ajust de la v4.53 (sat 0,6, guany 0,95 i sense ombra) es barrejaven amb el camí.
    figureGrade: { sat: 0.85, warm: [1, 0.98, 0.92], gain: 1.08, ink: [44, 36, 24], shadow: 0.55 },
  },
];

export const missionUrl = (m: Mission) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/${m.map}`;

const NO_TURN: TurnState = { active: false, order: [], turnIndex: 0, round: 1, activeRemainingFt: 0 };

/** La partida d'inici d'una missió, en el format que llegeix `applySessionState`. */
export function missionState(m: Mission, bg: Blob): Record<string, unknown> {
  const R = Math.round(m.cell * 0.45);
  const pos: Record<string, { x: number; y: number }> = {};
  const sizes: Record<string, number> = {};
  const players: Player[] = DEFAULT_PARTY.map((p, i) => {
    const [c, r] = m.party[i] ?? m.party[0];
    // La posició d'un token de jugador és la cantonada (centre − R), com a `addPlayer`.
    const x = c * m.cell + m.cell / 2 - R, y = r * m.cell + m.cell / 2 - R;
    const id = 9001 + i;
    pos[`pl_${id}`] = { x, y }; sizes[`pl_${id}`] = R;
    return { id, name: p.name, color: p.color, x, y, visible: true, hp: p.hpMax, hpMax: p.hpMax, speed: p.speed ?? DEFAULT_SPEED_FT, sprite: p.sprite };
  });
  // Tot el que no és de la missió es buida: si no, quedaria el que hi hagués del mapa d'abans.
  return {
    bgBlob: bg, bgName: `${m.name}.png`,
    players, pos, tokenSizeOverride: sizes,
    // La graella del mapa (una casella = 5 ft), visible, amb els tokens ajustats a la casella i
    // els enemics que s'afegeixin de la biblioteca també a la mida de la casella.
    gridSize: m.cell, gridOriginX: 0, gridOriginY: 0, gridSnap: true, gridVisible: true, gridLineWidth: 1,
    gridAutoSize: true,
    zoom: 1, panOffset: { x: 0, y: 0 },
    vis: {}, conditions: {}, defeated: {}, paintedZones: [], strokeHistory: [],
    libEnemies: [], walls: [], rooms: [], doors: [], lights: [], turn: NO_TURN,
    tokenGroups: [], dialogs: {}, tileMap: null,
    figureGrade: m.figureGrade,
  };
}
