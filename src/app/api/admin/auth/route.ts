import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

const SALT = 'rpg-map-viewer-admin-v1';

function computeToken(pass: string): string {
  return createHmac('sha256', SALT).update(pass).digest('hex');
}

export async function POST(req: Request) {
  const { password } = await req.json();
  const expected = process.env.ADMIN_PASSWORD ?? 'admin';

  if (password !== expected) {
    return NextResponse.json({ error: 'Contrasenya incorrecta' }, { status: 401 });
  }

  const token = computeToken(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('admin_session');
  return res;
}
