'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useChatRealtime } from '@/lib/useChatRealtime';
import { Avatar } from '@/components/Avatar';
import type { Channel, ChatMessage, User } from '@/lib/types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function ChatArea({ channel, user }: { channel: Channel; user: User }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const seenRef = useRef<Set<string>>(new Set());
  const lastSeqRef = useRef(0);

  // Dedupe por id: el mensaje puede llegar por data channel + eco del POST + SSE
  const push = useCallback((msg: ChatMessage) => {
    if (!msg?.id || seenRef.current.has(msg.id)) return;
    seenRef.current.add(msg.id);
    if (msg.seq > lastSeqRef.current) lastSeqRef.current = msg.seq;
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { transport, publish } = useChatRealtime(channel.id, user, push);

  // Historial inicial + catch-up tras suscribirse (cierra la carrera de llegada)
  useEffect(() => {
    let cancelled = false;
    seenRef.current = new Set();
    lastSeqRef.current = 0;
    setMessages([]);

    (async () => {
      const history = await api<ChatMessage[]>(`/api/channels/${channel.id}/messages?limit=50`);
      if (cancelled) return;
      history.forEach(push);
    })();

    return () => {
      cancelled = true;
    };
  }, [channel.id, push]);

  useEffect(() => {
    if (transport === 'connecting') return;
    let cancelled = false;
    (async () => {
      const missed = await api<ChatMessage[]>(
        `/api/channels/${channel.id}/messages?after=${lastSeqRef.current}`,
      );
      if (cancelled) return;
      missed.forEach(push);
    })();
    return () => {
      cancelled = true;
    };
  }, [channel.id, transport, push]);

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        channelId: channel.id,
        authorId: user.id,
        authorName: user.username,
        content,
        createdAt: Date.now(),
        seq: 0,
      };
      // 1) Entrega instantánea a los demás vía LiveKit (si está activo)
      void publish(msg);
      // 2) Persistencia en Turso (idempotente por id) + eco local
      const stored = await api<ChatMessage>(`/api/channels/${channel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify(msg),
      });
      push(stored);
      setDraft('');
      stickToBottom.current = true;
    } catch {
      // el input conserva el texto si falla
    } finally {
      setSending(false);
    }
  }

  const transportBadge =
    transport === 'livekit' ? (
      <span className="text-[11px] text-online" title="Mensajes en tiempo real vía LiveKit data channels (servidor sin estado)">
        ● tiempo real
      </span>
    ) : transport === 'sse' ? (
      <span className="text-[11px] text-yellow-500" title="Fallback SSE (un solo proceso Node)">
        ● sse
      </span>
    ) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-rail">
        <span className="text-muted font-bold text-xl">#</span>
        <h1 className="font-bold text-header truncate">{channel.name}</h1>
        <span className="ml-auto">{transportBadge}</span>
      </header>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-muted text-sm mt-8">
            <p className="text-2xl font-bold text-header mb-1">#{channel.name}</p>
            <p>Este es el comienzo del canal. Envía el primer mensaje.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3 group">
            <Avatar name={m.authorName} size={40} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-header">{m.authorName}</span>
                <span className="text-[11px] text-muted">{formatTime(m.createdAt)}</span>
              </div>
              <p className="text-text whitespace-pre-wrap wrap-break-word">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="shrink-0 px-4 pb-6">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Enviar mensaje a #${channel.name}`}
          maxLength={4000}
          className="w-full rounded-lg bg-input px-4 py-3 text-header placeholder:text-muted outline-none focus:ring-2 ring-accent"
        />
      </form>
    </div>
  );
}
