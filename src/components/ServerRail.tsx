'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Server } from '@/lib/types';

export function ServerRail({
  servers,
  activeServerId,
  onCreate,
}: {
  servers: Server[];
  activeServerId: string | null;
  onCreate: (name: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const n = name.trim();
    setName('');
    setCreating(false);
    await onCreate(n);
  }

  return (
    <nav className="w-[72px] shrink-0 bg-rail flex flex-col items-center gap-2 py-3 overflow-y-auto overflow-x-hidden">
      <Link
        href="/"
        title="VoxCord"
        className="grid h-12 w-12 place-items-center rounded-3xl bg-linear-to-br from-accent to-accent-2 text-sm font-black text-white transition-all hover:rounded-2xl"
      >
        V
      </Link>
      <div className="my-1 h-0.5 w-8 rounded bg-white/10" />

      {servers.map((s) => {
        const active = s.id === activeServerId;
        return (
          <Link
            key={s.id}
            href={`/s/${s.id}`}
            title={s.name}
            className={`group relative grid h-12 w-12 shrink-0 place-items-center rounded-3xl text-[13px] font-bold text-white transition-all hover:rounded-2xl ${
              active
                ? 'rounded-2xl bg-linear-to-br from-accent to-accent-2 shadow-lg shadow-accent/25'
                : 'bg-elevated hover:bg-accent'
            }`}
          >
            {s.name.slice(0, 2).toUpperCase()}
            <span
              className={`absolute left-0 h-0 w-1 rounded-r bg-header transition-all ${
                active ? 'h-8' : 'h-0 group-hover:h-5'
              }`}
              aria-hidden
            />
          </Link>
        );
      })}

      {creating ? (
        <form onSubmit={submit} className="w-full px-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Servidor"
            maxLength={48}
            onBlur={() => setCreating(false)}
            className="w-full rounded-lg border border-accent bg-sidebar px-2 py-2 text-xs text-header outline-none"
          />
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          title="Crear servidor"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-3xl bg-elevated text-xl text-online transition-all hover:rounded-2xl hover:bg-online hover:text-white"
        >
          +
        </button>
      )}
    </nav>
  );
}