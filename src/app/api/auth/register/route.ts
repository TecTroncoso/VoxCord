import { NextResponse } from 'next/server';
import { ensureSchema, newId } from '@/lib/db';
import { hashPassword, isHttpsRequest, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[\w.-]{2,32}$/;

// POST /api/auth/register  { username, password }
export async function POST(req: Request) {
  const db = await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: 'Usuario inválido: 2-32 caracteres (letras, números, guiones, punto, _)' },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const found = await db.execute({
    sql: 'SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ? COLLATE NOCASE',
    args: [username],
  });
  const existing = found.rows[0] as unknown as
    | { id: string; username: string; passwordHash: string | null }
    | undefined;

  if (existing && existing.passwordHash) {
    return NextResponse.json({ error: 'Ese nombre de usuario ya existe' }, { status: 409 });
  }

  const passwordHash = hashPassword(password);
  let user: { id: string; username: string };
  if (existing) {
    // Cuenta heredada sin contraseña (de la era sin auth): se "reclama" poniéndole una
    await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [passwordHash, existing.id] });
    user = { id: existing.id, username: existing.username };
  } else {
    user = { id: newId(), username };
    await db.execute({
      sql: 'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
      args: [user.id, user.username, passwordHash, Date.now()],
    });
  }

  await setSessionCookie(user, isHttpsRequest(req));
  return NextResponse.json({ ...user, createdAt: Date.now() }, { status: existing ? 200 : 201 });
}
