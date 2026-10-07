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

  const iconCls =
    'grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[12px] font-bold text-white transition-all duration-150';

  return (
    <nav className="flex w-[60px] shrink-0 flex-col items-center gap-2 overflow-y-auto overflow-x-hidden bg-rail py-3">
      <Link
        href="/"
        title="VoxCord"
        className={`${iconCls} bg-linear-to-br from-accent to-accent-2 shadow-[0_6px_18px_rgba(106,90,249,0.35)] hover:rounded-xl`}
      >
        V
      </Link>

      <span className="my-1 h-0.5 w-7 rounded-full bg-white/10" aria-hidden />

      {servers.map((s) => {
        const active = s.id === activeServerId;
        return (
          <Link
            key={s.id}
            href={`/s/${s.id}`}
            title={s.name}
            className={`group relative ${iconCls} ${
              active
                ? 'rounded-xl bg-linear-to-br from-accent to-accent-2 shadow-[0_6px_18px_rgba(106,90,249,0.4)]'
                : 'bg-elevated hover:rounded-xl hover:bg-accent'
            }`}
          >
            {s.name.slice(0, 2).toUpperCase()}
            {/* Indicador lateral estilo Discord */}
            <span
              className={`absolute -left-[13px] w-[4px] rounded-r-full bg-white transition-all duration-150 ${
                active ? 'h-7' : 'h-0 group-hover:h-4'
              }`}
              aria-hidden
            />
          </Link>
        );
      })}

      {creating ? (
        <form onSubmit={submit} className="w-full px-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Servidor"
            maxLength={48}
            onBlur={() => setCreating(false)}
            className="w-full rounded-xl border border-accent bg-sidebar px-2 py-2 text-[11px] text-header outline-none"
          />
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          title="Crear servidor"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-xl text-online transition-all duration-150 hover:border-online hover:bg-online hover:text-white"
        >
          +
        </button>
      )}
    </nav>
  );
}