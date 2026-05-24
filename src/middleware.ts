import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SALT = 'rpg-map-viewer-admin-v1';

async function computeToken(pass: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SALT),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(pass));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login' || pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const session = request.cookies.get('admin_session')?.value;
    const pass = process.env.ADMIN_PASSWORD ?? 'admin';
    const expected = await computeToken(pass);

    if (session !== expected) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
