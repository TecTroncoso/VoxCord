import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VoxCord',
  description: 'Chat + voz de baja latencia y pantalla compartida en alta calidad (LiveKit + Turso)',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
