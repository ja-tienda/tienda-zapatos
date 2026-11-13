import { randomInt } from 'node:crypto';
import path from 'node:path';
import type { Request, Response } from 'express';
import type { Order, OrderItem, OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { HttpError, parseId } from '../utils/http';
import { serializeOrder } from '../utils/serialize';
import { RECEIPTS_DIR, deleteReceipt, saveReceipt } from '../utils/uploads';

const orderSchema = z.object({
  customerName: z.string().trim().min(3, 'ingresa tu nombre completo').max(80),
  customerPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()+-]/g, ''))
    .pipe(z.string().regex(/^\d{9,12}$/, 'teléfono inválido (9 dígitos)')),
  deliveryMethod: z.enum(['DELIVERY_LOCAL', 'ENVIO_PROVINCIA', 'RECOJO']),
  address: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(300).nullish(),
  // El navegador solo dice QUÉ quiere y CUÁNTO. Precios, total y stock los pone el servidor.
  items: z
    .array(
      z.object({
        variantId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1, 'el carrito está vacío')
    .max(30),
});

const STATUSES = ['PENDIENTE', 'PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'] as const;
const statusSchema = z.object({ status: z.enum(STATUSES) });
const walletSchema = z.object({ method: z.enum(['YAPE', 'PLIN']).default('YAPE') });
const manualMethodSchema = z.object({ paymentMethod: z.enum(['TRANSFERENCIA', 'CONTRA_ENTREGA']) });

const MINUTE = 60_000;
/** Tiempo que se guarda el stock de un pedido recién creado mientras el cliente paga. */
export const PAYMENT_WINDOW_MS = 30 * MINUTE;
/** Si eligió coordinar por WhatsApp, la reserva dura dos días. */
const MANUAL_WINDOW_MS = 48 * 60 * MINUTE;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlo por WhatsApp

function newOrderCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `JA-${code}`;
}

type OrderWithItems = Order & { items: OrderItem[] };

/** El pedido de la URL, solo si pertenece al cliente que tiene la sesión. */
export async function findOwnOrder(req: Request): Promise<OrderWithItems> {
  const code = String(req.params.code ?? '').toUpperCase();
  const order = await prisma.order.findUnique({ where: { code }, include: { items: true } });
  // Mismo error exista o no: no se revela qué códigos son reales
  if (!order || order.userId !== req.user!.id) throw new HttpError(404, 'No encontramos este pedido en tu cuenta');
  return order;
}

function assertAwaitingPayment(order: Order) {
  if (order.status === 'CANCELADO') throw new HttpError(409, 'Este pedido fue cancelado. Vuelve a armar tu carrito.');
  if (order.status !== 'PENDIENTE') throw new HttpError(409, 'Este pedido ya está pagado');
}

/**
 * Descuenta del inventario las unidades de cada línea. El descuento lleva la condición
 * "solo si quedan suficientes" dentro de la misma operación de la base de datos, así dos
 * compras simultáneas de la última unidad no pueden ganar las dos: la segunda recibe un 409
 * y, al estar en una transacción, se deshace todo lo que ya había descontado.
 */
export async function takeStock(tx: Prisma.TransactionClient, items: Pick<OrderItem, 'variantId' | 'quantity' | 'productName' | 'size'>[]) {
  for (const item of items) {
    if (item.variantId === null) throw new HttpError(409, `${item.productName} ya no está disponible`);
    const updated = await tx.productVariant.updateMany({
      where: { id: item.variantId, isActive: true, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (updated.count === 0) {
      throw new HttpError(409, `${item.productName} (talla ${item.size}) se agotó o no quedan suficientes`);
    }
  }
}

/** Devuelve al inventario lo que el pedido tenía reservado. */
async function releaseStock(tx: Prisma.TransactionClient, order: OrderWithItems) {
  if (!order.stockReserved) return;
  for (const item of order.items) {
    if (item.variantId === null) continue; // la talla fue eliminada del catálogo
    await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
  }
}

/**
 * Cancela un pedido pendiente y libera su stock. La condición sobre el estado hace de
 * candado: si en ese instante el pedido se pagó, no se cancela.
 */
async function cancelPending(order: OrderWithItems): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDIENTE' },
      data: { status: 'CANCELADO', stockReserved: false, reservedUntil: null },
    });
    if (count === 0) return false;
    await releaseStock(tx, order);
    return true;
  });
}

/**
 * Libera el stock de los pedidos que nadie pagó a tiempo (carritos abandonados en el pago).
 * El servidor lo ejecuta cada minuto.
 */
export async function releaseExpiredOrders(): Promise<number> {
  const expired = await prisma.order.findMany({
    where: { status: 'PENDIENTE', paidAt: null, reservedUntil: { lt: new Date() } },
    include: { items: true },
    take: 100,
  });
  let released = 0;
  for (const order of expired) if (await cancelPending(order)) released++;
  return released;
}

/**
 * POST /api/orders (cliente con sesión)
 * Crea el pedido y RESERVA su stock en la misma transacción. Nombre, precio y total salen
 * de la base de datos, nunca de lo que envía el navegador.
 */
export async function createOrder(req: Request, res: Response) {
  const user = req.user!;
  const data = orderSchema.parse(req.body);

  if (data.deliveryMethod !== 'RECOJO' && data.address.length < 5) {
    throw new HttpError(400, 'Indica la dirección o agencia de destino');
  }

  // Une líneas repetidas de la misma talla
  const quantities = new Map<number, number>();
  for (const item of data.items) {
    quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...quantities.keys()] } },
    include: { product: { include: { category: true } } },
  });

  const problems: { variantId: number; message: string; available: number }[] = [];
  const lines = [...quantities.entries()].map(([variantId, quantity]) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant || !variant.isActive || !variant.product.isActive || !variant.product.category.isActive) {
      problems.push({ variantId, message: 'Uno de los productos ya no está disponible', available: 0 });
      return null;
    }
    if (variant.stock < quantity) {
      problems.push({
        variantId,
        available: variant.stock,
        message:
          variant.stock === 0
            ? `${variant.product.name} (talla ${variant.size}) se agotó`
            : `De ${variant.product.name} (talla ${variant.size}) solo quedan ${variant.stock}`,
      });
      return null;
    }
    return {
      productId: variant.productId,
      variantId: variant.id,
      productName: variant.product.name,
      size: variant.size,
      unitPrice: variant.product.price,
      quantity,
    };
  });

  if (problems.length > 0) throw new HttpError(409, problems[0].message, { stock: problems });

  const items = lines.filter((l) => l !== null);
  const total = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);

  const order = await prisma.$transaction(async (tx) => {
    // Un cliente no puede acaparar stock con muchos pedidos sin pagar: los anteriores
    // que aún no eligieron forma de pago se cancelan y liberan lo suyo.
    const stale = await tx.order.findMany({
      where: { userId: user.id, status: 'PENDIENTE', paymentMethod: null, paidAt: null },
      include: { items: true },
    });
    for (const old of stale) {
      const { count } = await tx.order.updateMany({
        where: { id: old.id, status: 'PENDIENTE' },
        data: { status: 'CANCELADO', stockReserved: false, reservedUntil: null },
      });
      if (count === 1) await releaseStock(tx, old);
    }

    await takeStock(tx, items);
    return tx.order.create({
      data: {
        code: newOrderCode(),
        userId: user.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: user.email,
        deliveryMethod: data.deliveryMethod,
        address: data.address,
        notes: data.notes || null,
        total: total.toFixed(2),
        stockReserved: true,
        reservedUntil: new Date(Date.now() + PAYMENT_WINDOW_MS),
        items: { create: items },
      },
      include: { items: true },
    });
  });

  // Guarda el teléfono en la cuenta para la próxima compra
  if (!user.phone) await prisma.user.update({ where: { id: user.id }, data: { phone: data.customerPhone } });

  res.status(201).json(serializeOrder(order, 'customer'));
}

/** GET /api/orders/:code (su dueño) — para la página de pago y seguimiento. */
export async function getOwnOrder(req: Request, res: Response) {
  res.json(serializeOrder(await findOwnOrder(req), 'customer'));
}

/**
 * POST /api/orders/:code/receipt (su dueño, multipart con "file" y "method")
 * "Ya pagué · Enviar comprobante": guarda la captura del Yape/Plin en una carpeta privada.
 * El pedido sigue PENDIENTE hasta que la administradora la revise.
 */
export async function uploadReceipt(req: Request, res: Response) {
  const order = await findOwnOrder(req);
  assertAwaitingPayment(order);
  if (!req.file) throw new HttpError(400, 'Adjunta la captura de tu pago');
  const { method } = walletSchema.parse(req.body);

  const receiptUrl = await saveReceipt(req.file.buffer);
  const updated = await prisma.order.update({
    where: { id: order.id },
    // Con comprobante enviado la reserva ya no vence sola: decide la administradora
    data: { receiptUrl, paymentMethod: method, reservedUntil: null },
    include: { items: true },
  });
  await deleteReceipt(order.receiptUrl); // si reenvía la captura, la anterior ya no hace falta
  res.json(serializeOrder(updated, 'customer'));
}

/** POST /api/orders/:code/method (su dueño) — transferencia o contra entrega, a coordinar por WhatsApp. */
export async function setManualMethod(req: Request, res: Response) {
  const order = await findOwnOrder(req);
  assertAwaitingPayment(order);
  const { paymentMethod } = manualMethodSchema.parse(req.body);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { paymentMethod, reservedUntil: new Date(Date.now() + MANUAL_WINDOW_MS) },
    include: { items: true },
  });
  res.json(serializeOrder(updated, 'customer'));
}

/**
 * POST /api/orders/:code/cancel (su dueño) — solo mientras no haya elegido cómo pagar.
 * En cuanto envía un comprobante o paga, el pedido queda en manos de la administradora.
 */
export async function cancelOwnOrder(req: Request, res: Response) {
  const order = await findOwnOrder(req);
  if (order.status !== 'PENDIENTE' || order.paidAt || order.receiptUrl || order.paymentMethod !== null) {
    throw new HttpError(409, 'Este pedido ya no se puede cancelar desde aquí. Escríbenos por WhatsApp.');
  }
  await cancelPending(order);
  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  res.json(serializeOrder(updated, 'customer'));
}

/** GET /api/receipts/:file (admin) — la captura de un pago. Nunca es pública. */
export async function getReceipt(req: Request, res: Response) {
  const file = String(req.params.file);
  if (!/^[a-f0-9]{32}\.webp$/.test(file)) throw new HttpError(404, 'Comprobante no encontrado');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.sendFile(path.join(RECEIPTS_DIR, file), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Comprobante no encontrado' });
  });
}

/** GET /api/orders?status=PENDIENTE (admin) */
export async function listOrders(req: Request, res: Response) {
  const status = statusSchema.shape.status.optional().parse(req.query.status || undefined);
  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(orders.map((o) => serializeOrder(o, 'admin')));
}

// Cambios de estado que puede hacer la administradora
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDIENTE: ['PAGADO', 'CANCELADO'],
  PAGADO: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

/**
 * PATCH /api/orders/:id/status (admin)
 * PENDIENTE -> PAGADO        : confirma el pago (el stock ya estaba reservado)
 * PAGADO -> ENVIADO -> ENTREGADO
 * cualquiera -> CANCELADO    : devuelve el stock reservado al inventario
 */
export async function updateOrderStatus(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { status: next } = statusSchema.parse(req.body);

  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw new HttpError(404, 'Pedido no encontrado');
    if (current.status === next) return current;
    if (!TRANSITIONS[current.status].includes(next)) {
      throw new HttpError(409, `No se puede pasar un pedido de ${current.status} a ${next}`);
    }

    // Candado: solo una petición gana si llegan dos clics a la vez.
    const { count } = await tx.order.updateMany({
      where: { id, status: current.status },
      data: {
        status: next,
        ...(next === 'PAGADO' ? { paidAt: current.paidAt ?? new Date(), stockReserved: true, reservedUntil: null } : {}),
        ...(next === 'CANCELADO' ? { stockReserved: false, reservedUntil: null } : {}),
      },
    });
    if (count === 0) throw new HttpError(409, 'El pedido cambió mientras lo editabas. Actualiza la lista.');

    // Pedidos anteriores a la reserva automática: su stock se descuenta al confirmar el pago
    if (next === 'PAGADO' && !current.stockReserved) await takeStock(tx, current.items);
    if (next === 'CANCELADO') await releaseStock(tx, current);

    return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
  });

  res.json(serializeOrder(order, 'admin'));
}
