import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ serverId: string }> };

// GET /api/servers/[serverId]/members -> miembros del servidor
export async function GET(_req: Request, ctx: Ctx) {
  const { serverId } = await ctx.params;
  const db = await ensureSchema();
  const res = await db.execute(
    `SELECT u.id, u.username, m.role, m.joined_at AS joinedAt
     FROM server_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.server_id = ?
     ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, u.username COLLATE NOCASE`,
    [serverId],
  );
  return NextResponse.json(res.rows);
}

// POST /api/servers/[serverId]/members -> unirse al servidor (idempotente)
export async function POST(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { serverId } = await ctx.params;
  const db = await ensureSchema();
  const server = await db.execute({ sql: 'SELECT id FROM servers WHERE id = ?', args: [serverId] });
  if (!server.rows[0]) {
    return NextResponse.json({ error: 'Servidor no encontrado' }, { status: 404 });
  }
  await db.execute({
    sql: `INSERT OR IGNORE INTO server_members (server_id, user_id, role, joined_at)
          VALUES (?, ?, 'member', ?)`,
    args: [serverId, session.id, Date.now()],
  });
  return NextResponse.json({ ok: true });
}