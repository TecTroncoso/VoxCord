'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Avatar } from '@/components/Avatar';
import type { Channel, Server, User } from '@/lib/types';

function HashIcon() {
  return (
    <span className="w-5 h-5 flex items-center justify-center text-muted font-bold text-lg leading-none shrink-0" aria-hidden>
      #
    </span>
  );
}

function VolumeIcon() {
  return (
    <svg className="w-5 h-5 text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.4 5.6a9 9 0 0 1 0 12.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChannelSidebar({
  server,
  channels,
  activeChannelId,
  user,
  onChannelsChanged,
}: {
  server: Server | null;
  channels: Channel[];
  activeChannelId: string | null;
  user: User | null;
  onChannelsChanged: () => void;
}) {
  const [creating, setCreating] = useState<null | 'text' | 'voice'>(null);
  const [name, setName] = useState('');

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

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  const renderGroup = (label: string, type: 'text' | 'voice', list: Channel[]) => (
    <div className="px-2 mt-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</span>
        <button
          onClick={() => setCreating(creating === type ? null : type)}
          title={`Crear canal de ${type === 'text' ? 'texto' : 'voz'}`}
          className="text-muted hover:text-header text-lg leading-none px-1"
        >
          +
        </button>
      </div>
      {creating === type && (
        <form onSubmit={createChannel} className="mt-1 px-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'text' ? 'nuevo-canal' : 'Nueva sala'}
            maxLength={32}
            className="w-full rounded bg-input px-2 py-1.5 text-sm text-header placeholder:text-muted outline-none focus:ring-2 ring-accent"
          />
        </form>
      )}
      <ul className="mt-1 space-y-0.5">
        {list.map((c) => {
          const active = c.id === activeChannelId;
          return (
            <li key={c.id}>
              <Link
                href={`/s/${c.serverId}/${c.id}`}
                className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-[15px] transition-colors ${
                  active ? 'bg-active text-header' : 'text-muted hover:bg-hover hover:text-header'
                }`}
              >
                {c.type === 'text' ? <HashIcon /> : <VolumeIcon />}
                <span className="truncate">{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <aside className="w-60 shrink-0 bg-sidebar flex flex-col min-h-0">
      <div className="h-12 px-4 flex items-center border-b border-rail shadow-sm">
        <h2 className="font-bold text-header truncate">{server?.name ?? 'Cargando…'}</h2>
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        {renderGroup('Canales de texto', 'text', textChannels)}
        {renderGroup('Canales de voz', 'voice', voiceChannels)}
      </div>
      {user && (
        <div className="h-[52px] bg-panel flex items-center gap-2 px-2">
          <Avatar name={user.username} size={32} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-header truncate leading-tight">{user.username}</p>
            <p className="text-[11px] text-muted leading-tight">en línea</p>
          </div>
        </div>
      )}
    </aside>
  );
}
