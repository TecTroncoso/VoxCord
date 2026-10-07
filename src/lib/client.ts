'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Channel, Server, User } from '@/lib/types';

const USER_KEY = 'voxcord:user';

export function loadStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

/**
 * Sesión actual: la cookie httpOnly firmada es la fuente de verdad.
 * localStorage solo actúa como caché para el primer pintado.
 */
export function useCurrentUser(): { user: User | null; hydrated: boolean; setUser: (u: User | null) => void } {
  const [user, setUserState] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setUserState(loadStoredUser());
    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const u = (await res.json()) as User;
          setUserState(u);
          storeUser(u);
        } else {
          setUserState(null);
          storeUser(null);
        }
      })
      .catch(() => {
        /* sin sesión válida */
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    storeUser(u);
  }, []);
  return { user, hydrated, setUser };
}

export async function login(identifier: string, password: string, remember = true): Promise<User> {
  return api<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, remember }),
  });
}

export async function register(
  username: string,
  email: string,
  password: string,
  remember = true,
): Promise<User> {
  return api<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, remember }),
  });
}

export async function logout(): Promise<void> {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // la cookie expira sola en el peor caso
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Error ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchServers(): Promise<Server[]> {
  return api<Server[]>('/api/servers');
}

export async function fetchChannels(serverId: string): Promise<Channel[]> {
  return api<Channel[]>(`/api/servers/${serverId}/channels`);
}

export function avatarHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}
