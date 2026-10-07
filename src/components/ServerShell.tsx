'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fetchChannels, fetchServers } from '@/lib/client';
import { ServerRail } from '@/components/ServerRail';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { ChatArea } from '@/components/ChatArea';
import { VoiceChannel } from '@/components/VoiceChannel';
import { Avatar } from '@/components/Avatar';
import type { CallState } from '@/lib/callState';
import type { Channel, Server, User } from '@/lib/types';

type Member = { id: string; username: string; role: string; joinedAt: number };

const LAST_SERVER_KEY = 'voxcord:lastServer';

export function ServerShell({
  serverId,
  channelId,
  user,
}: {
  serverId: string;
  channelId: string | null;
  user: User;
}) {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [callState, setCallState] = useState<CallState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [svs, chs] = await Promise.all([fetchServers(), fetchChannels(serverId)]);
      setServers(svs);
      setChannels(chs);
      setLoaded(true);
      setError(null);
      // Al entrar a un servidor, unirse a él (POST, idempotente) y leer la
      // lista real de miembros (GET) — el POST devuelve { ok: true }, no la lista.
      await api<{ ok: boolean }>(`/api/servers/${serverId}/members`, { method: 'POST' });
      const list = await api<Member[]>(`/api/servers/${serverId}/members`);
      setMembers(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el servidor');
    }
  }, [serverId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    window.localStorage.setItem(LAST_SERVER_KEY, serverId);
  }, [serverId]);

  // Redirigir al primer canal de texto si no hay canal seleccionado
  useEffect(() => {
    if (!loaded || channelId) return;
    const first = channels.find((c) => c.type === 'text') ?? channels[0];
    if (first) router.replace(`/s/${serverId}/${first.id}`);
  }, [loaded, channelId, channels, serverId, router]);

  const server = servers.find((s) => s.id === serverId) ?? null;
  const channel = channels.find((c) => c.id === channelId) ?? null;

  const grouped = useMemo(() => {
    const list = Array.isArray(members) ? members : [];
    const online = list.filter((m) => m.id === user.id);
    const offline = list.filter((m) => m.id !== user.id);
    return { online, offline };
  }, [members, user.id]);

  async function createServer(name: string) {
    try {
      const s = await api<Server>('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setServers((prev) => [...prev, s]);
      window.localStorage.setItem(LAST_SERVER_KEY, s.id);
      router.push(`/s/${s.id}`);
    } catch {
      setError('No se pudo crear el servidor');
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ServerRail servers={servers} activeServerId={serverId} onCreate={createServer} />

      <ChannelSidebar
        server={server}
        channels={channels}
        activeChannelId={channelId}
        user={user}
        membersCount={members.length || null}
        callState={callState}
        onChannelsChanged={load}
      />

      <main className="flex-1 min-w-0 bg-chat">
        {error && <div className="grid h-full place-items-center text-danger">{error}</div>}
        {!error && !loaded && (
          <div className="grid h-full place-items-center text-muted">Cargando…</div>
        )}
        {!error && loaded && !channel && (
          <div className="grid h-full place-items-center text-muted">
            {channels.length === 0
              ? 'Crea el primer canal desde el panel lateral'
              : 'Selecciona un canal'}
          </div>
        )}
        {!error && loaded && channel?.type === 'text' && (
          <ChatArea key={channel.id} channel={channel} user={user} />
        )}
        {!error && loaded && channel?.type === 'voice' && (
          <VoiceChannel key={channel.id} channel={channel} user={user} onCallState={setCallState} />
        )}
      </main>

      {/* Rail derecho: miembros (datos reales de la tabla server_members) */}
      <aside className="hidden w-[248px] shrink-0 overflow-y-auto border-l border-white/5 bg-sidebar xl:block">
        <div className="flex h-12 items-center gap-2 border-b border-white/5 px-4">
          <span className="text-sm font-bold text-header">Miembros</span>
          <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            {members.length}
          </span>
          <span className="ml-auto flex items-center gap-2 text-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
              <path d="M7 5v14M7 5l-2.5 2M7 5l2.5 2M13 5l2.5 2M13 5 10.5 7M13 5v9a3 3 0 0 1-3 3H9" />
            </svg>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="m6 15 6-6 6 6" />
            </svg>
          </span>
        </div>

        {grouped.online.length > 0 && (
          <MemberGroup title="En línea" members={grouped.online} userId={user.id} />
        )}
        {grouped.offline.length > 0 && (
          <MemberGroup title="Ausentes" members={grouped.offline} userId={user.id} />
        )}

        {members.length === 0 && loaded && (
          <p className="px-4 py-6 text-center text-xs text-muted">
            Nadie más se ha unido a este servidor todavía.
          </p>
        )}

        {/* Widget "En llamada": solo con datos reales de la sala conectada */}
        {callState && callState.participants.length > 0 && (
          <div className="mx-3 mt-5 rounded-xl border border-white/8 bg-panel p-3 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-online shadow-[0_0_8px_rgba(35,214,127,0.8)]" />
              <p className="text-sm font-bold text-header">En llamada</p>
              <span className="ml-auto text-[11px] font-medium text-muted">
                {callState.participants.length} en llamada
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted">
              <span className="text-online">◍</span>
              {callState.channelName ?? 'Sala de voz'}
            </p>
            <div className="mt-3 flex flex-wrap items-center">
              {callState.participants.slice(0, 8).map((p) => (
                <span key={p.identity} className="-ml-1.5 first:ml-0">
                  <Avatar name={p.name} size={28} />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Canales activos del servidor */}
        <div className="mx-3 mb-5 mt-4 rounded-xl border border-white/8 bg-panel p-3">
          <p className="text-sm font-bold text-header">Canales activos</p>
          <ul className="mt-2 space-y-1">
            {channels.slice(0, 7).map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 text-[13px] text-muted">
                <span className="w-4 shrink-0 text-center text-muted/70">
                  {c.type === 'text' ? '#' : '◍'}
                </span>
                <span className="truncate">{c.name}</span>
                {callState?.channelId === c.id && (
                  <span className="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-2">
                    {callState.participants.length}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function MemberGroup({
  title,
  members,
  userId,
}: {
  title: string;
  members: Member[];
  userId: string;
}) {
  return (
    <div className="mt-5 px-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        {title} — {members.length}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[15px] text-muted transition-colors hover:bg-hover hover:text-header"
          >
            <span className="relative shrink-0">
              <Avatar name={m.username} size={28} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${
                  m.id === userId ? 'bg-online' : 'bg-muted/40'
                }`}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate">{m.username}</span>
                {m.role === 'owner' && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-yellow-400" fill="currentColor" aria-label="propietario">
                    <path d="M3 8l4.5 2L12 5l4.5 5L21 8l-1.8 8H4.8L3 8Z" />
                  </svg>
                )}
              </span>
              <span className="block text-[11px] leading-tight text-muted/80">
                {m.id === userId ? 'En línea' : 'Desconectado'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}