import { Check, Eye, EyeOff, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ADULT_SHOE_SIZES, KIDS_SHOE_SIZES, isKidsGender, normalizeSize, presetSizesFor, usSizeFor } from '../../config/sizes';
import type { Product, Variant } from '../../types';

export interface StockActions {
  changeStock: (variantId: number, delta: number) => Promise<void>;
  setStock: (variantId: number, stock: number) => Promise<void>;
  toggleVariant: (variantId: number, isActive: boolean) => Promise<void>;
  deleteVariant: (variantId: number) => Promise<void>;
  addVariant: (productId: number, size: string, usSize?: string | null) => Promise<void>;
  /** Corrige el nombre de la talla (Perú) y/o su equivalente USA */
  renameVariant: (variantId: number, size: string, usSize: string | null) => Promise<void>;
}

interface Props {
  product: Product;
  actions: StockActions;
}

const smallField =
  'rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm focus:border-stone-900 focus:outline-none';

/** Gestión rápida: cada clic en + / − / ojo se guarda al instante en la base de datos. */
export default function StockEditor({ product, actions }: Props) {
  const [newSize, setNewSize] = useState('');
  const [newUs, setNewUs] = useState('');
  const [suggested, setSuggested] = useState('');
  const [busy, setBusy] = useState<number | 'new' | null>(null);
  const [editing, setEditing] = useState<{ id: number; size: string; us: string } | null>(null);

  const isShoe = product.category.sizeType === 'CALZADO';
  const existing = new Set(product.variants.map((v) => v.size.toLowerCase()));
  const notAdded = (sizes: string[]) => sizes.filter((s) => !existing.has(s.toLowerCase()));
  // Para calzado se sugieren tallas de adulto y de niños; primero el grupo que corresponde al producto
  const adultGroup = { label: 'Adulto', sizes: notAdded(ADULT_SHOE_SIZES) };
  const kidsGroup = { label: 'Niñas y niños', sizes: notAdded(KIDS_SHOE_SIZES) };
  const suggestionGroups = isShoe
    ? (isKidsGender(product.gender) ? [kidsGroup, adultGroup] : [adultGroup, kidsGroup]).filter((g) => g.sizes.length > 0)
    : [{ label: '', sizes: notAdded(presetSizesFor(product.category.sizeType, product.gender)) }].filter((g) => g.sizes.length > 0);
  const usLabel = (size: string) => (isShoe ? usSizeFor(size, product.gender) : null);

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
    const size = normalizeSize(newSize);
    if (!size) return;
    const us = newUs.trim() ? normalizeSize(newUs) : undefined;
    void run('new', async () => {
      await actions.addVariant(product.id, size, us);
      setNewSize('');
      setNewUs('');
    });
  }

  function startEdit(v: Variant) {
    setEditing({ id: v.id, size: v.size, us: v.usSize ?? '' });
  }

  function saveEdit(v: Variant) {
    if (!editing) return;
    const size = normalizeSize(editing.size);
    const us = editing.us.trim() ? normalizeSize(editing.us) : null;
    if (!size) return;
    if (size === v.size && us === (v.usSize ?? null)) {
      setEditing(null);
      return;
    }
    void run(v.id, async () => {
      await actions.renameVariant(v.id, size, us);
      setEditing(null);
    });
  }

  return (
    <div className="space-y-3 border-t border-stone-200 bg-stone-50 p-3 sm:p-4">
      {product.variants.length === 0 && <p className="text-sm text-stone-500">Este producto aún no tiene tallas.</p>}

      <ul className="grid gap-2 sm:grid-cols-2">
        {product.variants.map((v) =>
          editing?.id === v.id ? (
            <li key={v.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-900 bg-white p-2">
              <label className="text-[11px] font-semibold text-stone-500">
                {isShoe ? 'Talla Perú' : 'Talla'}
                <input
                  type="text"
                  value={editing.size}
                  onChange={(e) => setEditing({ ...editing, size: e.target.value })}
                  maxLength={12}
                  autoFocus
                  className={`mt-0.5 block w-20 ${smallField}`}
                />
              </label>
              {isShoe && (
                <label className="text-[11px] font-semibold text-stone-500">
                  Talla USA
                  <input
                    type="text"
                    value={editing.us}
                    onChange={(e) => setEditing({ ...editing, us: e.target.value })}
                    maxLength={8}
                    placeholder={usLabel(editing.size) ?? ''}
                    className={`mt-0.5 block w-20 ${smallField}`}
                  />
                </label>
              )}
              <div className="ml-auto flex">
                <button
                  type="button"
                  disabled={busy === v.id || !editing.size.trim()}
                  onClick={() => saveEdit(v)}
                  title="Guardar talla"
                  aria-label="Guardar talla"
                  className="grid size-9 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:text-stone-300"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  title="Cancelar"
                  aria-label="Cancelar edición de talla"
                  className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
                >
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ) : (
            <li
              key={v.id}
              className={`flex items-center gap-2 rounded-xl border bg-white p-2 ${
                v.isActive ? 'border-stone-200' : 'border-dashed border-stone-300 opacity-60'
              }`}
            >
              <span className="w-14 shrink-0 text-center leading-tight">
                <span className="block text-sm font-bold text-stone-900">{v.size}</span>
                {v.usSize && <span className="block text-[10px] font-semibold text-stone-500">US {v.usSize}</span>}
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
                  onClick={() => startEdit(v)}
                  title={isShoe ? 'Editar talla Perú / USA' : 'Editar talla'}
                  aria-label={`Editar talla ${v.size}`}
                  className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
                >
                  <Pencil className="size-4" />
                </button>
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
          ),
        )}
      </ul>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-semibold text-stone-500">
            {isShoe ? 'Nueva talla Perú' : 'Nueva talla'}
            <input
              type="text"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              maxLength={12}
              placeholder={isShoe ? 'Ej. 38.5' : 'Ej. XXL'}
              className={`mt-0.5 block w-28 ${smallField}`}
            />
          </label>
          {isShoe && (
            <label className="text-[11px] font-semibold text-stone-500">
              USA <span className="font-normal">(opcional)</span>
              <input
                type="text"
                value={newUs}
                onChange={(e) => setNewUs(e.target.value)}
                maxLength={8}
                placeholder={(newSize && usLabel(newSize)) || 'auto'}
                className={`mt-0.5 block w-20 ${smallField}`}
              />
            </label>
          )}
          <button
            type="submit"
            disabled={!newSize.trim() || busy === 'new'}
            className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
          >
            Agregar talla
          </button>
        </form>

        {suggestionGroups.length > 0 && (
          <div className="flex items-end gap-2">
            <label className="text-[11px] font-semibold text-stone-500">
              O elige una sugerida
              <select
                value={suggested}
                onChange={(e) => setSuggested(e.target.value)}
                className={`mt-0.5 block w-40 ${smallField}`}
              >
                <option value="">Talla…</option>
                {suggestionGroups.map((group) => {
                  const options = group.sizes.map((size) => {
                    const us = usLabel(size);
                    return (
                      <option key={size} value={size}>
                        {us ? `${size}  ·  US ${us}` : size}
                      </option>
                    );
                  });
                  return group.label ? (
                    <optgroup key={group.label} label={group.label}>
                      {options}
                    </optgroup>
                  ) : (
                    options
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              disabled={!suggested || busy === 'new'}
              onClick={() =>
                run('new', async () => {
                  await actions.addVariant(product.id, suggested);
                  setSuggested('');
                })
              }
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-900 disabled:text-stone-300"
            >
              Agregar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
