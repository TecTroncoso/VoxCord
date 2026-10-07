'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/client';
import {
  AuthError,
  AuthField,
  AuthIcons,
  AuthShell,
  Divider,
  PrimaryButton,
  SocialButtons,
} from '@/components/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(identifier.trim(), password, remember);
      void user;
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-[26px] font-bold leading-tight text-white">¡Bienvenido de nuevo!</h1>
      <p className="mt-1.5 text-sm text-muted">Inicia sesión para continuar con tu cuenta.</p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <AuthField
          label="Correo electrónico o nombre de usuario"
          icon={<AuthIcons.MailIcon className="h-5 w-5" />}
          value={identifier}
          onChange={setIdentifier}
          placeholder="tu@ejemplo.com o @usuario"
          maxLength={254}
          autoComplete="username"
        />

        <AuthField
          label="Contraseña"
          icon={<AuthIcons.LockIcon className="h-5 w-5" />}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Ingresa tu contraseña"
          maxLength={128}
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted transition-colors hover:text-header">
            <span className="relative grid h-5 w-5 place-items-center">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-5 w-5 rounded-md border border-white/20 bg-white/5 transition-colors peer-checked:border-accent peer-checked:bg-accent" />
              <AuthIcons.CheckIcon className="pointer-events-none absolute h-3 w-3 scale-0 text-white transition-transform peer-checked:scale-100" />
            </span>
            Mantener sesión iniciada
          </label>
          <span
            title="Pronto: recuperación de contraseña por correo"
            className="cursor-help text-sm text-accent-2/90 underline decoration-dotted underline-offset-4"
          >
            ¿Olvidaste tu contraseña?
          </span>
        </div>

        <PrimaryButton disabled={busy || !identifier.trim() || !password}>
          {busy ? 'Entrando…' : 'Iniciar sesión'}
        </PrimaryButton>
      </form>

      <div className="my-6">
        <Divider label="o continua con" />
      </div>
      <SocialButtons />

      <AuthError message={error} />

      <p className="mt-6 text-center text-sm text-muted">
        ¿No tienes una cuenta?{' '}
        <Link href="/register" className="font-semibold text-accent-2 hover:underline">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}