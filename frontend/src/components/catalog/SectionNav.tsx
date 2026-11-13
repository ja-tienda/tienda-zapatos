import { NavLink } from 'react-router';
import { ROUTES } from '../../config/constants';
import { useStore } from '../../context/StoreContext';

const chip = (accent = false) =>
  ({ isActive }: { isActive: boolean }) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
      isActive
        ? accent
          ? 'border-accent-600 bg-accent-600 text-white'
          : 'border-stone-900 bg-stone-900 text-white'
        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
    }`;

/** Botones para saltar entre secciones: Todo, cada categoría, cada temporada y Ofertas. */
export default function SectionNav() {
  const { categories, collections } = useStore();

  return (
    <nav aria-label="Cambiar de sección" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <NavLink to={{ pathname: ROUTES.home, hash: '#catalogo' }} end className={chip()}>
        Todo
      </NavLink>
      {categories.map((section) => (
        <NavLink key={section.id} to={ROUTES.section(section.slug)} className={chip()}>
          {section.name}
        </NavLink>
      ))}
      {collections.map((section) => (
        <NavLink key={section.id} to={ROUTES.section(section.slug)} className={chip()}>
          {section.name}
        </NavLink>
      ))}
      <NavLink to={ROUTES.offers} className={chip(true)}>
        Ofertas
      </NavLink>
    </nav>
  );
}
