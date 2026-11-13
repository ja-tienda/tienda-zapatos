import { ExternalLink, Eye, EyeOff, GalleryHorizontal, ImageOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { ROUTES } from '../../config/constants';
import type { Section, SectionKind } from '../../types';

interface Props {
  sections: Section[];
  onNew: (kind: SectionKind) => void;
  onEdit: (section: Section) => void;
  onToggleActive: (section: Section) => void;
  onDelete: (section: Section) => void;
}

const GROUPS: { kind: SectionKind; title: string; help: string; newLabel: string; empty: string }[] = [
  {
    kind: 'CATEGORIA',
    title: 'Categorías',
    help: 'Cada producto pertenece a una categoría. Aparecen en “Compra por categoría” y en el menú de la tienda.',
    newLabel: 'Nueva categoría',
    empty: 'Aún no hay categorías.',
  },
  {
    kind: 'COLECCION',
    title: 'Temporadas y colecciones',
    help: 'Agrupan productos de cualquier categoría (Verano, Invierno, Día de la Madre…). Las marcadas aparecen en el carrusel de inicio.',
    newLabel: 'Nueva temporada o colección',
    empty: 'Aún no hay temporadas. Crea la primera para que aparezca el carrusel en la página de inicio.',
  },
];

/** Lista de secciones de la tienda: cada una tiene su propia página, portada y textos. */
export default function SectionsPanel({ sections, onNew, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <div className="space-y-10">
      {GROUPS.map((group) => {
        const items = sections.filter((s) => s.kind === group.kind);
        return (
          <section key={group.kind}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-xl">
                <h2 className="text-xl font-extrabold text-stone-900">{group.title}</h2>
                <p className="mt-1 text-sm text-stone-500">{group.help}</p>
              </div>
              <button
                type="button"
                onClick={() => onNew(group.kind)}
                className="flex items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
              >
                <Plus className="size-4" aria-hidden />
                {group.newLabel}
              </button>
            </div>

            {items.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
                {group.empty}
              </p>
            ) : (
              <ul className="mt-4 space-y-3" aria-label={group.title}>
                {items.map((section) => (
                  <li
                    key={section.id}
                    className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${
                      section.isActive ? 'border-stone-200' : 'border-dashed border-stone-300'
                    }`}
                  >
                    <div className={`h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100 ${section.isActive ? '' : 'opacity-50'}`}>
                      {section.coverImage ? (
                        <img src={section.coverImage} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-stone-300" title="Sin portada">
                          <ImageOff className="size-5" aria-hidden />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 basis-44">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">
                        {section.name}
                        {section.showInCarousel && (
                          <span className="flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                            <GalleryHorizontal className="size-3" aria-hidden />
                            Carrusel
                          </span>
                        )}
                        {!section.isActive && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-600">Oculta</span>}
                      </p>
                      <p className="text-xs text-stone-500">
                        {section.productCount} {section.productCount === 1 ? 'producto' : 'productos'}
                        {!section.coverImage && ' · sin portada'}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      {section.isActive && (
                        <a
                          href={ROUTES.section(section.slug)}
                          target="_blank"
                          rel="noopener"
                          title="Ver su página en la tienda"
                          aria-label={`Ver la página de ${section.name}`}
                          className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(section)}
                        className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-900"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Editar portada y textos
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleActive(section)}
                        title={section.isActive ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
                        aria-label={section.isActive ? `Ocultar ${section.name}` : `Mostrar ${section.name}`}
                        className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100"
                      >
                        {section.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(section)}
                        title="Eliminar sección"
                        aria-label={`Eliminar ${section.name}`}
                        className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-accent-50 hover:text-accent-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="rounded-2xl bg-stone-200/60 p-4 text-sm text-stone-600">
        La página de <strong>Ofertas</strong> se arma sola con todos los productos que tienen precio de oferta: no hace falta crearla.
      </p>
    </div>
  );
}
