export type Gender = 'NINO' | 'NINA' | 'DAMA' | 'CABALLERO' | 'UNISEX';
export type Badge = 'NUEVO' | 'OFERTA' | 'ULTIMO_PAR';
export type SectionKind = 'CATEGORIA' | 'COLECCION';
export type SizeType = 'CALZADO' | 'ROPA' | 'UNICA';
export type DeliveryMethod = 'DELIVERY_LOCAL' | 'ENVIO_PROVINCIA' | 'RECOJO';
export type PaymentMethod = 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'CONTRA_ENTREGA' | 'TARJETA';
export type OrderStatus = 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO';

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
  variants?: { size: string; stock: number }[];
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
  customerEmail: string;
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
  receiptUrl: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface AdminSummary {
  products: number;
  activeProducts: number;
  pendingOrders: number;
  lowStock: number;
  outOfStock: number;
}

export type SortOption = 'DESTACADOS' | 'PRECIO_ASC' | 'PRECIO_DESC';
