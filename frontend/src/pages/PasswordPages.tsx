import { CircleCheck, LoaderCircle, MailCheck, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '../config/constants';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../services/api';

const inputClass =
  'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 focus:border-stone-900 focus:outline-none';

function Card({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8">
        <h1 className="font-display text-3xl font-medium text-stone-900">{title}</h1>
        {intro && <p className="mt-1 text-sm text-stone-500">{intro}</p>}
        {children}
      </div>
    </section>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p className="flex gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700" role="alert">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

/** /recuperar — pide el correo y envía un enlace de un solo uso que caduca en 30 minutos. */
export function ForgotPasswordPage() {
  usePageMeta('Recuperar contraseña');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Ingresa un correo válido.');
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card title="Revisa tu correo">
        <MailCheck className="mt-5 size-12 text-emerald-600" strokeWidth={1.5} aria-hidden />
        <p className="mt-4 text-sm leading-relaxed text-stone-600">
          Si <strong className="text-stone-900">{email.trim()}</strong> tiene una cuenta, te enviamos un enlace para crear una nueva
          contraseña. Sirve una sola vez y caduca en 30 minutos. Mira también la carpeta de spam.
        </p>
        <Link to={ROUTES.account} className="mt-6 inline-block text-sm font-semibold text-accent-600 hover:underline">
          Volver a iniciar sesión
        </Link>
      </Card>
    );
  }

  return (
    <Card title="Recuperar contraseña" intro="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.">
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-stone-700">
          Correo
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} className={inputClass} />
        </label>
        {error && <ErrorNote text={error} />}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-600 disabled:opacity-70"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Enviar enlace
        </button>
      </form>
      <Link to={ROUTES.account} className="mt-5 block text-center text-sm font-medium text-stone-600 hover:text-stone-900">
        Volver a iniciar sesión
      </Link>
    </Card>
  );
}

/** /restablecer?token=… — crea la nueva contraseña con el enlace recibido por correo. */
export function ResetPasswordPage() {
  usePageMeta('Nueva contraseña');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== repeat) return setError('Las dos contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card title="Contraseña actualizada">
        <CircleCheck className="mt-5 size-12 text-emerald-600" strokeWidth={1.5} aria-hidden />
        <p className="mt-4 text-sm text-stone-600">Ya puedes entrar con tu nueva contraseña. Por seguridad cerramos tus sesiones abiertas.</p>
        <Link to={ROUTES.account} className="mt-6 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600">
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (token.length < 20) {
    return (
      <Card title="Enlace no válido" intro="Este enlace está incompleto o ya caducó.">
        <Link to={ROUTES.forgot} className="mt-6 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600">
          Pedir un enlace nuevo
        </Link>
      </Card>
    );
  }

  return (
    <Card title="Crea tu nueva contraseña" intro="Elige una que no uses en otros sitios.">
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-stone-700">
          Nueva contraseña
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-stone-500">Mínimo 8 caracteres.</span>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Repite la contraseña
          <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} maxLength={72} className={inputClass} />
        </label>
        {error && (
          <>
            <ErrorNote text={error} />
            <Link to={ROUTES.forgot} className="block text-sm font-medium text-accent-600 hover:underline">
              Pedir un enlace nuevo
            </Link>
          </>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-600 disabled:opacity-70"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Guardar contraseña
        </button>
      </form>
    </Card>
  );
}
