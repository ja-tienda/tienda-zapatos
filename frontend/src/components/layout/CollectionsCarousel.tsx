import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../config/constants';
import { useStore } from '../../context/StoreContext';
import Reveal from '../ui/Reveal';
import RichTitle from '../ui/RichTitle';

const AUTOPLAY_MS = 6000;

/**
 * Carrusel de la página de inicio. Muestra las colecciones/temporadas marcadas con
 * "Mostrar en el carrusel" en el panel; cada diapositiva lleva a la página de su sección.
 * Usa el desplazamiento nativo del navegador, así en el celular se arrastra con el dedo.
 */
export default function CollectionsCarousel() {
  const { collections } = useStore();
  const slides = collections.filter((c) => c.showInCarousel && c.coverImage);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      const track = trackRef.current;
      if (!track || slides.length === 0) return;
      const target = (next + slides.length) % slides.length;
      track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
    },
    [slides.length],
  );

  // La diapositiva activa se deduce de la posición del scroll (sirve para flechas, puntos y dedo)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => setIndex(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') goTo(index + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, slides.length, index, goTo]);

  if (slides.length === 0) return null;

  return (
    <section aria-label="Temporadas y colecciones" aria-roledescription="carrusel" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
      <Reveal>
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div ref={trackRef} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-3xl">
            {slides.map((slide, i) => (
              <article
                key={slide.id}
                aria-roledescription="diapositiva"
                aria-label={`${i + 1} de ${slides.length}: ${slide.name}`}
                className="relative flex min-h-[26rem] w-full shrink-0 snap-center items-end overflow-hidden bg-stone-900 sm:min-h-[30rem]"
              >
                <img
                  src={slide.coverImage!}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="absolute inset-0 size-full object-cover"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/35 to-stone-950/5 sm:bg-gradient-to-r" aria-hidden />
                <div className="relative max-w-xl p-6 pb-14 sm:p-12 sm:pb-16">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-200">{slide.name}</p>
                  <h3 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.05] text-white sm:text-5xl">
                    <RichTitle text={slide.heroTitle || slide.name} highlightClass="text-accent-200" />
                  </h3>
                  {slide.heroText && <p className="mt-3 max-w-md text-base text-stone-200">{slide.heroText}</p>}
                  <Link
                    to={ROUTES.section(slide.slug)}
                    className="group mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-accent-600 hover:text-white"
                  >
                    {slide.ctaLabel}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {slides.length > 1 && (
            <>
              <div className="absolute bottom-5 right-5 flex gap-2 sm:bottom-8 sm:right-8">
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  aria-label="Anterior"
                  className="grid size-11 place-items-center rounded-full bg-white/90 text-stone-900 backdrop-blur transition-colors hover:bg-white"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  aria-label="Siguiente"
                  className="grid size-11 place-items-center rounded-full bg-white/90 text-stone-900 backdrop-blur transition-colors hover:bg-white"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
              <div className="absolute bottom-6 left-6 flex gap-1.5 sm:bottom-9 sm:left-12">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Ir a ${slide.name}`}
                    aria-current={i === index}
                    className={`h-1.5 rounded-full transition-all ${i === index ? 'w-8 bg-white' : 'w-3 bg-white/50 hover:bg-white/80'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}
