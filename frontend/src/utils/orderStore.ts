import { STORAGE_KEYS } from '../config/constants';

/**
 * Pedidos creados en este navegador: { código: clave secreta }.
 * La clave es lo que permite a este dispositivo (y solo a este) ver y pagar su pedido.
 */
function read(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getOrderToken(code: string): string | null {
  return read()[code.toUpperCase()] ?? null;
}

export function saveOrderToken(code: string, token: string): void {
  // Se conservan solo los últimos 10 pedidos
  const entries = Object.entries({ ...read(), [code.toUpperCase()]: token }).slice(-10);
  try {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* sin almacenamiento: el pedido solo se podrá pagar en esta misma visita */
  }
}

/** Código del pedido más reciente de este navegador (para cancelarlo si el cliente rehace su compra). */
export function lastOrder(): { code: string; token: string } | null {
  const entries = Object.entries(read());
  const last = entries[entries.length - 1];
  return last ? { code: last[0], token: last[1] } : null;
}
