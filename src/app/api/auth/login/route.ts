import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { isHttpsRequest, setSessionCookie, verifyPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/login  { username, password }
export async function POST(req: Request) {
  const db = await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!username || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña son obligatorios' }, { status: 400 });
  }

  const found = await db.execute({
    sql: 'SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ? COLLATE NOCASE',
    args: [username],
  });
  const user = found.rows[0] as unknown as
    | { id: string; username: string; passwordHash: string | null }
    | undefined;

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    if (user && !user.passwordHash) {
      return NextResponse.json(
        { error: 'Esta cuenta es anterior a las contraseñas: usa "Crear cuenta" para ponerle una' },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  await setSessionCookie({ id: user.id, username: user.username }, isHttpsRequest(req));
  return NextResponse.json({ id: user.id, username: user.username });
}
