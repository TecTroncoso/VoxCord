'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchChannels, fetchServers } from '@/lib/client';
import { ServerRail } from '@/components/ServerRail';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { ChatArea } from '@/components/ChatArea';
import { VoiceChannel } from '@/components/VoiceChannel';
import type { Channel, Server, User } from '@/lib/types';

export function ServerShell({ serverId, channelId, user }: { serverId: string; channelId: string | null; user: User }) {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [svs, chs] = await Promise.all([fetchServers(), fetchChannels(serverId)]);
      setServers(svs);
      setChannels(chs);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el servidor');
    }
  }, [serverId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Redirigir al primer canal de texto si no hay canal seleccionado
  useEffect(() => {
    if (!loaded || channelId) return;
    const first = channels.find((c) => c.type === 'text') ?? channels[0];
    if (first) router.replace(`/s/${serverId}/${first.id}`);
  }, [loaded, channelId, channels, serverId, router]);

  const server = servers.find((s) => s.id === serverId) ?? null;
  const channel = channels.find((c) => c.id === channelId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      <ServerRail servers={servers} activeServerId={serverId} onHome={() => router.push('/')} />
      <ChannelSidebar
        server={server}
        channels={channels}
        activeChannelId={channelId}
        user={user}
        onChannelsChanged={load}
      />
      <main className="flex-1 min-w-0 bg-chat">
        {error && <div className="h-full flex items-center justify-center text-danger">{error}</div>}
        {!error && !loaded && <div className="h-full flex items-center justify-center text-muted">Cargando…</div>}
        {!error && loaded && !channel && (
          <div className="h-full flex items-center justify-center text-muted">
            {channels.length === 0 ? 'Crea el primer canal desde el panel lateral' : 'Selecciona un canal'}
          </div>
        )}
        {!error && loaded && channel && channel.type === 'text' && (
          <ChatArea key={channel.id} channel={channel} user={user} />
        )}
        {!error && loaded && channel && channel.type === 'voice' && (
          <VoiceChannel key={channel.id} channel={channel} user={user} />
        )}
      </main>
    </div>
  );
}
