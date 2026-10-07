'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fetchServers, login, logout, register, useCurrentUser } from '@/lib/client';
import { Avatar } from '@/components/Avatar';
import type { Server } from '@/lib/types';

function Icon({ children, className = 'w-5 h-5' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const CheckIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="m20 6-11 11-5-5" />
  </Icon>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

const SparkIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Icon>
);

const FEATURES = [
  'Voz Opus de baja latencia (~95–140 ms) con jitter adaptativo',
  'Pantalla compartida hasta 4K/60 en VP9 con anti-eco',
  'Chat en tiempo real por data channels (servidor sin estado)',
  'Filtro IA de ruido opcional en el preset Voz HD',
];

const inputCls =
  'w-full rounded-xl bg-input px-4 py-3 text-header placeholder:text-muted/80 outline-none ' +
  'border border-transparent focus:border-accent/70 focus:ring-2 focus:ring-accent/30 transition-colors';

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useCurrentUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
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

  const filteredServers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? servers.filter((s) => s.name.toLowerCase().includes(q)) : servers;
  }, [servers, query]);

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
      const u = mode === 'login' ? await login(username, password) : await register(username, password);
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

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ---------------- Hero ---------------- */}
        <section className="relative overflow-hidden rounded-3xl border border-white/8 bg-sidebar p-7 sm:p-9 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div
            className="absolute inset-0 bg-linear-to-br from-accent/30 via-accent/5 to-accent-2/20"
            aria-hidden
          />
          <div
            className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-accent/25 blur-3xl"
            aria-hidden
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-accent to-accent-2 grid place-items-center text-lg font-black text-white shadow-lg shadow-accent/30">
                V
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-header tracking-tight">VoxCord</h1>
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-2">
                    beta
                  </span>
                </div>
                <p className="text-xs text-muted">Chat + voz + pantalla, en el navegador</p>
              </div>
            </div>

            <p className="mt-6 text-[15px] leading-relaxed text-text/90">
              Conecta con tu gente, comparte pantalla en alta calidad y habla con la latencia de un
              cliente de escritorio.
            </p>

            <ul className="mt-6 space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-muted">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-online/15 text-online">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* Presencia decorativa, al estilo del panel de miembros */}
            <div className="mt-8 rounded-2xl border border-white/8 bg-chat/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">En línea — 8</p>
              <div className="mt-3 flex items-center">
                {['Adolfo', 'Lilith', 'Nova', 'Kaito', 'Sofi'].map((n, i) => (
                  <div key={n} className="-ml-2 first:ml-0 relative">
                    <Avatar name={n} size={34} />
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-chat bg-online" />
                    <span className="sr-only">{i + 1}</span>
                  </div>
                ))}
                <span className="ml-3 text-xs text-muted">…y 3 más</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Auth ---------------- */}
        <section className="rounded-3xl border border-white/8 bg-chat p-6 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)] flex flex-col">
          <div className="flex rounded-xl bg-input p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-linear-to-r from-accent to-accent-2 text-white shadow' : 'text-muted hover:text-header'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {user ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/8 bg-sidebar p-4">
              <Avatar name={user.username} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-header">{user.username}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full bg-online" /> en línea
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-danger/50 hover:text-danger"
              >
                Salir
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="mt-5 space-y-3">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">
                  Usuario
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu-usuario"
                  maxLength={32}
                  autoComplete="username"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? '••••••••' : 'mínimo 6 caracteres'}
                  maxLength={128}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className={inputCls}
                />
              </div>
              {mode === 'register' && (
                <div>
                  <label htmlFor="password2" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">
                    Repetir contraseña
                  </label>
                  <input
                    id="password2"
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="••••••••"
                    maxLength={128}
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !username.trim() || password.length < 6 || (mode === 'register' && !password2)}
                className="w-full rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-3 font-bold text-white shadow-lg shadow-accent/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>

              <p className="text-center text-xs text-muted">
                {mode === 'login'
                  ? '¿Aún no tienes cuenta? Cambia a «Crear cuenta».'
                  : 'La sesión dura 7 días en este dispositivo.'}
              </p>
            </form>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}
        </section>

        {/* ---------------- Servidores ---------------- */}
        <section className="lg:col-span-2 rounded-3xl border border-white/8 bg-sidebar p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-header">Servidores</h2>
              <p className="text-xs text-muted">
                {servers.length} disponible{servers.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-full bg-input px-3.5 py-2 text-muted focus-within:border-accent/60">
              <SearchIcon className="h-4 w-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en este servidor…"
                className="w-40 bg-transparent text-sm text-header placeholder:text-muted/80 outline-none sm:w-56"
              />
            </div>
          </div>

          {user && (
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
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServers.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-muted">
                {servers.length === 0
                  ? 'Todavía no hay servidores. Crea el primero con tu cuenta iniciada.'
                  : 'Ningún servidor coincide con tu búsqueda.'}
              </p>
            )}
            {filteredServers.map((s) => (
              <button
                key={s.id}
                onClick={() => (user ? router.push(`/s/${s.id}`) : setError('Primero inicia sesión'))}
                className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-chat/60 p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-chat"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-accent/80 to-accent-2/70 text-sm font-bold text-white">
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-header">{s.name}</span>
                  <span className="block text-xs text-muted">
                    creado el {new Date(s.createdAt).toLocaleDateString('es')}
                  </span>
                </span>
                <SparkIcon className="ml-auto h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-70" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}