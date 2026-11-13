import { ExternalLink, LoaderCircle, LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FALLBACK_SETTINGS, STORAGE_KEYS, STORE } from '../config/constants';
import { ApiError, api } from '../services/api';
import { notifyCatalogChanged } from '../services/catalogSync';
import type {
  AdminSummary,
  EditableSettings,
  Order,
  OrderStatus,
  Product,
  ProductInput,
  Section,
  SectionInput,
  SectionKind,
  Settings,
} from '../types';
import { AdminContext, type AdminContextValue } from './AdminContext';
import LoginScreen from './components/LoginScreen';
import OrdersPanel from './components/OrdersPanel';
import ProductForm from './components/ProductForm';
import ProductsPanel from './components/ProductsPanel';
import SectionForm from './components/SectionForm';
import SectionsPanel from './components/SectionsPanel';
import { AppearancePanel, StorePanel } from './components/SettingsPanels';
import type { StockActions } from './components/StockEditor';
import StorePreview from './components/StorePreview';

const TABS = [
  { id: 'productos', label: 'Productos y stock' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'secciones', label: 'Secciones' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'tienda', label: 'Contacto y pagos' },
  { id: 'vista-previa', label: 'Vista previa' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Cada cuánto se revisa si entraron pedidos nuevos. */
const ORDERS_REFRESH_MS = 30_000;

function readToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.adminToken);
  } catch {
    return null;
  }
}

function tabFromHash(): TabId {
  const hash = window.location.hash.slice(1);
  return TABS.some((t) => t.id === hash) ? (hash as TabId) : 'productos';
}

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(readToken);
  const [tab, setTab] = useState<TabId>(tabFromHash);
  /** undefined = lista · null = producto nuevo · Product = editando */
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [editingSection, setEditingSection] = useState<{ section: Section | null; kind: SectionKind } | undefined>(undefined);
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [settings, setSettings] = useState<Settings>(FALLBACK_SETTINGS);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeForms = () => {
    setEditingProduct(undefined);
    setEditingSection(undefined);
  };

  // La pestaña activa vive en la URL (#pedidos) para poder recargar o guardar el enlace.
  useEffect(() => {
    const onHash = () => {
      setTab(tabFromHash());
      closeForms();
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTo = (next: TabId) => {
    closeForms();
    setError(null);
    setTab(next);
    history.replaceState(null, '', `#${next}`);
  };

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.adminToken);
    } catch {
      /* sin almacenamiento */
    }
    setToken(null);
  }, []);

  /** Ejecuta una llamada autenticada. Si la sesión venció, vuelve a pedir el PIN. */
  const call = useCallback(
    async <T,>(fn: (token: string) => Promise<T>, options: { rethrow?: boolean; silent?: boolean } = {}): Promise<T | undefined> => {
      if (!token) return undefined;
      try {
        if (!options.silent) setError(null);
        return await fn(token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return undefined;
        }
        if (options.rethrow) throw err;
        if (!options.silent) setError(err instanceof Error ? err.message : 'Ocurrió un error');
        return undefined;
      }
    },
    [token, logout],
  );

  const refreshOrders = useCallback(
    async (silent = false) => {
      const [o, s] = await Promise.all([
        call((t) => api.getOrders(t), { silent }),
        call((t) => api.getSummary(t), { silent }),
      ]);
      if (o) setOrders(o);
      if (s) setSummary(s);
    },
    [call],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [p, sec, set] = await Promise.all([
      call((t) => api.getAllProducts(t)),
      call((t) => api.getAllSections(t)),
      call(() => api.getSettings()),
      refreshOrders(),
    ]);
    if (p) setProducts(p);
    if (sec) setSections(sec);
    if (set) setSettings(set);
    setLoading(false);
  }, [call, refreshOrders]);

  useEffect(() => {
    if (!token) return;
    void loadAll();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshOrders(true);
    }, ORDERS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [token, loadAll, refreshOrders]);

  function handleLogin(newToken: string) {
    try {
      sessionStorage.setItem(STORAGE_KEYS.adminToken, newToken);
    } catch {
      /* sin almacenamiento: la sesión dura hasta cerrar la pestaña */
    }
    setToken(newToken);
  }

  /** Tras cualquier cambio: avisa a la tienda (se actualiza al instante) y refresca los contadores. */
  function storeChanged() {
    notifyCatalogChanged();
    void call((t) => api.getSummary(t), { silent: true }).then((s) => s && setSummary(s));
  }

  // ---------- Productos ----------
  function applyProduct(updated: Product | undefined) {
    if (!updated) return;
    setProducts((list) =>
      list.some((p) => p.id === updated.id) ? list.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...list],
    );
    storeChanged();
  }

  const stockActions: StockActions = {
    changeStock: async (id, delta) => applyProduct(await call((t) => api.patchVariant(t, id, { delta }))),
    setStock: async (id, stock) => applyProduct(await call((t) => api.patchVariant(t, id, { stock }))),
    toggleVariant: async (id, isActive) => applyProduct(await call((t) => api.patchVariant(t, id, { isActive }))),
    deleteVariant: async (id) => applyProduct(await call((t) => api.deleteVariant(t, id))),
    addVariant: async (productId, size) => applyProduct(await call((t) => api.addVariant(t, productId, { size, stock: 0 }))),
  };

  async function saveProduct(data: ProductInput) {
    const target = editingProduct;
    const saved = await call((t) => (target ? api.updateProduct(t, target.id, data) : api.createProduct(t, data)), {
      rethrow: true,
    });
    if (!saved) return;
    applyProduct(saved);
    setLastSavedId(saved.id);
    setEditingProduct(undefined);
    void refreshSections();
  }

  async function removeProduct(product: Product) {
    if (!confirm(`¿Eliminar "${product.name}" y todas sus tallas? Esta acción no se puede deshacer.`)) return;
    const ok = await call(async (t) => {
      await api.deleteProduct(t, product.id);
      return true;
    });
    if (!ok) return;
    setProducts((list) => list.filter((p) => p.id !== product.id));
    storeChanged();
    void refreshSections();
  }

  // ---------- Secciones ----------
  async function refreshSections() {
    const fresh = await call((t) => api.getAllSections(t), { silent: true });
    if (fresh) setSections(fresh);
  }

  async function saveSection(data: SectionInput) {
    const target = editingSection?.section;
    const { kind: _kind, ...changes } = data;
    const saved = await call((t) => (target ? api.updateSection(t, target.id, changes) : api.createSection(t, data)), {
      rethrow: true,
    });
    if (!saved) return;
    setEditingSection(undefined);
    await refreshSections();
    // El nombre de una categoría viaja dentro de cada producto: se recargan para reflejarlo
    const fresh = await call((t) => api.getAllProducts(t), { silent: true });
    if (fresh) setProducts(fresh);
    storeChanged();
  }

  async function toggleSection(section: Section) {
    const saved = await call((t) => api.updateSection(t, section.id, { isActive: !section.isActive }));
    if (!saved) return;
    await refreshSections();
    storeChanged();
  }

  async function removeSection(section: Section) {
    const what = section.kind === 'CATEGORIA' ? 'la categoría' : 'la temporada';
    if (!confirm(`¿Eliminar ${what} "${section.name}"? Sus productos no se borran. Esta acción no se puede deshacer.`)) return;
    const ok = await call(async (t) => {
      await api.deleteSection(t, section.id);
      return true;
    });
    if (!ok) return;
    await refreshSections();
    storeChanged();
  }

  // ---------- Ajustes ----------
  async function saveSettings(changes: Partial<EditableSettings>) {
    const saved = await call((t) => api.updateSettings(t, changes), { rethrow: true });
    if (!saved) throw new Error('Tu sesión venció. Ingresa tu PIN otra vez.');
    setSettings(saved);
    notifyCatalogChanged();
  }

  // ---------- Pedidos ----------
  async function setOrderStatus(orderId: number, status: OrderStatus) {
    const updated = await call((t) => api.setOrderStatus(t, orderId, status));
    if (!updated) return;
    setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)));
    // Confirmar o cancelar mueve stock: se recarga el inventario.
    const fresh = await call((t) => api.getAllProducts(t));
    if (fresh) setProducts(fresh);
    storeChanged();
  }

  const adminContext = useMemo<AdminContextValue>(
    () => ({
      upload: async (file, folder) => {
        const result = await call((t) => api.uploadImage(t, file, folder), { rethrow: true });
        if (!result) throw new Error('Tu sesión venció. Ingresa tu PIN otra vez.');
        return result.url;
      },
    }),
    [call],
  );

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  const categories = sections.filter((s) => s.kind === 'CATEGORIA');
  const collections = sections.filter((s) => s.kind === 'COLECCION');

  return (
    <AdminContext.Provider value={adminContext}>
      <div className="min-h-dvh bg-stone-100">
        <header className="sticky top-0 z-20 bg-stone-900 text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <span className="grid h-9 place-items-center rounded-lg bg-accent-600 px-2 text-sm font-extrabold tracking-tight">
              {STORE.name}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">Panel de administración</p>
              <p className="truncate text-xs text-stone-400">{STORE.tagline}</p>
            </div>
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="ml-auto flex items-center gap-1.5 rounded-full border border-stone-700 px-3 py-2 text-sm font-medium hover:border-white"
            >
              <ExternalLink className="size-4" aria-hidden />
              <span className="hidden sm:inline">Ver tienda</span>
            </a>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>

          <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Secciones del panel">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => goTo(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold ${
                  tab === t.id ? 'border-accent-500 text-white' : 'border-transparent text-stone-400 hover:text-white'
                }`}
              >
                {t.label}
                {t.id === 'pedidos' && !!summary?.pendingOrders && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-accent-600 px-1.5 text-xs font-bold leading-5 text-white">
                    {summary.pendingOrders}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {error && (
            <p className="mb-4 rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-700" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="flex items-center justify-center gap-2 py-24 text-sm text-stone-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Cargando la tienda…
            </p>
          ) : tab === 'vista-previa' ? (
            <StorePreview />
          ) : tab === 'apariencia' ? (
            <AppearancePanel settings={settings} onSave={saveSettings} />
          ) : tab === 'tienda' ? (
            <StorePanel settings={settings} onSave={saveSettings} />
          ) : tab === 'secciones' ? (
            editingSection ? (
              <SectionForm
                key={editingSection.section?.id ?? `new-${editingSection.kind}`}
                section={editingSection.section}
                kind={editingSection.kind}
                onSave={saveSection}
                onCancel={() => setEditingSection(undefined)}
              />
            ) : (
              <SectionsPanel
                sections={sections}
                onNew={(kind) => setEditingSection({ section: null, kind })}
                onEdit={(section) => setEditingSection({ section, kind: section.kind })}
                onToggleActive={toggleSection}
                onDelete={removeSection}
              />
            )
          ) : tab === 'pedidos' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-extrabold text-stone-900">Pedidos</h1>
                <button
                  type="button"
                  onClick={() => refreshOrders()}
                  className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 hover:border-stone-900"
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Actualizar
                </button>
              </div>
              <OrdersPanel orders={orders} onSetStatus={setOrderStatus} />
            </div>
          ) : editingProduct !== undefined ? (
            <ProductForm
              key={editingProduct?.id ?? 'new'}
              product={editingProduct}
              categories={categories}
              collections={collections}
              onSave={saveProduct}
              onCancel={() => setEditingProduct(undefined)}
            />
          ) : (
            <ProductsPanel
              products={products}
              summary={summary}
              stockActions={stockActions}
              initialExpandedId={lastSavedId}
              onNew={() => setEditingProduct(null)}
              onEdit={(product) => setEditingProduct(product)}
              onToggleActive={async (product) =>
                applyProduct(await call((t) => api.patchProduct(t, product.id, { isActive: !product.isActive })))
              }
              onDelete={removeProduct}
            />
          )}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
