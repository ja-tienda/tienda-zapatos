import { DELIVERY_LABELS, PAYMENT_LABELS, STORE } from '../config/constants';
import type { Order, Product, Settings } from '../types';

export function formatPrice(value: number): string {
  return `${STORE.currency} ${value.toFixed(2)}`;
}

/** "957433392" -> "957 433 392" */
export function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export function isOnSale(product: Pick<Product, 'price' | 'originalPrice'>): boolean {
  return product.originalPrice !== null && product.originalPrice > product.price;
}

export function discountPercent(product: Pick<Product, 'price' | 'originalPrice'>): number {
  if (!isOnSale(product)) return 0;
  return Math.round((1 - product.price / product.originalPrice!) * 100);
}

export function totalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + (v.isActive ? v.stock : 0), 0);
}

/** Quita tildes y mayúsculas para que "pantalon" encuentre "Pantalón". */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Ordena tallas: numéricas de menor a mayor, luego XS–XXL y al final "Única". */
export function compareSizes(a: string, b: string): number {
  const letters = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const rank = (size: string) => {
    const n = Number(size.replace(',', '.'));
    if (Number.isFinite(n) && size.trim() !== '') return n;
    const i = letters.indexOf(size.toUpperCase());
    return i >= 0 ? 1000 + i : 2000;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
}

/** Enlace de WhatsApp al número de contacto configurado en el panel. */
export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${STORE.countryCode}${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

/** Convierte "/uploads/…" en una dirección completa para poder pegarla en un mensaje. */
export function absoluteUrl(path: string): string {
  return path.startsWith('/') ? `${window.location.origin}${path}` : path;
}

/** Mensaje del pedido armado con los datos que confirmó el servidor (precios y total reales). */
export function buildOrderMessage(order: Order, settings: Pick<Settings, 'contactName'>): string {
  const lines = order.items.map(
    (item, i) =>
      `${i + 1}. *${item.productName}*\n   Talla: ${item.size} · Cant.: ${item.quantity} · P. unit.: ${formatPrice(item.unitPrice)} · Subtotal: ${formatPrice(item.unitPrice * item.quantity)}`,
  );

  const payment = order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] : 'Por coordinar';
  const paymentNote =
    order.paidAt !== null
      ? '✅ Pagado con tarjeta'
      : order.receiptUrl
        ? `🧾 Ya pagué. Mi comprobante: ${absoluteUrl(order.receiptUrl)}`
        : null;

  return [
    `¡Hola ${settings.contactName}! 👋 Vengo de la tienda virtual *${STORE.name}* y quiero realizar el siguiente pedido:`,
    '',
    `🧾 *Pedido ${order.code}*`,
    '',
    ...lines,
    '',
    `👤 *Cliente:* ${order.customerName}`,
    `📱 *Teléfono:* ${order.customerPhone}`,
    `🚚 *Entrega:* ${DELIVERY_LABELS[order.deliveryMethod]}`,
    ...(order.address ? [`📍 *Dirección / agencia:* ${order.address}`] : []),
    `💳 *Método de pago:* ${payment}`,
    ...(order.notes ? [`📝 *Nota:* ${order.notes}`] : []),
    '',
    `💰 *Total a pagar: ${formatPrice(order.total)}*`,
    ...(paymentNote ? ['', paymentNote] : []),
  ].join('\n');
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
