import type {
  Badge,
  DeliveryMethod,
  Gender,
  OrderStatus,
  PaymentMethod,
  SectionKind,
  Settings,
  SizeType,
  SortOption,
} from '../types';

// ---- Datos fijos de la marca (lo editable vive en los ajustes del panel) ----
export const STORE = {
  name: 'J & A',
  tagline: 'Calzados, ropa y accesorios',
  currency: 'S/',
  countryCode: '51',
} as const;

/**
 * Valores que se muestran mientras llegan los ajustes del servidor
 * (son los mismos valores por defecto del backend, para que no haya saltos al cargar).
 */
export const FALLBACK_SETTINGS: Settings = {
  logoUrl: '',
  announcement: 'Envíos a todo el Perú por Shalom y Olva · Paga con Yape o Plin',
  heroEyebrow: 'Nueva colección · Ingresos de la semana',
  heroTitle: 'Zapatillas que *combinan* con todo.',
  heroText: 'Calzados, ropa y accesorios elegidos uno por uno. Stock real por talla y atención directa de Jessica.',
  heroButtonLabel: 'Ver la colección',
  heroImage: '',
  contactName: 'Jessica',
  contactPhone: '957433392',
  contactEmail: '',
  businessHours: 'Lunes a sábado: 9:00 a. m. – 7:00 p. m.',
  walletNumber: '957433392',
  walletHolder: 'Jessica Paola Ramos Luján',
  walletQrUrl: '',
  businessName: '',
  businessRuc: '',
  businessAddress: '',
  seoDescription: '',
  returnsText: '',
  termsText: '',
  privacyText: '',
  cardPaymentsEnabled: false,
};

export const GENDER_LABELS: Record<Gender, string> = {
  DAMA: 'Dama',
  CABALLERO: 'Caballero',
  NINA: 'Niña',
  NINO: 'Niño',
  UNISEX: 'Unisex',
};
/** Orden en que se muestran los géneros en filtros y formularios. */
export const GENDERS: Gender[] = ['DAMA', 'CABALLERO', 'NINA', 'NINO', 'UNISEX'];

export const BADGE_LABELS: Record<Badge, string> = {
  NUEVO: 'Nuevo',
  OFERTA: 'Oferta',
  ULTIMO_PAR: '¡Último par!',
};

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  CATEGORIA: 'Categoría',
  COLECCION: 'Colección',
};

export const SIZE_TYPE_LABELS: Record<SizeType, string> = {
  CALZADO: 'Calzado (Perú 35–46 y niños 22–34.5, con medias tallas)',
  ROPA: 'Ropa (S, M, L, XL)',
  UNICA: 'Talla única',
};

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'DESTACADOS', label: 'Destacados' },
  { value: 'PRECIO_ASC', label: 'Menor precio' },
  { value: 'PRECIO_DESC', label: 'Mayor precio' },
];

export const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; addressLabel: string; placeholder: string }[] = [
  {
    value: 'DELIVERY_LOCAL',
    label: 'Delivery Local',
    addressLabel: 'Dirección de entrega',
    placeholder: 'Calle, número, referencia',
  },
  {
    value: 'ENVIO_PROVINCIA',
    label: 'Envío a Provincia (Shalom / Olva)',
    addressLabel: 'Agencia de destino',
    placeholder: 'Ej. Shalom - Av. Principal, Trujillo',
  },
  {
    value: 'RECOJO',
    label: 'Recojo coordinado',
    addressLabel: 'Punto o referencia de recojo (opcional)',
    placeholder: 'Lo coordinamos por WhatsApp',
  },
];

export const DELIVERY_LABELS = Object.fromEntries(DELIVERY_OPTIONS.map((o) => [o.value, o.label])) as Record<
  DeliveryMethod,
  string
>;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia bancaria',
  CONTRA_ENTREGA: 'Pago contra entrega',
  TARJETA: 'Tarjeta (Izipay)',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/** Colores de la etiqueta de cada estado (tienda y panel). */
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  PAGADO: 'bg-emerald-100 text-emerald-800',
  ENVIADO: 'bg-sky-100 text-sky-800',
  ENTREGADO: 'bg-stone-900 text-white',
  CANCELADO: 'bg-stone-200 text-stone-600',
};

// ---- Tallas ----
// Las tallas de calzado (Perú / USA, medias tallas, niños) viven en ./sizes.ts

export const CLOTHING_SIZE_TABLE: { size: string; chest: string; waist: string }[] = [
  { size: 'S', chest: '88 – 94', waist: '72 – 78' },
  { size: 'M', chest: '95 – 101', waist: '79 – 85' },
  { size: 'L', chest: '102 – 108', waist: '86 – 92' },
  { size: 'XL', chest: '109 – 115', waist: '93 – 100' },
];

export const STORAGE_KEYS = {
  cart: 'ja_cart_v1',
  checkout: 'ja_checkout_v3',
  /** Favoritos marcados sin haber iniciado sesión; al entrar se pasan a la cuenta */
  favorites: 'ja_favorites_v1',
} as const;

/** Rutas de la tienda en un solo lugar. */
export const ROUTES = {
  home: '/',
  catalog: '/#catalogo',
  offers: '/ofertas',
  section: (slug: string) => `/seccion/${slug}`,
  product: (slug: string) => `/producto/${slug}`,
  checkout: '/checkout',
  order: (code: string) => `/pedido/${code}`,
  account: '/cuenta',
  forgot: '/recuperar',
  reset: '/restablecer',
  terms: '/terminos',
  privacy: '/privacidad',
  returns: '/cambios-y-devoluciones',
  complaints: '/libro-de-reclamaciones',
} as const;
