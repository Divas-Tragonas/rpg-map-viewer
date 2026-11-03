import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { SITE_COOKIE, SITE_SESSION_DAYS, checkPassword, createSessionToken, siteAuthEnabled } from '@/lib/site-auth';

/** Entrar: `{ password }` → cookie httpOnly. 401 si no és la bona (amb un petit retard). */
export async function POST(request: NextRequest) {
  if (!siteAuthEnabled()) return Response.json({ ok: true });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!(await checkPassword(password))) {
    // Frena els intents a cegues (no hi ha magatzem per comptar-los: Vercel és sense estat).
    await new Promise(r => setTimeout(r, 800));
    return Response.json({ error: 'Contrasenya incorrecta' }, { status: 401 });
  }
  (await cookies()).set(SITE_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: SITE_SESSION_DAYS * 86400,
  });
  return Response.json({ ok: true });
}

/** Sortir: esborra la cookie. */
export async function DELETE() {
  (await cookies()).set(SITE_COOKIE, '', { path: '/', maxAge: 0 });
  return Response.json({ ok: true });
}
