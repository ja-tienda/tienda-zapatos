import { MessageCircle } from 'lucide-react';
import { STORE } from '../../config/constants';
import { useStore } from '../../context/StoreContext';
import { whatsappUrl } from '../../utils/format';

/** Botón flotante de consulta. Usa el nombre y el número de contacto configurados en el panel. */
export default function FloatingWhatsApp() {
  const { settings } = useStore();

  return (
    <a
      href={whatsappUrl(
        settings.contactPhone,
        `¡Hola ${settings.contactName}! 👋 Vengo de la tienda virtual ${STORE.name} y tengo una consulta.`,
      )}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Consultar a ${settings.contactName} por WhatsApp`}
      className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-emerald-600 p-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-transform hover:scale-105 hover:bg-emerald-700 sm:px-5"
    >
      <MessageCircle className="size-5" aria-hidden />
      <span className="hidden sm:inline">Consultar a {settings.contactName}</span>
    </a>
  );
}
