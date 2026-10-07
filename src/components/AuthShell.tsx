'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';

/* ---------------------------------------------------------------- */
/* Iconos                                                             */
/* ---------------------------------------------------------------- */

function Svg({ children, className = 'w-5 h-5' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const MailIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
  </Svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 4l16 16" />
    <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4" />
    <path d="M6.3 7.9A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.7-.5" />
    <path d="M9.8 9.9a3 3 0 0 0 4.3 4.2" />
  </Svg>
);

const GamepadIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.4l-.7 3.4a2.6 2.6 0 0 1-4.5 1.3L14 16h-4l-1.7 2.1a2.6 2.6 0 0 1-4.5-1.3l-.7-3.4A4.5 4.5 0 0 1 7.5 8Z" />
    <path d="M7 11.5v2M6 12.5h2M16 11.8h.01M18 13.6h.01" />
  </Svg>
);

const VolumeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="M15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.6 7.6 0 0 1 0 10.8" />
  </Svg>
);

const FileIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3Z" />
    <path d="M13.5 3v5.5H19" />
  </Svg>
);

const HelpIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.8 9.3a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .9-1 1.6" />
    <path d="M12 16.5h.01" />
  </Svg>
);

const ArrowIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m20 6-11 11-5-5" />
  </Svg>
);

/* ---------------------------------------------------------------- */
/* Hero                                                               */
/* ---------------------------------------------------------------- */

const HERO_FEATURES = [
  { icon: <GamepadIcon />, label: 'Comunidades activas' },
  { icon: <VolumeIcon />, label: 'Chats de voz y video' },
  { icon: <FileIcon />, label: 'Comparte tus archivos' },
  { icon: <HelpIcon />, label: 'Y mucho más…' },
];

function AuroraHero() {
  return (
    <div className="relative hidden overflow-hidden bg-sidebar lg:flex lg:w-[42%] lg:flex-col lg:justify-between lg:p-8">
      {/* Cielo aurora (placeholder CSS: si quieres ilustración real, cambia este div por un <img>) */}
      <div
        className="absolute inset-0 bg-[radial-gradient(120%_80%_at_18%_8%,rgba(124,92,255,0.55)_0%,transparent_55%),radial-gradient(90%_70%_at_82%_18%,rgba(37,99,235,0.45)_0%,transparent_52%),radial-gradient(80%_60%_at_50%_78%,rgba(147,51,234,0.35)_0%,transparent_58%),linear-gradient(180deg,#0a1030_0%,#0a0f22_100%)]"
        aria-hidden
      />
      <div className="absolute -top-10 left-10 h-32 w-32 rounded-full bg-accent/40 blur-3xl" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-1/2" aria-hidden>
        <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="h-full w-full">
          <path d="M0 200 L55 118 L105 162 L168 86 L228 158 L288 104 L338 148 L400 78 L400 200 Z" fill="#160f38" opacity=".95" />
          <path d="M0 200 L48 162 L118 194 L198 138 L276 188 L348 158 L400 182 L400 200 Z" fill="#0c0920" />
          <path d="M55 118 L105 162 L168 86 L228 158 L288 104 L338 148" stroke="rgba(167,139,250,0.55)" strokeWidth="1" fill="none" />
        </svg>
      </div>

      <Sparkle />

      <div className="relative">
        <div className="h-14 w-14 rounded-2xl bg-linear-to-br from-accent to-accent-2 grid place-items-center text-xl font-black text-white shadow-lg shadow-accent/40">
          V
        </div>
        <h2 className="mt-6 max-w-[13ch] text-4xl font-extrabold leading-[1.08] text-white">
          Conecta, juega, comparte.
        </h2>
        <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-white/60">
          Tu comunidad, tus conversaciones, en un solo lugar.
        </p>

        <ul className="mt-9 space-y-4">
          {HERO_FEATURES.map((f) => (
            <li key={f.label} className="flex items-center gap-3.5 text-sm text-white/85">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/90 backdrop-blur">
                {f.icon}
              </span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">VoxCord</span>
    </div>
  );
}

function Sparkle() {
  return (
    <span
      className="absolute left-8 top-8 h-3 w-3 rotate-45 rounded-[2px] bg-linear-to-br from-accent-2 to-accent shadow-[0_0_12px_rgba(109,94,252,0.9)]"
      aria-hidden
    />
  );
}

/* ---------------------------------------------------------------- */
/* Card + tabs                                                        */
/* ---------------------------------------------------------------- */

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname.startsWith('/register');

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/8 bg-sidebar shadow-[0_30px_80px_rgba(0,0,0,0.55)] lg:flex">
        <AuroraHero />

        <div className="w-full bg-sidebar px-6 py-8 sm:px-10 sm:py-10 lg:w-[58%]">
          <nav className="flex gap-8 border-b border-white/8" aria-label="Acceso">
            {[
              { href: '/login', label: 'Iniciar sesión' },
              { href: '/register', label: 'Registrarse' },
            ].map((t) => {
              const active = t.href === '/register' ? isRegister : !isRegister;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-transparent bg-linear-to-r from-accent-2 to-accent bg-clip-text text-transparent'
                      : 'border-transparent text-muted hover:text-header'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- */
/* Campo de formulario                                                */
/* ---------------------------------------------------------------- */

export function AuthField({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
  autoComplete,
  showCounter = false,
}: {
  label: string;
  icon: React.ReactNode;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
  maxLength?: number;
  autoComplete?: string;
  showCounter?: boolean;
}) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && reveal ? 'text' : type;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-header/90">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          {icon}
        </span>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-white/10 bg-white/4 py-3 pl-11 pr-11 text-header placeholder:text-muted/70 outline-none transition-colors focus:border-accent focus:bg-white/6 focus:ring-2 focus:ring-accent/25"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors hover:text-header"
            aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {reveal ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        {hint ? <span className="text-xs text-muted/80">{hint}</span> : <span />}
        {showCounter && (
          <span className="text-xs tabular-nums text-muted/80">
            {value.length}/{maxLength ?? 0}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Piezas reutilizables                                               */
/* ---------------------------------------------------------------- */

export const AuthIcons = { MailIcon, UserIcon, LockIcon, ArrowIcon, CheckIcon };

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">{message}</p>
  );
}

export function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="group flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-accent-2 to-accent px-5 py-3.5 font-bold text-white shadow-lg shadow-accent/25 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
    >
      {children}
      <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-white/10" />
      <span className="text-xs text-muted">{label}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

/** Botones sociales: diseño fiel al mockup, sin OAuth implementado todavía. */
export function SocialButtons() {
  const items = [
    { label: 'Google', hint: 'Próximamente' },
    { label: 'Discord', hint: 'Próximamente' },
    { label: 'Steam', hint: 'Próximamente' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((s) => (
        <button
          key={s.label}
          type="button"
          disabled
          title={`${s.label}: ${s.hint}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 text-sm font-semibold text-header/80 opacity-60"
        >
          <SocialGlyph kind={s.label} />
          <span className="hidden sm:inline">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

function SocialGlyph({ kind }: { kind: string }) {
  if (kind === 'Google') {
    return <span className="grid h-5 w-5 place-items-center text-sm font-black text-header">G</span>;
  }
  if (kind === 'Discord') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M19.3 5.6A16 16 0 0 0 15.4 4.4l-.2.4a12 12 0 0 1 3.4 1.7 13.6 13.6 0 0 0-12.4 0 12 12 0 0 1 3.4-1.7l-.2-.4A16 16 0 0 0 4.7 5.6C2.6 9.2 2 12.7 2.3 16.1A16 16 0 0 0 7.2 18l.6-1a10 10 0 0 1-1.6-.8l.4-.3a11.4 11.4 0 0 0 9.6 0l.4.3c-.5.3-1 .6-1.6.8l.6 1a16 16 0 0 0 4.9-1.9c.4-4-.6-7.4-2.2-10.5ZM9.7 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="15.5" cy="10.5" r="2.6" />
      <path d="M13 8.2 9.8 9.6a1 1 0 0 0-.5 1.4l.6 1a1 1 0 0 0 1.2.4l3-1.3" />
    </svg>
  );
}