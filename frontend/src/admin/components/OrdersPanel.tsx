import { CreditCard, MessageCircle, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { DELIVERY_LABELS, ORDER_STATUS_LABELS, PAYMENT_LABELS, STORE } from '../../config/constants';
import type { Order, OrderStatus } from '../../types';
import { formatDateTime, formatPrice } from '../../utils/format';

interface Props {
  orders: Order[];
  onSetStatus: (orderId: number, status: OrderStatus) => Promise<void>;
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  CONFIRMADO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-stone-200 text-stone-600',
};

const FILTERS: (OrderStatus | 'TODOS')[] = ['PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'TODOS'];

/** Qué falta para cerrar un pedido pendiente, en palabras de la administradora. */
function pendingHint(order: Order): { text: string; tone: string } | null {
  if (order.status !== 'PENDIENTE') return null;
  if (order.paidAt) return { text: 'Pagado con tarjeta, pero faltó stock al cobrar: revisa las tallas y confírmalo o coordina con el cliente', tone: 'bg-accent-50 text-accent-700' };
  if (order.receiptUrl) return { text: 'Envió su comprobante: revísalo y confirma el pago', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.paymentMethod) return { text: 'Coordinará el pago por WhatsApp', tone: 'bg-stone-100 text-stone-600' };
  return { text: 'Aún no eligió cómo pagar (puede haber abandonado la compra)', tone: 'bg-stone-100 text-stone-600' };
}

export default function OrdersPanel({ orders, onSetStatus }: Props) {
  const [filter, setFilter] = useState<OrderStatus | 'TODOS'>('PENDIENTE');
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
        El stock se descuenta cuando confirmas el pago (los pagos con tarjeta se confirman solos). Si cancelas un pedido ya
        confirmado, el stock vuelve al inventario.
      </p>

      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center text-sm text-stone-500">
          No hay pedidos en esta lista.
        </p>
      )}

      <ul className="space-y-3" aria-label="Pedidos">
        {visible.map((order) => {
          const hint = pendingHint(order);
          return (
            <li key={order.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-bold text-stone-900">{order.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                {order.paidAt && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    <CreditCard className="size-3" aria-hidden />
                    Pagado con tarjeta
                  </span>
                )}
                <span className="text-xs text-stone-500">{formatDateTime(order.createdAt)}</span>
                <span className="ml-auto text-lg font-extrabold text-stone-900">{formatPrice(order.total)}</span>
              </div>

              {hint && <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${hint.tone}`}>{hint.text}</p>}

              <div className="mt-3 flex flex-wrap gap-4">
                {order.receiptUrl && (
                  <a
                    href={order.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir el comprobante en grande"
                    className="group relative block h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
                  >
                    <img src={order.receiptUrl} alt={`Comprobante del pedido ${order.code}`} className="size-full object-cover" />
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

              {order.status !== 'CANCELADO' && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy === order.id}
                    onClick={() =>
                      change(
                        order,
                        'CANCELADO',
                        order.paidAt
                          ? `El pedido ${order.code} ya fue pagado con tarjeta. Si lo cancelas, recuerda devolver el dinero desde tu cuenta de Izipay. ¿Cancelar?`
                          : order.status === 'CONFIRMADO'
                            ? `¿Cancelar el pedido ${order.code}? El stock volverá al inventario.`
                            : `¿Cancelar el pedido ${order.code}?`,
                      )
                    }
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-accent-600 hover:text-accent-600 disabled:opacity-50"
                  >
                    Cancelar pedido
                  </button>
                  {order.status === 'PENDIENTE' && (
                    <button
                      type="button"
                      disabled={busy === order.id}
                      onClick={() => change(order, 'CONFIRMADO', `¿Confirmar el pago del pedido ${order.code}? Se descontará el stock.`)}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Confirmar pago
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
