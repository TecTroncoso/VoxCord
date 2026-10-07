import type { Client } from '@libsql/client';

/**
 * Cliente Turso (libSQL). Singleton por proceso.
 *
 * Variables de entorno:
 * - TURSO_DATABASE_URL (p. ej. libsql://xxxx.turso.io). Fallback dev: file:./dev.db
 * - TURSO_AUTH_TOKEN
 *
 * Con URL remota se usa `@libsql/client/web` (HTTP/fetch puro, sin binarios
 * nativos): apto para serverless (Vercel, edge) y procesos stateless.
 * Sin URL, se usa el driver Node con SQLite local para desarrollo.
 */
const g = globalThis as unknown as {
  __voxcordDb?: Client;
  __voxcordDbBoot?: Promise<Client>;
};

function toWebUrl(url: string): string {
  // El driver web habla HTTP(S); libsql://db.turso.io -> https://db.turso.io
  return url.replace(/^libsql:\/\//, 'https://');
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at)`,
];

/**
 * Crea el cliente (driver según entorno) y aplica el esquema de forma
 * idempotente, una vez por proceso. Devuelve el cliente listo.
 */
export function ensureSchema(): Promise<Client> {
  if (!g.__voxcordDbBoot) {
    const boot = async (): Promise<Client> => {
      const url = process.env.TURSO_DATABASE_URL?.trim();
      const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
      let client: Client;
      if (url) {
        const { createClient } = await import('@libsql/client/web');
        client = createClient({ url: toWebUrl(url), authToken }) as unknown as Client;
      } else {
        const { createClient } = await import('@libsql/client');
        client = createClient({ url: 'file:./dev.db' });
      }
      await client.batch(SCHEMA, 'write');
      // Migraciones para bases creadas antes de cada campo (idempotentes):
      const migrations = [
        'ALTER TABLE users ADD COLUMN password_hash TEXT',
        'ALTER TABLE users ADD COLUMN email TEXT',
        // Un email por cuenta (los registros sin email quedan fuera):
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
         ON users(email) WHERE email IS NOT NULL AND email <> ''`,
      ];
      for (const sql of migrations) {
        try {
          await client.execute(sql);
        } catch {
          // ya aplicado
        }
      }
      g.__voxcordDb = client;
      return client;
    };
    g.__voxcordDbBoot = boot().catch((err) => {
      g.__voxcordDbBoot = undefined;
      throw err;
    });
  }
  return g.__voxcordDbBoot;
}

export function newId(): string {
  return crypto.randomUUID();
}
