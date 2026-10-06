'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { api } from '@/lib/client';
import type { ChatMessage, User } from '@/lib/types';

export type ChatTransport = 'livekit' | 'sse' | 'connecting';

const CHAT_TOPIC = 'chat';

/**
 * Entrega de mensajes en tiempo real SIN estado en el servidor web:
 *
 * - 'livekit' (preferido): una sala de datos por canal (`chat-<id>`) sin
 *   audio/vídeo. El navegador conecta directo al edge de LiveKit; el servidor
 *   solo persiste en Turso. Válido para serverless (Vercel) y para Render sin
 *   consumir memoria.
 * - 'sse' (fallback): hub en memoria del proceso (un solo proceso Node).
 */
export function useChatRealtime(
  channelId: string,
  user: User,
  onMessage: (msg: ChatMessage) => void,
): { transport: ChatTransport; publish: (msg: ChatMessage) => Promise<boolean> } {
  const [transport, setTransport] = useState<ChatTransport>('connecting');
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let room: Room | null = null;

    const startSse = () => {
      if (cancelled) return;
      setTransport('sse');
      es = new EventSource(`/api/channels/${channelId}/stream`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as ChatMessage & { type?: string };
          if (data.type !== 'ready' && data.id) onMessageRef.current(data);
        } catch {
          // ping/malformado
        }
      };
    };

    (async () => {
      try {
        const t = await api<{ token: string; url: string }>('/api/livekit/token', {
          method: 'POST',
          body: JSON.stringify({
            roomName: `chat-${channelId}`,
            identity: user.id,
            name: user.username,
          }),
        });
        if (cancelled) return;
        room = new Room({ adaptiveStream: false, dynacast: false });
        const decoder = new TextDecoder();
        room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          if (topic !== CHAT_TOPIC) return;
          try {
            const data = JSON.parse(decoder.decode(payload)) as ChatMessage;
            if (data?.id) onMessageRef.current(data);
          } catch {
            // payload no-chat
          }
        });
        await room.connect(t.url, t.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        roomRef.current = room;
        setTransport('livekit');
      } catch {
        // LiveKit no configurado o inalcanzable -> fallback SSE
        startSse();
      }
    })();

    return () => {
      cancelled = true;
      es?.close();
      room?.disconnect();
      roomRef.current = null;
      setTransport('connecting');
    };
  }, [channelId, user.id, user.username]);

  /** Publica por data channel (entrega instantánea). Devuelve false si no hay sala activa. */
  const publish = useCallback(async (msg: ChatMessage): Promise<boolean> => {
    const room = roomRef.current;
    if (!room) return false;
    try {
      const data = new TextEncoder().encode(JSON.stringify(msg));
      await room.localParticipant.publishData(data, { reliable: true, topic: CHAT_TOPIC });
      return true;
    } catch {
      return false;
    }
  }, []);

  return { transport, publish };
}
