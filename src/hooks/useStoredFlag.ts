'use client';
import { useCallback, useSyncExternalStore } from 'react';

// Còpia en memòria: sense localStorage (mode privat, bloquejat) el valor es manté igualment
// mentre la pàgina està oberta.
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function read(key: string, fallback: boolean): boolean {
  if (!memory.has(key)) {
    let v = fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw === '1' || raw === '0') v = raw === '1';
    } catch { /* sense localStorage */ }
    memory.set(key, v);
  }
  return memory.get(key) ?? fallback;
}

/**
 * Un sí/no de la UI que es recorda entre sessions (localStorage), p. ex. el lateral plegat.
 * `useSyncExternalStore` amb el valor per defecte al servidor: llegir localStorage al primer
 * render donaria un error d'hidratació (veure `useEnemyGrouping`).
 */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key, fallback), () => fallback);
  const set = useCallback((v: boolean) => {
    memory.set(key, v);
    try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* es queda en memòria */ }
    listeners.forEach(l => l());
  }, [key]);
  return [value, set];
}

const memoryStr = new Map<string, string>();
function readStr(key: string, fallback: string): string {
  if (!memoryStr.has(key)) {
    let v = fallback;
    try { v = localStorage.getItem(key) ?? fallback; } catch { /* sense localStorage */ }
    memoryStr.set(key, v);
  }
  return memoryStr.get(key) ?? fallback;
}

/** Com `useStoredFlag`, per a un text (p. ex. l'última cinemàtica triada). */
export function useStoredString(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(subscribe, () => readStr(key, fallback), () => fallback);
  const set = useCallback((v: string) => {
    memoryStr.set(key, v);
    try { localStorage.setItem(key, v); } catch { /* es queda en memòria */ }
    listeners.forEach(l => l());
  }, [key]);
  return [value, set];
}
