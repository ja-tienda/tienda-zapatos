import { ArrowLeft, LoaderCircle, Lock, MailCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { STORE } from '../../config/constants';
import { api } from '../../services/api';
import type { User } from '../../types';

const inputClass =
  'mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-stone-900 focus:border-stone-900 focus:outline-none';
const buttonClass =
  'flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-sm font-bold text-white hover:bg-stone-700 disabled:bg-stone-300';

function Shell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-900 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white px-6 py-9 shadow-2xl">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-stone-900 text-white">
            <Lock className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-center text-xl font-extrabold text-stone-900">{title}</h1>
          <p className="mt-1 text-center text-sm text-stone-500">{intro}</p>
          {children}
        </div>
        <a href="/" className="mt-5 flex items-center justify-center gap-1.5 text-sm text-stone-400 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la tienda
        </a>
      </div>
    </main>
  );
}

/**
 * Entrada al panel con usuario (o correo) y contraseña. La sesión queda en una cookie
 * httpOnly: aquí no se guarda ninguna clave. También resuelve "olvidé mi contraseña" y el
 * enlace de recuperación (/admin/?token=…).
 */
export default function LoginScreen({ onLogin, notice }: { onLogin: (user: User) => void; notice?: string | null }) {
  const resetToken = new URLSearchParams(window.location.search).get('token') ?? '';
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent' | 'reset'>(resetToken.length >= 20 ? 'reset' : 'login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(notice ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo continuar');
    } finally {
      setBusy(false);
    }
  }

  function login(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return setError('Escribe tu usuario y tu contraseña.');
    void run(async () => {
      const { user } = await api.login(identifier.trim(), password);
      if (user.role !== 'ADMIN') {
        // Una cuenta de cliente no entra al panel: se cierra esa sesión aquí mismo
        await api.logout().catch(() => {});
        throw new Error('Esa cuenta no es de administración.');
      }
      onLogin(user);
    });
  }

  function forgot(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(identifier.trim())) return setError('Escribe el correo de la cuenta de administración.');
    void run(async () => {
      await api.forgotPassword(identifier.trim());
      setMode('sent');
    });
  }

  function reset(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError('Usa al menos 10 caracteres.');
    if (password !== repeat) return setError('Las dos contraseñas no coinciden.');
    void run(async () => {
      await api.resetPassword(resetToken, password);
      // El enlace ya se usó: se quita de la barra de direcciones
      history.replaceState(null, '', window.location.pathname);
      setPassword('');
      setRepeat('');
      setInfo('Contraseña actualizada. Ya puedes entrar.');
      setMode('login');
    });
  }

  const alert = error && (
    <p className="text-sm font-medium text-accent-600" role="alert">
      {error}
    </p>
  );
  const spinner = busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />;

  if (mode === 'sent') {
    return (
      <Shell title="Revisa tu correo" intro="Si ese correo es el de la administración, enviamos un enlace que caduca en 30 minutos.">
        <MailCheck className="mx-auto mt-5 size-10 text-emerald-600" strokeWidth={1.5} aria-hidden />
        <button type="button" onClick={() => setMode('login')} className={`${buttonClass} mt-6`}>
          Volver a entrar
        </button>
      </Shell>
    );
  }

  if (mode === 'forgot') {
    return (
      <Shell title="Recuperar acceso" intro="Escribe el correo de la cuenta de administración.">
        <form onSubmit={forgot} noValidate className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-stone-700">
            Correo
            <input type="email" autoComplete="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputClass} />
          </label>
          {alert}
          <button type="submit" disabled={busy} className={buttonClass}>
            {spinner}
            Enviar enlace
          </button>
          <button type="button" onClick={() => setMode('login')} className="w-full text-sm font-medium text-stone-600 hover:text-stone-900">
            Volver
          </button>
        </form>
      </Shell>
    );
  }

  if (mode === 'reset') {
    return (
      <Shell title="Nueva contraseña" intro="Elige una contraseña larga que no uses en otro sitio.">
        <form onSubmit={reset} noValidate className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-stone-700">
            Nueva contraseña
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Repítela
            <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} maxLength={72} className={inputClass} />
          </label>
          {alert}
          <button type="submit" disabled={busy} className={buttonClass}>
            {spinner}
            Guardar contraseña
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title={`Panel ${STORE.name}`} intro="Entra con tu usuario y contraseña de administración.">
      <form onSubmit={login} noValidate className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-stone-700">
          Usuario o correo
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Contraseña
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} className={inputClass} />
        </label>
        {info && (
          <p className="text-sm font-medium text-emerald-700" role="status">
            {info}
          </p>
        )}
        {alert}
        <button type="submit" disabled={busy} className={buttonClass}>
          {spinner}
          Entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('forgot');
            setError(null);
          }}
          className="w-full text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          Olvidé mi contraseña
        </button>
      </form>
    </Shell>
  );
}
