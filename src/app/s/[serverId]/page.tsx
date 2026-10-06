'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/client';
import { ServerShell } from '@/components/ServerShell';

export default function ServerPage() {
  const params = useParams<{ serverId: string }>();
  const router = useRouter();
  const { user, hydrated } = useCurrentUser();
  const serverId = String(params.serverId);

  if (!hydrated) {
    return <div className="h-screen flex items-center justify-center bg-chat text-muted">Cargando…</div>;
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-chat">
        <button
          onClick={() => router.push('/')}
          className="rounded bg-accent hover:bg-accent-hover px-5 py-3 font-semibold text-white"
        >
          Elige un nombre de usuario para entrar
        </button>
      </div>
    );
  }

  return <ServerShell serverId={serverId} channelId={null} user={user} />;
}
