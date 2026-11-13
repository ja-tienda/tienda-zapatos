import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { GENDER_LABELS, SORT_OPTIONS } from '../../config/constants';
import type { CatalogParams } from '../../hooks/useCatalogParams';
import type { Gender, Section, SortOption } from '../../types';

interface Props {
  params: CatalogParams;
  onChange: (patch: Partial<CatalogParams>) => void;
  /** Géneros que existen entre los productos de esta vista */
  genders: Gender[];
  /** Tallas con stock entre los productos de esta vista */
  sizes: string[];
  /** Sub-filtro opcional: categorías (en una colección) o colecciones (en una categoría) */
  facet?: { label: string; param: 'category' | 'collection'; options: Section[] };
  resultCount: number;
  hasActiveFilters: boolean;
  onClear: () => void;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
      }`}
    >
      {children}
    </button>
  );
}

const row = 'no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0';
const rowLabel = 'shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-500';

export default function FilterBar({ params, onChange, genders, sizes, facet, resultCount, hasActiveFilters, onClear }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {genders.length > 1 && (
          <div className={row} role="group" aria-label="Género">
            <span className={rowLabel}>Para</span>
            <Chip active={params.gender === null} onClick={() => onChange({ gender: null })}>
              Todos
            </Chip>
            {genders.map((g) => (
              <Chip key={g} active={params.gender === g} onClick={() => onChange({ gender: params.gender === g ? null : g })}>
                {GENDER_LABELS[g]}
              </Chip>
            ))}
          </div>
        )}

        <label className="ml-auto flex items-center gap-2 text-sm text-stone-600">
          Ordenar por
          <select
            value={params.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortOption })}
            className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-900 focus:border-stone-900 focus:outline-none"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {facet && facet.options.length > 1 && (
        <div className={row} role="group" aria-label={facet.label}>
          <span className={rowLabel}>{facet.label}</span>
          <Chip active={params[facet.param] === null} onClick={() => onChange({ [facet.param]: null })}>
            Todas
          </Chip>
          {facet.options.map((option) => (
            <Chip
              key={option.id}
              active={params[facet.param] === option.slug}
              onClick={() => onChange({ [facet.param]: params[facet.param] === option.slug ? null : option.slug })}
            >
              {option.name}
            </Chip>
          ))}
        </div>
      )}

      {sizes.length > 1 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Busca tu talla en stock</p>
          <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap" role="group" aria-label="Talla">
            {sizes.map((size) => {
              const active = params.size === size;
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ size: active ? null : size })}
                  className={`h-10 min-w-10 shrink-0 rounded-lg border px-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-accent-600 bg-accent-600 text-white'
                      : 'border-stone-200 text-stone-700 hover:border-stone-900'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <p className="text-stone-500" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'modelo disponible' : 'modelos disponibles'}
        </p>
        {hasActiveFilters && (
          <button type="button" onClick={onClear} className="flex items-center gap-1 font-medium text-accent-600 hover:text-accent-700">
            <X className="size-3.5" aria-hidden />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
