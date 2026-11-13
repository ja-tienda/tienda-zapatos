import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import type { CartItem, Product, Variant } from '../types';

interface AddResult {
  ok: boolean;
  message?: string;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product, variant: Variant) => AddResult;
  setQuantity: (variantId: number, quantity: number) => void;
  removeItem: (variantId: number) => void;
  clearCart: () => void;
  /** Cruza el carrito con el catálogo recién traído de la BD y devuelve avisos para el cliente. */
  syncWithCatalog: (products: Product[]) => string[];
  quantityOf: (variantId: number) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cart);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.variantId === 'number' && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(items));
    } catch {
      // Sin almacenamiento (modo privado): el carrito vive solo en memoria.
    }
  }, [items]);

  const addItem = useCallback(
    (product: Product, variant: Variant): AddResult => {
      const existing = items.find((i) => i.variantId === variant.id);
      const inCart = existing?.quantity ?? 0;
      if (variant.stock <= 0) return { ok: false, message: 'Esta talla está agotada' };
      if (inCart >= variant.stock) {
        return { ok: false, message: `Ya tienes en tu carrito todo el stock disponible (${variant.stock})` };
      }
      setItems((prev) => {
        const found = prev.find((i) => i.variantId === variant.id);
        if (found) {
          return prev.map((i) =>
            i.variantId === variant.id
              ? { ...i, quantity: Math.min(i.quantity + 1, variant.stock), maxStock: variant.stock, price: product.price }
              : i,
          );
        }
        return [
          ...prev,
          {
            variantId: variant.id,
            productId: product.id,
            name: product.name,
            image: product.images[0] ?? null,
            size: variant.size,
            price: product.price,
            quantity: 1,
            maxStock: variant.stock,
          },
        ];
      });
      return { ok: true };
    },
    [items],
  );

  const setQuantity = useCallback((variantId: number, quantity: number) => {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.variantId !== variantId) return [i];
        const next = Math.min(Math.max(quantity, 0), i.maxStock);
        return next <= 0 ? [] : [{ ...i, quantity: next }];
      }),
    );
  }, []);

  const removeItem = useCallback((variantId: number) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const syncWithCatalog = useCallback(
    (products: Product[]): string[] => {
      const variants = new Map<number, { product: Product; variant: Variant }>();
      for (const product of products) {
        for (const variant of product.variants) variants.set(variant.id, { product, variant });
      }

      const notices: string[] = [];
      const next: CartItem[] = [];
      let changed = false;

      for (const item of items) {
        const match = variants.get(item.variantId);
        if (!match || match.variant.stock <= 0) {
          notices.push(`${item.name} (talla ${item.size}) se agotó y se quitó de tu carrito.`);
          changed = true;
          continue;
        }
        const { product, variant } = match;
        const quantity = Math.min(item.quantity, variant.stock);
        if (quantity < item.quantity) {
          notices.push(`De ${item.name} (talla ${item.size}) solo quedan ${variant.stock}. Ajustamos tu carrito.`);
        }
        if (product.price !== item.price) {
          notices.push(`El precio de ${item.name} cambió. Ya lo actualizamos en tu carrito.`);
        }
        const updated: CartItem = {
          ...item,
          name: product.name,
          image: product.images[0] ?? null,
          price: product.price,
          quantity,
          maxStock: variant.stock,
        };
        if (
          updated.quantity !== item.quantity ||
          updated.price !== item.price ||
          updated.maxStock !== item.maxStock ||
          updated.name !== item.name ||
          updated.image !== item.image
        ) {
          changed = true;
        }
        next.push(updated);
      }

      if (changed) setItems(next);
      return notices;
    },
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      syncWithCatalog,
      quantityOf: (variantId) => items.find((i) => i.variantId === variantId)?.quantity ?? 0,
    }),
    [items, isOpen, addItem, setQuantity, removeItem, clearCart, syncWithCatalog],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
