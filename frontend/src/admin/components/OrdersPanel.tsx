import { CreditCard, MessageCircle, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { DELIVERY_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, PAYMENT_LABELS, STORE } from '../../config/constants';
import { apiAsset } from '../../services/api';
import type { Order, OrderStatus } from '../../types';
import { formatDateTime, formatPrice } from '../../utils/format';

interface Props {
  orders: Order[];
  onSetStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  /** Oculta los filtros (cuando se muestran los pedidos de un solo cliente) */
  compact?: boolean;
}

const FILTERS: (OrderStatus | 'TODOS')[] = ['PENDIENTE', 'PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO', 'TODOS'];

/** Siguiente paso natural de cada estado: el botón principal de la tarjeta. */
const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string; question: (code: string) => string }>> = {
  PENDIENTE: { to: 'PAGADO', label: 'Confirmar pago', question: (c) => `¿Confirmar que recibiste el pago del pedido ${c}?` },
  PAGADO: { to: 'ENVIADO', label: 'Marcar como enviado', question: (c) => `¿Marcar el pedido ${c} como enviado?` },
  ENVIADO: { to: 'ENTREGADO', label: 'Marcar como entregado', question: (c) => `¿Marcar el pedido ${c} como entregado?` },
};

/** Qué falta para cerrar un pedido, en palabras de la administradora. */
function hintFor(order: Order): { text: string; tone: string } | null {
  if (order.status === 'CANCELADO') {
    return order.paidAt
      ? { text: 'Se cobró con tarjeta después de cancelarse y ya no había stock: devuelve el dinero desde tu cuenta de Izipay', tone: 'bg-accent-50 text-accent-700' }
      : null;
  }
  if (order.status !== 'PENDIENTE') return null;
  if (order.hasReceipt) return { text: 'Envió su comprobante: revísalo y confirma el pago', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.paymentMethod) return { text: 'Coordinará el pago por WhatsApp', tone: 'bg-stone-100 text-stone-600' };
  return {
    text: `Aún no elige cómo pagar. Su stock está apartado${order.reservedUntil ? ` hasta las ${new Date(order.reservedUntil).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}` : ''}; después se cancela solo`,
    tone: 'bg-stone-100 text-stone-600',
  };
}

export default function OrdersPanel({ orders, onSetStatus, compact = false }: Props) {
  const [filter, setFilter] = useState<OrderStatus | 'TODOS'>(compact ? 'TODOS' : 'PENDIENTE');
  const [busy, setBusy] = useState<number | null>(null);

  const visible = filter === 'TODOS' ? orders : orders.filter((o) => o.status === filter);

  async function change(order: Order, status: OrderStatus, question: string) {
    if (!confirm(question)) return;
    setBusy(order.id);
    try {
      await onSetStatus(order.id, status);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const total = f === 'TODOS' ? orders.length : orders.filter((o) => o.status === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                    filter === f ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                  }`}
                >
                  {f === 'TODOS' ? 'Todos' : ORDER_STATUS_LABELS[f]} ({total})
                </button>
              );
            })}
          </div>
          <p className="text-xs text-stone-500">
            El stock se aparta cuando el cliente crea su pedido. Si lo cancelas (o nadie lo paga en 30 minutos), vuelve al inventario.
            Los pagos con tarjeta se confirman solos.
          </p>
        </>
      )}

      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center text-sm text-stone-500">
          No hay pedidos en esta lista.
        </p>
      )}

      <ul className="space-y-3" aria-label="Pedidos">
        {visible.map((order) => {
          const hint = hintFor(order);
          const next = NEXT_STEP[order.status];
          const canCancel = order.status !== 'CANCELADO' && order.status !== 'ENTREGADO';
          return (
            <li key={order.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-bold text-stone-900">{order.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ORDER_STATUS_STYLES[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                {order.paymentMethod === 'TARJETA' && order.paidAt && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    <CreditCard className="size-3" aria-hidden />
                    Cobrado con tarjeta
                  </span>
                )}
                <span className="text-xs text-stone-500">{formatDateTime(order.createdAt)}</span>
                <span className="ml-auto text-lg font-extrabold text-stone-900">{formatPrice(order.total)}</span>
              </div>

              {hint && <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${hint.tone}`}>{hint.text}</p>}

              <div className="mt-3 flex flex-wrap gap-4">
                {order.receiptUrl && (
                  // La captura es privada: el servidor solo la entrega con la sesión de administración
                  <a
                    href={apiAsset(order.receiptUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir el comprobante en grande"
                    className="group relative block h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
                  >
                    <img src={apiAsset(order.receiptUrl)} alt={`Comprobante del pedido ${order.code}`} className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-stone-900/80 py-1 text-[11px] font-semibold text-white">
                      <ReceiptText className="size-3" aria-hidden />
                      Ver captura
                    </span>
                  </a>
                )}

                <div className="min-w-0 flex-1 text-sm text-stone-700">
                  <p className="font-semibold text-stone-900">{order.customerName}</p>
                  <a
                    href={`https://wa.me/${STORE.countryCode}${order.customerPhone.replace(/^51(?=\d{9}$)/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 flex w-fit items-center gap-1 text-emerald-700 hover:underline"
                  >
                    <MessageCircle className="size-3.5" aria-hidden />
                    {order.customerPhone}
                  </a>
                  {order.customerEmail && <p className="text-stone-600">{order.customerEmail}</p>}
                  <p className="mt-1 text-stone-600">
                    {DELIVERY_LABELS[order.deliveryMethod]}
                    {order.address && ` — ${order.address}`}
                  </p>
                  <p className="text-stone-600">
                    Pago: {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] : 'sin elegir'}
                    {order.paymentRef && <span className="text-stone-400"> · ref. {order.paymentRef.slice(0, 12)}</span>}
                  </p>
                  {order.notes && <p className="text-stone-600">Nota: {order.notes}</p>}
                </div>
              </div>

              <ul className="mt-3 divide-y divide-stone-100 rounded-xl bg-stone-50 px-3 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 py-2">
                    <span className="text-stone-700">
                      {item.quantity} × {item.productName} <span className="text-stone-500">(talla {item.size})</span>
                    </span>
                    <span className="shrink-0 font-medium text-stone-900">{formatPrice(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>

              {(canCancel || next) && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {canCancel && (
                    <button
                      type="button"
                      disabled={busy === order.id}
                      onClick={() =>
                        change(
                          order,
                          'CANCELADO',
                          order.status === 'PENDIENTE'
                            ? `¿Cancelar el pedido ${order.code}? Su stock volverá al inventario.`
                            : `El pedido ${order.code} ya está pagado. Si lo cancelas, el stock vuelve al inventario y debes devolver el dinero al cliente. ¿Cancelar?`,
                        )
                      }
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-accent-600 hover:text-accent-600 disabled:opacity-50"
                    >
                      Cancelar pedido
                    </button>
                  )}
                  {next && (
                    <button
                      type="button"
                      disabled={busy === order.id}
                      onClick={() => change(order, next.to, next.question(order.code))}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {next.label}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
