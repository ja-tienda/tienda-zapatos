import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Order, OrderItem, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { HttpError, parseId } from '../utils/http';
import { serializeOrder } from '../utils/serialize';
import { deleteUpload, saveImage } from '../utils/uploads';

const orderSchema = z.object({
  customerName: z.string().trim().min(3, 'ingresa tu nombre completo').max(80),
  customerPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()+-]/g, ''))
    .pipe(z.string().regex(/^\d{9,12}$/, 'teléfono inválido (9 dígitos)')),
  customerEmail: z.union([z.literal(''), z.email('correo inválido').max(120)]).nullish(),
  deliveryMethod: z.enum(['DELIVERY_LOCAL', 'ENVIO_PROVINCIA', 'RECOJO']),
  address: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(300).nullish(),
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

const statusSchema = z.object({ status: z.enum(['PENDIENTE', 'CONFIRMADO', 'CANCELADO']) });
const walletSchema = z.object({ method: z.enum(['YAPE', 'PLIN']).default('YAPE') });
const manualMethodSchema = z.object({ paymentMethod: z.enum(['TRANSFERENCIA', 'CONTRA_ENTREGA']) });

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlo por WhatsApp

function newOrderCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `JA-${code}`;
}

type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Busca el pedido del cliente a partir del código de la URL y la clave secreta que su
 * navegador recibió al crearlo (cabecera X-Order-Token). Sin esa clave nadie puede ver
 * ni modificar un pedido ajeno aunque adivine el código.
 */
export async function findCustomerOrder(req: Request): Promise<OrderWithItems> {
  const code = String(req.params.code ?? '').toUpperCase();
  const token = String(req.headers['x-order-token'] ?? '');
  const order = await prisma.order.findUnique({ where: { code }, include: { items: true } });

  const expected = Buffer.from(order?.publicToken ?? '');
  const received = Buffer.from(token);
  const valid = order && expected.length > 0 && expected.length === received.length && timingSafeEqual(expected, received);
  if (!valid) throw new HttpError(404, 'No encontramos este pedido en este dispositivo');
  return order;
}

function assertAwaitingPayment(order: Order) {
  if (order.status === 'CANCELADO') throw new HttpError(409, 'Este pedido fue cancelado');
  if (order.status === 'CONFIRMADO' || order.paidAt) throw new HttpError(409, 'Este pedido ya está pagado');
}

/**
 * Descuenta el stock de cada línea. Si alguna talla ya no alcanza lanza un 409
 * (dentro de una transacción, eso revierte todo lo descontado).
 */
export async function takeStock(tx: Prisma.TransactionClient, items: OrderItem[]) {
  for (const item of items) {
    if (item.variantId === null) continue; // la talla fue eliminada del catálogo
    const updated = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (updated.count === 0) {
      throw new HttpError(409, `Stock insuficiente de ${item.productName} (talla ${item.size})`);
    }
  }
}

/**
 * POST /api/orders
 * El cliente solo envía variantId + cantidad. Nombre, precio y total se calculan
 * aquí con los datos reales de la BD, así nadie puede alterar precios desde el navegador.
 * El stock se valida ahora, pero se descuenta recién cuando se confirma el pago.
 * Devuelve el pedido y la clave (`token`) con la que ese navegador podrá pagarlo.
 */
export async function createOrder(req: Request, res: Response) {
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

  if (problems.length > 0) {
    throw new HttpError(409, problems[0].message, { stock: problems });
  }

  const items = lines.filter((l) => l !== null);
  const total = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
  const token = randomBytes(24).toString('hex');

  const order = await prisma.order.create({
    data: {
      code: newOrderCode(),
      publicToken: token,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail || null,
      deliveryMethod: data.deliveryMethod,
      address: data.address,
      notes: data.notes || null,
      total: total.toFixed(2),
      items: { create: items },
    },
    include: { items: true },
  });

  res.status(201).json({ order: serializeOrder(order), token });
}

/** GET /api/orders/:code (cliente, con X-Order-Token) — para la página de pago y seguimiento. */
export async function getCustomerOrder(req: Request, res: Response) {
  res.json(serializeOrder(await findCustomerOrder(req)));
}

/**
 * POST /api/orders/:code/receipt (cliente, multipart con "file" y "method")
 * "Ya pagué · Enviar comprobante": guarda la captura del Yape/Plin para que la
 * administradora la revise en el panel y confirme el pago.
 */
export async function uploadReceipt(req: Request, res: Response) {
  const order = await findCustomerOrder(req);
  assertAwaitingPayment(order);
  if (!req.file) throw new HttpError(400, 'Adjunta la captura de tu pago');
  const { method } = walletSchema.parse(req.body);

  const receiptUrl = await saveImage(req.file.buffer, 'comprobantes');
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { receiptUrl, paymentMethod: method },
    include: { items: true },
  });
  await deleteUpload(order.receiptUrl); // si reenvía la captura, la anterior ya no hace falta
  res.json(serializeOrder(updated));
}

/** POST /api/orders/:code/method (cliente) — transferencia o contra entrega, a coordinar por WhatsApp. */
export async function setManualMethod(req: Request, res: Response) {
  const order = await findCustomerOrder(req);
  assertAwaitingPayment(order);
  const { paymentMethod } = manualMethodSchema.parse(req.body);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { paymentMethod },
    include: { items: true },
  });
  res.json(serializeOrder(updated));
}

/**
 * POST /api/orders/:code/cancel (cliente) — solo mientras no haya elegido cómo pagar.
 * En cuanto envía un comprobante, paga con tarjeta o avisa que coordinará por WhatsApp,
 * el pedido queda en manos de la administradora.
 */
export async function cancelCustomerOrder(req: Request, res: Response) {
  const order = await findCustomerOrder(req);
  if (order.status !== 'PENDIENTE' || order.paidAt || order.receiptUrl || order.paymentMethod !== null) {
    throw new HttpError(409, 'Este pedido ya no se puede cancelar desde aquí. Escríbenos por WhatsApp.');
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'CANCELADO' },
    include: { items: true },
  });
  res.json(serializeOrder(updated));
}

/** GET /api/orders?status=PENDIENTE (admin) */
export async function listOrders(req: Request, res: Response) {
  const status = statusSchema.shape.status.optional().parse(req.query.status || undefined);
  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(orders.map(serializeOrder));
}

/**
 * PATCH /api/orders/:id/status (admin)
 * PENDIENTE -> CONFIRMADO : descuenta stock (falla si ya no alcanza)
 * CONFIRMADO -> CANCELADO : devuelve el stock
 * PENDIENTE -> CANCELADO  : no toca stock
 */
export async function updateOrderStatus(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { status: next } = statusSchema.parse(req.body);

  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw new HttpError(404, 'Pedido no encontrado');
    if (current.status === next) return current;

    const transition = `${current.status}>${next}`;
    if (!['PENDIENTE>CONFIRMADO', 'PENDIENTE>CANCELADO', 'CONFIRMADO>CANCELADO'].includes(transition)) {
      throw new HttpError(409, `No se puede pasar un pedido de ${current.status} a ${next}`);
    }

    // Candado: solo una petición gana si llegan dos clics a la vez.
    const { count } = await tx.order.updateMany({
      where: { id, status: current.status },
      data: { status: next },
    });
    if (count === 0) throw new HttpError(409, 'El pedido cambió mientras lo editabas. Actualiza la lista.');

    if (transition === 'PENDIENTE>CONFIRMADO') {
      await takeStock(tx, current.items);
    } else if (transition === 'CONFIRMADO>CANCELADO') {
      for (const item of current.items) {
        if (item.variantId === null) continue;
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
  });

  res.json(serializeOrder(order));
}
