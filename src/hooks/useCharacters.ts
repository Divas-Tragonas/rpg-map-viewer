'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isAdminLoggedIn, isApiConfigured, type ApiCharacter, type ApiCharacterInput, type XpMeta } from '@/lib/api';
import { levelUpTo } from '@/lib/characters';

export type CharactersStatus = 'off' | 'loading' | 'ready' | 'error';

/**
 * Fitxes de la colla (API `/characters`) al DM. Només es carreguen amb la API configurada i el
 * DM connectat al back office (la ruta demana el JWT també per llegir); si no, `status: 'off'` i
 * l'app funciona com abans. Les accions tornen la fitxa nova i refresquen la llista.
 */
export function useCharacters(notify: (text: string, kind?: 'error' | 'warn' | 'info') => void) {
  const [characters, setCharacters] = useState<ApiCharacter[]>([]);
  const [status, setStatus] = useState<CharactersStatus>('off');
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; });

  const refresh = useCallback(async () => {
    if (!isApiConfigured() || !isAdminLoggedIn()) { setStatus('off'); return; }
    setStatus(s => (s === 'ready' ? s : 'loading'));
    try {
      const list = await api.characters.list();
      setCharacters(list);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      console.error('[fitxes]', e);
    }
  }, []);

  // Primera càrrega: només es toca l'estat després de la resposta (res de setState síncron a l'efecte).
  useEffect(() => {
    if (!isApiConfigured() || !isAdminLoggedIn()) return;
    let alive = true;
    api.characters.list()
      .then(list => { if (alive) { setCharacters(list); setStatus('ready'); } })
      .catch(e => { if (alive) setStatus('error'); console.error('[fitxes]', e); });
    return () => { alive = false; };
  }, []);

  /** Substitueix a la llista les fitxes que ha tornat la API. */
  const merge = useCallback((upd: ApiCharacter[]) => {
    setCharacters(prev => prev.map(c => upd.find(u => u.id === c.id) ?? c));
  }, []);

  /** Avisa de les fitxes que ja poden pujar de nivell (el DM ho confirma al menú del token). */
  const announceLevels = useCallback((upd: ApiCharacter[]) => {
    for (const c of upd) {
      const to = levelUpTo(c);
      if (to) notifyRef.current(`${c.name} ja té prou experiència per pujar a nivell ${to}. Confirma-ho al menú del seu token.`, 'info');
    }
  }, []);

  const award = useCallback(async (id: string, amount: number, meta: XpMeta = {}) => {
    try {
      const c = await api.characters.awardXp(id, amount, meta);
      merge([c]); announceLevels([c]);
      return c;
    } catch (e) {
      notifyRef.current("No s'ha pogut desar l'experiència a la fitxa. Comprova que la API funciona i que estàs connectat al back office.");
      console.error('[fitxes]', e);
      return null;
    }
  }, [merge, announceLevels]);

  const awardBatch = useCallback(async (awards: { id: string; amount: number }[], meta: XpMeta = {}) => {
    const list = awards.filter(a => a.amount !== 0);
    if (!list.length) return [];
    try {
      const upd = await api.characters.awardXpBatch(list, meta);
      merge(upd); announceLevels(upd);
      return upd;
    } catch (e) {
      notifyRef.current("No s'ha pogut repartir l'experiència. Torna-ho a provar: la mateixa entrega no es comptarà dues vegades.");
      console.error('[fitxes]', e);
      return null;
    }
  }, [merge, announceLevels]);

  const update = useCallback(async (id: string, patch: Partial<ApiCharacterInput>) => {
    try {
      const c = await api.characters.update(id, patch);
      merge([c]);
      return c;
    } catch (e) {
      notifyRef.current("No s'ha pogut desar la fitxa.");
      console.error('[fitxes]', e);
      return null;
    }
  }, [merge]);

  return { characters, status, refresh, award, awardBatch, update };
}

export type CharactersApi = ReturnType<typeof useCharacters>;
