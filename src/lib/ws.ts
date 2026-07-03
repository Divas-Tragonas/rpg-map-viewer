'use client';

export interface SyncSocket {
  send(data: string): void;
  sendBinary(data: ArrayBuffer): void;
  close(): void;
}

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

export function createSyncSocket(
  role: 'dm' | 'client',
  onMessage: (ev: MessageEvent) => void,
  onOpen?: () => void,
): SyncSocket {
  const base = resolveApiBase().replace(/^http/, 'ws');
  const url = `${base}/sync?role=${role}`;

  let ws: WebSocket;
  let dead = false;

  function connect() {
    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      ws.onmessage = onMessage;
      if (onOpen) ws.onopen = onOpen;
      ws.onerror = () => { /* reconnect on close handles this */ };
      ws.onclose = () => {
        if (!dead) setTimeout(connect, 2000);
      };
    } catch {
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
