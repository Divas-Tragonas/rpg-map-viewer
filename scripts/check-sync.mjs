/**
 * Comprovació del contracte del WebSocket /sync de la API (divas_tragonas_api).
 *
 * Obre dues connexions (rol=dm i rol=client) i comprova que el servidor reenvia
 * els missatges en les dues direccions. Serveix per verificar un canvi al relay
 * abans de donar per bo el costat frontend (Pas 4 del flux de CLAUDE.md).
 *
 *   node scripts/check-sync.mjs                       # ws://localhost:3000
 *   node scripts/check-sync.mjs ws://192.168.68.102:3000
 *   node scripts/check-sync.mjs ws://localhost:3000 LA_SYNC_KEY
 *
 * Requereix Node 18+ (WebSocket global). Cap dependència.
 */
const base = (process.argv[2] || 'ws://localhost:3000').replace(/^http/, 'ws').replace(/\/$/, '');
const key = process.argv[3] ? `&key=${encodeURIComponent(process.argv[3])}` : '';
const url = (role) => `${base}/sync?role=${role}${key}`;

const open = (role) => new Promise((res, rej) => {
  const ws = new WebSocket(url(role));
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => res(ws);
  ws.onerror = () => rej(new Error(`no s'ha pogut connectar a ${url(role)}`));
  setTimeout(() => rej(new Error(`timeout connectant a ${url(role)}`)), 5000);
});

// Espera un missatge JSON que compleixi `match` (ignora la resta: STRUCT en caché, etc.)
const waitFor = (ws, match, ms = 3000) => new Promise((res) => {
  const t = setTimeout(() => { ws.removeEventListener('message', h); res(null); }, ms);
  const h = (ev) => {
    if (typeof ev.data !== 'string') return;
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (!match(m)) return;
    clearTimeout(t); ws.removeEventListener('message', h); res(m);
  };
  ws.addEventListener('message', h);
});

const line = (ok, label, extra = '') => console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);

let fails = 0;
try {
  const dm = await open('dm');
  const client = await open('client');
  console.log(`connectat a ${base}\n`);

  // 1) client → DM: VIEWPORT (el que fa que el DM llisti les pantalles connectades)
  const gotViewport = waitFor(dm, (m) => m.type === 'VIEWPORT');
  client.send(JSON.stringify({ type: 'VIEWPORT', id: 'check', w: 1234, h: 567 }));
  const vp = await gotViewport;
  const vpOk = !!vp && vp.id === 'check' && vp.w === 1234 && vp.h === 567;
  if (!vpOk) fails++;
  line(vpOk, 'VIEWPORT arriba del client al DM', vp ? JSON.stringify(vp) : 'no ha arribat res en 3s');

  // 2) client → DM: TOKEN_MOVE (relay que ja hi havia; control de que la prova és vàlida)
  const gotMove = waitFor(dm, (m) => m.type === 'TOKEN_MOVE');
  client.send(JSON.stringify({ type: 'TOKEN_MOVE', id: 'pl_check', x: 1, y: 2 }));
  const mv = await gotMove;
  if (!mv) fails++;
  line(!!mv, 'TOKEN_MOVE arriba del client al DM (control)', mv ? '' : 'no ha arribat: el relay client→dm no va');

  // 3) DM → client: STATE amb `cam` (l'enquadrament ha de viatjar sencer)
  const cam = { cx: 100, cy: 50, w: 800, h: 450 };
  const gotState = waitFor(client, (m) => m.type === 'STATE' && m.cam);
  dm.send(JSON.stringify({ type: 'STATE', cam, zoom: 2 }));
  const st = await gotState;
  const camOk = !!st && JSON.stringify(st.cam) === JSON.stringify(cam);
  if (!camOk) fails++;
  line(camOk, 'STATE reenvia el camp `cam` sencer al client', st ? JSON.stringify(st.cam) : 'no ha arribat cap STATE amb cam');

  dm.close(); client.close();
  console.log(fails ? `\n${fails} comprovació(ns) fallida(es).` : '\nTot correcte: la API ja serveix el que necessita el frontend.');
  process.exit(fails ? 1 : 0);
} catch (e) {
  console.error('❌', e.message);
  console.error('\nArrenca la API (port 3000) i torna-ho a provar. Si té SYNC_KEY, passa-la com a 2n argument.');
  process.exit(2);
}
