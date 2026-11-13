import { Check, CreditCard, LoaderCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import RichTitle from '../../components/ui/RichTitle';
import type { EditableSettings, Settings } from '../../types';
import { fieldClass } from '../AdminContext';
import ImageInput from './ImageInput';

interface PanelProps {
  settings: Settings;
  /** Guarda solo los campos que cambiaron. Lanza un error con el mensaje del servidor si falla. */
  onSave: (changes: Partial<EditableSettings>) => Promise<void>;
}

/**
 * Estado de un formulario de ajustes: copia editable de `keys`, detección de cambios
 * y guardado. Si los ajustes cambian en el servidor (otra pestaña), se actualiza lo no editado.
 */
function useSettingsForm<K extends keyof EditableSettings>(settings: Settings, keys: readonly K[], onSave: PanelProps['onSave']) {
  const pick = () => Object.fromEntries(keys.map((k) => [k, settings[k]])) as Pick<EditableSettings, K>;
  const [values, setValues] = useState(pick);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const snapshot = keys.map((k) => settings[k]).join('\u0000');
  useEffect(() => {
    setValues(pick());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambian los valores guardados
  }, [snapshot]);

  const changes = Object.fromEntries(keys.filter((k) => values[k] !== settings[k]).map((k) => [k, values[k]])) as Partial<EditableSettings>;
  const dirty = Object.keys(changes).length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(changes);
      setSavedAt(Date.now());
    } catch (err) {
      // El servidor antepone el nombre interno del campo ("contactPhone: …"): no le sirve a la administradora
      setError(err instanceof Error ? err.message.replace(/^[A-Za-z]+: /, '') : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const set = <F extends K>(key: F, value: string) => setValues((v) => ({ ...v, [key]: value }));
  return { values, set, submit, saving, error, dirty, justSaved: !dirty && savedAt > 0 };
}

function Card({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="text-lg font-extrabold text-stone-900">{title}</h2>
        {help && <p className="mt-0.5 text-sm text-stone-500">{help}</p>}
      </div>
      {children}
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

function SaveBar({ form }: { form: { saving: boolean; error: string | null; dirty: boolean; justSaved: boolean } }) {
  return (
    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-stone-300 bg-stone-100 px-4 py-3 sm:-mx-6 sm:px-6">
      {form.error && (
        <p className="mr-auto text-sm font-medium text-accent-700" role="alert">
          {form.error}
        </p>
      )}
      {form.justSaved && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700" role="status">
          <Check className="size-4" aria-hidden />
          Guardado. Ya se ve en la tienda.
        </p>
      )}
      {form.dirty && !form.saving && <p className="text-sm text-stone-500">Tienes cambios sin guardar</p>}
      <button
        type="submit"
        disabled={!form.dirty || form.saving}
        className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
      >
        {form.saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        Guardar cambios
      </button>
    </div>
  );
}

const APPEARANCE_KEYS = ['logoUrl', 'announcement', 'heroEyebrow', 'heroTitle', 'heroText', 'heroButtonLabel', 'heroImage'] as const;

/** Apariencia: logo, franja superior y portada de la página de inicio. */
export function AppearancePanel({ settings, onSave }: PanelProps) {
  const form = useSettingsForm(settings, APPEARANCE_KEYS, onSave);
  const { values, set } = form;

  return (
    <form onSubmit={form.submit} noValidate className="space-y-6">
      <Card title="Logo" help="Aparece arriba a la izquierda y en el pie de página. Sin logo se muestra “J & A” en letras.">
        <ImageInput
          label="Imagen del logo"
          hint="Mejor en PNG con fondo transparente, más ancho que alto."
          value={values.logoUrl}
          onChange={(v) => set('logoUrl', v)}
          folder="sitio"
          previewClass="h-20 w-44"
          fit="contain"
        />
      </Card>

      <Card title="Franja superior" help="La línea oscura que está encima de todo. Déjala vacía para ocultarla.">
        <Field label="Texto del anuncio">
          <input type="text" value={values.announcement} onChange={(e) => set('announcement', e.target.value)} maxLength={160} className={fieldClass} />
        </Field>
      </Card>

      <Card title="Portada de inicio" help="Lo primero que ve el cliente al entrar a la tienda.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Texto pequeño de arriba">
            <input type="text" value={values.heroEyebrow} onChange={(e) => set('heroEyebrow', e.target.value)} maxLength={80} className={fieldClass} />
          </Field>
          <Field label="Texto del botón">
            <input type="text" value={values.heroButtonLabel} onChange={(e) => set('heroButtonLabel', e.target.value)} maxLength={40} className={fieldClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Título grande" hint="Pon una palabra entre *asteriscos* para resaltarla en cursiva y color.">
              <input type="text" value={values.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} maxLength={120} className={fieldClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Texto debajo del título">
              <textarea value={values.heroText} onChange={(e) => set('heroText', e.target.value)} rows={2} maxLength={300} className={fieldClass} />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl bg-stone-50 p-5" aria-label="Vista previa del texto de portada">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Vista previa</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">{values.heroEyebrow}</p>
          <p className="mt-2 text-balance font-display text-4xl font-medium leading-[1.05] tracking-tight text-stone-900">
            <RichTitle text={values.heroTitle || 'Título de la portada'} />
          </p>
          <p className="mt-3 max-w-md text-sm text-stone-600">{values.heroText}</p>
          <span className="mt-4 inline-block rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white">
            {values.heroButtonLabel || 'Ver la colección'} →
          </span>
        </div>

        <ImageInput
          label="Imagen de la portada"
          hint="Si no subes ninguna, se muestra automáticamente la foto del producto destacado. Mejor vertical."
          value={values.heroImage}
          onChange={(v) => set('heroImage', v)}
          folder="sitio"
          previewClass="h-40 w-32"
        />
      </Card>

      <SaveBar form={form} />
    </form>
  );
}

const STORE_KEYS = [
  'contactName',
  'contactPhone',
  'contactEmail',
  'businessHours',
  'walletNumber',
  'walletHolder',
  'walletQrUrl',
  'termsText',
  'privacyText',
] as const;

const digits = (value: string) => value.replace(/\D/g, '').slice(0, 9);

/** Contacto y pagos: WhatsApp, correo, horario, Yape/Plin (con QR) y textos legales. */
export function StorePanel({ settings, onSave }: PanelProps) {
  const form = useSettingsForm(settings, STORE_KEYS, onSave);
  const { values, set } = form;

  return (
    <form onSubmit={form.submit} noValidate className="space-y-6">
      <Card title="Contacto" help="Se usa en el botón flotante de WhatsApp, en el pie de página y en los mensajes de pedido.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de quien atiende" hint="Sale en “Consultar a …” y en el saludo del mensaje de WhatsApp.">
            <input type="text" value={values.contactName} onChange={(e) => set('contactName', e.target.value)} maxLength={40} className={fieldClass} />
          </Field>
          <Field label="WhatsApp de contacto" hint="Celular de 9 dígitos. Ahí llegan las consultas y los pedidos.">
            <input
              type="tel"
              inputMode="numeric"
              value={values.contactPhone}
              onChange={(e) => set('contactPhone', digits(e.target.value))}
              className={fieldClass}
            />
          </Field>
          <Field label="Correo" hint="Opcional. Si lo dejas vacío no se muestra.">
            <input type="email" value={values.contactEmail} onChange={(e) => set('contactEmail', e.target.value.trim())} maxLength={120} className={fieldClass} />
          </Field>
          <Field label="Horario de atención" hint="Puedes usar varias líneas.">
            <textarea value={values.businessHours} onChange={(e) => set('businessHours', e.target.value)} rows={2} maxLength={200} className={fieldClass} />
          </Field>
        </div>
      </Card>

      <Card title="Pago con Yape o Plin" help="Lo que ve el cliente al pagar: el QR, el número y el titular.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número de Yape / Plin">
            <input
              type="tel"
              inputMode="numeric"
              value={values.walletNumber}
              onChange={(e) => set('walletNumber', digits(e.target.value))}
              className={fieldClass}
            />
          </Field>
          <Field label="Titular de la cuenta" hint="Tal como aparece en la app al pagar.">
            <input type="text" value={values.walletHolder} onChange={(e) => set('walletHolder', e.target.value)} maxLength={80} className={fieldClass} />
          </Field>
        </div>
        <ImageInput
          label="Código QR"
          hint="En Yape: toca tu QR, descárgalo o tómale captura y súbelo aquí. Sin QR, el cliente paga con el número."
          value={values.walletQrUrl}
          onChange={(v) => set('walletQrUrl', v)}
          folder="sitio"
          previewClass="size-36"
          fit="contain"
        />
      </Card>

      <Card title="Pago con tarjeta (Izipay)">
        <div className={`flex gap-3 rounded-xl p-4 text-sm ${settings.cardPaymentsEnabled ? 'bg-emerald-50 text-emerald-900' : 'bg-stone-100 text-stone-700'}`}>
          <CreditCard className="mt-0.5 size-5 shrink-0" aria-hidden />
          {settings.cardPaymentsEnabled ? (
            <p>
              <strong>Activado.</strong> Los clientes ya pueden pagar con tarjeta. Los pedidos pagados así se confirman solos.
            </p>
          ) : (
            <p>
              <strong>Aún no activado.</strong> En la tienda aparece como “Próximamente”. Se activa cuando el desarrollador coloca las
              cuatro claves de tu cuenta de Izipay en el servidor (archivo <code>backend/.env</code>). Por seguridad, esas claves no se
              escriben desde este panel.
            </p>
          )}
        </div>
      </Card>

      <Card title="Textos legales" help="Se muestran en las páginas enlazadas desde el pie. Escribe cada párrafo en una línea; una línea corta que empieza con número (“1. Pedidos”) sale como subtítulo.">
        <Field label="Términos y condiciones">
          <textarea value={values.termsText} onChange={(e) => set('termsText', e.target.value)} rows={10} maxLength={20000} className={fieldClass} />
        </Field>
        <Field label="Política de privacidad">
          <textarea value={values.privacyText} onChange={(e) => set('privacyText', e.target.value)} rows={10} maxLength={20000} className={fieldClass} />
        </Field>
      </Card>

      <SaveBar form={form} />
    </form>
  );
}
