import { BookOpenText, CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../services/api';
import type { ComplaintInput } from '../types';

const inputClass =
  'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none';

function Block({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <h2 className="flex items-center gap-3 font-display text-2xl font-medium text-stone-900">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-900 font-sans text-xs font-bold text-white">{step}</span>
        {title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, wide = false, hint, children }: { label: string; wide?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={`block text-sm font-medium text-stone-700 ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

/**
 * Libro de Reclamaciones virtual (Código de Protección y Defensa del Consumidor, Ley 29571).
 * La hoja se guarda con un número correlativo, se envía una constancia al correo del
 * consumidor y la tienda la responde desde su panel en un máximo de 15 días hábiles.
 */
export default function ComplaintPage() {
  usePageMeta('Libro de Reclamaciones', 'Registra tu reclamo o queja en el Libro de Reclamaciones virtual de J & A.');
  const { settings } = useStore();
  const { user } = useAuth();
  const [form, setForm] = useState<ComplaintInput>({
    type: 'RECLAMO',
    customerName: user?.name ?? '',
    documentType: 'DNI',
    documentNumber: '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    address: '',
    guardianName: '',
    itemType: 'PRODUCTO',
    itemDescription: '',
    amount: null,
    orderCode: '',
    detail: '',
    request: '',
    acceptTerms: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; emailSent: boolean } | null>(null);

  const set = <K extends keyof ComplaintInput>(key: K, value: ComplaintInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (form.customerName.trim().length < 3) return setError('Ingresa tu nombre completo.');
    if (!/^[A-Za-z0-9]{6,15}$/.test(form.documentNumber.trim())) return setError('Revisa tu número de documento.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Ingresa un correo válido: ahí llega tu constancia.');
    if (form.detail.trim().length < 10) return setError('Cuéntanos qué pasó con un poco más de detalle.');
    if (form.request.trim().length < 5) return setError('Indica qué solución pides.');
    if (!form.acceptTerms) return setError('Marca la casilla para confirmar que la información es verdadera.');

    setBusy(true);
    try {
      setDone(await api.sendComplaint(form));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar. Inténtalo de nuevo.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <CircleCheck className="mx-auto size-14 text-emerald-600" strokeWidth={1.5} aria-hidden />
        <h1 className="mt-4 font-display text-4xl font-medium text-stone-900">Hoja registrada</h1>
        <p className="mt-3 text-stone-600">Tu número de hoja de reclamación es</p>
        <p className="mt-1 font-mono text-2xl font-bold text-stone-900">{done.code}</p>
        <p className="mt-4 text-stone-600">
          {done.emailSent
            ? `Te enviamos una constancia a ${form.email.trim()}. Te responderemos a ese correo en un máximo de 15 días hábiles.`
            : 'Guarda este número: no pudimos enviarte la constancia por correo. Te responderemos en un máximo de 15 días hábiles.'}
        </p>
        <Link to={ROUTES.home} className="mt-7 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600">
          Volver al inicio
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
        <BookOpenText className="size-4" aria-hidden />
        Hoja de reclamación
      </p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">Libro de Reclamaciones</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">
        Conforme al Código de Protección y Defensa del Consumidor, este establecimiento cuenta con un Libro de Reclamaciones virtual.
        {settings.businessName && (
          <>
            {' '}
            Proveedor: <strong className="text-stone-900">{settings.businessName}</strong>
            {settings.businessRuc && ` · RUC ${settings.businessRuc}`}
            {settings.businessAddress && ` · ${settings.businessAddress}`}.
          </>
        )}
      </p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-6">
        <Block step={1} title="Tus datos">
          <Field label="Nombre completo" wide>
            <input type="text" autoComplete="name" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} maxLength={120} className={inputClass} />
          </Field>
          <Field label="Tipo de documento">
            <select value={form.documentType} onChange={(e) => set('documentType', e.target.value as ComplaintInput['documentType'])} className={inputClass}>
              <option value="DNI">DNI</option>
              <option value="CE">Carné de extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </Field>
          <Field label="Número de documento">
            <input type="text" inputMode="numeric" value={form.documentNumber} onChange={(e) => set('documentNumber', e.target.value.replace(/[^A-Za-z0-9]/g, ''))} maxLength={15} className={inputClass} />
          </Field>
          <Field label="Teléfono">
            <input type="tel" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/[^\d\s]/g, ''))} maxLength={12} className={inputClass} />
          </Field>
          <Field label="Correo" hint="Ahí recibirás tu constancia y la respuesta.">
            <input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={120} className={inputClass} />
          </Field>
          <Field label="Domicilio" wide>
            <input type="text" autoComplete="street-address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} className={inputClass} />
          </Field>
          <Field label="Padre, madre o apoderado" wide hint="Solo si eres menor de edad.">
            <input type="text" value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} maxLength={120} className={inputClass} />
          </Field>
        </Block>

        <Block step={2} title="Bien contratado">
          <Field label="Se trata de un">
            <select value={form.itemType} onChange={(e) => set('itemType', e.target.value as ComplaintInput['itemType'])} className={inputClass}>
              <option value="PRODUCTO">Producto</option>
              <option value="SERVICIO">Servicio</option>
            </select>
          </Field>
          <Field label="Monto reclamado (S/)" hint="Opcional.">
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.amount ?? ''}
              onChange={(e) => set('amount', e.target.value === '' ? null : Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Descripción" wide>
            <input type="text" placeholder="Ej. Zapatillas Urban Flow talla 38" value={form.itemDescription} onChange={(e) => set('itemDescription', e.target.value)} maxLength={300} className={inputClass} />
          </Field>
          <Field label="Código de pedido" hint="Opcional. Ej. JA-ABC12">
            <input type="text" value={form.orderCode} onChange={(e) => set('orderCode', e.target.value.toUpperCase())} maxLength={20} className={inputClass} />
          </Field>
        </Block>

        <Block step={3} title="Detalle">
          <div className="sm:col-span-2" role="radiogroup" aria-label="Tipo">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: 'RECLAMO', title: 'Reclamo', text: 'Disconformidad con el producto o el servicio.' },
                  { value: 'QUEJA', title: 'Queja', text: 'Malestar con la atención recibida.' },
                ] as const
              ).map((option) => {
                const selected = form.type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set('type', option.value)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      selected ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className={`mt-0.5 block text-xs ${selected ? 'text-stone-300' : 'text-stone-500'}`}>{option.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="¿Qué pasó?" wide>
            <textarea value={form.detail} onChange={(e) => set('detail', e.target.value)} rows={5} maxLength={3000} className={inputClass} />
          </Field>
          <Field label="¿Qué solución pides?" wide>
            <textarea value={form.request} onChange={(e) => set('request', e.target.value)} rows={3} maxLength={1500} className={inputClass} />
          </Field>
        </Block>

        <label className="flex items-start gap-2.5 text-sm text-stone-600">
          <input type="checkbox" checked={form.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-rose-600" />
          <span>
            Declaro que la información es verdadera y acepto la{' '}
            <Link to={ROUTES.privacy} target="_blank" className="font-medium text-stone-900 underline underline-offset-2">
              política de privacidad
            </Link>
            .
          </span>
        </label>

        {error && (
          <p className="flex gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-600 disabled:opacity-70 sm:w-auto sm:px-10"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Enviar hoja de reclamación
        </button>

        <p className="text-xs leading-relaxed text-stone-500">
          La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer
          una denuncia ante el INDECOPI. El proveedor debe dar respuesta en un plazo no mayor a quince (15) días hábiles.
        </p>
      </form>
    </section>
  );
}
