import { createContext, useContext } from 'react';

export interface AdminContextValue {
  /** Sube una imagen desde el dispositivo y devuelve su dirección lista para guardar. */
  upload: (file: File, folder: 'productos' | 'sitio') => Promise<string>;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin debe usarse dentro del panel de administración');
  return ctx;
}

/** Estilo común de los campos de texto del panel. */
export const fieldClass =
  'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none';
