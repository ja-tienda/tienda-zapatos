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
  CALZADO: 'Calzado (tallas 35–43)',
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
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
};

// ---- Tallas ----
export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43'];
export const CLOTHING_SIZES = ['S', 'M', 'L', 'XL'];
export const ONE_SIZE = 'Única';

/** Tallas que se proponen al crear un producto según el tipo de su categoría. */
export const SIZE_PRESETS: Record<SizeType, string[]> = {
  CALZADO: SHOE_SIZES,
  ROPA: CLOTHING_SIZES,
  UNICA: [ONE_SIZE],
};

/** Talla nacional (EUR/PE) -> US y largo de plantilla en CM. Misma tabla que usa el backend. */
export const SHOE_SIZE_TABLE: { eur: string; us: string; cm: string }[] = [
  { eur: '35', us: '5', cm: '22.5' },
  { eur: '36', us: '5.5', cm: '23' },
  { eur: '37', us: '6.5', cm: '23.5' },
  { eur: '38', us: '7', cm: '24' },
  { eur: '39', us: '7.5', cm: '25' },
  { eur: '40', us: '8', cm: '25.5' },
  { eur: '41', us: '9', cm: '26.5' },
  { eur: '42', us: '9.5', cm: '27' },
  { eur: '43', us: '10', cm: '27.5' },
];

/** Calzado infantil: talla -> largo aproximado del pie. Referencial; ajústalo a tus marcas. */
export const KIDS_SHOE_SIZE_TABLE: { eur: string; cm: string }[] = [
  { eur: '26', cm: '16' },
  { eur: '27', cm: '16.5' },
  { eur: '28', cm: '17.5' },
  { eur: '29', cm: '18' },
  { eur: '30', cm: '18.5' },
  { eur: '31', cm: '19.5' },
  { eur: '32', cm: '20' },
  { eur: '33', cm: '20.5' },
  { eur: '34', cm: '21.5' },
];

export const CLOTHING_SIZE_TABLE: { size: string; chest: string; waist: string }[] = [
  { size: 'S', chest: '88 – 94', waist: '72 – 78' },
  { size: 'M', chest: '95 – 101', waist: '79 – 85' },
  { size: 'L', chest: '102 – 108', waist: '86 – 92' },
  { size: 'XL', chest: '109 – 115', waist: '93 – 100' },
];

export const STORAGE_KEYS = {
  cart: 'ja_cart_v1',
  checkout: 'ja_checkout_v2',
  /** { "JA-XXXXX": "clave secreta" } — pedidos creados en este navegador */
  orders: 'ja_orders_v1',
  adminToken: 'ja_admin_token',
} as const;

/** Rutas de la tienda en un solo lugar. */
export const ROUTES = {
  home: '/',
  catalog: '/#catalogo',
  offers: '/ofertas',
  section: (slug: string) => `/seccion/${slug}`,
  checkout: '/checkout',
  order: (code: string) => `/pedido/${code}`,
  terms: '/terminos',
  privacy: '/privacidad',
} as const;
