import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { ROUTES } from '../../config/constants';
import { useStore } from '../../context/StoreContext';
import { totalStock } from '../../utils/format';
import Reveal from '../ui/Reveal';

/**
 * Accesos a la página de cada categoría. La foto es la portada que se sube en el panel;
 * si la categoría no tiene portada, se usa la foto de su primer producto con stock.
 */
export default function CategoryTiles() {
  const { categories, products } = useStore();

  const tiles = categories.map((category) => {
    const items = products.filter((p) => p.category.id === category.id);
    const fallback = items.find((p) => totalStock(p) > 0 && p.images[0]) ?? items.find((p) => p.images[0]);
    return { category, count: items.length, image: category.coverImage ?? fallback?.images[0] ?? null };
  });

  if (tiles.length === 0) return null;

  return (
    <section aria-label="Comprar por categoría" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
      <Reveal>
        <h2 className="font-display text-3xl font-medium tracking-tight text-stone-900 sm:text-4xl">Compra por categoría</h2>
      </Reveal>

      <div className={`mt-6 grid gap-4 sm:gap-5 ${tiles.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {tiles.map(({ category, count, image }, i) => (
          <Reveal key={category.id} delay={i * 90}>
            <Link
              to={ROUTES.section(category.slug)}
              className="group relative block aspect-[16/10] w-full overflow-hidden rounded-3xl bg-stone-200 sm:aspect-[4/5]"
            >
              {image && (
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-950/10 to-transparent" aria-hidden />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 lg:p-6">
                <span className="min-w-0">
                  <span className="block font-display text-3xl font-medium text-white sm:text-2xl lg:text-3xl">{category.name}</span>
                  <span className="mt-0.5 block text-sm text-stone-200">
                    {count} {count === 1 ? 'modelo' : 'modelos'}
                  </span>
                </span>
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-stone-900 transition-colors group-hover:bg-accent-600 group-hover:text-white sm:size-9 lg:size-11">
                  <ArrowUpRight className="size-5 transition-transform group-hover:rotate-45 sm:size-4 lg:size-5" aria-hidden />
                </span>
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
