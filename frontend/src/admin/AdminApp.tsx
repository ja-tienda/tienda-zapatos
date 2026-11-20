import { ExternalLink, LoaderCircle, LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FALLBACK_SETTINGS, STORE } from '../config/constants';
import { ApiError, api } from '../services/api';
import { notifyCatalogChanged } from '../services/catalogSync';
import type {
  AdminSummary,
  Complaint,
  Customer,
  EditableSettings,
  Order,
  OrderStatus,
  Product,
  ProductInput,
  Section,
  SectionInput,
  SectionKind,
  Settings,
  User,
} from '../types';
import { AdminContext, type AdminContextValue } from './AdminContext';
import AccessPanel from './components/AccessPanel';
import ComplaintsPanel from './components/ComplaintsPanel';
import CustomersPanel from './components/CustomersPanel';
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
  { id: 'clientes', label: 'Clientes' },
  { id: 'reclamos', label: 'Reclamos' },
  { id: 'secciones', label: 'Secciones' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'tienda', label: 'Contacto y pagos' },
  { id: 'acceso', label: 'Mi acceso' },
  { id: 'vista-previa', label: 'Vista previa' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Cada cuánto se revisa si entraron pedidos o reclamos nuevos. */
const REFRESH_MS = 30_000;

function tabFromHash(): TabId {
  const hash = window.location.hash.slice(1);
  return TABS.some((t) => t.id === hash) ? (hash as TabId) : 'productos';
}

export default function AdminApp() {
  /** undefined = comprobando si ya hay sesión · null = sin sesión */
  const [admin, setAdmin] = useState<User | null | undefined>(undefined);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(tabFromHash);
  /** undefined = lista · null = producto nuevo · Product = editando */
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [editingSection, setEditingSection] = useState<{ section: Section | null; kind: SectionKind } | undefined>(undefined);
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [settings, setSettings] = useState<Settings>(FALLBACK_SETTINGS);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ¿Ya había una sesión de administración abierta en este navegador?
  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        if (user && user.role !== 'ADMIN') setLoginNotice('Tienes abierta una cuenta de cliente. Entra con tu usuario de administración.');
        setAdmin(user?.role === 'ADMIN' ? user : null);
      })
      .catch(() => setAdmin(null));
  }, []);

  // Al cambiar de pestaña el producto que se estaba creando o editando queda abierto
  // (y su borrador guardado): al volver a "Productos y stock" sigue ahí, tal cual.
  const closeForms = () => setEditingSection(undefined);

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

  /** Ejecuta una llamada del panel. Si la sesión venció (401), vuelve a pedir usuario y contraseña. */
  const call = useCallback(
    async <T,>(fn: () => Promise<T>, options: { rethrow?: boolean; silent?: boolean } = {}): Promise<T | undefined> => {
      try {
        if (!options.silent) setError(null);
        return await fn();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setLoginNotice('Tu sesión venció. Vuelve a entrar.');
          setAdmin(null);
          return undefined;
        }
        if (options.rethrow) throw err;
        if (!options.silent) setError(err instanceof Error ? err.message : 'Ocurrió un error');
        return undefined;
      }
    },
    [],
  );

  const refreshInbox = useCallback(
    async (silent = false) => {
      const [o, s, c] = await Promise.all([
        call(() => api.getOrders(), { silent }),
        call(() => api.getSummary(), { silent }),
        call(() => api.getComplaints(), { silent }),
      ]);
      if (o) setOrders(o);
      if (s) setSummary(s);
      if (c) setComplaints(c);
    },
    [call],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [p, sec, set, cus] = await Promise.all([
      call(() => api.getAllProducts()),
      call(() => api.getAllSections()),
      call(() => api.getSettings()),
      call(() => api.getCustomers()),
      refreshInbox(),
    ]);
    if (p) setProducts(p);
    if (sec) setSections(sec);
    if (set) setSettings(set);
    if (cus) setCustomers(cus);
    setLoading(false);
  }, [call, refreshInbox]);

  useEffect(() => {
    if (!admin) return;
    void loadAll();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshInbox(true);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [admin, loadAll, refreshInbox]);

  async function logout() {
    await api.logout().catch(() => {});
    setLoginNotice(null);
    setAdmin(null);
  }

  /** Tras cualquier cambio: avisa a la tienda (se actualiza al instante) y refresca los contadores. */
  function storeChanged() {
    notifyCatalogChanged();
    void call(() => api.getSummary(), { silent: true }).then((s) => s && setSummary(s));
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
    changeStock: async (id, delta) => applyProduct(await call(() => api.patchVariant(id, { delta }))),
    setStock: async (id, stock) => applyProduct(await call(() => api.patchVariant(id, { stock }))),
    toggleVariant: async (id, isActive) => applyProduct(await call(() => api.patchVariant(id, { isActive }))),
    deleteVariant: async (id) => applyProduct(await call(() => api.deleteVariant(id))),
    addVariant: async (productId, size, usSize) =>
      applyProduct(await call(() => api.addVariant(productId, { size, usSize, stock: 0 }))),
    renameVariant: async (id, size, usSize) => applyProduct(await call(() => api.patchVariant(id, { size, usSize }))),
  };

  async function refreshProducts() {
    const fresh = await call(() => api.getAllProducts(), { silent: true });
    if (fresh) setProducts(fresh);
  }

  async function refreshSections() {
    const fresh = await call(() => api.getAllSections(), { silent: true });
    if (fresh) setSections(fresh);
  }

  async function saveProduct(data: ProductInput): Promise<boolean> {
    const target = editingProduct;
    const saved = await call(() => (target ? api.updateProduct(target.id, data) : api.createProduct(data)), { rethrow: true });
    if (!saved) return false; // sesión vencida: el borrador se conserva para después de entrar
    applyProduct(saved);
    setLastSavedId(saved.id);
    setEditingProduct(undefined);
    void refreshSections();
    return true;
  }

  async function removeProduct(product: Product) {
    if (!confirm(`¿Eliminar "${product.name}" y todas sus tallas? Esta acción no se puede deshacer.`)) return;
    const ok = await call(async () => {
      await api.deleteProduct(product.id);
      return true;
    });
    if (!ok) return;
    setProducts((list) => list.filter((p) => p.id !== product.id));
    storeChanged();
    void refreshSections();
  }

  // ---------- Secciones ----------
  async function saveSection(data: SectionInput, productIds?: number[]) {
    const target = editingSection?.section;
    const { kind: _kind, ...changes } = data;
    const saved = await call(
      async () => {
        if (target) return api.updateSection(target.id, { ...changes, productIds });
        const created = await api.createSection(data);
        // Una temporada nueva recibe sus productos en un segundo paso
        return productIds?.length ? api.updateSection(created.id, { productIds }) : created;
      },
      { rethrow: true },
    );
    if (!saved) return;
    setEditingSection(undefined);
    // El nombre de una categoría y las temporadas viajan dentro de cada producto: se recargan
    await Promise.all([refreshSections(), refreshProducts()]);
    storeChanged();
  }

  async function toggleSection(section: Section) {
    const saved = await call(() => api.updateSection(section.id, { isActive: !section.isActive }));
    if (!saved) return;
    await refreshSections();
    storeChanged();
  }

  async function removeSection(section: Section) {
    const what = section.kind === 'CATEGORIA' ? 'la categoría' : 'la temporada';
    if (!confirm(`¿Eliminar ${what} "${section.name}"? Sus productos no se borran. Esta acción no se puede deshacer.`)) return;
    const ok = await call(async () => {
      await api.deleteSection(section.id);
      return true;
    });
    if (!ok) return;
    await Promise.all([refreshSections(), refreshProducts()]);
    storeChanged();
  }

  // ---------- Ajustes ----------
  async function saveSettings(changes: Partial<EditableSettings>) {
    const saved = await call(() => api.updateSettings(changes), { rethrow: true });
    if (!saved) throw new Error('Tu sesión venció. Vuelve a entrar.');
    setSettings(saved);
    notifyCatalogChanged();
  }

  // ---------- Pedidos ----------
  async function setOrderStatus(orderId: number, status: OrderStatus): Promise<Order | undefined> {
    const updated = await call(() => api.setOrderStatus(orderId, status));
    if (!updated) return undefined;
    setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)));
    // Cancelar devuelve stock al inventario: se recarga. También cambia lo comprado por el cliente.
    await refreshProducts();
    void call(() => api.getCustomers(), { silent: true }).then((fresh) => fresh && setCustomers(fresh));
    storeChanged();
    return updated;
  }

  // ---------- Clientes y reclamos ----------
  async function setCustomerActive(customer: Customer, isActive: boolean) {
    const result = await call(() => api.setCustomerActive(customer.id, isActive));
    if (result) setCustomers((list) => list.map((c) => (c.id === customer.id ? { ...c, isActive: result.isActive } : c)));
  }

  async function respondComplaint(id: number, response: string): Promise<boolean> {
    const result = await call(() => api.respondComplaint(id, response));
    if (!result) return true; // el error ya se muestra arriba
    setComplaints((list) => list.map((c) => (c.id === id ? result : c)));
    storeChanged();
    return result.emailSent;
  }

  const adminContext = useMemo<AdminContextValue>(
    () => ({
      upload: async (file, folder) => {
        const result = await call(() => api.uploadImage(file, folder), { rethrow: true });
        if (!result) throw new Error('Tu sesión venció. Vuelve a entrar.');
        return result.url;
      },
    }),
    [call],
  );

  if (admin === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-stone-900 text-stone-300">
        <LoaderCircle className="size-6 animate-spin" aria-label="Cargando" />
      </main>
    );
  }

  if (!admin) {
    return (
      <LoginScreen
        key={loginNotice ?? 'login'}
        notice={loginNotice}
        onLogin={(user) => {
          setLoginNotice(null);
          setAdmin(user);
        }}
      />
    );
  }

  const categories = sections.filter((s) => s.kind === 'CATEGORIA');
  const collections = sections.filter((s) => s.kind === 'COLECCION');
  const badges: Partial<Record<TabId, number | undefined>> = {
    pedidos: summary?.pendingOrders,
    reclamos: summary?.pendingComplaints,
  };

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
              <p className="truncate text-xs text-stone-400">{admin.email}</p>
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
              onClick={() => void logout()}
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
                {!!badges[t.id] && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-accent-600 px-1.5 text-xs font-bold leading-5 text-white">
                    {badges[t.id]}
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
          ) : tab === 'acceso' ? (
            <AccessPanel user={admin} />
          ) : tab === 'apariencia' ? (
            <AppearancePanel settings={settings} onSave={saveSettings} />
          ) : tab === 'tienda' ? (
            <StorePanel settings={settings} onSave={saveSettings} />
          ) : tab === 'clientes' ? (
            <CustomersPanel
              customers={customers}
              loadOrders={(id) => api.getCustomerOrders(id)}
              onSetActive={setCustomerActive}
              onSetOrderStatus={setOrderStatus}
            />
          ) : tab === 'reclamos' ? (
            <ComplaintsPanel complaints={complaints} onRespond={respondComplaint} />
          ) : tab === 'secciones' ? (
            editingSection ? (
              <SectionForm
                key={editingSection.section?.id ?? `new-${editingSection.kind}`}
                section={editingSection.section}
                kind={editingSection.kind}
                products={products}
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
                  onClick={() => refreshInbox()}
                  className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 hover:border-stone-900"
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Actualizar
                </button>
              </div>
              <OrdersPanel
                orders={orders}
                onSetStatus={async (id, status) => {
                  await setOrderStatus(id, status);
                }}
              />
            </div>
          ) : editingProduct !== undefined ? (
            <ProductForm
              key={editingProduct?.id ?? 'new'}
              product={editingProduct}
              categories={categories}
              collections={collections}
              onSave={saveProduct}
              onClose={() => setEditingProduct(undefined)}
            />
          ) : (
            <ProductsPanel
              products={products}
              summary={summary}
              stockActions={stockActions}
              initialExpandedId={lastSavedId}
              onNew={() => setEditingProduct(null)}
              onEdit={(product) => setEditingProduct(product)}
              onToggleActive={async (product) => applyProduct(await call(() => api.patchProduct(product.id, { isActive: !product.isActive })))}
              onDelete={removeProduct}
            />
          )}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
