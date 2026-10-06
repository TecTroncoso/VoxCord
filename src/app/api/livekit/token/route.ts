import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Acuñación del JWT de acceso a LiveKit (HS256) a mano, con dos diferencias
 * clave frente al SDK oficial (livekit-server-sdk):
 *
 * - `nbf` retrocedido NBF_BACKDATE_SEC: el SDK oficial firma con nbf = "ahora"
 *   exacto. Si el reloj del host va adelantado (incluso 1-2 min), LiveKit
 *   rechaza el token como "invalid token" (aún no válido). Retrocederlo da
 *   tolerancia al desfase sin sacrificar seguridad (sigue ligado a la firma).
 * - Sin dependencia: el JWT de acceso es solo header.payload.firma HMAC.
 */

const NBF_BACKDATE_SEC = 600; // 10 min de tolerancia al clock skew
const TOKEN_TTL_SEC = 2 * 60 * 60; // 2 h, igual que antes

type VideoGrants = {
  roomJoin: boolean;
  room: string;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
};

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function mintLiveKitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  name: string,
  video: VideoGrants,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: apiKey,
      sub: identity,
      name,
      nbf: now - NBF_BACKDATE_SEC,
      exp: now + TOKEN_TTL_SEC,
      video,
    }),
  );
  const sig = createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// POST /api/livekit/token  { roomName } -> { token, url, identity }  (requiere sesión)
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
  if (!roomName) {
    return NextResponse.json({ error: 'roomName es obligatorio' }, { status: 400 });
  }

  // Sufijo aleatorio para permitir la misma cuenta en varias pestañas/dispositivos
  const identity = `${session.id}-${Math.random().toString(36).slice(2, 8)}`;

  const token = mintLiveKitToken(apiKey, apiSecret, identity, session.username, {
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({ token, url: serverUrl, identity });
}
