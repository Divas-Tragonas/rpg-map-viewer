'use client';
/**
 * Anota al diari (`lib/journal.ts`) el que passa a la taula i no té un únic punt de pas:
 * sales que es revelen, jugadors que cauen i mapes que s'obren. Només LLEGEIX l'estat de la
 * UI i escriu al diari: no toca res del joc.
 */
import { useEffect, useRef } from 'react';
import type { DefeatedMap, Player, Room } from '@/types';
import type { DMRefs } from './useDMRefs';
import { logJournal } from '@/lib/journal';

export function useJournalWatchers(R: DMRefs, o: { rooms: Room[]; defeated: DefeatedMap; players: Player[]; bgLoaded: boolean; bgName: string }) {
  const { rooms, defeated, players, bgLoaded, bgName } = o;
  const refs = useRef(R);
  useEffect(() => { refs.current = R; });

  // Sales revelades. Si el conjunt de sales ha canviat (escena nova, partida carregada) no es
  // compara res: les revelades d'una partida desada no són un esdeveniment d'avui.
  const prevRooms = useRef<Map<string, boolean> | null>(null);
  useEffect(() => {
    const next = new Map(rooms.map(r => [r.id, !!r.revealed]));
    const prev = prevRooms.current;
    prevRooms.current = next;
    if (!prev || prev.size !== next.size || rooms.some(r => !prev.has(r.id))) return;
    for (const r of rooms) if (r.revealed && prev.get(r.id) === false) logJournal('room', `Sala revelada: ${r.name || 'sense nom'}`);
  }, [rooms]);

  // Jugadors que cauen (els enemics derrotats surten al resum del combat).
  const prevDefeated = useRef<DefeatedMap | null>(null);
  useEffect(() => {
    const prev = prevDefeated.current;
    prevDefeated.current = defeated;
    if (!prev) return;
    for (const [k, v] of Object.entries(defeated)) {
      if (!v || prev[k] || !k.startsWith('pl_')) continue;
      const pl = players.find(p => `pl_${p.id}` === k);
      if (pl) logJournal('down', `${pl.name} cau`);
    }
  }, [defeated, players]);

  // Mapa obert (sense comptar els de les missions: ja surten com a escenes). Un petit retard
  // perquè la partida acabi de carregar-se i es sàpiga si és d'una missió.
  useEffect(() => {
    if (!bgLoaded || !bgName) return;
    const t = window.setTimeout(() => {
      if (!refs.current.rMissionScenes.current) logJournal('map', `Mapa: ${bgName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || bgName}`);
    }, 700);
    return () => window.clearTimeout(t);
  }, [bgLoaded, bgName]);
}
