import { NextResponse } from 'next/server';
import { ensureSchema, newId } from '@/lib/db';
import { hashPassword, isHttpsRequest, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[\w.-]{2,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST /api/auth/register  { username, email, password, remember? }
export async function POST(req: Request) {
  const db = await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(body?.password ?? '');
  const remember = body?.remember !== false;

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: 'Usuario inválido: 2-32 caracteres (letras, números, guiones, punto, _)' },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Escribe un correo electrónico válido' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  // Email ya usado por otra cuenta
  const emailOwner = await db.execute({
    sql: "SELECT id FROM users WHERE email = ? AND email <> ''",
    args: [email],
  });
  if (emailOwner.rows.length > 0) {
    return NextResponse.json({ error: 'Ese correo ya está registrado' }, { status: 409 });
  }

  const passwordHash = hashPassword(password);

  // Username heredado de la era sin auth: se "reclama" completándolo
  const existing = await db.execute({
    sql: 'SELECT id, username FROM users WHERE username = ? COLLATE NOCASE',
    args: [username],
  });
  const claimed = existing.rows[0] as unknown as { id: string; username: string } | undefined;

  let user: { id: string; username: string; email: string };
  if (claimed) {
    const hasPassword = await db.execute({
      sql: 'SELECT password_hash AS passwordHash FROM users WHERE id = ?',
      args: [claimed.id],
    });
    if (hasPassword.rows[0]?.passwordHash) {
      return NextResponse.json({ error: 'Ese nombre de usuario ya existe' }, { status: 409 });
    }
    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, email = ? WHERE id = ?',
      args: [passwordHash, email, claimed.id],
    });
    user = { id: claimed.id, username: claimed.username, email };
  } else {
    user = { id: newId(), username, email };
    await db.execute({
      sql: 'INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [user.id, user.username, user.email, passwordHash, Date.now()],
    });
  }

  await setSessionCookie({ id: user.id, username: user.username }, isHttpsRequest(req), remember);
  return NextResponse.json(user, { status: 201 });
}