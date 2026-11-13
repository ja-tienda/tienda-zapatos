import { ArrowDown } from 'lucide-react';
import RichTitle from '../ui/RichTitle';

export interface SectionHeroData {
  eyebrow: string;
  title: string;
  text: string;
  ctaLabel: string;
  coverImage: string | null;
}

interface Props {
  data: SectionHeroData;
  /** Ancla a la que baja el botón (por defecto, la lista de productos de la página) */
  targetId?: string;
  /** Versión reducida para la vista previa del panel: el botón no hace nada */
  preview?: boolean;
}

/**
 * Portada de una página de sección: imagen de fondo, título, texto y botón que baja a los
 * productos. Todo se edita en el panel (Secciones). Sin imagen se muestra una banda clara.
 */
export default function SectionHero({ data, targetId = 'productos', preview = false }: Props) {
  const hasCover = Boolean(data.coverImage);
  const height = preview ? 'min-h-56' : 'min-h-[22rem] sm:min-h-[28rem]';

  return (
    <section
      className={`relative flex items-end overflow-hidden ${height} ${hasCover ? 'bg-stone-900' : 'bg-stone-100'} ${preview ? 'rounded-2xl' : ''}`}
    >
      {hasCover ? (
        <>
          <img src={data.coverImage!} alt="" className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/40 to-stone-950/10" aria-hidden />
        </>
      ) : (
        <span className="absolute -right-16 -top-24 size-80 rounded-full bg-accent-100" aria-hidden />
      )}

      <div className={`relative mx-auto w-full max-w-7xl ${preview ? 'p-5' : 'px-4 py-10 sm:px-6 sm:py-14'}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${hasCover ? 'text-accent-200' : 'text-accent-600'}`}>
          {data.eyebrow}
        </p>
        <h1
          className={`mt-3 max-w-3xl text-balance font-display font-medium leading-[1.05] tracking-tight ${
            preview ? 'text-3xl' : 'text-4xl sm:text-6xl'
          } ${hasCover ? 'text-white' : 'text-stone-900'}`}
        >
          <RichTitle text={data.title} highlightClass={hasCover ? 'text-accent-200' : 'text-accent-600'} />
        </h1>
        {data.text && (
          <p className={`mt-3 max-w-xl ${preview ? 'text-sm' : 'text-base sm:text-lg'} ${hasCover ? 'text-stone-200' : 'text-stone-600'}`}>
            {data.text}
          </p>
        )}
        <a
          href={`#${targetId}`}
          onClick={preview ? (e) => e.preventDefault() : undefined}
          className={`group mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
            hasCover ? 'bg-white text-stone-900 hover:bg-accent-600 hover:text-white' : 'bg-stone-900 text-white hover:bg-accent-600'
          }`}
        >
          {data.ctaLabel || 'Ver productos'}
          <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
        </a>
      </div>
    </section>
  );
}
