'use client';
/**
 * Pantalla compacta (mòbil): el DM en un telèfon, dret (≤ 760 px d'ample) o ajagut (≤ 500 px
 * d'alt). La barra superior passa a icones, el lateral és un calaix per sobre del mapa i els
 * menús ocupen l'amplada de la pantalla. Es llegeix amb `useSyncExternalStore` (al servidor,
 * `false`), així no hi ha error d'hidratació.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';

export const COMPACT_QUERY = '(max-width: 760px), (max-height: 500px)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const snapshot = () => window.matchMedia(COMPACT_QUERY).matches;
const serverSnapshot = () => false;

export function useCompactLayout(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** El mateix valor per als components de dins d'una barra o d'un menú, sense passar-lo per props. */
export const CompactContext = createContext(false);
export const useCompact = () => useContext(CompactContext);
