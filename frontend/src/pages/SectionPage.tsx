import { useMemo } from 'react';
import { useParams } from 'react-router';
import Catalog from '../components/catalog/Catalog';
import SectionNav from '../components/catalog/SectionNav';
import SectionHero, { type SectionHeroData } from '../components/layout/SectionHero';
import { SECTION_KIND_LABELS } from '../config/constants';
import { useStore } from '../context/StoreContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { isOnSale } from '../utils/format';
import NotFoundPage from './NotFoundPage';

/**
 * Página de una sección: una categoría (/seccion/calzados), una colección o temporada
 * (/seccion/temporada-verano) o las ofertas (/ofertas, que no se crea en el panel:
 * reúne sola todo lo que tiene precio rebajado).
 */
export default function SectionPage({ offers = false }: { offers?: boolean }) {
  const { slug } = useParams();
  const { products, categories, collections, loading } = useStore();

  const section = offers ? null : ([...categories, ...collections].find((s) => s.slug === slug) ?? null);

  usePageTitle(offers ? 'Ofertas' : section?.name);

  const sectionProducts = useMemo(() => {
    if (offers) return products.filter(isOnSale);
    if (!section) return [];
    return section.kind === 'CATEGORIA'
      ? products.filter((p) => p.category.id === section.id)
      : products.filter((p) => p.collectionIds.includes(section.id));
  }, [offers, section, products]);

  if (!offers && !section) {
    // Mientras carga no se sabe aún si la sección existe
    return loading ? <div className="min-h-[28rem] animate-pulse bg-stone-100" aria-busy="true" /> : <NotFoundPage />;
  }

  const hero: SectionHeroData = section
    ? {
        eyebrow: SECTION_KIND_LABELS[section.kind],
        title: section.heroTitle || section.name,
        text: section.heroText,
        ctaLabel: section.ctaLabel,
        coverImage: section.coverImage,
      }
    : {
        eyebrow: 'Liquidación',
        title: 'Ofertas que *no duran*',
        text: 'Modelos seleccionados con precio rebajado. Cuando se acaba la talla, se acaba.',
        ctaLabel: 'Ver ofertas',
        coverImage: null,
      };

  // En una colección se puede filtrar por categoría; en una categoría (u ofertas), por temporada.
  const facet =
    section?.kind === 'COLECCION' || offers
      ? {
          label: 'Categoría',
          param: 'category' as const,
          options: categories.filter((c) => sectionProducts.some((p) => p.category.id === c.id)),
        }
      : {
          label: 'Temporada',
          param: 'collection' as const,
          options: collections.filter((c) => sectionProducts.some((p) => p.collectionIds.includes(c.id))),
        };

  return (
    <>
      <SectionHero data={hero} />

      <section id="productos" className="mx-auto max-w-7xl space-y-4 px-4 pt-10 sm:px-6">
        <SectionNav />
        <Catalog products={sectionProducts} facet={facet} />
      </section>
    </>
  );
}
