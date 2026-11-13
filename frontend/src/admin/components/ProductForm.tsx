import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import ProductCard from '../../components/catalog/ProductCard';
import { BADGE_LABELS, GENDERS, GENDER_LABELS, SIZE_PRESETS } from '../../config/constants';
import type { Badge, Gender, Product, ProductInput, Section } from '../../types';
import { fieldClass } from '../AdminContext';
import ImageGalleryInput from './ImageGalleryInput';

interface Props {
  /** null = producto nuevo */
  product: Product | null;
  categories: Section[];
  collections: Section[];
  onSave: (data: ProductInput) => Promise<void>;
  onCancel: () => void;
}

export default function ProductForm({ product, categories, collections, onSave, onCancel }: Props) {
  const isNew = product === null;
  const [name, setName] = useState(product?.name ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(product?.category.id ?? categories[0]?.id ?? null);
  const [collectionIds, setCollectionIds] = useState<number[]>(product?.collectionIds ?? []);
  const [gender, setGender] = useState<Gender>(product?.gender ?? 'UNISEX');
  // "Precio normal" es el de lista; "precio de oferta" es opcional y debe ser menor.
  const [normalPrice, setNormalPrice] = useState(String(product ? (product.originalPrice ?? product.price) : ''));
  const [salePrice, setSalePrice] = useState(product?.originalPrice ? String(product.price) : '');
  const [badge, setBadge] = useState<Badge | ''>(product?.badge ?? '');
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [initialStock, setInitialStock] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const presetSizes = SIZE_PRESETS[category?.sizeType ?? 'UNICA'];

  // Producto "en borrador" con lo que hay escrito ahora: alimenta la vista previa.
  const draftNormal = Number(normalPrice) > 0 ? Number(normalPrice) : 0;
  const draftSale = Number(salePrice) > 0 && Number(salePrice) < draftNormal ? Number(salePrice) : null;
  const draft: Product = {
    id: product?.id ?? 0,
    slug: product?.slug ?? '',
    createdAt: product?.createdAt ?? '',
    name: name.trim() || 'Nombre del producto',
    brand: brand.trim() || null,
    description,
    category: category
      ? { id: category.id, name: category.name, slug: category.slug, sizeType: category.sizeType }
      : { id: 0, name: 'Categoría', slug: '', sizeType: 'UNICA' },
    collectionIds,
    gender,
    price: draftSale ?? draftNormal,
    originalPrice: draftSale !== null ? draftNormal : null,
    badge: badge || null,
    images,
    featured,
    isActive,
    variants: product
      ? product.variants.filter((v) => v.isActive)
      : presetSizes.map((size, i) => ({
          id: -(i + 1),
          size,
          usSize: null,
          cmSize: null,
          stock: Math.max(0, Math.floor(Number(initialStock[size]) || 0)),
          isActive: true,
        })),
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normal = Number(normalPrice);
    const sale = salePrice.trim() === '' ? null : Number(salePrice);
    if (name.trim().length < 2) return setError('Escribe el nombre del producto.');
    if (categoryId === null) return setError('Elige una categoría (créala primero en la pestaña Secciones).');
    if (!Number.isFinite(normal) || normal <= 0) return setError('Ingresa un precio normal válido.');
    if (sale !== null && (!Number.isFinite(sale) || sale <= 0 || sale >= normal)) {
      return setError('El precio de oferta debe ser menor que el precio normal.');
    }

    const data: ProductInput = {
      name: name.trim(),
      brand: brand.trim() || null,
      description: description.trim(),
      categoryId,
      collectionIds,
      gender,
      price: sale ?? normal,
      originalPrice: sale !== null ? normal : null,
      badge: badge || null,
      images,
      featured,
      isActive,
    };
    if (isNew) {
      data.variants = presetSizes.map((size) => ({
        size,
        stock: Math.max(0, Math.floor(Number(initialStock[size]) || 0)),
      }));
    }

    setSaving(true);
    try {
      await onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setSaving(false);
    }
  }

  const toggleCollection = (id: number) =>
    setCollectionIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));

  return (
    <form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a productos
        </button>
        <h1 className="text-xl font-extrabold text-stone-900">{isNew ? 'Nuevo producto' : `Editar: ${product.name}`}</h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
            Nombre
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={fieldClass} />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Categoría
            <select value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))} className={fieldClass}>
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
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={fieldClass}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Marca / línea <span className="font-normal text-stone-400">(opcional)</span>
            <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={60} className={fieldClass} />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Etiqueta
            <select value={badge} onChange={(e) => setBadge(e.target.value as Badge | '')} className={fieldClass}>
              <option value="">Sin etiqueta</option>
              {(Object.keys(BADGE_LABELS) as Badge[]).map((b) => (
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
              value={normalPrice}
              onChange={(e) => setNormalPrice(e.target.value)}
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
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="Déjalo vacío si no hay oferta"
              className={fieldClass}
            />
          </label>

          <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
            Descripción
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={fieldClass} />
          </label>
        </div>

        {collections.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium text-stone-700">
              Temporadas y colecciones <span className="font-normal text-stone-400">(puede estar en varias o en ninguna)</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {collections.map((c) => {
                const checked = collectionIds.includes(c.id);
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

        <ImageGalleryInput value={images} onChange={setImages} />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="size-4 accent-rose-600" />
            Producto destacado (aparece primero)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 accent-rose-600" />
            Visible en la tienda
          </label>
        </div>

        {isNew && (
          <fieldset className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <legend className="px-1 text-sm font-semibold text-stone-900">Stock inicial por talla</legend>
            <p className="text-xs text-stone-500">
              Las tallas dependen de la categoría. Después podrás agregar otras (por ejemplo, tallas de niños) desde “Tallas y
              stock”.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {presetSizes.map((size) => (
                <label key={size} className="flex flex-col items-center text-xs font-bold text-stone-700">
                  {size}
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={initialStock[size] ?? ''}
                    onChange={(e) => setInitialStock((s) => ({ ...s, [size]: e.target.value }))}
                    className="mt-1 w-14 rounded-lg border border-stone-200 bg-white px-1 py-2 text-center text-sm font-normal focus:border-stone-900 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p className="rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:border-stone-900">
            Cancelar
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
          <ProductCard product={draft} onOpen={() => {}} />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {isActive
            ? 'Se actualiza mientras escribes. Nada cambia en la tienda hasta que guardes.'
            : 'Este producto está oculto: no aparecerá en la tienda hasta que marques “Visible en la tienda”.'}
        </p>
      </aside>
    </form>
  );
}
