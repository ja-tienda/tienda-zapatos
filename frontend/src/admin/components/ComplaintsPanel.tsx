import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { Complaint } from '../../types';
import { formatDateTime, formatPrice } from '../../utils/format';
import { fieldClass } from '../AdminContext';

interface Props {
  complaints: Complaint[];
  /** Guarda la respuesta y la envía por correo al consumidor. Devuelve si el correo salió. */
  onRespond: (id: number, response: string) => Promise<boolean>;
}

const TYPE_LABEL = { RECLAMO: 'Reclamo', QUEJA: 'Queja' } as const;
const DAY = 24 * 60 * 60 * 1000;

/** Fecha límite legal: 15 días hábiles (se cuentan de lunes a viernes; no descuenta feriados). */
function deadline(createdAt: string): Date {
  const date = new Date(createdAt);
  let remaining = 15;
  while (remaining > 0) {
    date.setTime(date.getTime() + DAY);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining--;
  }
  return date;
}

/** Libro de Reclamaciones: hojas recibidas y su respuesta. */
export default function ComplaintsPanel({ complaints, onRespond }: Props) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  async function respond(complaint: Complaint) {
    const text = (drafts[complaint.id] ?? '').trim();
    if (text.length < 5) return setNotice({ id: complaint.id, text: 'Escribe la respuesta antes de enviarla.' });
    if (!confirm(`¿Enviar esta respuesta a ${complaint.email}? Quedará registrada en la hoja ${complaint.code}.`)) return;
    setBusy(complaint.id);
    setNotice(null);
    try {
      const emailSent = await onRespond(complaint.id, text);
      if (!emailSent) {
        setNotice({ id: complaint.id, text: 'La respuesta se guardó, pero el correo no salió (revisa la configuración de correos). Escríbele por otro medio.' });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-stone-900">Libro de Reclamaciones</h1>
        <p className="mt-1 text-sm text-stone-500">
          Cada hoja debe responderse en un máximo de 15 días hábiles. La respuesta se envía al correo del consumidor y queda guardada.
        </p>
      </div>

      {complaints.length === 0 && (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center text-sm text-stone-500">No hay reclamos ni quejas registrados.</p>
      )}

      <ul className="space-y-3" aria-label="Reclamos">
        {complaints.map((c) => {
          const pending = c.status === 'PENDIENTE';
          const limit = deadline(c.createdAt);
          const late = pending && limit.getTime() < Date.now();
          return (
            <li key={c.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-bold text-stone-900">{c.code}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700">{TYPE_LABEL[c.type]}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {pending ? 'Pendiente' : 'Atendido'}
                </span>
                <span className="text-xs text-stone-500">{formatDateTime(c.createdAt)}</span>
                {pending && (
                  <span className={`ml-auto text-xs font-semibold ${late ? 'text-accent-600' : 'text-stone-600'}`}>
                    {late ? 'Plazo vencido el ' : 'Responder antes del '}
                    {limit.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-stone-700 sm:grid-cols-2">
                <div>
                  <dt className="inline text-stone-500">Consumidor: </dt>
                  <dd className="inline font-semibold text-stone-900">{c.customerName}</dd>
                </div>
                <div>
                  <dt className="inline text-stone-500">{c.documentType}: </dt>
                  <dd className="inline">{c.documentNumber}</dd>
                </div>
                <div>
                  <dt className="inline text-stone-500">Correo: </dt>
                  <dd className="inline break-all">{c.email}</dd>
                </div>
                <div>
                  <dt className="inline text-stone-500">Teléfono: </dt>
                  <dd className="inline">{c.phone}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline text-stone-500">Domicilio: </dt>
                  <dd className="inline">{c.address}</dd>
                </div>
                {c.guardianName && (
                  <div className="sm:col-span-2">
                    <dt className="inline text-stone-500">Apoderado: </dt>
                    <dd className="inline">{c.guardianName}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="inline text-stone-500">{c.itemType === 'PRODUCTO' ? 'Producto' : 'Servicio'}: </dt>
                  <dd className="inline">
                    {c.itemDescription}
                    {c.amount !== null && ` · ${formatPrice(c.amount)}`}
                    {c.orderCode && ` · pedido ${c.orderCode}`}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
                <p className="whitespace-pre-line text-stone-800">
                  <span className="font-semibold">Detalle: </span>
                  {c.detail}
                </p>
                <p className="whitespace-pre-line text-stone-800">
                  <span className="font-semibold">Pide: </span>
                  {c.request}
                </p>
              </div>

              {pending ? (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-stone-700">
                    Tu respuesta
                    <textarea
                      value={drafts[c.id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      rows={3}
                      maxLength={3000}
                      className={fieldClass}
                    />
                  </label>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => respond(c)}
                      className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
                    >
                      {busy === c.id && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                      Responder y enviar por correo
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-line rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <span className="font-semibold">Respuesta{c.respondedAt ? ` (${formatDateTime(c.respondedAt)})` : ''}: </span>
                  {c.response}
                </p>
              )}
              {notice?.id === c.id && (
                <p className="mt-2 text-sm font-medium text-accent-700" role="alert">
                  {notice.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
