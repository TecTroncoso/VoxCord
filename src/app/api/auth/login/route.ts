import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { isHttpsRequest, setSessionCookie, verifyPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/login  { identifier (usuario o email), password, remember? }
export async function POST(req: Request) {
  const db = await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const identifier = String(body?.identifier ?? '').trim();
  const password = String(body?.password ?? '');
  const remember = body?.remember !== false;

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Escribe tu correo o usuario y tu contraseña' }, { status: 400 });
  }

  const found = await db.execute({
    sql: `SELECT id, username, email, password_hash AS passwordHash
          FROM users
          WHERE username = ? COLLATE NOCASE OR (email IS NOT NULL AND email = ?)
          LIMIT 1`,
    args: [identifier, identifier.toLowerCase()],
  });
  const user = found.rows[0] as unknown as
    | { id: string; username: string; email: string | null; passwordHash: string | null }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: 'No encontramos una cuenta con esos datos' }, { status: 401 });
  }
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: 'Esta cuenta es anterior a las contraseñas: regístrate con el mismo usuario' },
      { status: 401 },
    );
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  await setSessionCookie({ id: user.id, username: user.username }, isHttpsRequest(req), remember);
  return NextResponse.json({ id: user.id, username: user.username, email: user.email });
}