import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function POST(req: Request) {
  const { password } = await req.json();

  if (!API) {
    return NextResponse.json({ error: 'API no configurada' }, { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    return NextResponse.json({ error: 'No s\'ha pogut connectar amb la API' }, { status: 503 });
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(
      { error: body.error ?? 'Contrasenya incorrecta' },
      { status: upstream.status },
    );
  }

  const { token } = await upstream.json();
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_token', token, {
    httpOnly: false,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('admin_token');
  return res;
}
