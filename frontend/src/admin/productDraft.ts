import type { Badge, Gender } from '../types';

/**
 * Borrador del formulario de producto. Se guarda en este navegador mientras se escribe,
 * así no se pierde al pasar a otra pestaña del panel, al recargar o si la sesión vence.
 */
export interface ProductDraft {
  name: string;
  brand: string;
  description: string;
  categoryId: number | null;
  collectionIds: number[];
  gender: Gender;
  normalPrice: string;
  salePrice: string;
  badge: Badge | '';
  images: string[];
  featured: boolean;
  isActive: boolean;
  /** Solo producto nuevo: pares por talla, tallas USA corregidas, tallas agregadas y quitadas */
  stock: Record<string, string>;
  usOverrides: Record<string, string>;
  extraSizes: string[];
  removedSizes: string[];
}

const keyFor = (productId: number | null) => `ja_admin_product_draft_${productId ?? 'new'}`;

export function readProductDraft(productId: number | null): ProductDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProductDraft>;
    return parsed && typeof parsed === 'object' && typeof parsed.name === 'string' ? (parsed as ProductDraft) : null;
  } catch {
    return null;
  }
}

export function writeProductDraft(productId: number | null, draft: ProductDraft) {
  try {
    localStorage.setItem(keyFor(productId), JSON.stringify(draft));
  } catch {
    // Sin almacenamiento (modo privado, etc.): el borrador vive solo mientras el formulario siga abierto
  }
}

export function clearProductDraft(productId: number | null) {
  try {
    localStorage.removeItem(keyFor(productId));
  } catch {
    // nada que limpiar
  }
}
