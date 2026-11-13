import { Eye, EyeOff, Minus, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { SIZE_PRESETS } from '../../config/constants';
import type { Product } from '../../types';

export interface StockActions {
  changeStock: (variantId: number, delta: number) => Promise<void>;
  setStock: (variantId: number, stock: number) => Promise<void>;
  toggleVariant: (variantId: number, isActive: boolean) => Promise<void>;
  deleteVariant: (variantId: number) => Promise<void>;
  addVariant: (productId: number, size: string) => Promise<void>;
}

interface Props {
  product: Product;
  actions: StockActions;
}

/** Gestión rápida: cada clic en + / − / ojo se guarda al instante en la base de datos. */
export default function StockEditor({ product, actions }: Props) {
  const [newSize, setNewSize] = useState('');
  const [busy, setBusy] = useState<number | 'new' | null>(null);

  const existing = new Set(product.variants.map((v) => v.size.toLowerCase()));
  const presets = SIZE_PRESETS[product.category.sizeType];
  const missing = presets.filter((s) => !existing.has(s.toLowerCase()));

  async function run(key: number | 'new', fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const size = newSize.trim();
    if (!size) return;
    void run('new', async () => {
      await actions.addVariant(product.id, size);
      setNewSize('');
    });
  }

  return (
    <div className="space-y-3 border-t border-stone-200 bg-stone-50 p-3 sm:p-4">
      {product.variants.length === 0 && <p className="text-sm text-stone-500">Este producto aún no tiene tallas.</p>}

      <ul className="grid gap-2 sm:grid-cols-2">
        {product.variants.map((v) => (
          <li
            key={v.id}
            className={`flex items-center gap-2 rounded-xl border bg-white p-2 ${
              v.isActive ? 'border-stone-200' : 'border-dashed border-stone-300 opacity-60'
            }`}
          >
            <span className="w-14 shrink-0 text-center">
              <span className="block text-sm font-bold text-stone-900">{v.size}</span>
              {!v.isActive && <span className="block text-[10px] uppercase text-stone-500">oculta</span>}
            </span>

            <div className="flex items-center rounded-full border border-stone-200">
              <button
                type="button"
                disabled={busy === v.id || v.stock <= 0}
                onClick={() => run(v.id, () => actions.changeStock(v.id, -1))}
                aria-label={`Restar 1 a talla ${v.size}`}
                className="grid size-9 place-items-center rounded-full hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min={0}
                max={9999}
                key={v.stock}
                defaultValue={v.stock}
                aria-label={`Stock de talla ${v.size}`}
                onBlur={(e) => {
                  const value = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  if (value !== v.stock) void run(v.id, () => actions.setStock(v.id, value));
                  else e.target.value = String(v.stock);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className={`w-12 bg-transparent text-center text-sm font-bold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${
                  v.stock === 0 ? 'text-accent-600' : v.stock === 1 ? 'text-amber-600' : 'text-stone-900'
                }`}
              />
              <button
                type="button"
                disabled={busy === v.id}
                onClick={() => run(v.id, () => actions.changeStock(v.id, 1))}
                aria-label={`Sumar 1 a talla ${v.size}`}
                className="grid size-9 place-items-center rounded-full hover:bg-stone-100 disabled:text-stone-300"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <div className="ml-auto flex">
              <button
                type="button"
                disabled={busy === v.id}
                onClick={() => run(v.id, () => actions.toggleVariant(v.id, !v.isActive))}
                title={v.isActive ? 'Ocultar talla en la tienda' : 'Mostrar talla en la tienda'}
                aria-label={v.isActive ? `Ocultar talla ${v.size}` : `Mostrar talla ${v.size}`}
                className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100"
              >
                {v.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <button
                type="button"
                disabled={busy === v.id}
                onClick={() => {
                  if (confirm(`¿Eliminar la talla ${v.size} de "${product.name}"?`)) {
                    void run(v.id, () => actions.deleteVariant(v.id));
                  }
                }}
                title="Eliminar talla"
                aria-label={`Eliminar talla ${v.size}`}
                className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-accent-50 hover:text-accent-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          maxLength={12}
          placeholder="Nueva talla"
          aria-label="Nueva talla"
          className="w-28 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newSize.trim() || busy === 'new'}
          className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
        >
          Agregar talla
        </button>
        {missing.map((size) => (
          <button
            key={size}
            type="button"
            disabled={busy === 'new'}
            onClick={() => run('new', () => actions.addVariant(product.id, size))}
            className="rounded-lg border border-dashed border-stone-300 px-2.5 py-2 text-xs font-medium text-stone-600 hover:border-stone-900 hover:text-stone-900"
          >
            + {size}
          </button>
        ))}
      </form>
    </div>
  );
}
