export type Gender = 'NINO' | 'NINA' | 'DAMA' | 'CABALLERO' | 'UNISEX';
export type Badge = 'NUEVO' | 'OFERTA' | 'ULTIMO_PAR';
export type SectionKind = 'CATEGORIA' | 'COLECCION';
export type SizeType = 'CALZADO' | 'ROPA' | 'UNICA';
export type DeliveryMethod = 'DELIVERY_LOCAL' | 'ENVIO_PROVINCIA' | 'RECOJO';
export type PaymentMethod = 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'CONTRA_ENTREGA' | 'TARJETA';
export type OrderStatus = 'PENDIENTE' | 'PAGADO' | 'ENVIADO' | 'ENTREGADO' | 'CANCELADO';
export type Role = 'ADMIN' | 'CUSTOMER';

/** Cuenta con sesión iniciada (cliente o administradora). Nunca incluye la contraseña. */
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  hasPassword: boolean;
  hasGoogle: boolean;
}

/** Sección con página propia: categoría (Calzados…) o colección/temporada (Verano…). */
export interface Section {
  id: number;
  name: string;
  slug: string;
  kind: SectionKind;
  sizeType: SizeType;
  coverImage: string | null;
  heroTitle: string;
  heroText: string;
  ctaLabel: string;
  showInCarousel: boolean;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

/** sortOrder vacío = el servidor la coloca al final de su grupo. */
export type SectionInput = Omit<Section, 'id' | 'slug' | 'productCount' | 'sortOrder'> & { sortOrder?: number };

export interface Variant {
  id: number;
  size: string;
  usSize: string | null;
  cmSize: string | null;
  stock: number;
  isActive: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  description: string;
  category: { id: number; name: string; slug: string; sizeType: SizeType };
  collectionIds: number[];
  gender: Gender;
  price: number;
  originalPrice: number | null;
  badge: Badge | null;
  images: string[];
  featured: boolean;
  isActive: boolean;
  createdAt: string;
  variants: Variant[];
}

export interface ProductInput {
  name: string;
  brand: string | null;
  description: string;
  categoryId: number;
  collectionIds: number[];
  gender: Gender;
  price: number;
  originalPrice: number | null;
  badge: Badge | null;
  images: string[];
  featured: boolean;
  isActive: boolean;
  variants?: { size: string; stock: number; usSize?: string | null }[];
}

/** Ajustes editables desde el panel (mismas claves que backend/src/config/settings.ts). */
export interface Settings {
  logoUrl: string;
  announcement: string;
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  heroButtonLabel: string;
  heroImage: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  businessHours: string;
  walletNumber: string;
  walletHolder: string;
  walletQrUrl: string;
  businessName: string;
  businessRuc: string;
  businessAddress: string;
  seoDescription: string;
  returnsText: string;
  termsText: string;
  privacyText: string;
  /** Solo lectura: indica si el servidor tiene configuradas las claves de Izipay. */
  cardPaymentsEnabled: boolean;
}

export type EditableSettings = Omit<Settings, 'cardPaymentsEnabled'>;

/** Línea del carrito. `maxStock` se refresca cada vez que llega el catálogo de la BD. */
export interface CartItem {
  variantId: number;
  productId: number;
  name: string;
  image: string | null;
  size: string;
  price: number;
  quantity: number;
  maxStock: number;
}

export interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  notes: string;
}

export interface OrderItem {
  id: number;
  productId: number | null;
  variantId: number | null;
  productName: string;
  size: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: number;
  code: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryMethod: DeliveryMethod;
  address: string;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  total: number;
  status: OrderStatus;
  /** El cliente ya envió la captura de su pago */
  hasReceipt: boolean;
  /** Solo en el panel: ruta protegida para ver la captura */
  receiptUrl?: string | null;
  paymentRef?: string | null;
  userId?: number | null;
  paidAt: string | null;
  /** Hasta cuándo se guarda el stock si aún no paga (null = no vence sola) */
  reservedUntil: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface AdminSummary {
  products: number;
  activeProducts: number;
  pendingOrders: number;
  lowStock: number;
  outOfStock: number;
  pendingComplaints: number;
  customers: number;
}

/** Cliente registrado, como lo ve la administradora. */
export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  withGoogle: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  orderCount: number;
  favoriteCount: number;
  totalSpent: number;
}

export type ComplaintType = 'RECLAMO' | 'QUEJA';

/** Lo que llena el consumidor en el Libro de Reclamaciones. */
export interface ComplaintInput {
  type: ComplaintType;
  customerName: string;
  documentType: 'DNI' | 'CE' | 'PASAPORTE';
  documentNumber: string;
  phone: string;
  email: string;
  address: string;
  guardianName: string;
  itemType: 'PRODUCTO' | 'SERVICIO';
  itemDescription: string;
  amount: number | null;
  orderCode: string;
  detail: string;
  request: string;
  acceptTerms: boolean;
}

export interface Complaint extends Omit<ComplaintInput, 'acceptTerms' | 'guardianName' | 'orderCode'> {
  id: number;
  code: string;
  guardianName: string | null;
  orderCode: string | null;
  status: 'PENDIENTE' | 'ATENDIDO';
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

/** Diagnóstico del servidor para comprobar la configuración tras desplegar. */
export interface Diagnostics {
  production: boolean;
  appUrl: string;
  apiUrl: string;
  yourIp: string | null;
  forwardedFor: string | null;
  trustProxy: number;
  https: boolean;
  cookieSameSite: string;
  googleLogin: boolean;
  emails: boolean;
  cardPayments: boolean;
  cardPaymentsMode: string | null;
  googleRedirectUri: string;
  izipayNotificationUrl: string;
}

export type SortOption = 'DESTACADOS' | 'PRECIO_ASC' | 'PRECIO_DESC';
