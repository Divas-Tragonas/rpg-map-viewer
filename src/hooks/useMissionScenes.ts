'use client';
/**
 * Escenes d'una missió amb llocs (Cony Cirera: la farga, la capella, l'hostal…): entrar i sortir
 * dels llocs amb un fos a negre a totes les pantalles.
 *
 * Un canvi d'escena és carregar una altra partida (`applySessionState`), o sigui que tot el
 * que ja funciona (sync, desat, sales fosques, boira) hi funciona igual:
 *   1. la cortina es tanca (camp `curtain` del STATE) i, mentrestant, es baixa el mapa del lloc;
 *   2. l'escena d'ara es desa tal com és dins de `missionScenes.saved` (es desa a la partida);
 *   3. es carrega la de destí (`sceneState`: com es va deixar, o nova) amb la colla a l'entrada;
 *   4. quan el fons és a punt, la cortina s'obre (cada pantalla espera el seu fons).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MissionScenes, SceneCurtain } from '@/types';
import type { DMRefs } from './useDMRefs';
import { VILLAGE, missionById, placeOf, sceneState, sceneTitle, sceneUrl } from '@/lib/missions';
import type { PlaceMark } from '@/lib/render/places';
import { resetExplored } from '@/lib/render/darkrooms';
import { CURTAIN_CLOSE_MS } from '@/components/ui/SceneCurtain';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/** Marques del mapa del DM per a l'escena `scenes.current`. */
function marksFor(scenes: MissionScenes | null): PlaceMark[] {
  const m = missionById(scenes?.mission);
  if (!m || !scenes) return [];
  const cell = m.cell;
  const at = ([c, r]: [number, number]) => ({ x: (c + 0.5) * cell, y: (r + 0.5) * cell });
  const here = placeOf(m, scenes.current);
  if (here) return [{ id: VILLAGE, ...at(here.exit), label: `Sortir a ${m.name}`, kind: 'exit' }];
  return (m.places ?? []).map(p => ({ id: p.id, ...at(p.door), label: p.name, kind: 'enter' as const }));
}

export function useMissionScenes(R: DMRefs, o: {
  applySessionState: (state: Record<string, unknown>) => Promise<void>;
  buildCore: () => Record<string, unknown>;
  broadcast: () => void;
  notify: (text: string) => void;
  /** Abans de canviar d'escena: tancar menús i el que hi hagi a mig fer. */
  onBeforeSwitch: () => void;
  onUndoChange: () => void;
}) {
  // Els refs del DM es llegeixen a través d'un ref propi (veure `useDialog`).
  const refs = useRef(R);
  useEffect(() => { refs.current = R; });
  const oRef = useRef(o);
  useEffect(() => { oRef.current = o; });

  const [scenes, setScenesState] = useState<MissionScenes | null>(null);
  const [curtain, setCurtainState] = useState<SceneCurtain | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  /** L'han canviat per fora (carregar una partida, obrir una missió): marques i menú. */
  const setScenes = useCallback((s: MissionScenes | null) => {
    setScenesState(s);
    refs.current.rPlaceMarks.current = marksFor(s);
  }, []);

  const setCurtain = useCallback((c: SceneCurtain | null) => {
    refs.current.rCurtain.current = c; setCurtainState(c);
    oRef.current.broadcast();
  }, []);

  const goTo = useCallback(async (target: string) => {
    const Rf = refs.current;
    const sc = Rf.rMissionScenes.current;
    const m = missionById(sc?.mission);
    if (!sc || !m || busyRef.current || target === sc.current) return;
    if (target !== VILLAGE && !placeOf(m, target)) return;
    busyRef.current = true; setBusy(true);
    const title = sceneTitle(m, target);
    oRef.current.onBeforeSwitch();
    Rf.rSelectedToken.current = null; Rf.rMultiSelected.current = new Set(); Rf.rPlaceHover.current = null;
    setCurtain({ closed: true, scene: target, title });
    try {
      const [blob] = await Promise.all([
        fetch(sceneUrl(m, target)).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }),
        wait(CURTAIN_CLOSE_MS + 50),
      ]);
      const state = sceneState(m, sc, oRef.current.buildCore(), target, blob);
      // Desfer: res de l'escena d'abans s'ha de poder desfer a la nova.
      Rf.rMapHistory.current = []; Rf.rMoveHistory.current = []; Rf.rUndoLog.current = [];
      await oRef.current.applySessionState(state);
      // El fons és un <img> nou: s'espera que estigui a punt (màx. 4 s) abans d'obrir.
      for (let t = 0; t < 40; t++) {
        const el = Rf.mediaRef.current as HTMLImageElement | null;
        if (el && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) break;
        await wait(100);
      }
      // L'escena nova comença neta: res de boira explorada ni de tokens lliscant des d'on eren.
      resetExplored();
      Rf.visualPosRef.current = {}; Rf.rMovePath.current = {};
      oRef.current.onUndoChange();
      await wait(120);
    } catch {
      oRef.current.notify(`No s'ha pogut obrir «${title}». Comprova la connexió i torna-ho a provar.`);
      const back = Rf.rMissionScenes.current;
      setCurtain({ closed: false, scene: back?.current ?? sc.current, title: '' });
      busyRef.current = false; setBusy(false);
      return;
    }
    setCurtain({ closed: false, scene: target, title });
    busyRef.current = false; setBusy(false);
  }, [setCurtain]);

  useEffect(() => { refs.current.rPlaceEnter.current = id => { void goTo(id); }; }, [goTo]);

  /** Un mapa que no és de la missió (mapa nou, PSD, demo, caselles): fora llocs i marques. */
  const drop = useCallback(() => {
    if (!refs.current.rMissionScenes.current) return;
    refs.current.rMissionScenes.current = null; setScenes(null);
  }, [setScenes]);
  /** El menú ressalta la porta d'un lloc al mapa. */
  const hover = useCallback((id: string | null) => { refs.current.rPlaceHover.current = id; }, []);

  const mission = missionById(scenes?.mission) ?? null;
  return { scenes, setScenes, curtain, busy, goTo, mission, drop, hover };
}
