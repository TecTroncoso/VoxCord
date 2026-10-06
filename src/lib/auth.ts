import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Auth mínima pero real para el MVP:
 * - Contraseña: scrypt (node:crypto, salt aleatoria) — formato "saltHex:hashHex".
 * - Sesión: JWT HS256 en cookie httpOnly (7 días). Stateless → apto serverless.
 * - Secreto: AUTH_SECRET; fallback derivado de TURSO_AUTH_TOKEN (estable entre
 *   reinicios); en su defecto, secreto dev fijo (solo local).
 */

export const SESSION_COOKIE = 'voxcord_session';
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

export type SessionUser = { id: string; username: string };

/* ------------------------------ contraseñas ------------------------------ */

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, 'hex'), 32);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

/* --------------------------------- JWT ---------------------------------- */

function authSecret(): string {
  const explicit = process.env.AUTH_SECRET?.trim();
  if (explicit) return explicit;
  const turso = process.env.TURSO_AUTH_TOKEN?.trim();
  if (turso) return createHash('sha256').update(`voxcord:${turso}`).digest('hex');
  return 'voxcord-dev-insecure-secret';
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signSession(user: SessionUser): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ sub: user.id, name: user.username, iat: now, exp: now + SESSION_TTL_SEC }),
  );
  const sig = createHmac('sha256', authSecret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function verifySession(token: string): SessionUser | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = createHmac('sha256', authSecret()).update(`${header}.${payload}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      name?: string;
      exp?: number;
    };
    if (!data.sub || !data.name) return null;
    if (typeof data.exp === 'number' && data.exp < Date.now() / 1000) return null;
    return { id: data.sub, username: data.name };
  } catch {
    return null;
  }
}

/* -------------------------------- cookies -------------------------------- */

export async function setSessionCookie(user: SessionUser, secureTransport: boolean): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    // Secure solo bajo HTTPS real (prod tras proxy); en http local la cookie
    // debe enviarse igualmente o la sesión no persistiría en desarrollo.
    secure: secureTransport,
    maxAge: SESSION_TTL_SEC,
    path: '/',
  });
}

/** Detecta si la request llegó por HTTPS (Vercel/Render terminan TLS en proxy). */
export function isHttpsRequest(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  return proto === 'https';
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? verifySession(raw) : null;
}
