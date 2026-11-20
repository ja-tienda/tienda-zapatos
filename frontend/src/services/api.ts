import type {
  AdminSummary,
  CheckoutForm,
  Complaint,
  ComplaintInput,
  Customer,
  Diagnostics,
  EditableSettings,
  Order,
  OrderStatus,
  Product,
  ProductInput,
  Section,
  SectionInput,
  Settings,
  User,
} from '../types';

/**
 * Dirección de la API. Vacío = mismo dominio que la tienda (lo recomendado: el servidor del
 * frontend reenvía /api y /uploads al backend). VITE_API_URL no es un secreto: solo dice
 * dónde está la API. Ninguna clave privada debe ir en variables VITE_*, porque terminan
 * dentro del JavaScript que descarga el navegador.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const BASE_URL = `${API_ORIGIN}/api`;

/** Dirección completa de un recurso de la API (p. ej. la captura privada de un pago). */
export const apiAsset = (path: string) => (path.startsWith('/') ? `${API_ORIGIN}${path}` : path);

/** Enlace para "Continuar con Google": es una navegación completa, no una llamada fetch. */
export const googleLoginUrl = (next: string) => `${BASE_URL}/auth/google?next=${encodeURIComponent(next)}`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  /** Objeto (se envía como JSON) o FormData (archivos). */
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      // La sesión viaja en una cookie httpOnly que el navegador adjunta solo: aquí no se
      // guarda ni se lee ninguna clave.
      credentials: 'include',
      headers: {
        // Cabecera propia: el servidor la exige en todo lo que modifica datos (protección CSRF)
        'X-Requested-With': 'ja-web',
        ...(options.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.');
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // El servidor antepone el nombre del campo en los errores de validación ("email: …")
    const message = typeof data?.error === 'string' ? data.error.replace(/^[A-Za-z.]+: /, '') : `Error ${response.status}`;
    throw new ApiError(response.status, message, data?.details);
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body });

function fileForm(file: File, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append('file', file);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  return form;
}

export interface OrderPayload extends CheckoutForm {
  items: { variantId: number; quantity: number }[];
}

export const api = {
  // ── Tienda (público) ──
  getSettings: () => request<Settings>('/settings'),
  getSections: () => request<Section[]>('/sections'),
  getProducts: () => request<Product[]>('/products'),
  sendComplaint: (data: ComplaintInput) => post<{ code: string; createdAt: string; emailSent: boolean }>('/complaints', data),

  // ── Cuenta ──
  me: () => request<{ user: User | null; googleEnabled: boolean }>('/auth/me'),
  register: (data: { name: string; email: string; password: string; acceptTerms: boolean }) =>
    post<{ user: User }>('/auth/register', data),
  login: (identifier: string, password: string) => post<{ user: User }>('/auth/login', { identifier, password }),
  logout: () => post<void>('/auth/logout'),
  forgotPassword: (email: string) => post<{ ok: true }>('/auth/forgot', { email }),
  resetPassword: (token: string, password: string) => post<{ ok: true; role: User['role'] }>('/auth/reset', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ ok: true }>('/auth/password', { currentPassword, newPassword }),
  updateProfile: (data: { name: string; phone: string }) => request<{ user: User }>('/auth/profile', { method: 'PUT', body: data }),

  myOrders: () => request<Order[]>('/account/orders'),
  getFavorites: () => request<number[]>('/account/favorites'),
  addFavorite: (productId: number) => request<number[]>(`/account/favorites/${productId}`, { method: 'PUT' }),
  removeFavorite: (productId: number) => request<number[]>(`/account/favorites/${productId}`, { method: 'DELETE' }),
  mergeFavorites: (productIds: number[]) => post<number[]>('/account/favorites/merge', { productIds }),

  // ── Pedido del cliente (el servidor comprueba que sea suyo) ──
  createOrder: (payload: OrderPayload) => post<Order>('/orders', payload),
  getOrder: (code: string) => request<Order>(`/orders/${code}`),
  sendReceipt: (code: string, file: File, method: 'YAPE' | 'PLIN') => post<Order>(`/orders/${code}/receipt`, fileForm(file, { method })),
  setManualMethod: (code: string, paymentMethod: 'TRANSFERENCIA' | 'CONTRA_ENTREGA') =>
    post<Order>(`/orders/${code}/method`, { paymentMethod }),
  cancelOrder: (code: string) => post<Order>(`/orders/${code}/cancel`),
  startCardPayment: (code: string, email?: string) =>
    post<{ formToken: string; publicKey: string }>(`/orders/${code}/card`, email ? { email } : {}),

  // ── Administración ──
  getSummary: () => request<AdminSummary>('/admin/summary'),
  getDiagnostics: () => request<Diagnostics>('/admin/diagnostics'),
  uploadImage: (file: File, folder: 'productos' | 'sitio') => post<{ url: string }>(`/uploads?folder=${folder}`, fileForm(file)),
  updateSettings: (changes: Partial<EditableSettings>) => request<Settings>('/settings', { method: 'PUT', body: changes }),

  getAllSections: () => request<Section[]>('/sections?all=1'),
  createSection: (data: SectionInput) => post<Section>('/sections', data),
  updateSection: (id: number, data: Partial<Omit<SectionInput, 'kind'>> & { productIds?: number[] }) =>
    request<Section>(`/sections/${id}`, { method: 'PUT', body: data }),
  deleteSection: (id: number) => request<void>(`/sections/${id}`, { method: 'DELETE' }),

  getAllProducts: () => request<Product[]>('/products?all=1'),
  createProduct: (data: ProductInput) => post<Product>('/products', data),
  updateProduct: (id: number, data: Partial<ProductInput>) => request<Product>(`/products/${id}`, { method: 'PUT', body: data }),
  patchProduct: (id: number, data: Partial<ProductInput>) => request<Product>(`/products/${id}`, { method: 'PATCH', body: data }),
  deleteProduct: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  addVariant: (productId: number, data: { size: string; stock: number; usSize?: string | null }) => post<Product>(`/products/${productId}/variants`, data),
  patchVariant: (
    variantId: number,
    data: { delta?: number; stock?: number; isActive?: boolean; size?: string; usSize?: string | null },
  ) =>
    request<Product>(`/variants/${variantId}`, { method: 'PATCH', body: data }),
  deleteVariant: (variantId: number) => request<Product>(`/variants/${variantId}`, { method: 'DELETE' }),

  getOrders: () => request<Order[]>('/orders'),
  setOrderStatus: (id: number, status: OrderStatus) => request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),

  getCustomers: () => request<Customer[]>('/admin/customers'),
  getCustomerOrders: (id: number) => request<Order[]>(`/admin/customers/${id}/orders`),
  setCustomerActive: (id: number, isActive: boolean) =>
    request<{ id: number; isActive: boolean }>(`/admin/customers/${id}`, { method: 'PATCH', body: { isActive } }),

  getComplaints: () => request<Complaint[]>('/complaints'),
  respondComplaint: (id: number, response: string) => post<Complaint & { emailSent: boolean }>(`/complaints/${id}/response`, { response }),
};
