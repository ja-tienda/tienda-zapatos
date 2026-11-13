import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { BADGE_LABELS, GENDER_LABELS } from '../../config/constants';
import { useTilt } from '../../hooks/useTilt';
import type { Badge, Product } from '../../types';
import { discountPercent, formatPrice, isOnSale, totalStock } from '../../utils/format';

interface Props {
  product: Product;
  /** Abre el detalle; si se pasa una talla, llega preseleccionada. */
  onOpen: (product: Product, variantId?: number) => void;
}

const BADGE_STYLES: Record<Badge, string> = {
  NUEVO: 'bg-white text-stone-900',
  OFERTA: 'bg-accent-600 text-white',
  ULTIMO_PAR: 'bg-stone-900 text-white',
};

export default function ProductCard({ product, onOpen }: Props) {
  const tiltRef = useTilt<HTMLElement>(5);
  // La segunda foto solo se descarga cuando alguien pasa el mouse (ahorra datos en celulares).
  const [showAlt, setShowAlt] = useState(false);
  const soldOut = totalStock(product) === 0;
  const discount = discountPercent(product);
  const altImage = product.images[1];

  return (
    <article
      ref={tiltRef}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setShowAlt(true);
      }}
      className="tilt group flex w-full flex-col overflow-hidden rounded-3xl border border-stone-200/70 bg-white hover:shadow-soft"
    >
      <button
        type="button"
        onClick={() => onOpen(product)}
        aria-label={`Ver detalle de ${product.name}`}
        className="relative block aspect-[4/5] overflow-hidden bg-stone-100"
      >
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className={`size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${soldOut ? 'opacity-50 grayscale' : ''}`}
          />
        ) : (
          <span className="grid size-full place-items-center text-stone-300">
            <ImageOff className="size-10" aria-hidden />
          </span>
        )}
        {showAlt && altImage && !soldOut && (
          <img
            src={altImage}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}

        <span className="absolute left-3 top-3">
          {soldOut ? (
            <span className="rounded-full bg-stone-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
              Agotado
            </span>
          ) : (
            product.badge && (
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider shadow-sm ${BADGE_STYLES[product.badge]}`}
              >
                {BADGE_LABELS[product.badge]}
              </span>
            )
          )}
        </span>
      </button>

      <div className="flex flex-1 flex-col p-3.5 sm:p-5">
        <p className="truncate text-[11px] uppercase tracking-[0.14em] text-stone-500">
          {[product.brand, product.category.name, GENDER_LABELS[product.gender]].filter(Boolean).join(' · ')}
        </p>
        <h3 className="mt-1.5 line-clamp-2 min-h-11 font-display text-base font-medium leading-snug text-stone-900 sm:text-lg sm:leading-snug">
          {product.name}
        </h3>

        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold text-stone-900 sm:text-lg">{formatPrice(product.price)}</span>
          {isOnSale(product) && (
            <>
              <span className="text-sm text-stone-400 line-through">{formatPrice(product.originalPrice!)}</span>
              {!soldOut && <span className="text-xs font-semibold text-accent-600">-{discount}%</span>}
            </>
          )}
        </p>

        <div className="mb-4 mt-3 flex flex-wrap gap-1" aria-label="Tallas">
          {product.variants.map((v) =>
            v.stock > 0 ? (
              <button
                key={v.id}
                type="button"
                onClick={() => onOpen(product, v.id)}
                title={`Elegir talla ${v.size}`}
                className="min-w-8 rounded-full border border-stone-200 px-2 py-1 text-xs font-medium text-stone-700 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-white"
              >
                {v.size}
              </button>
            ) : (
              <span
                key={v.id}
                title={`Talla ${v.size} agotada`}
                className="min-w-8 rounded-full border border-stone-100 px-2 py-1 text-center text-xs text-stone-300 line-through"
              >
                {v.size}
              </span>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpen(product)}
          className="mt-auto w-full rounded-full border border-stone-900 py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-900 hover:text-white group-hover:bg-stone-900 group-hover:text-white"
        >
          {soldOut ? 'Ver detalle' : 'Elegir talla'}
        </button>
      </div>
    </article>
  );
}
