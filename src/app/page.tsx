'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fetchServers, useCurrentUser } from '@/lib/client';
import type { Server } from '@/lib/types';

const LAST_SERVER_KEY = 'voxcord:lastServer';

export default function HomePage() {
  const router = useRouter();
  const { user, hydrated } = useCurrentUser();
  const [checking, setChecking] = useState(true);
  const [needsServer, setNeedsServer] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al iniciar sesión se entra directo a la interfaz del servidor:
  // el último visitado si sigue existiendo, si no el primero disponible.
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const servers = await fetchServers();
        if (cancelled) return;
        if (servers.length === 0) {
          setNeedsServer(true);
          setChecking(false);
          return;
        }
        const last = window.localStorage.getItem(LAST_SERVER_KEY);
        const target = servers.find((s) => s.id === last) ?? servers[0];
        window.localStorage.setItem(LAST_SERVER_KEY, target.id);
        router.replace(`/s/${target.id}`);
      } catch {
        if (!cancelled) {
          setError('No se pudo comprobar la lista de servidores');
          setChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user, router]);

  async function createFirstServer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api<Server>('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      window.localStorage.setItem(LAST_SERVER_KEY, s.id);
      router.replace(`/s/${s.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el servidor');
      setBusy(false);
    }
  }

  if (checking || !hydrated || !needsServer) {
    return (
      <main className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
          <p className="text-sm text-muted">Entrando…</p>
        </div>
      </main>
    );
  }

  // Onboarding: primer servidor de la cuenta
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={createFirstServer}
        className="w-full max-w-md rounded-3xl border border-white/8 bg-sidebar p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-xl font-black text-white shadow-lg shadow-accent/30">
          V
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-header">Crea tu primer servidor</h1>
        <p className="mt-2 text-sm text-muted">
          Hola {user?.username}. Tu servidor tiene un canal de texto y una sala de voz listos para usar.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del servidor"
          maxLength={48}
          autoFocus
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-header placeholder:text-muted/70 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="mt-4 w-full rounded-xl bg-linear-to-r from-accent-2 to-accent px-5 py-3.5 font-bold text-white shadow-lg shadow-accent/25 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
        >
          {busy ? 'Creando…' : 'Crear y entrar'}
        </button>
        {error && (
          <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}