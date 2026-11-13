import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { endAllSessions } from '../middleware/auth';
import { HttpError, parseId } from '../utils/http';
import { serializeOrder } from '../utils/serialize';

const activeSchema = z.object({ isActive: z.boolean() });

/** GET /api/admin/customers — clientes registrados con el resumen de sus compras. */
export async function listCustomers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { _count: { select: { orders: true, favorites: true } } },
  });

  // Total gastado: solo pedidos ya pagados
  const spent = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: users.map((u) => u.id) }, status: { in: ['PAGADO', 'ENVIADO', 'ENTREGADO'] } },
    _sum: { total: true },
  });
  const spentBy = new Map(spent.map((s) => [s.userId, Number(s._sum.total ?? 0)]));

  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      withGoogle: u.googleId !== null,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      orderCount: u._count.orders,
      favoriteCount: u._count.favorites,
      totalSpent: spentBy.get(u.id) ?? 0,
    })),
  );
}

/** GET /api/admin/customers/:id/orders */
export async function customerOrders(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const orders = await prisma.order.findMany({
    where: { userId: id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(orders.map((o) => serializeOrder(o, 'admin')));
}

/** PATCH /api/admin/customers/:id — desactivar o reactivar una cuenta de cliente. */
export async function setCustomerActive(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { isActive } = activeSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== 'CUSTOMER') throw new HttpError(404, 'Cliente no encontrado');

  await prisma.user.update({ where: { id }, data: { isActive } });
  // Una cuenta desactivada pierde el acceso de inmediato, también en los dispositivos abiertos
  if (!isActive) await endAllSessions(id);
  res.json({ id, isActive });
}
