import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { parseId } from '../utils/http';
import { serializeOrder } from '../utils/serialize';

const mergeSchema = z.object({ productIds: z.array(z.coerce.number().int().positive()).max(200) });

async function favoriteIds(userId: number): Promise<number[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId, product: { isActive: true } },
    orderBy: { createdAt: 'desc' },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

/** GET /api/account/orders — mis pedidos, del más reciente al más antiguo. */
export async function myOrders(req: Request, res: Response) {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(orders.map((o) => serializeOrder(o, 'customer')));
}

/** GET /api/account/favorites — ids de mis productos favoritos. */
export async function listFavorites(req: Request, res: Response) {
  res.json(await favoriteIds(req.user!.id));
}

/** PUT /api/account/favorites/:productId */
export async function addFavorite(req: Request, res: Response) {
  const productId = parseId(req.params.productId);
  const userId = req.user!.id;
  await prisma.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
  res.json(await favoriteIds(userId));
}

/** DELETE /api/account/favorites/:productId */
export async function removeFavorite(req: Request, res: Response) {
  const productId = parseId(req.params.productId);
  const userId = req.user!.id;
  await prisma.favorite.deleteMany({ where: { userId, productId } });
  res.json(await favoriteIds(userId));
}

/**
 * POST /api/account/favorites/merge — al iniciar sesión, suma a la cuenta los corazones
 * que el cliente marcó mientras navegaba sin cuenta.
 */
export async function mergeFavorites(req: Request, res: Response) {
  const { productIds } = mergeSchema.parse(req.body);
  const userId = req.user!.id;
  if (productIds.length > 0) {
    const existing = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
    await prisma.favorite.createMany({
      data: existing.map((p) => ({ userId, productId: p.id })),
      skipDuplicates: true,
    });
  }
  res.json(await favoriteIds(userId));
}
