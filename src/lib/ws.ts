'use client';

export interface SyncSocket {
  send(data: string): void;
  sendBinary(data: ArrayBuffer): void;
  close(): void;
}

// Estat de la connexió amb la API. Serveix per poder DIR a la pantalla de jugador
// per què no arriba res (abans es quedava en un "Esperant al Dungeon Master..."
// indistingible d'un DM que encara no ha carregat cap mapa).
export type SyncStatus = 'connecting' | 'open' | 'closed';

// Estat + motiu del tancament. El `code` és el que distingeix els dos fracassos que
// des de fora es veuen igual: `4401` = el servidor ens ha rebutjat la clau
// (`SYNC_KEY`/`NEXT_PUBLIC_SYNC_KEY`, veure api-spec.txt), i `1006` = la connexió no
// s'ha arribat a establir (host apagat, funnel tancat, DNS, sense xarxa).
export interface SyncState { status: SyncStatus; code?: number; reason?: string }

// Resol la URL base de la API en runtime. Quan la pàgina s'ha carregat des d'un
// altre dispositiu (p. ex. una tablet obrint http://[IP-del-PC]:3001/player),
// "localhost" apuntaria a la mateixa tablet: cal substituir-lo pel host real
// des d'on s'ha servit la pàgina. NEXT_PUBLIC_API_URL es cuina en temps de
// build, així que aquesta correcció només pot fer-se aquí, al client.
function resolveApiBase(): string {
  const pageHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (!env) return `http://${pageHost}:3000`;
  if (pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
    try {
      const u = new URL(env);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        u.hostname = pageHost;
        return u.toString().replace(/\/$/, '');
      }
    } catch { /* URL invàlida: usar env tal qual */ }
  }
  return env;
}

// URL del WebSocket de sincronització per a un rol. Exportada perquè la pantalla de
// jugador la pugui ENSENYAR quan no connecta: en LAN, saber a quin host està trucant
// és la meitat del diagnòstic.
export function syncUrl(role: 'dm' | 'client'): string {
  const base = resolveApiBase().replace(/^http/, 'ws');
  const key = process.env.NEXT_PUBLIC_SYNC_KEY;
  return `${base}/sync?role=${role}${key ? `&key=${encodeURIComponent(key)}` : ''}`;
}

// Una pàgina servida per https NO pot obrir un WebSocket ws:// (contingut mixt): el
// navegador el bloqueja i no arriba mai res. És exactament el que passa quan es
// carrega el desplegament públic (https) des del mòbil esperant que sincronitzi amb
// el PC del DM de la wifi de casa, que va per http.
export function syncBlockedByMixedContent(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && syncUrl('client').startsWith('ws:');
}

// Base HTTP de la API (per ensenyar-la i per provar si el host respon).
export function apiBase(): string { return resolveApiBase(); }

// Hi ha clau de sincronització cuinada al build? NOMÉS diu si n'hi ha, mai el valor.
export function hasSyncKey(): boolean { return !!process.env.NEXT_PUBLIC_SYNC_KEY; }

// El host de la API respon per HTTP? Distingeix "no s'hi arriba" (Mac apagat, funnel
// tancat, sense xarxa) de "s'hi arriba però el WebSocket es tanca" (clau dolenta,
// proxy que no deixa passar el WS). `no-cors` perquè només ens importa si la petició
// arriba a algun lloc: la resposta és opaca i no se'n llegeix res.
export async function probeApiReachable(timeoutMs = 5000): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    await fetch(`${resolveApiBase()}/enemies`, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function createSyncSocket(
  role: 'dm' | 'client',
  onMessage: (ev: MessageEvent) => void,
  onOpen?: () => void,
  onStatus?: (state: SyncState) => void,
): SyncSocket {
  const url = syncUrl(role);

  let ws: WebSocket;
  let dead = false;

  function connect() {
    onStatus?.({ status: 'connecting' });
    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      ws.onmessage = onMessage;
      ws.onopen = () => { onStatus?.({ status: 'open' }); onOpen?.(); };
      ws.onerror = () => { /* reconnect on close handles this */ };
      ws.onclose = (ev) => {
        onStatus?.({ status: 'closed', code: ev.code, reason: ev.reason });
        if (!dead) setTimeout(connect, 2000);
      };
    } catch {
      onStatus?.({ status: 'closed' });
      if (!dead) setTimeout(connect, 2000);
    }
  }

  connect();

  return {
    send(data: string) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
    },
    sendBinary(data: ArrayBuffer) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
    },
    close() {
      dead = true;
      if (ws) ws.close();
    },
  };
}
