'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fetchServers, login, logout, register, useCurrentUser } from '@/lib/client';
import { Avatar } from '@/components/Avatar';
import type { Server } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useCurrentUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [servers, setServers] = useState<Server[]>([]);
  const [serverName, setServerName] = useState('');
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

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (mode === 'register' && password !== password2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setBusy(true);
    try {
      const u =
        mode === 'login' ? await login(username, password) : await register(username, password);
      setUser(u);
      setPassword('');
      setPassword2('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
  }

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

  const inputCls =
    'w-full rounded bg-input px-3 py-2.5 text-header placeholder:text-muted outline-none focus:ring-2 ring-accent';

  return (
    <main className="min-h-screen bg-rail flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid gap-6 md:grid-cols-2">
        <section className="md:col-span-2 text-center">
          <h1 className="text-4xl font-extrabold text-header tracking-tight">VoxCord</h1>
          <p className="text-muted mt-2">
            Chat estilo Discord, voz de baja latencia tipo TeamSpeak y pantalla compartida en alta calidad.
          </p>
        </section>

        {/* ------- Auth ------- */}
        <section className="bg-sidebar rounded-lg p-6 shadow-xl">
          <div className="flex rounded-lg bg-panel p-1 mb-5">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-accent text-white' : 'text-muted hover:text-header'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <Avatar name={user.username} size={44} />
              <div className="min-w-0">
                <p className="font-semibold text-header truncate">{user.username}</p>
                <p className="text-xs text-online">Sesión iniciada</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto text-sm text-muted hover:text-danger underline underline-offset-2"
              >
                Salir
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                maxLength={32}
                autoComplete="username"
                className={inputCls}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={inputCls}
              />
              {mode === 'register' && (
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repite la contraseña"
                  maxLength={128}
                  autoComplete="new-password"
                  className={inputCls}
                />
              )}
              <button
                type="submit"
                disabled={busy || !username.trim() || password.length < 6 || (mode === 'register' && !password2)}
                className="w-full rounded bg-accent hover:bg-accent-hover disabled:opacity-50 px-3 py-2.5 font-semibold text-white transition-colors"
              >
                {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
              {mode === 'register' && (
                <p className="text-xs text-muted">Mínimo 6 caracteres. La sesión dura 7 días.</p>
              )}
            </form>
          )}
        </section>

        {/* ------- Crear servidor ------- */}
        <section className="bg-sidebar rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-bold text-header mb-4">Crear servidor</h2>
          <form onSubmit={handleCreateServer} className="space-y-3">
            <input
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Nombre del servidor"
              maxLength={48}
              disabled={!user}
              className={`${inputCls} disabled:opacity-50`}
            />
            <button
              type="submit"
              disabled={busy || !user || !serverName.trim()}
              className="w-full rounded bg-online/90 hover:bg-online disabled:opacity-50 px-3 py-2.5 font-semibold text-white transition-colors"
            >
              Crear y entrar
            </button>
            {!user && <p className="text-xs text-muted">Inicia sesión para crear un servidor.</p>}
          </form>
        </section>

        {/* ------- Servidores ------- */}
        <section className="md:col-span-2 bg-sidebar rounded-lg p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-header">Servidores disponibles</h2>
            <button onClick={refreshServers} className="text-sm text-muted hover:text-header underline underline-offset-2">
              Recargar
            </button>
          </div>
          {servers.length === 0 ? (
            <p className="text-muted text-sm">No hay servidores todavía. Crea el primero arriba.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {servers.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => (user ? router.push(`/s/${s.id}`) : setError('Primero inicia sesión'))}
                    className="w-full text-left rounded bg-panel hover:bg-hover px-4 py-3 transition-colors"
                  >
                    <p className="font-semibold text-header truncate">{s.name}</p>
                    <p className="text-xs text-muted">{new Date(s.createdAt).toLocaleDateString('es')}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <p className="md:col-span-2 text-center text-sm text-danger bg-danger/10 rounded px-3 py-2">{error}</p>
        )}
      </div>
    </main>
  );
}
