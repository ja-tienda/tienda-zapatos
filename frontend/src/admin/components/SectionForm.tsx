import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import SectionHero from '../../components/layout/SectionHero';
import { ROUTES, SECTION_KIND_LABELS, SIZE_TYPE_LABELS } from '../../config/constants';
import type { Section, SectionInput, SectionKind, SizeType } from '../../types';
import { fieldClass } from '../AdminContext';
import ImageInput from './ImageInput';

interface Props {
  /** Sección a editar, o el tipo de la nueva sección */
  section: Section | null;
  kind: SectionKind;
  onSave: (data: SectionInput) => Promise<void>;
  onCancel: () => void;
}

const WORDS: Record<SectionKind, { one: string; newTitle: string; example: string }> = {
  CATEGORIA: { one: 'categoría', newTitle: 'Nueva categoría', example: 'Ej. Sandalias' },
  COLECCION: { one: 'temporada o colección', newTitle: 'Nueva temporada o colección', example: 'Ej. Temporada Invierno' },
};

/** Crea o edita una sección (categoría o temporada) con la vista previa de su portada. */
export default function SectionForm({ section, kind, onSave, onCancel }: Props) {
  const isNew = section === null;
  const words = WORDS[kind];
  const [name, setName] = useState(section?.name ?? '');
  const [sizeType, setSizeType] = useState<SizeType>(section?.sizeType ?? 'CALZADO');
  const [coverImage, setCoverImage] = useState(section?.coverImage ?? '');
  const [heroTitle, setHeroTitle] = useState(section?.heroTitle ?? '');
  const [heroText, setHeroText] = useState(section?.heroText ?? '');
  const [ctaLabel, setCtaLabel] = useState(section?.ctaLabel ?? 'Ver productos');
  const [showInCarousel, setShowInCarousel] = useState(section?.showInCarousel ?? kind === 'COLECCION');
  const [sortOrder, setSortOrder] = useState(String(section?.sortOrder ?? ''));
  const [isActive, setIsActive] = useState(section?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Escribe el nombre de la sección.');
    if (kind === 'COLECCION' && showInCarousel && !coverImage) {
      return setError('Para mostrarla en el carrusel de inicio, súbele una imagen de portada.');
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        kind,
        sizeType: kind === 'CATEGORIA' ? sizeType : 'UNICA',
        coverImage: coverImage || null,
        heroTitle: heroTitle.trim() || name.trim(),
        heroText: heroText.trim(),
        ctaLabel: ctaLabel.trim() || 'Ver productos',
        showInCarousel: kind === 'COLECCION' && showInCarousel,
        sortOrder: sortOrder.trim() === '' ? undefined : Math.max(0, Math.floor(Number(sortOrder) || 0)),
        isActive,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a secciones
        </button>
        <h1 className="text-xl font-extrabold text-stone-900">{isNew ? words.newTitle : `Editar: ${section.name}`}</h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
            Nombre
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={words.example} className={fieldClass} />
            {section && (
              <span className="mt-1 block text-xs font-normal text-stone-500">
                Su página es <code>{ROUTES.section(section.slug)}</code> (cambia si cambias el nombre).
              </span>
            )}
          </label>

          {kind === 'CATEGORIA' && (
            <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
              Tallas que usan sus productos
              <select value={sizeType} onChange={(e) => setSizeType(e.target.value as SizeType)} className={fieldClass}>
                {(Object.keys(SIZE_TYPE_LABELS) as SizeType[]).map((t) => (
                  <option key={t} value={t}>
                    {SIZE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-stone-500">
                Son las tallas que se proponen al crear un producto. En cada producto puedes agregar otras.
              </span>
            </label>
          )}
        </div>

        <ImageInput
          label="Imagen de portada"
          hint="Se ve arriba de la página de esta sección, en “Compra por categoría” y en el carrusel. Mejor horizontal y de buena calidad."
          value={coverImage}
          onChange={setCoverImage}
          folder="sitio"
          previewClass="h-28 w-48"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
            Título de la portada
            <input
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              maxLength={120}
              placeholder={name || 'Si lo dejas vacío se usa el nombre'}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs font-normal text-stone-500">
              Pon una palabra entre *asteriscos* para resaltarla en cursiva. Ej.: Abrígate con *estilo*
            </span>
          </label>

          <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
            Texto de llamado a la acción
            <textarea value={heroText} onChange={(e) => setHeroText(e.target.value)} rows={2} maxLength={300} className={fieldClass} />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Texto del botón
            <input type="text" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} className={fieldClass} />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Orden <span className="font-normal text-stone-400">(1 va primero)</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="Al final"
              className={fieldClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {kind === 'COLECCION' && (
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input type="checkbox" checked={showInCarousel} onChange={(e) => setShowInCarousel(e.target.checked)} className="size-4 accent-rose-600" />
              Mostrar en el carrusel de inicio
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 accent-rose-600" />
            Visible en la tienda
          </label>
        </div>

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
            {isNew ? `Crear ${words.one}` : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-28" aria-label="Vista previa de la portada">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Así se verá su portada</p>
        <div className="mt-2 overflow-hidden rounded-2xl border border-stone-200">
          <SectionHero
            preview
            data={{
              eyebrow: SECTION_KIND_LABELS[kind],
              title: heroTitle.trim() || name.trim() || 'Título de la sección',
              text: heroText,
              ctaLabel: ctaLabel || 'Ver productos',
              coverImage: coverImage || null,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-stone-500">Se actualiza mientras escribes. Nada cambia en la tienda hasta que guardes.</p>
      </aside>
    </form>
  );
}
