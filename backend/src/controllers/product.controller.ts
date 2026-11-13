import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { imageRef } from '../config/settings';
import { SHOE_SIZE_MAP, sizeSortOrder } from '../config/sizes';
import { isAdminRequest } from '../middleware/auth';
import { HttpError, parseId } from '../utils/http';
import { productInclude, serializeProduct, slugify } from '../utils/serialize';
import { removeUnusedUploads } from '../utils/uploads';

const money = z.coerce.number().positive('debe ser mayor a 0').max(99999);
const gender = z.enum(['NINO', 'NINA', 'DAMA', 'CABALLERO', 'UNISEX']);
const images = z.array(imageRef).max(8);
const ids = z.array(z.coerce.number().int().positive()).max(30);

const variantInput = z.object({
  size: z.string().trim().min(1).max(12),
  usSize: z.string().trim().max(8).nullish(),
  cmSize: z.string().trim().max(8).nullish(),
  stock: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const createSchema = z.object({
  name: z.string().trim().min(2, 'nombre muy corto').max(120),
  brand: z.string().trim().max(60).nullish(),
  description: z.string().trim().max(2000).default(''),
  categoryId: z.coerce.number().int().positive(),
  collectionIds: ids.default([]),
  gender: gender.default('UNISEX'),
  price: money,
  originalPrice: money.nullish(),
  badge: z.enum(['NUEVO', 'OFERTA', 'ULTIMO_PAR']).nullish(),
  images: images.default([]),
  featured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  variants: z.array(variantInput).max(40).default([]),
});

// En PUT/PATCH todo es opcional: solo se actualiza lo que llega.
const updateSchema = z
  .object({
    name: z.string().trim().min(2, 'nombre muy corto').max(120),
    brand: z.string().trim().max(60).nullish(),
    description: z.string().trim().max(2000),
    categoryId: z.coerce.number().int().positive(),
    collectionIds: ids,
    gender,
    price: money,
    originalPrice: money.nullish(),
    badge: z.enum(['NUEVO', 'OFERTA', 'ULTIMO_PAR']).nullish(),
    images,
    featured: z.boolean(),
    isActive: z.boolean(),
  })
  .partial();

const variantPatchSchema = z
  .object({
    stock: z.coerce.number().int().min(0).max(9999),
    delta: z.coerce.number().int().min(-9999).max(9999),
    isActive: z.boolean(),
    usSize: z.string().trim().max(8).nullable(),
    cmSize: z.string().trim().max(8).nullable(),
  })
  .partial();

const adminInclude = productInclude(false);

function assertOfferPrice(price: number | undefined, originalPrice: number | null | undefined) {
  if (price !== undefined && originalPrice != null && originalPrice <= price) {
    throw new HttpError(400, 'El precio normal (tachado) debe ser mayor que el precio de oferta');
  }
}

/** Comprueba que la categoría y las colecciones existan y sean del tipo correcto. */
async function assertSections(categoryId: number | undefined, collectionIds: number[] | undefined) {
  if (categoryId !== undefined) {
    const category = await prisma.section.findUnique({ where: { id: categoryId } });
    if (!category || category.kind !== 'CATEGORIA') throw new HttpError(400, 'Elige una categoría válida');
  }
  if (collectionIds?.length) {
    const found = await prisma.section.count({ where: { id: { in: collectionIds }, kind: 'COLECCION' } });
    if (found !== new Set(collectionIds).size) throw new HttpError(400, 'Alguna colección o temporada no existe');
  }
}

/** Completa US/CM con la tabla oficial cuando la talla es de calzado y no se indicó. */
function withEquivalences<T extends { size: string; usSize?: string | null; cmSize?: string | null }>(v: T) {
  const eq = SHOE_SIZE_MAP[v.size];
  return {
    ...v,
    usSize: v.usSize || eq?.us || null,
    cmSize: v.cmSize || eq?.cm || null,
    sortOrder: sizeSortOrder(v.size),
  };
}

async function uniqueSlug(name: string, ignoreId?: number): Promise<string> {
  const base = slugify(name) || 'producto';
  let slug = base;
  for (let n = 2; ; n++) {
    const found = await prisma.product.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${base}-${n}`;
  }
}

/**
 * GET /api/products
 * Público: solo productos, categorías y tallas activos.
 * Con token de administradora y ?all=1: todo el inventario.
 */
export async function listProducts(req: Request, res: Response) {
  const showAll = req.query.all === '1' && isAdminRequest(req);
  const products = await prisma.product.findMany({
    where: showAll ? {} : { isActive: true, category: { isActive: true } },
    include: productInclude(!showAll),
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
  });
  res.json(products.map(serializeProduct));
}

/** GET /api/products/:idOrSlug */
export async function getProduct(req: Request, res: Response) {
  const key = String(req.params.idOrSlug);
  const isAdmin = isAdminRequest(req);
  const product = await prisma.product.findFirst({
    where: {
      ...(/^\d+$/.test(key) ? { id: Number(key) } : { slug: key }),
      ...(isAdmin ? {} : { isActive: true, category: { isActive: true } }),
    },
    include: productInclude(!isAdmin),
  });
  if (!product) throw new HttpError(404, 'Producto no encontrado');
  res.json(serializeProduct(product));
}

/** POST /api/products */
export async function createProduct(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  assertOfferPrice(data.price, data.originalPrice);
  await assertSections(data.categoryId, data.collectionIds);

  const sizes = data.variants.map((v) => v.size.toLowerCase());
  if (new Set(sizes).size !== sizes.length) throw new HttpError(400, 'Hay tallas repetidas');

  const { variants, categoryId, collectionIds, ...fields } = data;
  const product = await prisma.product.create({
    data: {
      ...fields,
      brand: fields.brand || null,
      originalPrice: fields.originalPrice ?? null,
      badge: fields.badge ?? null,
      slug: await uniqueSlug(fields.name),
      category: { connect: { id: categoryId } },
      collections: { connect: collectionIds.map((id) => ({ id })) },
      variants: { create: variants.map(withEquivalences) },
    },
    include: adminInclude,
  });
  res.status(201).json(serializeProduct(product));
}

/** PUT y PATCH /api/products/:id — actualiza los campos enviados. */
export async function updateProduct(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { categoryId, collectionIds, ...data } = updateSchema.parse(req.body);

  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Producto no encontrado');

  const nextPrice = data.price ?? Number(current.price);
  const nextOriginal =
    data.originalPrice === undefined
      ? current.originalPrice === null
        ? null
        : Number(current.originalPrice)
      : data.originalPrice;
  assertOfferPrice(nextPrice, nextOriginal);
  await assertSections(categoryId, collectionIds);

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      ...(data.brand !== undefined ? { brand: data.brand || null } : {}),
      ...(data.name && data.name !== current.name ? { slug: await uniqueSlug(data.name, id) } : {}),
      ...(categoryId !== undefined ? { category: { connect: { id: categoryId } } } : {}),
      // "set" reemplaza la lista completa de colecciones por la enviada
      ...(collectionIds !== undefined ? { collections: { set: collectionIds.map((cid) => ({ id: cid })) } } : {}),
    },
    include: adminInclude,
  });
  // Las fotos que se quitaron del producto ya no hacen falta en el disco
  if (data.images) void removeUnusedUploads(current.images.filter((url) => !data.images!.includes(url)));
  res.json(serializeProduct(product));
}

/** DELETE /api/products/:id — los pedidos antiguos conservan nombre, talla y precio. */
export async function deleteProduct(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const deleted = await prisma.product.delete({ where: { id } });
  void removeUnusedUploads(deleted.images);
  res.status(204).end();
}

/** POST /api/products/:id/variants — agrega una talla nueva al producto. */
export async function addVariant(req: Request, res: Response) {
  const productId = parseId(req.params.id);
  const data = variantInput.parse(req.body);

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
  if (!product) throw new HttpError(404, 'Producto no encontrado');
  if (product.variants.some((v) => v.size.toLowerCase() === data.size.toLowerCase())) {
    throw new HttpError(409, `La talla ${data.size} ya existe en este producto`);
  }

  await prisma.productVariant.create({ data: { ...withEquivalences(data), productId } });
  const updated = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: adminInclude });
  res.status(201).json(serializeProduct(updated));
}

/**
 * PATCH /api/variants/:id
 * { delta: +1 | -1 } suma/resta stock de forma atómica (seguro con varios clics seguidos),
 * { stock: n } fija un valor exacto, { isActive } enciende/apaga la talla.
 */
export async function updateVariant(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { delta, ...rest } = variantPatchSchema.parse(req.body);

  if (delta !== undefined && rest.stock !== undefined) {
    throw new HttpError(400, 'Envía "delta" o "stock", no ambos');
  }

  const variant = await prisma.$transaction(async (tx) => {
    if (delta !== undefined && delta < 0) {
      // Resta condicionada: nunca deja el stock en negativo.
      const { count } = await tx.productVariant.updateMany({
        where: { id, stock: { gte: -delta } },
        data: { stock: { increment: delta } },
      });
      if (count === 0) {
        const exists = await tx.productVariant.findUnique({ where: { id } });
        if (!exists) throw new HttpError(404, 'Talla no encontrada');
        throw new HttpError(409, 'El stock no puede quedar en negativo');
      }
    }
    return tx.productVariant.update({
      where: { id },
      data: {
        ...rest,
        ...(delta !== undefined && delta > 0 ? { stock: { increment: delta } } : {}),
      },
    });
  });

  const product = await prisma.product.findUniqueOrThrow({ where: { id: variant.productId }, include: adminInclude });
  res.json(serializeProduct(product));
}

/** DELETE /api/variants/:id */
export async function deleteVariant(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const variant = await prisma.productVariant.delete({ where: { id } });
  const product = await prisma.product.findUniqueOrThrow({ where: { id: variant.productId }, include: adminInclude });
  res.json(serializeProduct(product));
}
