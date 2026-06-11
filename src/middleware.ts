import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('admin_token')?.value;
    if (!token || !(await verifyJWT(token))) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
