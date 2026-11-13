import { SearchX } from 'lucide-react';
import type { Product } from '../../types';
import Reveal from '../ui/Reveal';
import ProductCard from './ProductCard';

interface Props {
  products: Product[];
  loading: boolean;
  onOpen: (product: Product, variantId?: number) => void;
  onClearFilters: () => void;
}

const GRID = 'grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4';

export default function ProductGrid({ products, loading, onOpen, onClearFilters }: Props) {
  if (loading) {
    return (
      <div className={GRID} aria-busy="true" aria-label="Cargando catálogo">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white">
            <div className="aspect-[4/5] animate-pulse bg-stone-100" />
            <div className="space-y-2.5 p-5">
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-stone-100" />
              <div className="h-4 w-full animate-pulse rounded-full bg-stone-100" />
              <div className="h-5 w-1/3 animate-pulse rounded-full bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <SearchX className="mx-auto size-10 text-stone-300" strokeWidth={1.5} aria-hidden />
        <p className="mt-4 font-display text-xl font-medium text-stone-900">No encontramos modelos con esos filtros</p>
        <p className="mt-1 text-sm text-stone-500">Prueba con otra talla o categoría.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-6 rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
        >
          Ver todo el catálogo
        </button>
      </div>
    );
  }

  return (
    <div className={GRID}>
      {products.map((product, i) => (
        // El retraso crea una cascada por fila (hasta 4 columnas)
        <Reveal key={product.id} delay={(i % 4) * 70} className="flex">
          <ProductCard product={product} onOpen={onOpen} />
        </Reveal>
      ))}
    </div>
  );
}
