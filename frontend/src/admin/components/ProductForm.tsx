import { ArrowLeft, History, LoaderCircle, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import ProductCard from '../../components/catalog/ProductCard';
import { BADGE_LABELS, GENDERS, GENDER_LABELS } from '../../config/constants';
import {
  KIDS_SHOE_SIZES,
  ADULT_SHOE_SIZES,
  isKidsGender,
  normalizeSize,
  presetSizesFor,
  sortSizes,
  usSizeFor,
} from '../../config/sizes';
import type { Gender, Product, ProductInput, Section, SizeType } from '../../types';
import { fieldClass } from '../AdminContext';
import { clearProductDraft, readProductDraft, writeProductDraft, type ProductDraft } from '../productDraft';
import ImageGalleryInput from './ImageGalleryInput';

interface Props {
  /** null = producto nuevo */
  product: Product | null;
  categories: Section[];
  collections: Section[];
  /** Devuelve true si se guardó (entonces se borra el borrador). */
  onSave: (data: ProductInput) => Promise<boolean>;
  /** Cierra el formulario. El borrador se conserva salvo que se haya descartado. */
  onClose: () => void;
}

function formFromProduct(product: Product | null, categories: Section[]): ProductDraft {
  return {
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    description: product?.description ?? '',
    categoryId: product?.category.id ?? categories[0]?.id ?? null,
    collectionIds: product?.collectionIds ?? [],
    gender: product?.gender ?? 'UNISEX',
    // "Precio normal" es el de lista; "precio de oferta" es opcional y debe ser menor.
    normalPrice: product ? String(product.originalPrice ?? product.price) : '',
    salePrice: product?.originalPrice ? String(product.price) : '',
    badge: product?.badge ?? '',
    images: product?.images ?? [],
    featured: product?.featured ?? false,
    isActive: product?.isActive ?? true,
    stock: {},
    usOverrides: {},
    extraSizes: [],
    removedSizes: [],
  };
}

const toCount = (value: string | undefined) => Math.max(0, Math.floor(Number(value) || 0));

export default function ProductForm({ product, categories, collections, onSave, onClose }: Props) {
  const isNew = product === null;
  const draftId = product?.id ?? null;
  const base = useMemo(() => formFromProduct(product, categories), [product, categories]);
  const baseJson = JSON.stringify(base);

  // Si quedó un borrador sin guardar (cambio de pestaña, recarga…), se continúa desde ahí.
  const [initialDraft] = useState(() => readProductDraft(draftId));
  const [form, setForm] = useState<ProductDraft>(() => ({ ...base, ...initialDraft }));
  const [restored, setRestored] = useState(initialDraft !== null && JSON.stringify({ ...base, ...initialDraft }) !== baseJson);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(form) !== baseJson;

  useEffect(() => {
    if (isDirty) writeProductDraft(draftId, form);
    else clearProductDraft(draftId);
  }, [form, isDirty, draftId]);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => setForm((f) => ({ ...f, [key]: value }));

  const category = categories.find((c) => c.id === form.categoryId) ?? categories[0] ?? null;
  const categoryId = category?.id ?? null;
  const sizeType: SizeType = category?.sizeType ?? 'UNICA';
  const isShoe = sizeType === 'CALZADO';

  // Tallas del producto nuevo: las sugeridas (según categoría y "Para") + las agregadas − las quitadas
  const sizeRows = sortSizes([...new Set([...presetSizesFor(sizeType, form.gender), ...form.extraSizes])]).filter(
    (s) => !form.removedSizes.includes(s),
  );
  const usOf = (size: string) => form.usOverrides[size] ?? (isShoe ? (usSizeFor(size, form.gender) ?? '') : '');
  const stockedRows = sizeRows.filter((s) => toCount(form.stock[s]) > 0);

  // Producto "en borrador" con lo que hay escrito ahora: alimenta la vista previa.
  const draftNormal = Number(form.normalPrice) > 0 ? Number(form.normalPrice) : 0;
  const draftSale = Number(form.salePrice) > 0 && Number(form.salePrice) < draftNormal ? Number(form.salePrice) : null;
  const preview: Product = {
    id: product?.id ?? 0,
    slug: product?.slug ?? '',
    createdAt: product?.createdAt ?? '',
    name: form.name.trim() || 'Nombre del producto',
    brand: form.brand.trim() || null,
    description: form.description,
    category: category
      ? { id: category.id, name: category.name, slug: category.slug, sizeType: category.sizeType }
      : { id: 0, name: 'Categoría', slug: '', sizeType: 'UNICA' },
    collectionIds: form.collectionIds,
    gender: form.gender,
    price: draftSale ?? draftNormal,
    originalPrice: draftSale !== null ? draftNormal : null,
    badge: form.badge || null,
    images: form.images,
    featured: form.featured,
    isActive: form.isActive,
    variants: product
      ? product.variants.filter((v) => v.isActive)
      : stockedRows.map((size, i) => ({
          id: -(i + 1),
          size,
          usSize: usOf(size) || null,
          cmSize: null,
          stock: toCount(form.stock[size]),
          isActive: true,
        })),
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normal = Number(form.normalPrice);
    const sale = form.salePrice.trim() === '' ? null : Number(form.salePrice);
    if (form.name.trim().length < 2) return setError('Escribe el nombre del producto.');
    if (categoryId === null) return setError('Elige una categoría (créala primero en la pestaña Secciones).');
    if (!Number.isFinite(normal) || normal <= 0) return setError('Ingresa un precio normal válido.');
    if (sale !== null && (!Number.isFinite(sale) || sale <= 0 || sale >= normal)) {
      return setError('El precio de oferta debe ser menor que el precio normal.');
    }

    const data: ProductInput = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      description: form.description.trim(),
      categoryId,
      collectionIds: form.collectionIds,
      gender: form.gender,
      price: sale ?? normal,
      originalPrice: sale !== null ? normal : null,
      badge: form.badge || null,
      images: form.images,
      featured: form.featured,
      isActive: form.isActive,
    };
    if (isNew) {
      // Solo se crean las tallas que tienen pares; las demás se agregan cuando lleguen.
      data.variants = stockedRows.map((size) => ({
        size,
        stock: toCount(form.stock[size]),
        ...(isShoe ? { usSize: usOf(size).trim() || null } : {}),
      }));
    }

    setSaving(true);
    try {
      if (await onSave(data)) clearProductDraft(draftId);
      else setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setSaving(false);
    }
  }

  function discard() {
    if (isDirty && !confirm(isNew ? '¿Descartar este producto? Se borrará lo que escribiste.' : '¿Descartar los cambios sin guardar?')) {
      return;
    }
    clearProductDraft(draftId);
    onClose();
  }

  function startOver() {
    setForm(base);
    setRestored(false);
  }

  const toggleCollection = (id: number) =>
    set('collectionIds', form.collectionIds.includes(id) ? form.collectionIds.filter((c) => c !== id) : [...form.collectionIds, id]);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <button type="button" onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a productos
        </button>
        <h1 className="text-xl font-extrabold text-stone-900">{isNew ? 'Nuevo producto' : `Editar: ${product.name}`}</h1>

        {restored && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <History className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">Recuperamos lo que estabas escribiendo y aún no guardaste.</span>
            <button type="button" onClick={startOver} className="font-semibold underline underline-offset-2 hover:text-amber-700">
              Empezar de cero
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
            Nombre
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} className={fieldClass} />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Categoría
            <select value={categoryId ?? ''} onChange={(e) => set('categoryId', Number(e.target.value))} className={fieldClass}>
              {categories.length === 0 && <option value="">Crea una categoría en “Secciones”</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? '' : ' (oculta)'}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Para
            <select value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)} className={fieldClass}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Marca / línea <span className="font-normal text-stone-400">(opcional)</span>
            <input type="text" value={form.brand} onChange={(e) => set('brand', e.target.value)} maxLength={60} className={fieldClass} />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Etiqueta
            <select value={form.badge} onChange={(e) => set('badge', e.target.value as ProductDraft['badge'])} className={fieldClass}>
              <option value="">Sin etiqueta</option>
              {(Object.keys(BADGE_LABELS) as (keyof typeof BADGE_LABELS)[]).map((b) => (
                <option key={b} value={b}>
                  {BADGE_LABELS[b]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Precio normal (S/)
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.normalPrice}
              onChange={(e) => set('normalPrice', e.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Precio de oferta (S/) <span className="font-normal text-stone-400">(opcional)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.salePrice}
              onChange={(e) => set('salePrice', e.target.value)}
              placeholder="Déjalo vacío si no hay oferta"
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              maxLength={2000}
              className={fieldClass}
            />
          </label>
        </div>

        {collections.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium text-stone-700">
              Temporadas y colecciones <span className="font-normal text-stone-400">(puede estar en varias o en ninguna)</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {collections.map((c) => {
                const checked = form.collectionIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium ${
                      checked ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleCollection(c.id)} className="sr-only" />
                    {c.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <ImageGalleryInput value={form.images} onChange={(images) => set('images', images)} />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} className="size-4 accent-rose-600" />
            Producto destacado (aparece primero)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-4 accent-rose-600" />
            Visible en la tienda
          </label>
        </div>

        {isNew && (
          <InitialSizes
            form={form}
            setForm={setForm}
            rows={sizeRows}
            usOf={usOf}
            isShoe={isShoe}
            sizeType={sizeType}
            stockedCount={stockedRows.length}
          />
        )}

        {error && (
          <p className="rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isDirty && <span className="mr-auto text-xs text-stone-500">Borrador guardado en este navegador</span>}
          <button type="button" onClick={discard} className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:border-stone-900">
            {isDirty ? 'Descartar' : 'Cancelar'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
          >
            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {isNew ? 'Crear producto' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-28" aria-label="Vista previa del producto">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Así se verá en la tienda</p>
        {/* inert: es solo una muestra, sus botones no hacen nada */}
        <div className="mx-auto mt-2 max-w-64 lg:max-w-none" inert>
          <ProductCard product={preview} onOpen={() => {}} />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {form.isActive
            ? 'Se actualiza mientras escribes. Nada cambia en la tienda hasta que guardes.'
            : 'Este producto está oculto: no aparecerá en la tienda hasta que marques “Visible en la tienda”.'}
        </p>
      </aside>
    </form>
  );
}

interface InitialSizesProps {
  form: ProductDraft;
  setForm: Dispatch<SetStateAction<ProductDraft>>;
  rows: string[];
  usOf: (size: string) => string;
  isShoe: boolean;
  sizeType: SizeType;
  stockedCount: number;
}

/** Tallas del producto nuevo: talla Perú, su equivalente USA (editable) y los pares que hay. */
function InitialSizes({ form, setForm, rows, usOf, isShoe, sizeType, stockedCount }: InitialSizesProps) {
  const [newSize, setNewSize] = useState('');
  const [newUs, setNewUs] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const kids = isKidsGender(form.gender);
  const customized = form.extraSizes.length > 0 || form.removedSizes.length > 0;
  const totalPairs = rows.reduce((sum, s) => sum + toCount(form.stock[s]), 0);

  const setStock = (size: string, value: string) => setForm((f) => ({ ...f, stock: { ...f.stock, [size]: value } }));
  const setUs = (size: string, value: string) => setForm((f) => ({ ...f, usOverrides: { ...f.usOverrides, [size]: value } }));
  const removeSize = (size: string) =>
    setForm((f) => ({
      ...f,
      removedSizes: [...f.removedSizes, size],
      extraSizes: f.extraSizes.filter((s) => s !== size),
    }));

  function addSize() {
    const size = normalizeSize(newSize);
    if (!size) return;
    if (rows.some((s) => s.toLowerCase() === size.toLowerCase())) {
      setAddError(`La talla ${size} ya está en la lista.`);
      return;
    }
    setForm((f) => ({
      ...f,
      extraSizes: f.removedSizes.includes(size) ? f.extraSizes : [...f.extraSizes, size],
      removedSizes: f.removedSizes.filter((s) => s !== size),
      usOverrides: newUs.trim() ? { ...f.usOverrides, [size]: normalizeSize(newUs) } : f.usOverrides,
    }));
    setNewSize('');
    setNewUs('');
    setAddError(null);
  }

  const range = kids ? `${KIDS_SHOE_SIZES[0]} a ${KIDS_SHOE_SIZES.at(-1)}` : `${ADULT_SHOE_SIZES[0]} a ${ADULT_SHOE_SIZES.at(-1)}`;

  return (
    <fieldset className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <legend className="px-1 text-sm font-semibold text-stone-900">Tallas y stock inicial</legend>
      <p className="text-xs text-stone-500">
        {isShoe ? (
          <>
            {kids ? 'Tallas de niños' : 'Tallas de adulto'} (Perú {range}, con medias tallas). Debajo de cada talla está su
            equivalente USA: puedes corregirlo si tu proveedor usa otro.{' '}
            {!kids && 'Elige “Niño” o “Niña” en “Para” para ver las tallas de niños. '}
          </>
        ) : (
          'Las tallas dependen de la categoría. '
        )}
        Escribe cuántos pares tienes: solo se crean las tallas con stock.
      </p>

      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2">
        {rows.map((size) => {
          const has = toCount(form.stock[size]) > 0;
          return (
            <div
              key={size}
              className={`relative rounded-xl border bg-white px-1.5 pb-1.5 pt-2 text-center ${has ? 'border-stone-900' : 'border-stone-200'}`}
            >
              <button
                type="button"
                onClick={() => removeSize(size)}
                title={`Quitar talla ${size}`}
                aria-label={`Quitar talla ${size}`}
                className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full text-stone-300 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="size-3" />
              </button>
              <span className="block text-sm font-bold text-stone-900">{size}</span>
              {isShoe && (
                <label className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-semibold text-stone-500">
                  US
                  <input
                    type="text"
                    inputMode="decimal"
                    value={usOf(size)}
                    onChange={(e) => setUs(size, e.target.value)}
                    maxLength={8}
                    aria-label={`Talla USA equivalente a la ${size}`}
                    className="w-9 rounded border border-transparent bg-transparent px-0.5 text-center text-[11px] font-semibold text-stone-700 hover:border-stone-200 focus:border-stone-900 focus:bg-white focus:outline-none"
                  />
                </label>
              )}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={form.stock[size] ?? ''}
                onChange={(e) => setStock(size, e.target.value)}
                aria-label={`Pares en talla ${size}`}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-1 py-1.5 text-center text-sm focus:border-stone-900 focus:outline-none"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-stone-600">
          {isShoe ? 'Otra talla Perú' : 'Otra talla'}
          <input
            type="text"
            value={newSize}
            onChange={(e) => {
              setNewSize(e.target.value);
              setAddError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSize();
              }
            }}
            maxLength={12}
            placeholder={isShoe ? 'Ej. 47' : sizeType === 'ROPA' ? 'Ej. XXL' : 'Ej. Única'}
            className="mt-1 block w-28 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
        </label>
        {isShoe && (
          <label className="text-xs font-medium text-stone-600">
            USA <span className="font-normal text-stone-400">(opcional)</span>
            <input
              type="text"
              value={newUs}
              onChange={(e) => setNewUs(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSize();
                }
              }}
              maxLength={8}
              placeholder={newSize ? (usSizeFor(newSize, form.gender) ?? 'Ej. 13') : 'Ej. 13'}
              className="mt-1 block w-24 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </label>
        )}
        <button
          type="button"
          onClick={addSize}
          disabled={!newSize.trim()}
          className="flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
        >
          <Plus className="size-4" aria-hidden />
          Agregar talla
        </button>
        {customized && (
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, extraSizes: [], removedSizes: [] }))}
            className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Volver a las tallas sugeridas
          </button>
        )}
      </div>
      {addError && <p className="mt-2 text-xs font-medium text-accent-700">{addError}</p>}

      <p className="mt-3 text-xs font-medium text-stone-600">
        {stockedCount === 0
          ? 'Aún no hay stock: el producto se creará como agotado. Podrás sumar pares luego en “Tallas y stock”.'
          : `Se crearán ${stockedCount} ${stockedCount === 1 ? 'talla' : 'tallas'} con ${totalPairs} ${totalPairs === 1 ? 'par' : 'pares'} en total.`}
      </p>
    </fieldset>
  );
}
