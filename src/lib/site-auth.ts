/**
 * Contrasenya de la web (tot menys la pantalla de jugador). Viu només al servidor de Next:
 * no depèn de la API, així el DM pot entrar encara que la API estigui apagada.
 *
 * - `SITE_PASSWORD` (variable d'entorn del servidor, p. ex. a Vercel): la contrasenya. Si no hi
 *   és, la porta està oberta (ús local / LAN, `npm run dev`).
 * - `SITE_SECRET` (opcional, recomanat): secret per signar la cookie. Canviar-lo, o canviar la
 *   contrasenya, tanca totes les sessions obertes.
 *
 * La cookie (`site_session`, httpOnly) porta `<caducitat>.<signatura HMAC-SHA256>`: no s'hi desa la
 * contrasenya ni res llegible per JavaScript. Web Crypto, perquè funcioni igual al `proxy.ts` i als
 * Route Handlers.
 */

export const SITE_COOKIE = 'site_session';
/** Dies que dura la sessió abans de tornar a demanar la contrasenya. */
export const SITE_SESSION_DAYS = 30;

/** Rutes que no demanen contrasenya (la pantalla de jugador i la mateixa porta). */
export function isPublicPath(pathname: string): boolean {
  return pathname === '/player' || pathname.startsWith('/player/')
    || pathname === '/login' || pathname === '/api/site-login';
}

export function siteAuthEnabled(): boolean {
  return !!process.env.SITE_PASSWORD;
}

const enc = new TextEncoder();

async function hmac(message: string): Promise<string> {
  const keyText = `${process.env.SITE_SECRET ?? ''}|${process.env.SITE_PASSWORD ?? ''}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Comparació de temps constant (no diu per on falla). */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const real = process.env.SITE_PASSWORD;
  if (!real) return false;
  // Es comparen les signatures (mateixa llargada) per no filtrar la llargada de la contrasenya.
  return sameText(await hmac(`pw:${input}`), await hmac(`pw:${real}`));
}

/** Valor nou per a la cookie, vàlid `SITE_SESSION_DAYS` dies. */
export async function createSessionToken(nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SITE_SESSION_DAYS * 86400;
  return `${exp}.${await hmac(`site:${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp <= Math.floor(nowMs / 1000)) return false;
  return sameText(token.slice(dot + 1), await hmac(`site:${exp}`));
}

/** Destinació segura després d'entrar: només camins interns (res de `//altre-lloc`). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
