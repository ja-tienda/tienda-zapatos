import { useMemo } from 'react';
import Catalog from '../components/catalog/Catalog';
import SectionNav from '../components/catalog/SectionNav';
import CategoryTiles from '../components/layout/CategoryTiles';
import CollectionsCarousel from '../components/layout/CollectionsCarousel';
import HeroBanner from '../components/layout/HeroBanner';
import TrustBar from '../components/layout/TrustBar';
import Reveal from '../components/ui/Reveal';
import { STORE } from '../config/constants';
import { useStore } from '../context/StoreContext';
import { totalStock } from '../utils/format';

export default function HomePage() {
  const { products } = useStore();

  const heroProduct = useMemo(
    () => products.find((p) => p.featured && totalStock(p) > 0) ?? products.find((p) => totalStock(p) > 0) ?? null,
    [products],
  );

  return (
    <>
      <HeroBanner featured={heroProduct} />
      <TrustBar />
      <CategoryTiles />
      <CollectionsCarousel />

      <section id="catalogo" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">Catálogo · Stock actualizado</p>
          <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">{STORE.tagline}</h2>
        </Reveal>

        <div className="mt-7 space-y-4">
          <SectionNav />
          <Catalog products={products} />
        </div>
      </section>
    </>
  );
}
