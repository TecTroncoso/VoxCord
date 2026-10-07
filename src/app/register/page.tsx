'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/client';
import {
  AuthError,
  AuthField,
  AuthIcons,
  AuthShell,
  Divider,
  PrimaryButton,
  SocialButtons,
} from '@/components/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password !== password2) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setBusy(true);
    try {
      const user = await register(username.trim(), email.trim(), password, remember);
      void user;
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-[26px] font-bold leading-tight text-white">Crea tu cuenta</h1>
      <p className="mt-1.5 text-sm text-muted">Es rápido y gratis. Solo necesitas unos datos.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <AuthField
          label="Nombre de usuario"
          icon={<AuthIcons.UserIcon className="h-5 w-5" />}
          value={username}
          onChange={setUsername}
          placeholder="Elige un nombre de usuario"
          maxLength={32}
          autoComplete="username"
          showCounter
        />

        <AuthField
          label="Correo electrónico"
          icon={<AuthIcons.MailIcon className="h-5 w-5" />}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="tu@ejemplo.com"
          maxLength={254}
          autoComplete="email"
        />

        <AuthField
          label="Contraseña"
          icon={<AuthIcons.LockIcon className="h-5 w-5" />}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Mínimo 8 caracteres"
          hint={password.length > 0 && password.length < 8 ? 'Aún faltan caracteres' : undefined}
          maxLength={128}
          autoComplete="new-password"
        />

        <AuthField
          label="Confirmar contraseña"
          icon={<AuthIcons.LockIcon className="h-5 w-5" />}
          type="password"
          value={password2}
          onChange={(v) => {
            setPassword2(v);
            if (mismatch && v === password) setMismatch(false);
          }}
          placeholder="Repite la contraseña"
          maxLength={128}
          autoComplete="new-password"
        />

        {mismatch && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            Las contraseñas no coinciden
          </p>
        )}

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
        </div>

        <PrimaryButton
          disabled={busy || !username.trim() || !email.trim() || password.length < 8 || !password2}
        >
          {busy ? 'Creando cuenta…' : 'Crear cuenta'}
        </PrimaryButton>
      </form>

      <div className="my-6">
        <Divider label="o continua con" />
      </div>
      <SocialButtons />

      <AuthError message={error} />

      <p className="mt-6 text-center text-[13px] leading-relaxed text-muted">
        Al registrarte, aceptas nuestros{' '}
        <span className="cursor-help text-accent-2/90 underline decoration-dotted underline-offset-2" title="Documento pendiente">
          Términos de Servicio
        </span>{' '}
        y{' '}
        <span className="cursor-help text-accent-2/90 underline decoration-dotted underline-offset-2" title="Documento pendiente">
          Política de Privacidad
        </span>
        .
      </p>

      <p className="mt-3 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-accent-2 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}