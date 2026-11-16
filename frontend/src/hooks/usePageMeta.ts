import { useEffect } from 'react';
import { STORE } from '../config/constants';

const DEFAULT_TITLE = `${STORE.name} — ${STORE.tagline}`;

function setMeta(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
}

/**
 * Título y descripción de la página mientras el cliente navega ("Calzados — J & A").
 * Para buscadores y para las vistas previas de WhatsApp/Facebook, que no ejecutan
 * JavaScript, el servidor del frontend escribe estos mismos datos en el HTML (ver vite.config.ts).
 */
export function usePageMeta(title?: string | null, description?: string | null) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${STORE.name}` : DEFAULT_TITLE;
    document.title = fullTitle;
    setMeta('meta[property="og:title"]', fullTitle);
    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
    }
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description]);
}
