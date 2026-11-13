import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { signAdminToken } from '../middleware/auth';
import { HttpError } from '../utils/http';

const loginSchema = z.object({ pin: z.string().min(1).max(64) });

function pinMatches(candidate: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(env.adminPin);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** POST /api/admin/login — valida el PIN en el servidor y entrega un token temporal. */
export async function login(req: Request, res: Response) {
  const { pin } = loginSchema.parse(req.body);
  if (!pinMatches(pin)) throw new HttpError(401, 'PIN incorrecto');
  res.json({ token: signAdminToken(), expiresInHours: 8 });
}

/** GET /api/admin/session — permite al frontend comprobar si el token guardado sigue vigente. */
export async function session(_req: Request, res: Response) {
  res.json({ ok: true });
}

/** GET /api/admin/summary — números rápidos para la cabecera del panel. */
export async function summary(_req: Request, res: Response) {
  const [products, activeProducts, pendingOrders, lowStock, outOfStock] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count({ where: { status: 'PENDIENTE' } }),
    prisma.productVariant.count({ where: { isActive: true, stock: 1 } }),
    prisma.productVariant.count({ where: { isActive: true, stock: 0 } }),
  ]);
  res.json({ products, activeProducts, pendingOrders, lowStock, outOfStock });
}
