import { ArrowLeft, ArrowRight, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { CartLine, CartNotices } from '../components/cart/CartDrawer';
import { DELIVERY_OPTIONS, ROUTES, STORAGE_KEYS } from '../config/constants';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiError, api } from '../services/api';
import type { CheckoutForm } from '../types';
import { formatPrice } from '../utils/format';
import { lastOrder, saveOrderToken } from '../utils/orderStore';

const EMPTY_FORM: CheckoutForm = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  deliveryMethod: 'DELIVERY_LOCAL',
  address: '',
  notes: '',
};

function loadForm(): CheckoutForm {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.checkout) ?? 'null');
    return saved && typeof saved === 'object' ? { ...EMPTY_FORM, ...saved, notes: '' } : EMPTY_FORM;
  } catch {
    return EMPTY_FORM;
  }
}

const inputClass =
  'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none';

/** Paso 1 de la compra: datos del cliente y de entrega. El pago se elige en la página del pedido. */
export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { reload } = useStore();
  const navigate = useNavigate();
  usePageTitle('Finalizar compra');
  const [form, setForm] = useState<CheckoutForm>(loadForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Recuerda nombre, teléfono y dirección para la próxima compra (solo en este dispositivo).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.checkout, JSON.stringify(form));
    } catch {
      /* sin almacenamiento */
    }
  }, [form]);

  const delivery = DELIVERY_OPTIONS.find((d) => d.value === form.deliveryMethod)!;
  const update = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(): boolean {
    const next: typeof errors = {};
    if (form.customerName.trim().length < 3) next.customerName = 'Ingresa tu nombre completo';
    if (!/^\d{9}$/.test(form.customerPhone.replace(/\s/g, ''))) next.customerPhone = 'Ingresa un celular de 9 dígitos';
    if (form.customerEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.customerEmail.trim())) next.customerEmail = 'Revisa tu correo';
    if (form.deliveryMethod !== 'RECOJO' && form.address.trim().length < 5) {
      next.address = form.deliveryMethod === 'ENVIO_PROVINCIA' ? 'Indica la agencia y ciudad de destino' : 'Indica tu dirección';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || items.length === 0) return;
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Si el cliente volvió para corregir algo, el pedido anterior sin pagar se descarta
      // (el servidor solo lo permite si aún no tiene pago ni comprobante).
      const previous = lastOrder();
      if (previous) await api.cancelOrder(previous.code, previous.token).catch(() => {});

      const { order, token } = await api.createOrder({
        ...form,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.replace(/\s/g, ''),
        customerEmail: form.customerEmail.trim(),
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      saveOrderToken(order.code, token);
      navigate(ROUTES.order(order.code));
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.');
      // 409 = cambió el stock: se refresca el catálogo y el carrito se ajusta solo
      if (err instanceof ApiError && err.status === 409) await reload();
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-medium text-stone-900">Tu carrito está vacío</h1>
        <p className="mt-3 text-stone-600">Agrega algún producto para continuar con tu compra.</p>
        <div className="mx-auto mt-5 max-w-md text-left">
          <CartNotices />
        </div>
        <Link
          to={ROUTES.catalog}
          className="mt-7 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
        >
          Ver el catálogo
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to={ROUTES.catalog} className="flex w-fit items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden />
        Seguir comprando
      </Link>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">Finalizar compra</h1>
      <p className="mt-2 text-sm text-stone-500">Paso 1 de 2 · Tus datos y la entrega. En el siguiente paso eliges cómo pagar.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <fieldset className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-7">
            <legend className="sr-only">Tus datos</legend>
            <h2 className="font-display text-2xl font-medium text-stone-900">Tus datos</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
                Nombre completo
                <input
                  type="text"
                  autoComplete="name"
                  value={form.customerName}
                  onChange={(e) => update('customerName', e.target.value)}
                  aria-invalid={!!errors.customerName}
                  className={`${inputClass} ${errors.customerName ? 'border-accent-600' : ''}`}
                />
                {errors.customerName && <span className="mt-1 block text-xs text-accent-600">{errors.customerName}</span>}
              </label>

              <label className="block text-sm font-medium text-stone-700">
                Celular / WhatsApp
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="9 dígitos"
                  maxLength={11}
                  value={form.customerPhone}
                  onChange={(e) => update('customerPhone', e.target.value.replace(/[^\d\s]/g, ''))}
                  aria-invalid={!!errors.customerPhone}
                  className={`${inputClass} ${errors.customerPhone ? 'border-accent-600' : ''}`}
                />
                {errors.customerPhone && <span className="mt-1 block text-xs text-accent-600">{errors.customerPhone}</span>}
              </label>

              <label className="block text-sm font-medium text-stone-700">
                Correo <span className="font-normal text-stone-400">(opcional)</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Necesario si pagas con tarjeta"
                  value={form.customerEmail}
                  onChange={(e) => update('customerEmail', e.target.value)}
                  aria-invalid={!!errors.customerEmail}
                  className={`${inputClass} ${errors.customerEmail ? 'border-accent-600' : ''}`}
                />
                {errors.customerEmail && <span className="mt-1 block text-xs text-accent-600">{errors.customerEmail}</span>}
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-7">
            <legend className="sr-only">Entrega</legend>
            <h2 className="font-display text-2xl font-medium text-stone-900">Entrega</h2>

            <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Modalidad de entrega">
              {DELIVERY_OPTIONS.map((option) => {
                const selected = form.deliveryMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update('deliveryMethod', option.value)}
                    className={`rounded-2xl border p-3.5 text-left text-sm font-medium transition-colors ${
                      selected ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block text-sm font-medium text-stone-700">
              {delivery.addressLabel}
              <input
                type="text"
                autoComplete="street-address"
                placeholder={delivery.placeholder}
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                aria-invalid={!!errors.address}
                className={`${inputClass} ${errors.address ? 'border-accent-600' : ''}`}
              />
              {errors.address && <span className="mt-1 block text-xs text-accent-600">{errors.address}</span>}
            </label>

            <label className="mt-4 block text-sm font-medium text-stone-700">
              Nota para tu pedido <span className="font-normal text-stone-400">(opcional)</span>
              <input
                type="text"
                maxLength={300}
                placeholder="Ej. entregar después de las 5 pm"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                className={inputClass}
              />
            </label>
          </fieldset>
        </div>

        <aside className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6 lg:sticky lg:top-36">
          <h2 className="font-display text-2xl font-medium text-stone-900">Tu pedido</h2>
          <div className="mt-4 space-y-3">
            <CartNotices />
            <ul className="space-y-3">
              {items.map((item) => (
                <CartLine key={item.variantId} item={item} compact />
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-baseline justify-between border-t border-stone-200 pt-4">
            <span className="text-sm text-stone-600">Total</span>
            <span className="text-2xl font-semibold text-stone-900">{formatPrice(subtotal)}</span>
          </div>
          <p className="text-xs text-stone-500">El costo de envío se coordina por WhatsApp según tu destino.</p>

          {submitError && (
            <p className="mt-4 flex gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700" role="alert">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="group mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {submitting ? 'Creando tu pedido…' : 'Continuar al pago'}
            {!submitting && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-stone-500">
            <ShieldCheck className="size-3.5" aria-hidden />
            Aún no se cobra nada: primero verás las formas de pago.
          </p>
        </aside>
      </form>
    </section>
  );
}
