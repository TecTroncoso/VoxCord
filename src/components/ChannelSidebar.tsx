'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Avatar } from '@/components/Avatar';
import type { Channel, Server, User } from '@/lib/types';

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
  children,
  onCreate,
  createLabel,
}: {
  title: string;
  children: React.ReactNode;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <div className="mt-5 px-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</span>
        {onCreate && (
          <button
            onClick={onCreate}
            title={createLabel}
            className="rounded px-1 text-lg leading-none text-muted transition-colors hover:text-header"
          >
            +
          </button>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </div>
  );
}

export function ChannelSidebar({
  server,
  channels,
  activeChannelId,
  user,
  membersCount,
  onChannelsChanged,
}: {
  server: Server | null;
  channels: Channel[];
  activeChannelId: string | null;
  user: User | null;
  membersCount: number | null;
  onChannelsChanged: () => void;
}) {
  const [creating, setCreating] = useState<null | 'text' | 'voice'>(null);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? channels.filter((c) => c.name.toLowerCase().includes(q)) : channels;
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
    return (
      <Link
        key={c.id}
        href={`/s/${c.serverId}/${c.id}${c.type === 'voice' ? '?join=1' : ''}`}
        className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[15px] transition-colors ${
          active
            ? 'bg-accent/20 text-header font-medium'
            : 'text-muted hover:bg-hover hover:text-header'
        }`}
      >
        {c.type === 'text' ? (
          <HashIcon className={active ? 'text-muted' : 'text-muted'} />
        ) : (
          <VolumeIcon />
        )}
        <span className="truncate">{c.name}</span>
      </Link>
    );
  };

  return (
    <aside className="w-60 shrink-0 bg-sidebar flex flex-col min-h-0">
      {/* Cabecera del servidor */}
      <div className="h-12 shrink-0 px-4 flex items-center gap-2 border-b border-white/5 shadow-sm">
        <h2 className="font-bold text-header truncate">{server?.name ?? 'Cargando…'}</h2>
        {server && (
          <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-semibold text-muted">
            {membersCount ?? 0}
          </span>
        )}
      </div>

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
        <div className="h-[54px] shrink-0 bg-panel flex items-center gap-2 px-2 border-t border-white/5">
          <Avatar name={user.username} size={32} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-header truncate leading-tight">{user.username}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted leading-tight">
              <span className="h-1.5 w-1.5 rounded-full bg-online" /> en línea
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}