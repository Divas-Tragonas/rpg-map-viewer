'use client';
/* eslint-disable react-hooks/immutability -- `DMRefs` són contenidors mutables compartits
   entre tots els hooks del DM: és el patró de tot el projecte (veure `useDMRefs`). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { writeAutosave, type AutosaveBg } from '@/lib/autosave';
import type { DMRefs } from './useDMRefs';

/** Període entre desats. Prou curt per no perdre gran cosa, prou llarg per no molestar. */
const PERIOD_MS = 30_000;

interface Opts {
  /** true mentre l'usuari vulgui autodesat (interruptor del HUD). */
  enabled: boolean;
  /** Hi ha partida per desar? Sense mapa carregat no es desa res. */
  hasMap: boolean;
  /** Nom del mapa, per poder dir què es recuperarà. */
  mapName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildRecord: () => { state: Record<string, any>; bg: AutosaveBg | null };
}

/**
 * Desat automàtic de la partida (P5). Escriu a IndexedDB cada `PERIOD_MS` **només si
 * `_broadcastState` ha marcat canvis** (`rAutosaveDirty`), i sempre que la pestanya passa
 * a segon pla — que és quan el navegador té més números de descarregar-la.
 *
 * Retorna la marca de temps de l'últim desat correcte (per al xip del HUD) i un
 * `saveNow()` per forçar-ne un.
 */
export function useAutosave(R: DMRefs, { enabled, hasMap, mapName, buildRecord }: Opts) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Els paràmetres es llegeixen dins del temporitzador, no en tancar-lo: així canviar de
  // mapa o apagar l'interruptor no obliga a reprogramar l'interval.
  const optsRef = useRef({ enabled, hasMap, mapName, buildRecord });
  useEffect(() => { optsRef.current = { enabled, hasMap, mapName, buildRecord }; });
  // Un desat no pot començar mentre l'anterior encara escriu (blobs de megabytes).
  const busyRef = useRef(false);

  const save = useCallback(async (force: boolean) => {
    const { enabled: on, hasMap: map, mapName: name, buildRecord: build } = optsRef.current;
    if (!on || !map || busyRef.current) return;
    if (!force && !R.rAutosaveDirty.current) return;
    busyRef.current = true;
    // La marca es neteja ABANS de construir l'estat: si arriba un canvi mentre s'escriu,
    // el proper cicle el tornarà a desar en lloc de donar-lo per desat.
    R.rAutosaveDirty.current = false;
    try {
      const { state, bg } = build();
      const ok = await writeAutosave(state, bg, name);
      if (ok) setSavedAt(Date.now());
      else R.rAutosaveDirty.current = true;  // quota plena, mode privat... es tornarà a provar
    } catch {
      R.rAutosaveDirty.current = true;
    } finally {
      busyRef.current = false;
    }
  }, [R]);

  useEffect(() => {
    const iv = setInterval(() => { void save(false); }, PERIOD_MS);
    // Amagar la pestanya (canvi d'aplicació, bloqueig de pantalla) és l'últim moment fiable
    // per desar: després el navegador la pot descarregar sense avisar.
    const onHide = () => { if (document.visibilityState === 'hidden') void save(false); };
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onHide); };
  }, [save]);

  return { savedAt, saveNow: () => save(true) };
}
