import { BookOpenText, Clock, Lock, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import { ROUTES, STORE } from '../../config/constants';
import { useStore } from '../../context/StoreContext';
import { formatPhone, whatsappUrl } from '../../utils/format';

const heading = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400';

/** Pie de página. Teléfono, correo, horario y datos de Yape se editan en el panel (Contacto y pagos). */
export default function Footer() {
  const { settings, categories, collections, openSizeGuide } = useStore();
  const phone = formatPhone(settings.contactPhone);

  return (
    <footer className="mt-24 bg-stone-900 text-stone-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 border-b border-stone-700 py-12 sm:flex-row sm:items-center">
          <p className="max-w-xl font-display text-3xl font-medium leading-tight text-white sm:text-4xl">
            ¿Buscas un modelo o una talla? <em className="font-normal italic text-accent-200">Escríbenos.</em>
          </p>
          <a
            href={whatsappUrl(settings.contactPhone, `¡Hola ${settings.contactName}! Tengo una consulta sobre la tienda ${STORE.name}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-accent-600 hover:text-white"
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp {phone}
          </a>
        </div>

        <div className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={STORE.name} className="h-12 w-auto max-w-44 rounded-lg bg-stone-50 object-contain p-1.5" />
            ) : (
              <p className="font-display text-3xl font-medium text-white">
                J <span className="text-accent-500">&amp;</span> A
              </p>
            )}
            <p className="mt-3 text-sm">{STORE.tagline}</p>
            <p className="mt-1 text-sm text-stone-400">Envíos por Shalom, Olva y delivery local.</p>
          </div>

          <div className="text-sm">
            <p className={heading}>Tienda</p>
            <ul className="mt-3 space-y-2">
              {[...categories, ...collections].map((section) => (
                <li key={section.id}>
                  <Link to={ROUTES.section(section.slug)} className="hover:text-white">
                    {section.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to={ROUTES.offers} className="hover:text-white">
                  Ofertas
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-sm">
            <p className={heading}>Contacto</p>
            <ul className="mt-3 space-y-2.5">
              <li>
                <a
                  href={whatsappUrl(settings.contactPhone, `¡Hola ${settings.contactName}!`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle className="size-4 shrink-0" aria-hidden />
                  {phone}
                </a>
              </li>
              {settings.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2 break-all hover:text-white">
                    <Mail className="size-4 shrink-0" aria-hidden />
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.businessHours && (
                <li className="flex gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="whitespace-pre-line">
                    <span className="block text-stone-400">Horario de atención</span>
                    {settings.businessHours}
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div className="text-sm">
            <p className={heading}>Ayuda y legal</p>
            <ul className="mt-3 space-y-2">
              <li>
                <button type="button" onClick={openSizeGuide} className="hover:text-white">
                  Guía de tallas
                </button>
              </li>
              <li>
                <Link to={ROUTES.account} className="hover:text-white">
                  Mi cuenta y mis pedidos
                </Link>
              </li>
              <li>
                <Link to={ROUTES.returns} className="hover:text-white">
                  Cambios y devoluciones
                </Link>
              </li>
              <li>
                <Link to={ROUTES.terms} className="hover:text-white">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to={ROUTES.privacy} className="hover:text-white">
                  Política de privacidad
                </Link>
              </li>
            </ul>
            {/* Aviso obligatorio en Perú: acceso visible al Libro de Reclamaciones */}
            <Link
              to={ROUTES.complaints}
              className="mt-4 flex w-fit items-center gap-2 rounded-xl border border-stone-600 px-3 py-2 text-stone-100 transition-colors hover:border-white"
            >
              <BookOpenText className="size-5 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase leading-tight tracking-wide">
                Libro de
                <br />
                Reclamaciones
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-800">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-stone-400 sm:px-6">
          <p>
            © {new Date().getFullYear()} {settings.businessName || STORE.name}
            {settings.businessRuc && ` · RUC ${settings.businessRuc}`} · Precios en soles ({STORE.currency})
          </p>
          {/* El panel es una página aparte. target="_top" evita que se abra dentro de la vista previa del panel. */}
          <a href="/admin/" target="_top" rel="nofollow" className="flex items-center gap-1.5 hover:text-stone-200">
            <Lock className="size-3" aria-hidden />
            Acceso administración
          </a>
        </div>
      </div>
    </footer>
  );
}
