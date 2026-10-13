import type { DrawTool } from '@/types';

/**
 * Els dos moments d'una sessió del DM. **Preparar** és construir el mapa abans de jugar
 * (parets, portes, llums, graella, capes); **Jugar** és el que es fa a la taula (regla,
 * dibuix, màgies, torns). Cada mode només ensenya les seves eines: abans les catorze de la
 * barra i les tres pestanyes del lateral sortien sempre alhora.
 *
 * És estat només de la UI del DM: no es sincronitza ni canvia res del que veuen els jugadors.
 */
export type DMMode = 'preparar' | 'jugar';

const PREP_TOOLS: readonly DrawTool[] = ['wall', 'light'];
const PLAY_TOOLS: readonly DrawTool[] = ['pen', 'eraser', 'shape', 'pointer'];

/** Mode on viu una eina; null = als dos (la de selecció). */
export function modeForTool(tool: DrawTool): DMMode | null {
  if (PREP_TOOLS.includes(tool)) return 'preparar';
  if (PLAY_TOOLS.includes(tool)) return 'jugar';
  return null;
}
