import { Check, Flame, ImageOff, Ruler, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BADGE_LABELS, GENDER_LABELS } from '../../config/constants';
import { useCart } from '../../context/CartContext';
import type { Product } from '../../types';
import { discountPercent, formatPrice, isOnSale } from '../../utils/format';
import Modal from './Modal';

interface Props {
  /** Siempre la versión más reciente del producto (se actualiza con el catálogo). */
  product: Product;
  initialVariantId?: number;
  onClose: () => void;
  onOpenSizeGuide: () => void;
}

export default function ProductDetailModal({ product, initialVariantId, onClose, onOpenSizeGuide }: Props) {
  const { addItem, openCart, quantityOf } = useCart();
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(() => {
    const available = product.variants.filter((v) => v.stock > 0);
    if (initialVariantId && available.some((v) => v.id === initialVariantId)) return initialVariantId;
    // Talla única: se elige sola para no pedir un clic innecesario
    return product.variants.length === 1 && available.length === 1 ? available[0].id : null;
  });
  const [sizeError, setSizeError] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;

  // Si la talla elegida se agota mientras el modal está abierto, se deselecciona.
  useEffect(() => {
    if (variant && variant.stock <= 0) setVariantId(null);
  }, [variant]);

  const inCart = variant ? quantityOf(variant.id) : 0;
  const remaining = variant ? variant.stock - inCart : 0;
  const soldOut = product.variants.every((v) => v.stock <= 0);
  const isShoe = product.category.sizeType === 'CALZADO';

  function handleAdd() {
    if (!variant) {
      setSizeError(true);
      return;
    }
    const result = addItem(product, variant);
    setFeedback(
      result.ok
        ? { ok: true, text: `Agregado: talla ${variant.size}` }
        : { ok: false, text: result.message ?? 'No se pudo agregar' },
    );
  }

  return (
    <Modal title={product.name} onClose={onClose} size="max-w-4xl" hideTitle>
      <div className="grid md:grid-cols-2">
        {/* Galería */}
        <div className="bg-stone-100 p-3 sm:p-4">
          <div className="aspect-square overflow-hidden rounded-2xl bg-stone-200">
            {product.images[imageIndex] ? (
              <img src={product.images[imageIndex]} alt={`${product.name}, vista ${imageIndex + 1}`} className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-stone-400">
                <ImageOff className="size-12" aria-hidden />
              </span>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {product.images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-pressed={i === imageIndex}
                  className={`size-16 overflow-hidden rounded-xl border-2 ${
                    i === imageIndex ? 'border-stone-900' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Información */}
        <div className="flex flex-col p-5 sm:p-7">
          <p className="pr-10 text-[11px] uppercase tracking-[0.14em] text-stone-500">
            {[product.brand, product.category.name, GENDER_LABELS[product.gender]].filter(Boolean).join(' · ')}
          </p>
          <h2 className="mt-1.5 font-display text-3xl font-medium leading-tight text-stone-900">{product.name}</h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-stone-900">{formatPrice(product.price)}</span>
            {isOnSale(product) && (
              <>
                <span className="text-base text-stone-400 line-through">{formatPrice(product.originalPrice!)}</span>
                <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-bold text-accent-700">
                  -{discountPercent(product)}%
                </span>
              </>
            )}
            {product.badge && product.badge !== 'OFERTA' && (
              <span className="rounded-full bg-stone-900 px-2 py-0.5 text-xs font-bold text-white">
                {BADGE_LABELS[product.badge]}
              </span>
            )}
          </div>

          {product.description && <p className="mt-4 text-sm leading-relaxed text-stone-600">{product.description}</p>}

          {/* Selector de talla */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-semibold ${sizeError && !variant ? 'text-accent-600' : 'text-stone-900'}`}>
                {sizeError && !variant ? 'Elige una talla para continuar' : 'Elige tu talla'}
              </p>
              {isShoe && (
                <button
                  type="button"
                  onClick={onOpenSizeGuide}
                  className="flex items-center gap-1 text-xs font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
                >
                  <Ruler className="size-3.5" aria-hidden />
                  Guía de tallas
                </button>
              )}
            </div>

            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Talla">
              {product.variants.map((v) => {
                const disabled = v.stock <= 0;
                const selected = v.id === variantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => {
                      setVariantId(v.id);
                      setSizeError(false);
                      setFeedback(null);
                    }}
                    className={`rounded-xl border px-1 py-2 text-center transition-colors ${
                      disabled
                        ? 'cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300'
                        : selected
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : sizeError
                            ? 'border-accent-500 text-stone-900 hover:border-stone-900'
                            : 'border-stone-200 text-stone-900 hover:border-stone-900'
                    }`}
                  >
                    <span className={`block text-sm font-bold ${disabled ? 'line-through' : ''}`}>{v.size}</span>
                    {v.usSize && (
                      <span className={`block text-[10px] leading-tight ${selected ? 'text-stone-300' : disabled ? '' : 'text-stone-500'}`}>
                        US {v.usSize}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {variant && (variant.usSize || variant.cmSize) && (
              <p className="mt-2 text-xs text-stone-500">
                Talla {variant.size}
                {variant.usSize && ` · US ${variant.usSize}`}
                {variant.cmSize && ` · plantilla de ${variant.cmSize} cm`}
              </p>
            )}

            {variant && variant.stock === 1 && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                <Flame className="size-4 shrink-0" aria-hidden />
                ¡Solo queda 1 disponible en esta talla!
              </p>
            )}
            {variant && variant.stock > 1 && variant.stock <= 3 && (
              <p className="mt-3 text-sm font-medium text-amber-700">Quedan solo {variant.stock} en esta talla.</p>
            )}
          </div>

          <div className="mt-6 space-y-2 md:mt-auto md:pt-6">
            <button
              type="button"
              onClick={handleAdd}
              disabled={soldOut || (variant !== null && remaining <= 0)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 py-3.5 text-sm font-bold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <ShoppingBag className="size-4" aria-hidden />
              {soldOut
                ? 'Agotado'
                : variant && remaining <= 0
                  ? 'Ya tienes todo el stock en tu carrito'
                  : 'Agregar al carrito'}
            </button>

            <div aria-live="polite">
              {feedback && (
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                    feedback.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {feedback.ok && <Check className="size-4" aria-hidden />}
                    {feedback.text}
                  </span>
                  {feedback.ok && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        openCart();
                      }}
                      className="shrink-0 font-bold underline underline-offset-2"
                    >
                      Ver carrito
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
