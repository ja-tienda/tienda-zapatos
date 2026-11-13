import { Check, CircleCheck, CircleX, Clock, CreditCard, LoaderCircle, MessageCircle, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import CardPayment from '../components/checkout/CardPayment';
import WalletPayment from '../components/checkout/WalletPayment';
import { DELIVERY_LABELS, PAYMENT_LABELS, ROUTES } from '../config/constants';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiError, api } from '../services/api';
import type { Order } from '../types';
import { buildOrderMessage, formatPrice, whatsappUrl } from '../utils/format';
import { getOrderToken } from '../utils/orderStore';

type Method = 'wallet' | 'card' | 'manual';

/** Cada cuánto se consulta si la administradora ya confirmó el pago. */
const POLL_MS = 20_000;

function MethodCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  badge,
  disabled = false,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border bg-white transition-colors ${
        selected ? 'border-stone-900' : 'border-stone-200/80'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onSelect}
        className="flex w-full items-center gap-4 p-5 text-left disabled:cursor-not-allowed"
      >
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${selected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-semibold text-stone-900">
            {title}
            {badge && (
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-600">{badge}</span>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-stone-500">{description}</span>
        </span>
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300'}`}
          aria-hidden
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>
      {selected && children && <div className="border-t border-stone-200 p-5 sm:p-6">{children}</div>}
    </div>
  );
}

function StatusPanel({ tone, icon, title, children }: { tone: 'ok' | 'wait' | 'off'; icon: ReactNode; title: string; children: ReactNode }) {
  const tones = { ok: 'text-emerald-600', wait: 'text-amber-600', off: 'text-stone-400' };
  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white p-6 text-center sm:p-10">
      <span className={`mx-auto block w-fit ${tones[tone]}`}>{icon}</span>
      <h2 className="mt-4 font-display text-3xl font-medium text-stone-900">{title}</h2>
      <div className="mx-auto mt-3 max-w-md space-y-4 text-stone-600">{children}</div>
    </div>
  );
}

/** Paso 2 de la compra: elegir cómo pagar, pagar y seguir el estado del pedido. */
export default function OrderPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { settings } = useStore();
  const { clearCart } = useCart();
  const orderToken = getOrderToken(code);
  usePageTitle(`Pedido ${code.toUpperCase()}`);

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>('wallet');
  const [resend, setResend] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderToken) return;
    try {
      setOrder(await api.getOrder(code, orderToken));
      setError(null);
    } catch (err) {
      // Un fallo de red al refrescar no debe borrar lo que ya se ve
      setOrder((current) => {
        if (!current) setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu pedido');
        return current;
      });
    }
  }, [code, orderToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mientras el pedido espera confirmación se consulta de vez en cuando
  const waiting = order?.status === 'PENDIENTE';
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  if (!orderToken || error) {
    return (
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-medium text-stone-900">No encontramos este pedido</h1>
        <p className="mt-3 text-stone-600">
          {error ?? 'Por seguridad, un pedido solo se puede ver y pagar desde el mismo dispositivo donde se creó.'}
        </p>
        <Link
          to={ROUTES.home}
          className="mt-7 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
        >
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (!order) {
    return (
      <p className="flex items-center justify-center gap-2 py-32 text-sm text-stone-500" aria-busy="true">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Cargando tu pedido…
      </p>
    );
  }

  const whatsapp = whatsappUrl(settings.contactPhone, buildOrderMessage(order, settings));
  const whatsappButton = (label: string) => (
    <a
      href={whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
    >
      <MessageCircle className="size-4" aria-hidden />
      {label}
    </a>
  );

  /** El pedido ya quedó registrado con su forma de pago: el carrito cumplió su función. */
  function completed(updated: Order) {
    setOrder(updated);
    setResend(false);
    clearCart();
  }

  async function editOrder() {
    setBusy(true);
    // Se descarta este pedido (aún sin pago) y se vuelve al paso anterior con el carrito intacto
    await api.cancelOrder(order!.code, orderToken!).catch(() => {});
    navigate(ROUTES.checkout);
  }

  async function coordinateByWhatsApp(paymentMethod: 'TRANSFERENCIA' | 'CONTRA_ENTREGA') {
    // La pestaña se abre ANTES de llamar al servidor: después el navegador la bloquearía.
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const updated = await api.setManualMethod(order!.code, orderToken!, paymentMethod);
      const url = whatsappUrl(settings.contactPhone, buildOrderMessage(updated, settings));
      if (tab) tab.location.href = url;
      completed(updated);
    } catch {
      tab?.close();
    } finally {
      setBusy(false);
    }
  }

  const choosingPayment = order.status === 'PENDIENTE' && !order.paidAt && (!order.paymentMethod || resend);
  const contact = settings.contactName;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
        {choosingPayment ? 'Paso 2 de 2 · Pago' : 'Tu pedido'}
      </p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">Pedido {order.code}</h1>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {order.status === 'CONFIRMADO' ? (
            <StatusPanel tone="ok" icon={<CircleCheck className="size-14" strokeWidth={1.5} />} title="¡Pago confirmado!">
              <p>
                Tu pedido está confirmado. {contact} te escribirá por WhatsApp para coordinar la entrega
                {order.deliveryMethod === 'ENVIO_PROVINCIA' ? ' y enviarte tu código de envío' : ''}.
              </p>
              {whatsappButton(`Escribir a ${contact}`)}
            </StatusPanel>
          ) : order.status === 'CANCELADO' ? (
            <StatusPanel tone="off" icon={<CircleX className="size-14" strokeWidth={1.5} />} title="Pedido cancelado">
              <p>Este pedido fue cancelado. Si crees que es un error, escríbenos por WhatsApp.</p>
              <Link
                to={ROUTES.catalog}
                className="inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
              >
                Volver al catálogo
              </Link>
            </StatusPanel>
          ) : order.paidAt ? (
            <StatusPanel tone="ok" icon={<CircleCheck className="size-14" strokeWidth={1.5} />} title="Recibimos tu pago">
              <p>Tu pago con tarjeta fue aprobado. {contact} revisará tu pedido y te escribirá para coordinar la entrega.</p>
              {whatsappButton(`Escribir a ${contact}`)}
            </StatusPanel>
          ) : !choosingPayment && order.receiptUrl ? (
            <StatusPanel tone="wait" icon={<Clock className="size-14" strokeWidth={1.5} />} title="Comprobante recibido">
              <p>
                {contact} verificará tu pago y confirmará tu pedido. Esta página se actualiza sola cuando eso ocurra.
              </p>
              <p className="text-sm">Para que lo revise más rápido, avísale por WhatsApp: el mensaje ya incluye tu pedido y el enlace a tu comprobante.</p>
              <div className="flex flex-col items-center gap-3">
                {whatsappButton(`Avisar a ${contact} por WhatsApp`)}
                <button type="button" onClick={() => setResend(true)} className="text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900">
                  Enviar otra captura o cambiar forma de pago
                </button>
              </div>
            </StatusPanel>
          ) : !choosingPayment ? (
            <StatusPanel tone="wait" icon={<Clock className="size-14" strokeWidth={1.5} />} title="Pedido registrado">
              <p>
                Elegiste <strong className="text-stone-900">{PAYMENT_LABELS[order.paymentMethod!].toLowerCase()}</strong>. Coordina el
                pago y la entrega con {contact} por WhatsApp.
              </p>
              <div className="flex flex-col items-center gap-3">
                {whatsappButton(`Abrir WhatsApp con ${contact}`)}
                <button type="button" onClick={() => setResend(true)} className="text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900">
                  Prefiero pagar ahora con Yape, Plin o tarjeta
                </button>
              </div>
            </StatusPanel>
          ) : (
            <>
              <h2 className="font-display text-2xl font-medium text-stone-900">Elige cómo pagar</h2>
              <div className="space-y-3" role="radiogroup" aria-label="Forma de pago">
                <MethodCard
                  selected={method === 'wallet'}
                  onSelect={() => setMethod('wallet')}
                  icon={<Smartphone className="size-5" />}
                  title="Yape o Plin"
                  description="Pagas desde tu app y subes la captura. Lo confirmamos en minutos."
                >
                  <WalletPayment order={order} orderToken={orderToken} onSent={completed} />
                </MethodCard>

                <MethodCard
                  selected={method === 'card'}
                  onSelect={() => setMethod('card')}
                  disabled={!settings.cardPaymentsEnabled}
                  badge={settings.cardPaymentsEnabled ? undefined : 'Próximamente'}
                  icon={<CreditCard className="size-5" />}
                  title="Tarjeta de crédito o débito"
                  description="Pago en línea con Izipay. Confirmación inmediata, sin enviar capturas."
                >
                  <CardPayment order={order} orderToken={orderToken} onPaid={completed} />
                </MethodCard>

                <MethodCard
                  selected={method === 'manual'}
                  onSelect={() => setMethod('manual')}
                  icon={<MessageCircle className="size-5" />}
                  title="Coordinar por WhatsApp"
                  description="Transferencia bancaria o pago contra entrega (según tu zona)."
                >
                  <p className="text-sm text-stone-600">
                    Se abrirá WhatsApp con el detalle de tu pedido para que {contact} te indique los siguientes pasos.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => coordinateByWhatsApp('TRANSFERENCIA')}
                      className="rounded-full border border-stone-900 px-4 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-900 hover:text-white disabled:opacity-60"
                    >
                      Transferencia bancaria
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => coordinateByWhatsApp('CONTRA_ENTREGA')}
                      className="rounded-full border border-stone-900 px-4 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-900 hover:text-white disabled:opacity-60"
                    >
                      Pago contra entrega
                    </button>
                  </div>
                </MethodCard>
              </div>

              {!order.paymentMethod && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={editOrder}
                  className="text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900 disabled:opacity-60"
                >
                  Volver y editar mi pedido
                </button>
              )}
            </>
          )}
        </div>

        <aside className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6 lg:sticky lg:top-36">
          <h2 className="font-display text-2xl font-medium text-stone-900">Resumen</h2>
          <ul className="mt-4 divide-y divide-stone-100 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2.5">
                <span className="text-stone-700">
                  {item.quantity} × {item.productName}
                  <span className="block text-xs text-stone-500">Talla {item.size}</span>
                </span>
                <span className="shrink-0 font-medium text-stone-900">{formatPrice(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-stone-200 pt-4">
            <span className="text-sm text-stone-600">Total</span>
            <span className="text-2xl font-semibold text-stone-900">{formatPrice(order.total)}</span>
          </div>
          <dl className="mt-4 space-y-1.5 border-t border-stone-200 pt-4 text-sm text-stone-600">
            <div>
              <dt className="inline text-stone-500">Cliente: </dt>
              <dd className="inline">{order.customerName}</dd>
            </div>
            <div>
              <dt className="inline text-stone-500">Entrega: </dt>
              <dd className="inline">
                {DELIVERY_LABELS[order.deliveryMethod]}
                {order.address && ` — ${order.address}`}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-stone-500">¿Dudas con tu pago? Escríbenos por WhatsApp con tu código de pedido.</p>
        </aside>
      </div>
    </section>
  );
}
