/**
 * Pont de la sincronització amb el tauler de missions de la wiki, sense API.
 *
 * El tauler (`divas-tragonas.github.io/wiki/missions/`) posa una pantalla de jugador dins d'un
 * iframe. Aquest iframe és d'un altre lloc que la pàgina que el conté, i el navegador li aïlla el
 * `BroadcastChannel` (particionat per lloc): no sent el DM encara que siguin al mateix ordinador.
 * En lloc de passar per la API, els missatges van de finestra a finestra amb `postMessage`:
 *
 *   DM ──postMessage──▶ tauler (wiki) ──postMessage──▶ iframe /player?embed=1
 *   DM ◀──────────────  tauler        ◀──────────────  iframe (PLAYER_READY, VIEWPORT…)
 *
 * El DM obre el tauler (menú Pantalles) i en guarda la finestra; el tauler parla amb el DM pel
 * seu `window.opener`. Si el DM es recarrega, el tauler hi torna a saludar i es retroba.
 * Sobre: `{ rpg: 'bc', msg }` per als missatges del canal i `{ rpg: 'bc-hello', base }` per
 * saludar-se (el DM hi diu on és, perquè el tauler carregui la pantalla i el mapa d'aquí).
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Tauler de missions que té el mapa en píxel (de moment, el de Cony Cirera). */
export const BOARD_URL = process.env.NEXT_PUBLIC_BOARD_URL || 'https://divas-tragonas.github.io/wiki/missions/?lloc=cony-cirera';
const BOARD_ORIGIN = new URL(BOARD_URL).origin;

/** Finestres del tauler a qui el DM reenvia el canal (les que ha obert o que l'han saludat). */
const _boards = new Set<Window>();

/** Obre el tauler en una finestra nova (o torna a la que ja hi ha) i la recorda. */
export function openBoard(): boolean {
  const w = window.open(BOARD_URL, 'rpg-tauler', 'width=1280,height=720');
  if (w) _boards.add(w);
  return !!w;
}

/**
 * DM: tot el que s'envia pel canal també va als taulers, i el que arriba dels taulers es
 * tracta com si vingués pel canal. Retorna la funció que ho desfà.
 */
export function relayBoards(bc: BroadcastChannel, onMsg: (e: { data: unknown }) => void): () => void {
  const post = bc.postMessage.bind(bc);
  bc.postMessage = (msg: unknown) => {
    post(msg);
    for (const w of _boards) {
      if (w.closed) { _boards.delete(w); continue; }
      try { w.postMessage({ rpg: 'bc', msg }, BOARD_ORIGIN); } catch { /* la finestra ha canviat de pàgina */ }
    }
  };
  const onWin = (e: MessageEvent) => {
    if (e.origin !== BOARD_ORIGIN || !e.source) return;
    const d = e.data as { rpg?: string; msg?: unknown } | null;
    if (d?.rpg !== 'bc' && d?.rpg !== 'bc-hello') return;
    const w = e.source as Window;
    _boards.add(w);
    if (d.rpg === 'bc-hello') w.postMessage({ rpg: 'bc-hello', base: location.origin + BASE }, BOARD_ORIGIN);
    else onMsg({ data: d.msg });
  };
  window.addEventListener('message', onWin);
  return () => { window.removeEventListener('message', onWin); bc.postMessage = post; };
}

/**
 * Pantalla de jugador incrustada: el que envia pel canal també va a la pàgina que la conté, i
 * el que aquesta li passa entra pel mateix handler que el canal. Si el navegador no té
 * `BroadcastChannel`, el pont fa de canal. Retorna el canal a fer servir i la funció que ho desfà.
 */
export function relayToParent(bc: BroadcastChannel | null, onMsg: (e: { data: unknown }) => void): { channel: BroadcastChannel; undo: () => void } {
  const up = (msg: unknown) => window.parent.postMessage({ rpg: 'bc', msg }, '*');
  let channel: BroadcastChannel;
  let restore = () => {};
  if (bc) {
    const post = bc.postMessage.bind(bc);
    bc.postMessage = (msg: unknown) => { post(msg); up(msg); };
    restore = () => { bc.postMessage = post; };
    channel = bc;
  } else {
    channel = { postMessage: up, close: () => {} } as unknown as BroadcastChannel;
  }
  const onWin = (e: MessageEvent) => {
    if (e.source !== window.parent) return;
    const d = e.data as { rpg?: string; msg?: unknown } | null;
    if (d?.rpg === 'bc') onMsg({ data: d.msg });
  };
  window.addEventListener('message', onWin);
  return { channel, undo: () => { window.removeEventListener('message', onWin); restore(); } };
}
