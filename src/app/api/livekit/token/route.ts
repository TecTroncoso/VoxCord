import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/livekit/token  { roomName } -> { token, url }  (requiere sesión)
export async function POST(req: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const serverUrl = process.env.LIVEKIT_URL?.trim();
  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json(
      { error: 'LiveKit no configurado: define LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET' },
      { status: 500 },
    );
  }

  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const roomName = String(body?.roomName ?? '').trim();
  const baseIdentity = session.id;
  const displayName = session.username;
  if (!roomName) {
    return NextResponse.json({ error: 'roomName es obligatorio' }, { status: 400 });
  }

  // Sufijo aleatorio para permitir la misma cuenta en varias pestañas/dispositivos
  const identity = `${baseIdentity}-${Math.random().toString(36).slice(2, 8)}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: displayName,
    ttl: '2h',
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({ token: await at.toJwt(), url: serverUrl, identity });
}
