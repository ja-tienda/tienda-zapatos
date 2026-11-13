import type {
  AdminSummary,
  CheckoutForm,
  EditableSettings,
  Order,
  OrderStatus,
  Product,
  ProductInput,
  Section,
  SectionInput,
  Settings,
} from '../types';

const BASE_URL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

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
  /** Sesión de la administradora */
  token?: string | null;
  /** Clave del pedido del cliente */
  orderToken?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.orderToken ? { 'X-Order-Token': options.orderToken } : {}),
      },
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.');
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? `Error ${response.status}`, data?.details);
  }
  return data as T;
}

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
  // --- Tienda (público) ---
  getSettings: () => request<Settings>('/settings'),
  getSections: () => request<Section[]>('/sections'),
  getProducts: () => request<Product[]>('/products'),

  // --- Pedido del cliente (code + clave que se guardó al crearlo) ---
  createOrder: (payload: OrderPayload) =>
    request<{ order: Order; token: string }>('/orders', { method: 'POST', body: payload }),
  getOrder: (code: string, orderToken: string) => request<Order>(`/orders/${code}`, { orderToken }),
  sendReceipt: (code: string, orderToken: string, file: File, method: 'YAPE' | 'PLIN') =>
    request<Order>(`/orders/${code}/receipt`, { method: 'POST', body: fileForm(file, { method }), orderToken }),
  setManualMethod: (code: string, orderToken: string, paymentMethod: 'TRANSFERENCIA' | 'CONTRA_ENTREGA') =>
    request<Order>(`/orders/${code}/method`, { method: 'POST', body: { paymentMethod }, orderToken }),
  cancelOrder: (code: string, orderToken: string) =>
    request<Order>(`/orders/${code}/cancel`, { method: 'POST', orderToken }),
  startCardPayment: (code: string, orderToken: string, email?: string) =>
    request<{ formToken: string; publicKey: string }>(`/orders/${code}/card`, {
      method: 'POST',
      body: email ? { email } : {},
      orderToken,
    }),
  confirmCardPayment: (code: string, orderToken: string, krAnswer: string, krHash: string) =>
    request<Order>(`/orders/${code}/card/confirm`, { method: 'POST', body: { krAnswer, krHash }, orderToken }),

  // --- Administradora ---
  login: (pin: string) => request<{ token: string }>('/admin/login', { method: 'POST', body: { pin } }),
  getSummary: (token: string) => request<AdminSummary>('/admin/summary', { token }),

  uploadImage: (token: string, file: File, folder: 'productos' | 'sitio') =>
    request<{ url: string }>(`/uploads?folder=${folder}`, { method: 'POST', body: fileForm(file), token }),
  updateSettings: (token: string, changes: Partial<EditableSettings>) =>
    request<Settings>('/settings', { method: 'PUT', body: changes, token }),

  getAllSections: (token: string) => request<Section[]>('/sections?all=1', { token }),
  createSection: (token: string, data: SectionInput) =>
    request<Section>('/sections', { method: 'POST', body: data, token }),
  updateSection: (token: string, id: number, data: Partial<Omit<SectionInput, 'kind'>>) =>
    request<Section>(`/sections/${id}`, { method: 'PUT', body: data, token }),
  deleteSection: (token: string, id: number) => request<void>(`/sections/${id}`, { method: 'DELETE', token }),

  getAllProducts: (token: string) => request<Product[]>('/products?all=1', { token }),
  createProduct: (token: string, data: ProductInput) =>
    request<Product>('/products', { method: 'POST', body: data, token }),
  updateProduct: (token: string, id: number, data: Partial<ProductInput>) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: data, token }),
  patchProduct: (token: string, id: number, data: Partial<ProductInput>) =>
    request<Product>(`/products/${id}`, { method: 'PATCH', body: data, token }),
  deleteProduct: (token: string, id: number) => request<void>(`/products/${id}`, { method: 'DELETE', token }),
  addVariant: (token: string, productId: number, data: { size: string; stock: number }) =>
    request<Product>(`/products/${productId}/variants`, { method: 'POST', body: data, token }),
  patchVariant: (token: string, variantId: number, data: { delta?: number; stock?: number; isActive?: boolean }) =>
    request<Product>(`/variants/${variantId}`, { method: 'PATCH', body: data, token }),
  deleteVariant: (token: string, variantId: number) =>
    request<Product>(`/variants/${variantId}`, { method: 'DELETE', token }),

  getOrders: (token: string) => request<Order[]>('/orders', { token }),
  setOrderStatus: (token: string, id: number, status: OrderStatus) =>
    request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: { status }, token }),
};
