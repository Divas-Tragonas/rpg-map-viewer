'use client';
import { useSyncExternalStore } from 'react';
import { getPack, subscribePack, type PackState } from '@/lib/sprites/pack';

const SERVER: PackState = { status: 'none', sheets: {} };

/** Estat del paquet de sprites per a la UI (es re-renderitza quan es carrega). */
export function useSpritePack(): PackState {
  return useSyncExternalStore(subscribePack, getPack, () => SERVER);
}
