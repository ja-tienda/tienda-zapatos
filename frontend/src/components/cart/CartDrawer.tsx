import { ArrowRight, ImageOff, Minus, Plus, ShoppingBag, Trash2, TriangleAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ROUTES } from '../../config/constants';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import type { CartItem } from '../../types';
import { formatPrice } from '../../utils/format';
import { lastOrder } from '../../utils/orderStore';
import { useEscapeKey, useLockBodyScroll } from '../modals/Modal';

/** Línea de producto con control de cantidad (limitado al stock real). También se usa en el checkout. */
export function CartLine({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const { setQuantity, removeItem } = useCart();

  return (
    <li className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3">
      <div className={`${compact ? 'size-16' : 'size-20'} shrink-0 overflow-hidden rounded-xl bg-stone-100`}>
        {item.image ? (
          <img src={item.image} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-stone-300">
            <ImageOff className="size-6" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-stone-900">{item.name}</p>
          <button
            type="button"
            onClick={() => removeItem(item.variantId)}
            aria-label={`Quitar ${item.name} talla ${item.size}`}
            className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-accent-600"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">
          Talla {item.size} · {formatPrice(item.price)} c/u
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center rounded-full border border-stone-200">
            <button
              type="button"
              onClick={() => setQuantity(item.variantId, item.quantity - 1)}
              aria-label="Restar uno"
              className="grid size-8 place-items-center rounded-full text-stone-700 hover:bg-stone-100"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-7 text-center text-sm font-bold" aria-label={`Cantidad: ${item.quantity}`}>
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(item.variantId, item.quantity + 1)}
              disabled={item.quantity >= item.maxStock}
              aria-label="Sumar uno"
              className="grid size-8 place-items-center rounded-full text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <p className="text-sm font-bold text-stone-900">{formatPrice(item.price * item.quantity)}</p>
        </div>
        {item.quantity >= item.maxStock && <p className="mt-1 text-xs text-amber-700">Stock máximo disponible: {item.maxStock}</p>}
      </div>
    </li>
  );
}

export function CartNotices() {
  const { cartNotices, dismissCartNotices } = useStore();
  if (cartNotices.length === 0) return null;
  return (
    <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <ul className="flex-1 space-y-1">
        {cartNotices.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <button type="button" onClick={dismissCartNotices} aria-label="Cerrar aviso" className="self-start">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Carrito lateral: revisar productos y continuar al checkout (datos, entrega y pago). */
export default function CartDrawer() {
  const { items, subtotal, count, closeCart } = useCart();
  const navigate = useNavigate();
  const myOrder = lastOrder();

  useLockBodyScroll();
  useEscapeKey(closeCart);

  return (
    <div
      className="fixed inset-0 z-40 animate-fade-in bg-stone-950/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeCart();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in flex-col bg-stone-50 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-medium text-stone-900">
            <ShoppingBag className="size-5" aria-hidden />
            Tu carrito
            {count > 0 && <span className="font-sans text-sm font-medium text-stone-500">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Cerrar carrito"
            className="grid size-9 place-items-center rounded-full text-stone-700 hover:bg-stone-100"
          >
            <X className="size-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <ShoppingBag className="size-12 text-stone-300" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 font-display text-xl font-medium text-stone-900">Tu carrito está vacío</p>
            <p className="mt-1 text-sm text-stone-500">Elige tu talla y agrega tus modelos favoritos.</p>
            <div className="mt-4 w-full">
              <CartNotices />
            </div>
            <button
              type="button"
              onClick={closeCart}
              className="mt-5 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
            >
              Seguir viendo
            </button>
            {myOrder && (
              <button
                type="button"
                onClick={() => {
                  closeCart();
                  navigate(ROUTES.order(myOrder.code));
                }}
                className="mt-4 text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900"
              >
                Ver mi pedido {myOrder.code}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <CartNotices />
              <ul className="space-y-3">
                {items.map((item) => (
                  <CartLine key={item.variantId} item={item} />
                ))}
              </ul>
            </div>

            <div className="border-t border-stone-200 bg-white p-4 sm:p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-600">Subtotal</span>
                <span className="text-2xl font-semibold text-stone-900">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-stone-500">El costo de envío se coordina por WhatsApp según tu destino.</p>
              <button
                type="button"
                onClick={() => {
                  closeCart();
                  navigate(ROUTES.checkout);
                }}
                className="group mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-600"
              >
                Continuar con la compra
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </button>
              <button type="button" onClick={closeCart} className="mt-2 w-full py-2 text-sm font-medium text-stone-600 hover:text-stone-900">
                Seguir viendo
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
