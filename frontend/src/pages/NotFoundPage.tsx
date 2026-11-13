import { Link } from 'react-router';
import { ROUTES } from '../config/constants';

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">Página no encontrada</p>
      <h1 className="mt-3 font-display text-4xl font-medium text-stone-900">Aquí no hay nada… todavía</h1>
      <p className="mt-3 text-stone-600">Puede que el enlace haya cambiado o que esta sección ya no esté disponible.</p>
      <Link
        to={ROUTES.home}
        className="mt-7 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
