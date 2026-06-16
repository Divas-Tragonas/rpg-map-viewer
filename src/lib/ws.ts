'use client';

export interface SyncSocket {
  send(data: string): void;
  sendBinary(data: ArrayBuffer): void;
  close(): void;
}

export function createSyncSocket(
  role: 'dm' | 'client',
  onMessage: (ev: MessageEvent) => void,
): SyncSocket {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
    .replace(/^http/, 'ws');
  const url = `${base}/sync?role=${role}`;

  let ws: WebSocket;
  let dead = false;

  function connect() {
    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      ws.onmessage = onMessage;
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
