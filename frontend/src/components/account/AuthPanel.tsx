import { Eye, EyeOff, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { googleLoginUrl } from '../../services/api';

interface Props {
  /** A dónde volver después de entrar con Google (ruta interna, p. ej. "/checkout") */
  next: string;
  /** Texto bajo el título, según desde dónde se pide entrar */
  intro?: string;
}

const inputClass =
  'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Iniciar sesión o crear cuenta (correo y contraseña, o Google).
 * Se muestra recién cuando hace falta: al continuar la compra o al entrar a "Mi cuenta".
 */
export default function AuthPanel({ next, intro }: Props) {
  const { login, register, googleEnabled } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === 'register';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (isRegister && name.trim().length < 3) return setError('Ingresa tu nombre completo.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Ingresa un correo válido.');
    if (isRegister && password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (!password) return setError('Ingresa tu contraseña.');
    if (isRegister && !acceptTerms) return setError('Para crear tu cuenta debes aceptar los términos y la política de privacidad.');

    setBusy(true);
    try {
      if (isRegister) await register({ name: name.trim(), email: email.trim(), password, acceptTerms });
      else await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo continuar. Inténtalo de nuevo.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8">
      <h2 className="font-display text-3xl font-medium text-stone-900">{isRegister ? 'Crea tu cuenta' : 'Inicia sesión'}</h2>
      <p className="mt-1 text-sm text-stone-500">
        {intro ?? (isRegister ? 'Guarda tus pedidos y favoritos en un solo lugar.' : 'Entra para ver tus pedidos y favoritos.')}
      </p>

      {googleEnabled && (
        <>
          <a
            href={googleLoginUrl(next)}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-stone-300 py-3 text-sm font-semibold text-stone-900 transition-colors hover:border-stone-900"
          >
            <GoogleIcon />
            Continuar con Google
          </a>
          <p className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />o con tu correo
            <span className="h-px flex-1 bg-stone-200" />
          </p>
        </>
      )}

      <form onSubmit={submit} noValidate className={`space-y-4 ${googleEnabled ? '' : 'mt-6'}`}>
        {isRegister && (
          <label className="block text-sm font-medium text-stone-700">
            Nombre completo
            <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} />
          </label>
        )}

        <label className="block text-sm font-medium text-stone-700">
          Correo
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          <span className="flex items-baseline justify-between">
            Contraseña
            {!isRegister && (
              <Link to={ROUTES.forgot} className="text-xs font-medium text-accent-600 hover:underline">
                ¿La olvidaste?
              </Link>
            )}
          </span>
          <span className="relative block">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-2 top-1/2 mt-0.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
          {isRegister && <span className="mt-1 block text-xs font-normal text-stone-500">Mínimo 8 caracteres.</span>}
        </label>

        {isRegister && (
          <label className="flex items-start gap-2.5 text-sm text-stone-600">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-rose-600" />
            <span>
              Acepto los{' '}
              <Link to={ROUTES.terms} target="_blank" className="font-medium text-stone-900 underline underline-offset-2">
                términos y condiciones
              </Link>
              , la{' '}
              <Link to={ROUTES.privacy} target="_blank" className="font-medium text-stone-900 underline underline-offset-2">
                política de privacidad
              </Link>{' '}
              y la de{' '}
              <Link to={ROUTES.returns} target="_blank" className="font-medium text-stone-900 underline underline-offset-2">
                cambios y devoluciones
              </Link>
              .
            </span>
          </label>
        )}

        {error && (
          <p className="flex gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-600 disabled:cursor-wait disabled:opacity-70"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {isRegister ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-stone-600">
        {isRegister ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(isRegister ? 'login' : 'register');
            setError(null);
          }}
          className="font-semibold text-accent-600 hover:underline"
        >
          {isRegister ? 'Inicia sesión' : 'Crea tu cuenta'}
        </button>
      </p>
    </div>
  );
}
