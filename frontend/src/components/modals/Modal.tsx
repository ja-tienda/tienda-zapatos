import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Ancho máximo del panel (clase de Tailwind). */
  size?: string;
  /** Oculta el título visualmente (sigue disponible para lectores de pantalla). */
  hideTitle?: boolean;
}

/** Bloquea el scroll del fondo mientras haya algún modal o drawer abierto. */
export function useLockBodyScroll() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}

export function useEscapeKey(onEscape: () => void) {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}

export default function Modal({ title, onClose, children, size = 'max-w-2xl', hideTitle = false }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useLockBodyScroll();
  useEscapeKey(onClose);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-stone-950/60 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[94dvh] w-full ${size} animate-pop-in flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl`}
      >
        {!hideTitle && (
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 className="font-display text-2xl font-medium text-stone-900">{title}</h2>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-stone-700 shadow-sm hover:bg-stone-100"
        >
          <X className="size-5" />
        </button>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
