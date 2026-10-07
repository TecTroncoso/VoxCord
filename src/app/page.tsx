'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fetchServers, logout, useCurrentUser } from '@/lib/client';
import { Avatar } from '@/components/Avatar';
import type { Server } from '@/lib/types';

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const inputCls =
  'w-full rounded-xl bg-input px-4 py-3 text-header placeholder:text-muted/80 outline-none ' +
  'border border-transparent focus:border-accent/70 focus:ring-2 focus:ring-accent/30 transition-colors';

export default function HomePage() {
  const router = useRouter();
  const { user, hydrated, setUser } = useCurrentUser();
  const [servers, setServers] = useState<Server[]>([]);
  const [serverName, setServerName] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshServers = useCallback(async () => {
    try {
      setServers(await fetchServers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de servidores');
    }
  }, []);

  useEffect(() => {
    refreshServers();
  }, [refreshServers]);

  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user, router]);

  const filteredServers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? servers.filter((s) => s.name.toLowerCase().includes(q)) : servers;
  }, [servers, query]);

  async function handleCreateServer(e: React.FormEvent) {
    e.preventDefault();
    if (!serverName.trim() || !user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api<Server>('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name: serverName }),
      });
      setServerName('');
      router.push(`/s/${s.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el servidor');
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    router.replace('/login');
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen grid place-items-center text-muted">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-5">
        {/* Cabecera con identidad */}
        <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/8 bg-sidebar p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user?.username ?? '?'} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-header">{user?.username}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-online" /> en línea
                {user?.email && <span className="truncate">· {user.email}</span>}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-danger/50 hover:text-danger"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Servidores */}
        <section className="rounded-3xl border border-white/8 bg-sidebar p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-header">Servidores</h1>
              <p className="text-xs text-muted">
                {servers.length} disponible{servers.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-full bg-input px-3.5 py-2 text-muted focus-within:border-accent/60">
              <SearchIcon className="h-4 w-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="w-40 bg-transparent text-sm text-header placeholder:text-muted/80 outline-none sm:w-56"
              />
            </div>
          </div>

          <form onSubmit={handleCreateServer} className="mt-4 flex gap-2">
            <input
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Nombre del nuevo servidor"
              maxLength={48}
              className={`${inputCls} flex-1`}
            />
            <button
              type="submit"
              disabled={busy || !serverName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PlusIcon className="h-4 w-4" />
              Crear
            </button>
          </form>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServers.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-muted">
                {servers.length === 0
                  ? 'Todavía no hay servidores. Crea el primero.'
                  : 'Ningún servidor coincide con tu búsqueda.'}
              </p>
            )}
            {filteredServers.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/s/${s.id}`)}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-chat/60 p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-chat"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-accent/80 to-accent-2/70 text-sm font-bold text-white">
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-header">{s.name}</span>
                  <span className="block text-xs text-muted">
                    {new Date(s.createdAt).toLocaleDateString('es')}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}