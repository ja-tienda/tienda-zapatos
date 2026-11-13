import { Ruler, Search, ShoppingBag, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ROUTES, STORE } from '../../config/constants';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';

/** Páginas que muestran un catálogo: ahí el buscador filtra en el mismo sitio. */
const isCatalogPath = (pathname: string) =>
  pathname === '/' || pathname.startsWith('/seccion/') || pathname === ROUTES.offers;

function SearchBox({ className = '' }: { className?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const search = isCatalogPath(pathname) ? (searchParams.get('q') ?? '') : '';

  function onSearchChange(value: string) {
    if (!isCatalogPath(pathname)) {
      // Desde el checkout u otra página: buscar lleva al catálogo completo
      navigate(value ? `/?q=${encodeURIComponent(value)}#catalogo` : ROUTES.home);
      return;
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
    if (value && !search) {
      // Al empezar a escribir se baja a los resultados (#catalogo en inicio, #productos en una sección)
      (document.getElementById('catalogo') ?? document.getElementById('productos'))?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">Buscar productos</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por nombre o modelo…"
        className="w-full rounded-full border border-stone-200 bg-white/70 py-2.5 pl-10 pr-9 text-sm placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {search && (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-stone-500 hover:bg-stone-200"
        >
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 border-b-2 py-2.5 text-sm font-medium transition-colors ${
    isActive ? 'border-accent-600 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'
  }`;

export default function Header() {
  const { count, openCart } = useCart();
  const { settings, categories, collections, openSizeGuide } = useStore();

  return (
    <>
      {settings.announcement && (
        <p className="bg-stone-900 px-4 py-2 text-center text-xs tracking-wide text-stone-100">{settings.announcement}</p>
      )}

      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to={ROUTES.home} className="flex shrink-0 items-center gap-3" aria-label={`${STORE.name} — inicio`}>
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={STORE.name} className="h-10 w-auto max-w-40 object-contain sm:h-11" />
            ) : (
              <span className="font-display text-3xl font-medium leading-none tracking-tight text-stone-900">
                J <span className="text-accent-600">&amp;</span> A
              </span>
            )}
            <span className="hidden text-[11px] uppercase leading-none tracking-[0.18em] text-stone-500 lg:block">
              {STORE.tagline}
            </span>
          </Link>

          <SearchBox className="mx-auto hidden max-w-md flex-1 md:block" />

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              type="button"
              onClick={openSizeGuide}
              className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900"
            >
              <Ruler className="size-4" aria-hidden />
              <span className="hidden min-[400px]:inline">Guía de Tallas</span>
              <span className="min-[400px]:hidden">Tallas</span>
            </button>
            <button
              type="button"
              onClick={openCart}
              aria-label={`Abrir carrito, ${count} ${count === 1 ? 'producto' : 'productos'}`}
              className="relative flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
            >
              <ShoppingBag className="size-4" aria-hidden />
              <span className="hidden sm:inline">Carrito</span>
              {count > 0 && (
                <span
                  key={count}
                  className="grid min-w-5 animate-pop-in place-items-center rounded-full bg-accent-600 px-1.5 text-xs font-bold leading-5 ring-2 ring-stone-50"
                >
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="px-4 pb-2 md:hidden">
          <SearchBox />
        </div>

        {/* Navegación por secciones: categorías, temporadas y ofertas */}
        <nav aria-label="Secciones de la tienda" className="border-t border-stone-200/60">
          <div className="no-scrollbar mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 sm:px-6">
            <NavLink to={ROUTES.home} end className={navLinkClass}>
              Inicio
            </NavLink>
            {[...categories, ...collections].map((section) => (
              <NavLink key={section.id} to={ROUTES.section(section.slug)} className={navLinkClass}>
                {section.name}
              </NavLink>
            ))}
            <NavLink
              to={ROUTES.offers}
              className={({ isActive }) =>
                `shrink-0 border-b-2 py-2.5 text-sm font-semibold ${isActive ? 'border-accent-600 text-accent-700' : 'border-transparent text-accent-600 hover:text-accent-700'}`
              }
            >
              Ofertas
            </NavLink>
          </div>
        </nav>
      </header>
    </>
  );
}
