import { ArrowRight, ArrowUpRight, Ruler } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../config/constants';
import { useStore } from '../../context/StoreContext';
import { useTilt } from '../../hooks/useTilt';
import type { Product } from '../../types';
import { discountPercent, formatPrice, isOnSale } from '../../utils/format';
import RichTitle from '../ui/RichTitle';

/** Retraso de entrada en cascada para cada bloque de texto. */
const enter = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Portada de la página de inicio. Los textos y la imagen se editan en el panel
 * (Apariencia). Si no se eligió una imagen, se muestra el producto destacado.
 */
export default function HeroBanner({ featured }: { featured: Product | null }) {
  const { settings, openProduct, openSizeGuide, loading } = useStore();
  const tiltRef = useTilt<HTMLDivElement>(7);
  const customImage = settings.heroImage || null;
  const product = customImage ? null : featured;

  return (
    <section id="inicio" className="mx-auto max-w-7xl overflow-x-clip px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          {settings.heroEyebrow && (
            <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.2em] text-accent-600" style={enter(0)}>
              {settings.heroEyebrow}
            </p>
          )}
          <h1
            className="mt-4 animate-fade-up text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight text-stone-900 sm:text-6xl lg:text-7xl"
            style={enter(80)}
          >
            <RichTitle text={settings.heroTitle} />
          </h1>
          {settings.heroText && (
            <p className="mt-5 max-w-md animate-fade-up text-base leading-relaxed text-stone-600 sm:text-lg" style={enter(160)}>
              {settings.heroText}
            </p>
          )}

          <div className="mt-8 flex animate-fade-up flex-wrap items-center gap-3" style={enter(240)}>
            <a
              href="#catalogo"
              className="group flex items-center gap-2 rounded-full bg-stone-900 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
            >
              {settings.heroButtonLabel || 'Ver la colección'}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </a>
            <Link
              to={ROUTES.offers}
              className="rounded-full border border-stone-300 px-7 py-3.5 text-sm font-semibold text-stone-900 transition-colors hover:border-stone-900 hover:bg-white"
            >
              Ofertas y liquidación
            </Link>
          </div>

          <button
            type="button"
            onClick={openSizeGuide}
            className="mt-5 flex w-fit animate-fade-up items-center gap-1.5 text-sm text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-900 hover:decoration-stone-900"
            style={enter(320)}
          >
            <Ruler className="size-4" aria-hidden />
            ¿No sabes tu talla? Mira la guía de tallas
          </button>
        </div>

        {/* Imagen: arco + capas flotantes que se mueven en 3D con el mouse */}
        <div className="relative mx-auto w-full max-w-md animate-fade-up lg:max-w-none" style={enter(200)}>
          <div className="absolute -right-3 top-10 -z-10 size-56 rounded-full bg-accent-100 sm:-right-8 sm:size-72" aria-hidden />
          <div className="absolute -left-4 bottom-16 -z-10 size-28 rounded-full bg-stone-200" aria-hidden />

          {customImage ? (
            <div ref={tiltRef} className="tilt relative">
              <a href="#catalogo" className="group block aspect-[4/5] w-full overflow-hidden rounded-b-[2rem] rounded-t-[999px] bg-stone-200">
                <img
                  src={customImage}
                  alt=""
                  fetchPriority="high"
                  className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                />
              </a>
            </div>
          ) : product ? (
            <div ref={tiltRef} className="tilt relative">
              <button
                type="button"
                onClick={() => openProduct(product)}
                aria-label={`Ver ${product.name}`}
                className="group block aspect-[4/5] w-full overflow-hidden rounded-b-[2rem] rounded-t-[999px] bg-stone-200"
              >
                {product.images[0] && (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    fetchPriority="high"
                    className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                  />
                )}
              </button>

              {isOnSale(product) && (
                <span className="tilt-layer absolute right-2 top-[18%] grid size-20 animate-float place-items-center rounded-full bg-accent-600 text-center font-display text-xl font-medium leading-none text-white shadow-soft sm:right-0 sm:size-24 sm:text-2xl">
                  <span>
                    -{discountPercent(product)}%
                    <span className="mt-1 block font-sans text-[10px] font-semibold uppercase tracking-widest">oferta</span>
                  </span>
                </span>
              )}

              <button
                type="button"
                onClick={() => openProduct(product)}
                className="tilt-layer absolute -bottom-5 left-3 right-10 flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-soft sm:-left-6 sm:right-auto sm:w-72"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-600">
                    Destacado de la semana
                  </span>
                  <span className="mt-1 block truncate font-display text-lg font-medium text-stone-900">{product.name}</span>
                  <span className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-stone-900">{formatPrice(product.price)}</span>
                    {isOnSale(product) && (
                      <span className="text-xs text-stone-400 line-through">{formatPrice(product.originalPrice!)}</span>
                    )}
                  </span>
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-900 text-white">
                  <ArrowUpRight className="size-4" aria-hidden />
                </span>
              </button>
            </div>
          ) : (
            <div
              className={`aspect-[4/5] rounded-b-[2rem] rounded-t-[999px] bg-stone-200 ${loading ? 'animate-pulse' : ''}`}
              aria-hidden
            />
          )}
        </div>
      </div>
    </section>
  );
}
