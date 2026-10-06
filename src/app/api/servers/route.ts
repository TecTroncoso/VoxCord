import { NextResponse } from 'next/server';
import { ensureSchema, newId } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/servers -> lista de servidores
export async function GET() {
  const db = await ensureSchema();
  const res = await db.execute(
    'SELECT id, name, owner_id AS ownerId, created_at AS createdAt FROM servers ORDER BY created_at ASC',
  );
  return NextResponse.json(res.rows);
}

// POST /api/servers  { name } -> crea servidor con canales por defecto (requiere sesión)
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const db = await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? '').trim().slice(0, 48);
  const ownerId = session.id;
  if (!name) {
    return NextResponse.json({ error: 'name es obligatorio' }, { status: 400 });
  }
  const serverId = newId();
  const generalTextId = newId();
  const generalVoiceId = newId();
  const now = Date.now();
  await db.batch([
    {
      sql: 'INSERT INTO servers (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)',
      args: [serverId, name, ownerId, now],
    },
    {
      sql: 'INSERT INTO channels (id, server_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [generalTextId, serverId, 'general', 'text', now],
    },
    {
      sql: 'INSERT INTO channels (id, server_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [generalVoiceId, serverId, 'Sala de voz', 'voice', now],
    },
  ]);
  return NextResponse.json({ id: serverId, name, ownerId, createdAt: now }, { status: 201 });
}
