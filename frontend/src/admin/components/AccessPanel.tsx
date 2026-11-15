import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../services/api';
import type { Diagnostics, User } from '../../types';
import { fieldClass } from '../AdminContext';

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {ok ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Correcto" />
      ) : (
        <CircleX className="mt-0.5 size-4 shrink-0 text-stone-400" aria-label="Pendiente" />
      )}
      <span className="min-w-0">
        <span className="font-semibold text-stone-900">{label}</span>
        {detail && <span className="block break-all text-xs text-stone-500">{detail}</span>}
      </span>
    </li>
  );
}

/** "Mi acceso": cambiar la contraseña de administración y revisar la configuración del servidor. */
export default function AccessPanel({ user }: { user: User }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  useEffect(() => {
    api.getDiagnostics().then(setDiag).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next.length < 10) return setMessage({ ok: false, text: 'La nueva contraseña debe tener al menos 10 caracteres.' });
    if (next !== repeat) return setMessage({ ok: false, text: 'Las dos contraseñas nuevas no coinciden.' });
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setMessage({ ok: true, text: 'Contraseña cambiada. Se cerró tu sesión en los demás dispositivos.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo cambiar' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900">Cambiar contraseña</h1>
          <p className="mt-1 text-sm text-stone-500">
            Sesión iniciada como <strong className="text-stone-900">{user.email}</strong>. Usa una contraseña larga que no uses en otro
            sitio.
          </p>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          Contraseña actual
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} maxLength={200} className={fieldClass} />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Nueva contraseña
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} maxLength={72} className={fieldClass} />
          <span className="mt-1 block text-xs font-normal text-stone-500">Mínimo 10 caracteres.</span>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Repite la nueva contraseña
          <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} maxLength={72} className={fieldClass} />
        </label>
        {message && (
          <p className={`text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-accent-700'}`} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Cambiar contraseña
        </button>
        <p className="text-xs text-stone-500">
          Tras 5 contraseñas incorrectas la cuenta se bloquea 15 minutos. Si la olvidas, usa “Olvidé mi contraseña” en la pantalla de
          entrada: el enlace llega a este correo.
        </p>
      </form>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <h2 className="text-xl font-extrabold text-stone-900">Estado del servidor</h2>
        <p className="mt-1 text-sm text-stone-500">Para comprobar la configuración después de publicar. No muestra ninguna clave.</p>
        {!diag ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-stone-500">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Consultando…
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            <Check ok={diag.production} label={diag.production ? 'Modo producción' : 'Modo desarrollo'} detail={`Tienda: ${diag.appUrl}`} />
            <Check ok={diag.https} label={diag.https ? 'Conexión segura (https)' : 'Sin https (normal en tu PC)'} />
            <Check
              ok={diag.yourIp !== null}
              label={`El servidor te ve con la IP ${diag.yourIp ?? 'desconocida'}`}
              detail={`Debe ser tu IP pública. Si es interna (10.x, 100.x, 172.x), ajusta TRUST_PROXY (ahora ${diag.trustProxy}).`}
            />
            <Check ok={diag.emails} label={diag.emails ? 'Envío de correos activo' : 'Envío de correos sin configurar'} detail={diag.emails ? undefined : 'Faltan RESEND_API_KEY y MAIL_FROM: no funciona la recuperación de contraseña.'} />
            <Check ok={diag.googleLogin} label={diag.googleLogin ? 'Inicio de sesión con Google activo' : 'Google sin configurar'} detail={`URI de redirección para Google: ${diag.googleRedirectUri}`} />
            <Check
              ok={diag.cardPayments}
              label={diag.cardPayments ? `Pago con tarjeta activo (claves de ${diag.cardPaymentsMode})` : 'Pago con tarjeta sin configurar'}
              detail={`URL de notificación para Izipay: ${diag.izipayNotificationUrl}`}
            />
          </ul>
        )}
      </section>
    </div>
  );
}
