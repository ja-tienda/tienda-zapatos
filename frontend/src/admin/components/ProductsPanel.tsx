import { ChevronDown, Eye, EyeOff, ImageOff, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { GENDER_LABELS } from '../../config/constants';
import type { AdminSummary, Product } from '../../types';
import { formatPrice, isOnSale, normalizeText, totalStock } from '../../utils/format';
import StockEditor, { type StockActions } from './StockEditor';

interface Props {
  products: Product[];
  summary: AdminSummary | null;
  stockActions: StockActions;
  /** Producto cuyo editor de tallas se abre al entrar (p. ej. el recién creado). */
  initialExpandedId: number | null;
  onNew: () => void;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export default function ProductsPanel({
  products,
  summary,
  stockActions,
  initialExpandedId,
  onNew,
  onEdit,
  onToggleActive,
  onDelete,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(initialExpandedId);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? products.filter((p) => normalizeText(`${p.name} ${p.brand ?? ''}`).includes(normalizeText(query.trim())))
    : products;

  return (
    <div className="space-y-4">
      {summary && (
        <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            { label: 'Productos visibles', value: `${summary.activeProducts} / ${summary.products}` },
            { label: 'Pedidos pendientes', value: summary.pendingOrders },
            { label: 'Tallas con 1 unidad', value: summary.lowStock },
            { label: 'Tallas agotadas', value: summary.outOfStock },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-stone-200 bg-white px-2 py-3">
              <dd className="text-xl font-extrabold text-stone-900">{s.value}</dd>
              <dt className="text-xs text-stone-500">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm focus:border-stone-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
        >
          <Plus className="size-4" aria-hidden />
          Nuevo producto
        </button>
      </div>

      <ul className="space-y-3" aria-label="Productos">
        {filtered.map((product) => {
          const expanded = expandedId === product.id;
          const stock = totalStock(product);
          return (
            <li
              key={product.id}
              className={`overflow-hidden rounded-2xl border bg-white ${product.isActive ? 'border-stone-200' : 'border-dashed border-stone-300'}`}
            >
              <div className="flex flex-wrap items-center gap-3 p-3">
                <div className={`size-14 shrink-0 overflow-hidden rounded-xl bg-stone-100 ${product.isActive ? '' : 'opacity-50'}`}>
                  {product.images[0] ? (
                    <img src={product.images[0]} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-stone-300">
                      <ImageOff className="size-5" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                    {product.featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Destacado" />}
                    <span className="truncate">{product.name}</span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {product.category.name} · {GENDER_LABELS[product.gender]} · {formatPrice(product.price)}
                    {isOnSale(product) && <span className="line-through"> {formatPrice(product.originalPrice!)}</span>}
                    {' · '}
                    <span className={stock === 0 ? 'font-semibold text-accent-600' : ''}>{stock} en stock</span>
                    {!product.isActive && <span className="font-semibold text-stone-700"> · Oculto</span>}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : product.id)}
                    aria-expanded={expanded}
                    className="flex items-center gap-1 rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-900"
                  >
                    Tallas y stock
                    <ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    title="Editar producto"
                    aria-label={`Editar ${product.name}`}
                    className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleActive(product)}
                    title={product.isActive ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
                    aria-label={product.isActive ? `Ocultar ${product.name}` : `Mostrar ${product.name}`}
                    className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100"
                  >
                    {product.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(product)}
                    title="Eliminar producto"
                    aria-label={`Eliminar ${product.name}`}
                    className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-accent-50 hover:text-accent-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              {expanded && <StockEditor product={product} actions={stockActions} />}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && <p className="py-8 text-center text-sm text-stone-500">No hay productos que coincidan.</p>}
    </div>
  );
}
