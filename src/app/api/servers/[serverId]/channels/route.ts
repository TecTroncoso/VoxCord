import { NextResponse } from 'next/server';
import { ensureSchema, newId } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ serverId: string }> };

// GET /api/servers/[serverId]/channels
export async function GET(_req: Request, ctx: Ctx) {
  const db = await ensureSchema();
  const { serverId } = await ctx.params;
  const res = await db.execute({
    sql: `SELECT id, server_id AS serverId, name, type, created_at AS createdAt
          FROM channels WHERE server_id = ? ORDER BY created_at ASC`,
    args: [serverId],
  });
  return NextResponse.json(res.rows);
}

// POST /api/servers/[serverId]/channels  { name, type }  (requiere sesión)
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const db = await ensureSchema();
  const { serverId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? '').trim().slice(0, 32);
  const type = body?.type === 'voice' ? 'voice' : 'text';
  if (!name) {
    return NextResponse.json({ error: 'name es obligatorio' }, { status: 400 });
  }
  const channel = { id: newId(), serverId, name, type, createdAt: Date.now() };
  await db.execute({
    sql: 'INSERT INTO channels (id, server_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [channel.id, channel.serverId, channel.name, channel.type, channel.createdAt],
  });
  return NextResponse.json(channel, { status: 201 });
}
