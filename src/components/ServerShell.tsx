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
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-l border-white/5 bg-sidebar xl:block">
        <div className="flex h-12 items-center justify-between px-4 border-b border-white/5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Miembros</span>
          <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-semibold text-muted">
            {members.length}
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
          <div className="mx-3 mt-6 rounded-xl border border-online/30 bg-chat/70 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-online" />
              <p className="text-sm font-semibold text-header">En llamada</p>
              <span className="ml-auto text-[11px] text-muted">
                {callState.participants.length} en llamada
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-muted">
              {callState.channelName ? `🔊 ${callState.channelName}` : '🔊 Sala de voz'}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center">
              {callState.participants.slice(0, 8).map((p) => (
                <span key={p.identity} className="-ml-1.5 first:ml-0 relative">
                  <Avatar name={p.name} size={26} />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Canales activos del servidor */}
        <div className="mx-3 mt-6 mb-4 rounded-xl border border-white/8 bg-chat/50 p-3">
          <p className="text-sm font-semibold text-header">Canales activos</p>
          <ul className="mt-2 space-y-1">
            {channels
              .filter((c) => c.type === 'text' || c.type === 'voice')
              .slice(0, 6)
              .map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-4 text-center text-muted/70">{c.type === 'text' ? '#' : '◍'}</span>
                  <span className="truncate">{c.name}</span>
                  {callState?.channelId === c.id && (
                    <span className="ml-auto rounded-full bg-online/15 px-1.5 py-0.5 text-[10px] font-semibold text-online">
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
              <Avatar name={m.username} size={26} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${
                  m.id === userId ? 'bg-online' : 'bg-muted/50'
                }`}
              />
            </span>
            <span className="truncate">{m.username}</span>
            {m.role === 'owner' && (
              <span className="ml-auto text-[10px] font-bold uppercase text-accent-2">owner</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}