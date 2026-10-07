'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Avatar } from '@/components/Avatar';
import type { Channel, Server, User } from '@/lib/types';
import type { CallState } from '@/lib/callState';

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <span className={`w-5 shrink-0 text-center font-bold leading-none ${className ?? 'text-muted'}`} aria-hidden>
      #
    </span>
  );
}

function VolumeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-5 h-5 text-muted'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" stroke="none" />
      <path d="M15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.6 7.6 0 0 1 0 10.8" />
    </svg>
  );
}

function Group({
  title,
  icon,
  children,
  onCreate,
  createLabel,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <div className="mt-5 px-3">
      <div className="flex items-center gap-1.5 px-1">
        {icon && <span className="text-muted/80">{icon}</span>}
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</span>
        {onCreate && (
          <button
            onClick={onCreate}
            title={createLabel}
            className="ml-auto rounded px-1 text-lg leading-none text-muted transition-colors hover:text-header"
          >
            +
          </button>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </div>
  );
}

function CommunityIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.2A5 5 0 0 1 21.2 19" />
    </svg>
  );
}

export function ChannelSidebar({
  server,
  channels,
  activeChannelId,
  user,
  membersCount,
  callState,
  onChannelsChanged,
}: {
  server: Server | null;
  channels: Channel[];
  activeChannelId: string | null;
  user: User | null;
  membersCount: number | null;
  callState: CallState | null;
  onChannelsChanged: () => void;
}) {
  const [creating, setCreating] = useState<null | 'text' | 'voice'>(null);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [channels, query]);

  const textChannels = filtered.filter((c) => c.type === 'text');
  const voiceChannels = filtered.filter((c) => c.type === 'voice');

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!server || !creating || !name.trim()) return;
    await api(`/api/servers/${server.id}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), type: creating }),
    });
    setName('');
    setCreating(null);
    onChannelsChanged();
  }

  const channelRow = (c: Channel) => {
    const active = c.id === activeChannelId;
    const inCall = callState?.channelId === c.id;
    return (
      <Link
        key={c.id}
        href={`/s/${c.serverId}/${c.id}${c.type === 'voice' ? '?join=1' : ''}`}
        className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[15px] transition-colors ${
          active ? 'bg-accent/25 text-header font-medium' : 'text-muted hover:bg-hover hover:text-header'
        }`}
      >
        {c.type === 'text' ? <HashIcon /> : <VolumeIcon />}
        <span className="truncate">{c.name}</span>
        {inCall && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-online">
            {callState?.participants.length ?? 0} en llamada
          </span>
        )}
        {active && !inCall && (
          <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </Link>
    );
  };

  return (
    <aside className="w-[272px] shrink-0 bg-sidebar flex flex-col min-h-0 rounded-tr-2xl border-t border-r border-white/8">
      {/* Cabecera del servidor */}
      <button
        onClick={() => setQuery('')}
        title="Servidor: nombre y miembros"
        className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left shadow-sm transition-colors hover:bg-hover"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent to-accent-2 text-xs font-bold text-white shadow-[0_4px_12px_rgba(106,90,249,0.35)]">
          {(server?.name ?? '··').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-sm font-bold text-header">{server?.name ?? 'Cargando…'}</h2>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-accent-2" fill="currentColor" aria-hidden>
              <path d="M12 2.5 14.2 8l5.8.6-4.4 4 1.2 5.7L12 15.5 7.2 18.3l1.2-5.7-4.4-4L9.8 8 12 2.5Z" />
            </svg>
          </div>
          <p className="text-[11px] text-muted">
            {membersCount ?? 0} {membersCount === 1 ? 'miembro' : 'miembros'}
            {callState && callState.participants.length > 0 && (
              <span className="text-online"> · {callState.participants.length} en llamada</span>
            )}
          </p>
        </div>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Buscador */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-lg bg-input px-3 py-1.5 text-muted focus-within:ring-1 focus-within:ring-accent/60">
          <SearchIcon className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en este servidor…"
            className="w-full bg-transparent text-sm text-header placeholder:text-muted/80 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        <Group
          title="Canales de texto"
          icon={<CommunityIcon />}
          onCreate={() => setCreating(creating === 'text' ? null : 'text')}
          createLabel="Crear canal de texto"
        >
          {creating === 'text' && (
            <form onSubmit={createChannel} className="px-1 pb-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="nuevo-canal"
                maxLength={32}
                className="w-full rounded-lg border border-accent bg-input px-2 py-1.5 text-sm text-header outline-none"
              />
            </form>
          )}
          {textChannels.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted/70">Sin canales de texto</p>
          )}
          {textChannels.map(channelRow)}
        </Group>

        <Group
          title="Canales de voz"
          icon={<VolumeIcon className="w-4 h-4 text-muted/80" />}
          onCreate={() => setCreating(creating === 'voice' ? null : 'voice')}
          createLabel="Crear sala de voz"
        >
          {creating === 'voice' && (
            <form onSubmit={createChannel} className="px-1 pb-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nueva sala"
                maxLength={32}
                className="w-full rounded-lg border border-accent bg-input px-2 py-1.5 text-sm text-header outline-none"
              />
            </form>
          )}
          {voiceChannels.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted/70">Sin salas de voz</p>
          )}
          {voiceChannels.map(channelRow)}
        </Group>
      </div>

      {user && (
        <div className="flex h-[54px] shrink-0 items-center gap-2.5 border-t border-white/5 bg-panel px-2">
          <Avatar name={user.username} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-header">{user.username}</p>
            <p className="flex items-center gap-1.5 text-[11px] leading-tight text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-online" /> en línea
            </p>
          </div>
          <button
            title="Ajustes (próximamente)"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-hover hover:text-header"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9 2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2 2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1Z" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}