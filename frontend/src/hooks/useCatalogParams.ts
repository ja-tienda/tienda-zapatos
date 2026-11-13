import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { GENDERS } from '../config/constants';
import type { Gender, SortOption } from '../types';

export interface CatalogParams {
  /** Texto del buscador */
  q: string;
  gender: Gender | null;
  size: string | null;
  sort: SortOption;
  /** slug de una categoría (filtro dentro de una colección) */
  category: string | null;
  /** slug de una colección (filtro dentro de una categoría) */
  collection: string | null;
}

const KEYS: Record<keyof CatalogParams, string> = {
  q: 'q',
  gender: 'genero',
  size: 'talla',
  sort: 'orden',
  category: 'categoria',
  collection: 'coleccion',
};

const SORTS: SortOption[] = ['DESTACADOS', 'PRECIO_ASC', 'PRECIO_DESC'];

/**
 * Los filtros del catálogo viven en la dirección (?genero=DAMA&talla=38), así un enlace
 * compartido abre exactamente la misma vista y el botón "atrás" funciona como se espera.
 */
export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<CatalogParams>(() => {
    const gender = searchParams.get(KEYS.gender)?.toUpperCase() as Gender | undefined;
    const sort = searchParams.get(KEYS.sort)?.toUpperCase() as SortOption | undefined;
    return {
      q: searchParams.get(KEYS.q) ?? '',
      gender: gender && GENDERS.includes(gender) ? gender : null,
      size: searchParams.get(KEYS.size),
      sort: sort && SORTS.includes(sort) ? sort : 'DESTACADOS',
      category: searchParams.get(KEYS.category),
      collection: searchParams.get(KEYS.collection),
    };
  }, [searchParams]);

  const setParams = useCallback(
    (patch: Partial<CatalogParams>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(patch)) {
            const key = KEYS[name as keyof CatalogParams];
            if (value === null || value === '' || value === 'DESTACADOS') next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  const clear = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams();
        const sort = current.get(KEYS.sort);
        if (sort) next.set(KEYS.sort, sort);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setSearchParams]);

  const hasActiveFilters = Boolean(params.q || params.gender || params.size || params.category || params.collection);

  return { params, setParams, clear, hasActiveFilters };
}
