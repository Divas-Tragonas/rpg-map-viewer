import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SITE_COOKIE, isPublicPath, siteAuthEnabled, verifySessionToken } from '@/lib/site-auth';

async function verifyJWT(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET ?? '';
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const b64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4);
    const sigBytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      enc.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return false;

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadPadded = payloadB64 + '=='.slice(0, (4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(atob(payloadPadded));

    return !payload.exp || payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/**
 * Porta de la web (Next 16: `proxy.ts` substitueix `middleware.ts`).
 * 1. Contrasenya de la web (`lib/site-auth.ts`): tot demana la cookie `site_session` menys la
 *    pantalla de jugador (`/player`), la pàgina `/login` i els fitxers estàtics (el matcher els
 *    exclou: la pantalla de jugador els necessita). Sense `SITE_PASSWORD`, oberta.
 * 2. Back office (`/admin/*`): a més, el JWT de la API (`admin_token`), com abans.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (siteAuthEnabled() && !isPublicPath(pathname)
      && !(await verifySessionToken(request.cookies.get(SITE_COOKIE)?.value))) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('admin_token')?.value;
    if (!token || !(await verifyJWT(token))) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Tot menys els fitxers de Next i qualsevol camí amb extensió (sprites, mapes, icones, mòduls…).
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
