'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isAdminLoggedIn, isApiConfigured, type ApiCharacter, type ApiCharacterInput, type XpMeta } from '@/lib/api';
import { levelUpTo, sameCharacter } from '@/lib/characters';
import {
  applyLocally, isLocalId, loadCachedCharacters, loadPending, saveCachedCharacters, savePending, type PendingOp,
} from '@/lib/characters-store';

/** `online` = la llista ve de la API; `offline` = còpia d'aquest navegador (canvis en cua). */
export type CharactersStatus = 'loading' | 'online' | 'offline';

/** Cada quant es torna a provar de connectar mentre no hi ha connexió (o hi ha canvis pendents). */
const RETRY_MS = 30_000;

/** Un error de la API amb resposta 4xx (dades) en lloc d'un error de xarxa (es pot reintentar). */
const isClientError = (e: unknown) => e instanceof Error && /^Error API 4\d\d/.test(e.message);

/**
 * Fitxes de la colla al DM (v4.68: també sense connexió). Amb la API i el back office, la llista
 * és la del servidor i se'n desa una còpia a aquest navegador; sense, es treballa amb la còpia (o
 * amb les fitxes de Notion si mai no n'hi ha hagut cap) i l'experiència i els nivells es desen en
 * una cua que es puja sola en tornar a connectar (cada 30 s, en tornar a la pestanya o quan torna
 * la xarxa). Veure `lib/characters-store.ts`.
 */
export function useCharacters(notify: (text: string, kind?: 'error' | 'warn' | 'info') => void) {
  const [characters, setCharacters] = useState<ApiCharacter[]>([]);
  const [status, setStatus] = useState<CharactersStatus>('loading');
  const [pending, setPending] = useState(0);
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; });
  const listRef = useRef<ApiCharacter[]>([]);
  const statusRef = useRef<CharactersStatus>('loading');
  const syncing = useRef(false);
  const warnedOffline = useRef(false);

  const setList = useCallback((list: ApiCharacter[]) => {
    listRef.current = list; setCharacters(list); saveCachedCharacters(list);
  }, []);
  const setSt = useCallback((s: CharactersStatus) => { statusRef.current = s; setStatus(s); }, []);

  /** Avisa de les fitxes que ja poden pujar de nivell (el DM ho confirma al menú del token). */
  const announceLevels = useCallback((upd: ApiCharacter[]) => {
    for (const c of upd) {
      const to = levelUpTo(c);
      if (to) notifyRef.current(`${c.name} ja té prou experiència per pujar a nivell ${to}. Confirma-ho al menú del seu token.`, 'info');
    }
  }, []);

  /**
   * Connecta amb la API: puja els canvis pendents (crea al servidor les fitxes que només eren
   * locals) i es queda amb la llista del servidor. Sense connexió, deixa la còpia local.
   */
  const sync = useCallback(async (): Promise<boolean> => {
    if (syncing.current) return false;
    if (!isApiConfigured() || !isAdminLoggedIn()) { setSt('offline'); return false; }
    syncing.current = true;
    try {
      let server = await api.characters.list();
      const ops = loadPending();
      let done = 0;
      const left: PendingOp[] = [];
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        try {
          let target = server.find(c => c.id === op.id) ?? server.find(c => sameCharacter(c.name, op.name));
          if (!target && isLocalId(op.id)) {
            // Fitxa que només existia aquí (de Notion, sense connexió): es crea amb el nivell que
            // tingui. L'XP no hi va (la mouen només els endpoints d'XP): la pugen els pendents.
            const local = listRef.current.find(c => c.id === op.id);
            if (local) {
              const { id: _i, xp: _x, xpLog: _l, createdAt: _c, updatedAt: _u, ...body } = local;
              void _i; void _x; void _l; void _c; void _u;
              target = await api.characters.create(body);
              server = [...server, target];
            }
          }
          if (!target) { console.warn('[fitxes] canvi pendent d\'una fitxa que ja no existeix', op); continue; }
          if (op.kind === 'xp') {
            const c = await api.characters.awardXp(target.id, op.amount, { reason: op.reason, source: op.source, awardId: op.awardId });
            server = server.map(x => x.id === c.id ? c : x);
          } else {
            const c = await api.characters.update(target.id, op.patch);
            server = server.map(x => x.id === c.id ? c : x);
          }
          done++;
        } catch (e) {
          if (isClientError(e)) { console.warn('[fitxes] canvi pendent rebutjat per la API', op, e); continue; }
          left.push(...ops.slice(i));  // xarxa: es torna a provar més tard, en el mateix ordre
          break;
        }
      }
      savePending(left);
      setPending(left.length);
      // Les fitxes locals que encara no són al servidor (sense cap canvi pendent) també hi pugen.
      for (const local of listRef.current) {
        if (!isLocalId(local.id) || server.some(c => sameCharacter(c.name, local.name))) continue;
        try {
          const { id: _i, xp: _x, xpLog: _l, createdAt: _c, updatedAt: _u, ...body } = local;
          void _i; void _x; void _l; void _c; void _u;
          server = [...server, await api.characters.create(body)];
        } catch (e) { console.warn('[fitxes] no s\'ha pogut crear la fitxa local', local.name, e); }
      }
      setList(server);
      setSt('online');
      warnedOffline.current = false;
      if (done) notifyRef.current(`S'han pujat ${done} ${done === 1 ? 'canvi' : 'canvis'} de les fitxes que s'havien fet sense connexió.`, 'info');
      return true;
    } catch (e) {
      console.warn('[fitxes] sense connexió amb la API', e);
      setSt('offline');
      return false;
    } finally {
      syncing.current = false;
    }
  }, [setList, setSt]);

  // Primer, la còpia local (fora del cos de l'efecte: res de setState síncron); després, la API.
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      listRef.current = loadCachedCharacters();
      setCharacters(listRef.current);
      setPending(loadPending().length);
      return sync();
    });
    return () => { alive = false; };
  }, [sync]);

  // Sense connexió (o amb canvis a la cua): es torna a provar sol.
  useEffect(() => {
    const retry = () => { if (statusRef.current !== 'online' || loadPending().length) void sync(); };
    const t = setInterval(retry, RETRY_MS);
    window.addEventListener('focus', retry);
    window.addEventListener('online', retry);
    return () => { clearInterval(t); window.removeEventListener('focus', retry); window.removeEventListener('online', retry); };
  }, [sync]);

  /** Desa canvis a la cua i a la còpia local (sense connexió o si la petició ha fallat per xarxa). */
  const queue = useCallback((ops: PendingOp[]) => {
    let list = listRef.current;
    for (const op of ops) list = applyLocally(list, op);
    setList(list);
    const all = [...loadPending(), ...ops];
    savePending(all); setPending(all.length);
    if (!warnedOffline.current) {
      warnedOffline.current = true;
      notifyRef.current('Sense connexió amb el back office: els canvis de les fitxes es desen en aquest ordinador i es pujaran sols quan et connectis.', 'warn');
    }
    return list.filter(c => ops.some(o => o.id === c.id));
  }, [setList]);

  const nameOf = useCallback((id: string) => listRef.current.find(c => c.id === id)?.name ?? '', []);
  const online = useCallback(() => statusRef.current === 'online' && isApiConfigured() && isAdminLoggedIn(), []);

  const award = useCallback(async (id: string, amount: number, meta: XpMeta = {}) => {
    const op: PendingOp = { kind: 'xp', id, name: nameOf(id), amount, reason: meta.reason ?? '', source: meta.source ?? '', awardId: meta.awardId || `xp-${Date.now().toString(36)}` };
    if (online() && !isLocalId(id)) {
      try {
        const c = await api.characters.awardXp(id, amount, { reason: op.reason, source: op.source, awardId: op.awardId });
        setList(listRef.current.map(x => x.id === c.id ? c : x));
        announceLevels([c]);
        return c;
      } catch (e) {
        if (isClientError(e)) { notifyRef.current("La API no ha acceptat l'experiència."); console.error('[fitxes]', e); return null; }
        setSt('offline');
      }
    }
    const [c] = queue([op]);
    if (c) announceLevels([c]);
    return c ?? null;
  }, [queue, setList, setSt, announceLevels, nameOf, online]);

  const awardBatch = useCallback(async (awards: { id: string; amount: number }[], meta: XpMeta = {}) => {
    const list = awards.filter(a => a.amount !== 0);
    if (!list.length) return [];
    const awardId = meta.awardId || `xp-${Date.now().toString(36)}`;
    if (online() && !list.some(a => isLocalId(a.id))) {
      try {
        const upd = await api.characters.awardXpBatch(list, { ...meta, awardId });
        setList(listRef.current.map(c => upd.find(u => u.id === c.id) ?? c));
        announceLevels(upd);
        return upd;
      } catch (e) {
        if (isClientError(e)) { notifyRef.current("La API no ha acceptat el repartiment d'experiència."); console.error('[fitxes]', e); return null; }
        setSt('offline');
      }
    }
    // Una entrada per fitxa amb el mateix `awardId`: és com el guarda la API al lot.
    const upd = queue(list.map(a => ({ kind: 'xp' as const, id: a.id, name: nameOf(a.id), amount: a.amount, reason: meta.reason ?? '', source: meta.source ?? '', awardId })));
    announceLevels(upd);
    return upd;
  }, [queue, setList, setSt, announceLevels, nameOf, online]);

  const update = useCallback(async (id: string, patch: Partial<ApiCharacterInput>) => {
    // Optimista: la llista local canvia ja (si no, la sincronització de la vida desfaria el canvi
    // mentre la petició és en camí). La resposta del servidor la substitueix.
    const before = listRef.current;
    if (online() && !isLocalId(id)) {
      setList(applyLocally(before, { kind: 'update', id, name: nameOf(id), patch }));
      try {
        const c = await api.characters.update(id, patch);
        setList(listRef.current.map(x => x.id === c.id ? c : x));
        return c;
      } catch (e) {
        if (isClientError(e)) { setList(before); notifyRef.current("La API no ha acceptat el canvi de la fitxa."); console.error('[fitxes]', e); return null; }
        setSt('offline');
        listRef.current = before;  // `queue` el torna a aplicar sobre la llista d'abans
      }
    }
    const [c] = queue([{ kind: 'update', id, name: nameOf(id), patch }]);
    return c ?? null;
  }, [queue, setList, setSt, nameOf, online]);

  return { characters, status, pending, sync, award, awardBatch, update };
}

export type CharactersApi = ReturnType<typeof useCharacters>;
