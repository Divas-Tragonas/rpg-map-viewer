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
  /** Avís a la pantalla quan el desat automàtic porta unes quantes fallades seguides. */
  onError?: (text: string) => void;
}

/** Fallades seguides abans de dir-ho a la pantalla. Una de sola pot ser una escriptura
 *  que ha coincidit amb un altre procés; dues vol dir que no s'està desant res. */
const FAIL_STREAK_TO_WARN = 2;

/**
 * Desat automàtic de la partida (P5). Escriu a IndexedDB cada `PERIOD_MS` **només si
 * `_broadcastState` ha marcat canvis** (`rAutosaveDirty`), i sempre que la pestanya passa
 * a segon pla — que és quan el navegador té més números de descarregar-la.
 *
 * Retorna la marca de temps de l'últim desat correcte (per al xip del HUD), si està
 * fallant i un `saveNow()` per forçar-ne un.
 *
 * ⚠️ El fracàs ha de ser VISIBLE. Abans, amb la quota plena o en mode privat, l'única
 * pista era que el xip ⟳ deixava d'actualitzar-se: ningú no se n'adonava fins a perdre
 * la partida.
 */
export function useAutosave(R: DMRefs, { enabled, hasMap, mapName, buildRecord, onError }: Opts) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [failing, setFailing] = useState(false);
  const failStreakRef = useRef(0);
  const warnedRef = useRef(false);
  // Els paràmetres es llegeixen dins del temporitzador, no en tancar-lo: així canviar de
  // mapa o apagar l'interruptor no obliga a reprogramar l'interval.
  const optsRef = useRef<Opts>({ enabled, hasMap, mapName, buildRecord, onError });
  useEffect(() => { optsRef.current = { enabled, hasMap, mapName, buildRecord, onError }; });
  // Un desat no pot començar mentre l'anterior encara escriu (blobs de megabytes).
  const busyRef = useRef(false);

  const save = useCallback(async (force: boolean) => {
    const { enabled: on, hasMap: map, mapName: name, buildRecord: build, onError: report } = optsRef.current;
    if (!on || !map || busyRef.current) return;
    if (!force && !R.rAutosaveDirty.current) return;
    busyRef.current = true;
    // La marca es neteja ABANS de construir l'estat: si arriba un canvi mentre s'escriu,
    // el proper cicle el tornarà a desar en lloc de donar-lo per desat.
    R.rAutosaveDirty.current = false;
    let ok = false;
    try {
      const { state, bg } = build();
      ok = await writeAutosave(state, bg, name);
    } catch {
      ok = false;
    }
    if (ok) {
      failStreakRef.current = 0; warnedRef.current = false;
      setFailing(false);
      setSavedAt(Date.now());
    } else {
      R.rAutosaveDirty.current = true;  // quota plena, mode privat... es tornarà a provar
      failStreakRef.current++;
      if (failStreakRef.current >= FAIL_STREAK_TO_WARN) {
        setFailing(true);
        // Un sol avís per ratxa: si no, en surt un cada 30 segons.
        if (!warnedRef.current) {
          warnedRef.current = true;
          report?.("El desat automàtic no pot escriure (espai del navegador ple o finestra privada). Desa la partida a un fitxer per no perdre-la.");
        }
      }
    }
    busyRef.current = false;
  }, [R]);

  useEffect(() => {
    const iv = setInterval(() => { void save(false); }, PERIOD_MS);
    // Amagar la pestanya (canvi d'aplicació, bloqueig de pantalla) és l'últim moment fiable
    // per desar: després el navegador la pot descarregar sense avisar.
    const onHide = () => { if (document.visibilityState === 'hidden') void save(false); };
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onHide); };
  }, [save]);

  return { savedAt, failing, saveNow: () => save(true) };
}
