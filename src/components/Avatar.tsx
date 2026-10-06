'use client';

import { avatarHue } from '@/lib/client';

export function Avatar({ name, size = 40, speaking = false }: { name: string; size?: number; speaking?: boolean }) {
  const hue = avatarHue(name || '?');
  const initials = (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white select-none shrink-0 transition-shadow"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `hsl(${hue} 55% 45%)`,
        boxShadow: speaking ? '0 0 0 2px var(--color-sidebar), 0 0 0 4px var(--color-online)' : 'none',
      }}
      aria-label={name}
    >
      {initials || '?'}
    </div>
  );
}
