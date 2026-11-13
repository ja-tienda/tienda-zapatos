import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { GENDERS } from '../../config/constants';
import { useStore } from '../../context/StoreContext';
import { useCatalogParams } from '../../hooks/useCatalogParams';
import type { Product, Section } from '../../types';
import { compareSizes, normalizeText, totalStock } from '../../utils/format';
import FilterBar from './FilterBar';
import ProductGrid from './ProductGrid';

interface Props {
  /** Productos de esta vista (todos, los de una categoría, los de una temporada, las ofertas…) */
  products: Product[];
  /** Sub-filtro que tiene sentido en esta vista */
  facet?: { label: string; param: 'category' | 'collection'; options: Section[] };
}

/** Filtros + grilla de productos. Se usa igual en el inicio y en cada página de sección. */
export default function Catalog({ products, facet }: Props) {
  const { loading, loadError, reload, openProduct, collections } = useStore();
  const { params, setParams, clear, hasActiveFilters } = useCatalogParams();

  const { visible, genders, sizes } = useMemo(() => {
    const term = normalizeText(params.q.trim());
    const collectionId = params.collection ? collections.find((c) => c.slug === params.collection)?.id : undefined;

    // Todo menos la talla: de aquí salen las tallas que se ofrecen como filtro
    const beforeSize = products.filter((p) => {
      if (term && !normalizeText(`${p.name} ${p.brand ?? ''} ${p.description} ${p.category.name}`).includes(term)) return false;
      if (params.gender && p.gender !== params.gender) return false;
      if (params.category && p.category.slug !== params.category) return false;
      if (params.collection && (collectionId === undefined || !p.collectionIds.includes(collectionId))) return false;
      return true;
    });

    const sizeSet = new Set<string>();
    for (const p of beforeSize) for (const v of p.variants) if (v.stock > 0) sizeSet.add(v.size);

    const list = params.size
      ? beforeSize.filter((p) => p.variants.some((v) => v.size === params.size && v.stock > 0))
      : beforeSize;

    const soldOutLast = (a: Product, b: Product) => Number(totalStock(a) === 0) - Number(totalStock(b) === 0);
    const sorted =
      params.sort === 'PRECIO_ASC'
        ? [...list].sort((a, b) => a.price - b.price)
        : params.sort === 'PRECIO_DESC'
          ? [...list].sort((a, b) => b.price - a.price)
          : // "Destacados": el servidor ya los envía destacados primero; lo agotado va al final.
            [...list].sort(soldOutLast);

    return {
      visible: sorted,
      genders: GENDERS.filter((g) => products.some((p) => p.gender === g)),
      sizes: [...sizeSet].sort(compareSizes),
    };
  }, [products, params, collections]);

  return (
    <div>
      <FilterBar
        params={params}
        onChange={setParams}
        genders={genders}
        sizes={sizes}
        facet={facet}
        resultCount={visible.length}
        hasActiveFilters={hasActiveFilters}
        onClear={clear}
      />

      {loadError && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          <p className="flex-1">
            {products.length > 0 ? 'No pudimos actualizar el stock. Puede que veas datos de hace unos minutos.' : loadError}
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className="flex items-center gap-1.5 rounded-full bg-amber-900 px-4 py-2 font-semibold text-white hover:bg-amber-800"
          >
            <RefreshCw className="size-4" aria-hidden />
            Reintentar
          </button>
        </div>
      )}

      <div className="mt-6">
        {!(loadError && products.length === 0 && !loading) && (
          <ProductGrid products={visible} loading={loading} onOpen={openProduct} onClearFilters={clear} />
        )}
      </div>
    </div>
  );
}
