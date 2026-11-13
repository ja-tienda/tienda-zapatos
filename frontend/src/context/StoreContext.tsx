import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FALLBACK_SETTINGS } from '../config/constants';
import { api } from '../services/api';
import { onCatalogChanged } from '../services/catalogSync';
import type { Product, Section, Settings } from '../types';
import { useCart } from './CartContext';

interface StoreContextValue {
  products: Product[];
  /** Categorías activas (Calzados, Ropa…), en el orden definido en el panel. */
  categories: Section[];
  /** Colecciones y temporadas activas. */
  collections: Section[];
  settings: Settings;
  loading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;

  /** Producto abierto en el modal de detalle (con talla preseleccionada opcional). */
  detail: { productId: number; variantId?: number } | null;
  openProduct: (product: Product, variantId?: number) => void;
  closeProduct: () => void;

  sizeGuideOpen: boolean;
  openSizeGuide: () => void;
  closeSizeGuide: () => void;

  /** Avisos de stock/precio generados al cruzar el carrito con la BD. */
  cartNotices: string[];
  dismissCartNotices: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** Cada cuánto se vuelve a pedir el contenido para reflejar lo que cambia la administradora. */
const REFRESH_MS = 30_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [settings, setSettings] = useState<Settings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<StoreContextValue['detail']>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [cartNotices, setCartNotices] = useState<string[]>([]);

  const syncCart = useRef(cart.syncWithCatalog);
  syncCart.current = cart.syncWithCatalog;

  const reload = useCallback(async () => {
    try {
      const [nextProducts, nextSections, nextSettings] = await Promise.all([
        api.getProducts(),
        api.getSections(),
        api.getSettings(),
      ]);
      setProducts(nextProducts);
      setSections(nextSections);
      setSettings(nextSettings);
      setLoadError(null);
      const notices = syncCart.current(nextProducts);
      if (notices.length > 0) setCartNotices(notices);
    } catch (err) {
      // Si ya hay contenido en pantalla, un fallo de refresco no debe borrarlo.
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la tienda');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    // El panel de administración avisa al instante cuando cambia algo.
    const stopListening = onCatalogChanged(() => void reload());
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      stopListening();
    };
  }, [reload]);

  const value = useMemo<StoreContextValue>(
    () => ({
      products,
      categories: sections.filter((s) => s.kind === 'CATEGORIA'),
      collections: sections.filter((s) => s.kind === 'COLECCION'),
      settings,
      loading,
      loadError,
      reload,
      detail,
      openProduct: (product, variantId) => setDetail({ productId: product.id, variantId }),
      closeProduct: () => setDetail(null),
      sizeGuideOpen,
      openSizeGuide: () => setSizeGuideOpen(true),
      closeSizeGuide: () => setSizeGuideOpen(false),
      cartNotices,
      dismissCartNotices: () => setCartNotices([]),
    }),
    [products, sections, settings, loading, loadError, reload, detail, sizeGuideOpen, cartNotices],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}
