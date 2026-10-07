'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useChatRealtime } from '@/lib/useChatRealtime';
import { Avatar } from '@/components/Avatar';
import type { Channel, ChatMessage, User } from '@/lib/types';

/* ------------------------------ iconos ------------------------------ */

const Icon = ({ children, className = 'w-5 h-5' }: { children: React.ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const BellIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
    <path d="M10.5 19a2 2 0 0 0 3 0" />
  </Icon>
);

const PeopleIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" />
    <path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.2A5 5 0 0 1 21.2 19" />
  </Icon>
);

const SearchIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

const SlidersIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M5 8h10M19 8h.01M5 16h4M13 16h6" />
    <circle cx="17" cy="8" r="2" />
    <circle cx="11" cy="16" r="2" />
  </Icon>
);

const PlusIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

const SmileIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 14.5c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4" />
    <path d="M9.5 9.8h.01M14.5 9.8h.01" />
  </Icon>
);

const SendIcon = (p: { className?: string }) => (
  <Icon {...p} className={`${p.className ?? 'w-5 h-5'}`}>
    <path d="M4.5 12h6M10.5 6.5 14 12l-3.5 5.5" />
    <path d="M14.5 12H20" />
  </Icon>
);

const ArrowIcon = (p: { className?: string }) => (
  <Icon {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
);

/* ------------------------------ utilidades ------------------------------ */

function nameColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 72% 66%)`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '✅'];

/* ------------------------------ componente ------------------------------ */

export function ChatArea({ channel, user }: { channel: Channel; user: User }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);
  const seenRef = useRef<Set<string>>(new Set());
  const lastSeqRef = useRef(0);

  const push = useCallback((msg: ChatMessage) => {
    if (!msg?.id || seenRef.current.has(msg.id)) return;
    seenRef.current.add(msg.id);
    if (msg.seq > lastSeqRef.current) lastSeqRef.current = msg.seq;
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { transport, publish } = useChatRealtime(channel.id, user, push);

  // Historial inicial
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

  // Catch-up de lo que se haya perdido por carrera al suscribirse
  useEffect(() => {
    if (transport === 'connecting') return;
    let cancelled = false;
    (async () => {
      const missed = await api<ChatMessage[]>(`/api/channels/${channel.id}/messages?after=${lastSeqRef.current}`);
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
      void publish(msg);
      const stored = await api<ChatMessage>(`/api/channels/${channel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify(msg),
      });
      push(stored);
      setDraft('');
      setEmojiOpen(false);
      stickToBottom.current = true;
    } catch {
      // el texto se conserva en el input
    } finally {
      setSending(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q));
  }, [messages, query]);

  // Agrupar con separadores de día
  const rows = useMemo(() => {
    const out: ({ kind: 'sep'; key: string; label: string } | { kind: 'msg'; key: string; msg: ChatMessage })[] = [];
    let day = '';
    for (const m of visible) {
      const d = dayLabel(m.createdAt);
      if (d !== day) {
        day = d;
        out.push({ kind: 'sep', key: `sep-${d}-${m.id}`, label: d });
      }
      out.push({ kind: 'msg', key: m.id, msg: m });
    }
    return out;
  }, [visible]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard bloqueado: se ignora
    }
  }

  const topic = channel.name === 'general' ? 'Chat principal de la comunidad' : `Canal de texto · ${channel.name}`;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Cabecera */}
      <header className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-white/5">
        <span className="text-muted font-bold text-2xl leading-none">#</span>
        <h1 className="font-bold text-header">{channel.name}</h1>
        <span className="hidden truncate border-l border-white/10 pl-3 text-sm text-muted md:block">{topic}</span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={copyInvite}
            title={copied ? 'Enlace copiado' : 'Copiar enlace del canal'}
            className="hidden rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-header sm:block"
          >
            {copied ? <Icon className="w-5 h-5 text-online">{<path d="m20 6-11 11-5-5" />}</Icon> : <PeopleIcon />}
          </button>
          <div className="flex items-center gap-2 rounded-full bg-input px-3 py-1.5 text-muted focus-within:ring-1 focus-within:ring-accent/60">
            <SearchIcon className="h-4 w-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-28 bg-transparent text-sm text-header placeholder:text-muted/80 outline-none sm:w-40"
            />
          </div>
          <button
            title="Notificaciones (próximamente)"
            className="rounded-lg p-2 text-muted/60 transition-colors hover:bg-hover hover:text-header"
          >
            <BellIcon />
          </button>
          <button
            title="Ajustes del canal (próximamente)"
            className="hidden rounded-lg p-2 text-muted/60 transition-colors hover:bg-hover hover:text-header sm:block"
          >
            <SlidersIcon />
          </button>
        </div>
      </header>

      {/* Mensajes */}
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {visible.length === 0 && (
          /* Tarjeta de bienvenida, estilo mockup */
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/8 bg-sidebar p-6 text-center">
            <div
              className="absolute inset-0 bg-[radial-gradient(90%_120%_at_20%_0%,rgba(124,92,255,0.35),transparent_60%),radial-gradient(80%_110%_at_85%_10%,rgba(37,99,235,0.30),transparent_55%)]"
              aria-hidden
            />
            <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-xl font-black text-white shadow-lg shadow-accent/30">
              V
            </div>
            <h2 className="relative mt-4 text-xl font-bold text-header">
              {query ? 'Sin resultados' : `¡Bienvenido a #${channel.name}!`}
            </h2>
            <p className="relative mx-auto mt-1.5 max-w-md text-sm text-muted">
              {query
                ? 'Ningún mensaje coincide con tu búsqueda en este canal.'
                : 'Este es el comienzo del canal. Escribe el primer mensaje para abrir la conversación.'}
            </p>
            {!query && (
              <button
                onClick={() => inputRef.current?.focus()}
                className="relative mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-linear-to-r from-accent-2 to-accent px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:brightness-110"
              >
                Enviar el primer mensaje <ArrowIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="space-y-1">
          {rows.map((row) =>
            row.kind === 'sep' ? (
              <div key={row.key} className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/8" />
                <span className="text-[11px] font-semibold text-muted">{row.label}</span>
                <span className="h-px flex-1 bg-white/8" />
              </div>
            ) : (
              <div key={row.key} className="group -mx-2 flex gap-3 rounded-lg px-2 py-1.5 hover:bg-white/3">
                <Avatar name={row.msg.authorName} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold" style={{ color: nameColor(row.msg.authorName) }}>
                      {row.msg.authorName}
                    </span>
                    <span className="text-[11px] text-muted">{formatTime(row.msg.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-text">{row.msg.content}</p>
                </div>
              </div>
            ),
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Compositor */}
      <form onSubmit={send} className="shrink-0 px-4 pb-5">
        <div className="flex items-center gap-2 rounded-2xl bg-input px-3 py-2 focus-within:ring-1 focus-within:ring-accent/50">
          <button
            type="button"
            title="Adjuntar (próximamente)"
            className="rounded-full p-1.5 text-muted transition-colors hover:text-header"
          >
            <PlusIcon />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Escribe un mensaje en #${channel.name}…`}
            maxLength={4000}
            className="flex-1 bg-transparent py-1 text-header placeholder:text-muted/80 outline-none"
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              title="Emoji"
              className="rounded-full p-1.5 text-muted transition-colors hover:text-header"
            >
              <SmileIcon />
            </button>
            {emojiOpen && (
              <div className="absolute bottom-12 right-0 z-50 grid w-56 grid-cols-8 gap-1 rounded-xl border border-white/10 bg-rail p-2 shadow-2xl">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setDraft((d) => d + e);
                      setEmojiOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="rounded p-1 text-lg transition-colors hover:bg-hover"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!draft.trim() || sending}
            title="Enviar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent-2 to-accent text-white shadow-lg shadow-accent/25 transition-all hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-3 px-1 text-[11px] text-muted/70">
          <span>Enter para enviar</span>
          {transport === 'livekit' ? (
            <span className="text-online">● tiempo real (LiveKit data channel)</span>
          ) : transport === 'sse' ? (
            <span className="text-yellow-500">● fallback SSE</span>
          ) : (
            <span>conectando…</span>
          )}
        </p>
      </form>
    </div>
  );
}