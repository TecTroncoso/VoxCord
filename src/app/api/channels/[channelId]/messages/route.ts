import { NextResponse } from 'next/server';
import { ensureSchema, newId } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { broadcastMessage, type StreamMessage } from '@/lib/hub';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ channelId: string }> };

// GET /api/channels/[channelId]/messages?after=<seq>&limit=50
export async function GET(req: Request, ctx: Ctx) {
  const db = await ensureSchema();
  const { channelId } = await ctx.params;
  const url = new URL(req.url);
  const after = Number(url.searchParams.get('after') ?? '0') || 0;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50') || 50, 100);

  if (after > 0) {
    const res = await db.execute({
      sql: `SELECT rowid AS seq, id, channel_id AS channelId, author_id AS authorId,
                   author_name AS authorName, content, created_at AS createdAt
            FROM messages WHERE channel_id = ? AND rowid > ? ORDER BY rowid ASC LIMIT ?`,
      args: [channelId, after, limit],
    });
    return NextResponse.json(res.rows);
  }

  const res = await db.execute({
    sql: `SELECT rowid AS seq, id, channel_id AS channelId, author_id AS authorId,
                 author_name AS authorName, content, created_at AS createdAt
          FROM messages WHERE channel_id = ? ORDER BY rowid DESC LIMIT ?`,
    args: [channelId, limit],
  });
  return NextResponse.json(res.rows.reverse());
}

/**
 * POST /api/channels/[channelId]/messages  { id?, content }
 *
 * - Requiere sesión: el autor se toma de la cookie firmada, nunca del body.
 * - El cliente envía `id` (uuid) para envío idempotente: con el transporte
 *   LiveKit el mensaje viaja al instante por data channel y este POST solo
 *   persiste; reintentos no duplican.
 * - Broadcast al hub SSE (fallback cuando LiveKit no está configurado).
 * El servidor no mantiene estado entre llamadas: apto para serverless.
 */
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const db = await ensureSchema();
  const { channelId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const clientId = String(body?.id ?? '').trim().slice(0, 64) || newId();
  const content = String(body?.content ?? '').trim().slice(0, 4000);
  if (!content) {
    return NextResponse.json({ error: 'content es obligatorio' }, { status: 400 });
  }

  await db.execute({
    sql: 'INSERT OR IGNORE INTO messages (id, channel_id, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [clientId, channelId, session.id, session.username, content, Date.now()],
  });
  const row = await db.execute({
    sql: `SELECT rowid AS seq, id, channel_id AS channelId, author_id AS authorId,
                 author_name AS authorName, content, created_at AS createdAt
          FROM messages WHERE id = ?`,
    args: [clientId],
  });
  const msg = row.rows[0] as unknown as StreamMessage | undefined;
  if (!msg) {
    return NextResponse.json({ error: 'No se pudo guardar el mensaje' }, { status: 500 });
  }
  // El broadcast SSE alimenta el fallback sin LiveKit; en modo LiveKit no hay oyentes.
  broadcastMessage(channelId, msg);
  return NextResponse.json(msg, { status: 201 });
}
