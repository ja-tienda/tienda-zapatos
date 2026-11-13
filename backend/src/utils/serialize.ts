import type { Order, OrderItem, Product, ProductVariant, Section } from '@prisma/client';

type ProductWithRelations = Product & {
  variants: ProductVariant[];
  category: Section;
  collections: { id: number }[];
};
type OrderWithItems = Order & { items: OrderItem[] };
type SectionWithCounts = Section & { _count?: { categoryProducts: number; collectionProducts: number } };

/** Relaciones que necesita serializeProduct. `publicOnly` oculta las tallas apagadas. */
export function productInclude(publicOnly: boolean) {
  return {
    variants: publicOnly ? { where: { isActive: true } } : true,
    category: true,
    collections: { select: { id: true }, ...(publicOnly ? { where: { isActive: true } } : {}) },
  } as const;
}

/** Convierte Decimal -> number y ordena las tallas para enviarlas al frontend. */
export function serializeProduct(p: ProductWithRelations) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    description: p.description,
    category: { id: p.category.id, name: p.category.name, slug: p.category.slug, sizeType: p.category.sizeType },
    collectionIds: p.collections.map((c) => c.id),
    gender: p.gender,
    price: Number(p.price),
    originalPrice: p.originalPrice === null ? null : Number(p.originalPrice),
    badge: p.badge,
    images: p.images,
    featured: p.featured,
    isActive: p.isActive,
    createdAt: p.createdAt,
    variants: [...p.variants]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((v) => ({
        id: v.id,
        size: v.size,
        usSize: v.usSize,
        cmSize: v.cmSize,
        stock: v.stock,
        isActive: v.isActive,
      })),
  };
}

export function serializeSection(s: SectionWithCounts) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    kind: s.kind,
    sizeType: s.sizeType,
    coverImage: s.coverImage,
    heroTitle: s.heroTitle,
    heroText: s.heroText,
    ctaLabel: s.ctaLabel,
    showInCarousel: s.showInCarousel,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
    productCount: s._count ? (s.kind === 'CATEGORIA' ? s._count.categoryProducts : s._count.collectionProducts) : 0,
  };
}

/** Nunca incluye publicToken: esa clave solo se entrega una vez, al crear el pedido. */
export function serializeOrder(o: OrderWithItems) {
  return {
    id: o.id,
    code: o.code,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    deliveryMethod: o.deliveryMethod,
    address: o.address,
    paymentMethod: o.paymentMethod,
    notes: o.notes,
    total: Number(o.total),
    status: o.status,
    receiptUrl: o.receiptUrl,
    paymentRef: o.paymentRef,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      size: i.size,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
    })),
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
