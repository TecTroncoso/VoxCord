'use client';

import Link from 'next/link';
import type { Server } from '@/lib/types';

export function ServerRail({
  servers,
  activeServerId,
  onHome,
}: {
  servers: Server[];
  activeServerId: string | null;
  onHome: () => void;
}) {
  return (
    <nav className="w-[72px] shrink-0 bg-rail flex flex-col items-center gap-2 py-3 overflow-y-auto">
      <button
        onClick={onHome}
        title="Inicio"
        className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-sidebar hover:bg-accent text-header flex items-center justify-center font-bold transition-all"
      >
        VC
      </button>
      <div className="w-8 h-0.5 rounded bg-hover" />
      {servers.map((s) => {
        const active = s.id === activeServerId;
        return (
          <Link
            key={s.id}
            href={`/s/${s.id}`}
            title={s.name}
            className={`w-12 h-12 rounded-3xl hover:rounded-2xl flex items-center justify-center font-semibold text-white transition-all ${
              active ? 'rounded-2xl bg-accent' : 'bg-sidebar hover:bg-accent'
            }`}
          >
            {s.name.slice(0, 2).toUpperCase()}
          </Link>
        );
      })}
    </nav>
  );
}
