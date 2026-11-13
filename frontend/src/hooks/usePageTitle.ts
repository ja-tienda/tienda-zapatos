import { useEffect } from 'react';
import { STORE } from '../config/constants';

const DEFAULT_TITLE = `${STORE.name} — ${STORE.tagline}`;

/** Título de la pestaña del navegador (y del enlace al compartirlo): "Calzados — J & A". */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — ${STORE.name}` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
