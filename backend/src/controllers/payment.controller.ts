import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError } from '../utils/http';
import { serializeOrder } from '../utils/serialize';
import { findCustomerOrder, takeStock } from './order.controller';

/**
 * Pago con tarjeta mediante Izipay (formulario incrustado, API REST V4).
 * Flujo:
 *   1. createCardPayment  -> el servidor pide a Izipay un "formToken" por el total del pedido.
 *   2. El navegador muestra el formulario de Izipay con ese token (la tarjeta nunca pasa por nuestro servidor).
 *   3. confirmCardPayment -> el navegador reenvía la respuesta firmada; se valida con la clave HMAC.
 *   4. izipayNotification -> además Izipay avisa de servidor a servidor (IPN), firmado con la contraseña.
 * Los pasos 3 y 4 hacen lo mismo (marcar el pedido como pagado) y son idempotentes.
 * Documentación: https://secure.micuentaweb.pe/doc/es-PE/rest/V4.0/javascript/
 */
const CREATE_PAYMENT_URL = 'https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment';

const startSchema = z.object({ email: z.email('correo inválido').max(120).optional() });
const confirmSchema = z.object({ krAnswer: z.string().min(2).max(100_000), krHash: z.string().min(16).max(256) });

/** Estructura mínima que usamos de la respuesta de Izipay (kr-answer). */
const answerSchema = z.object({
  orderStatus: z.string(),
  orderDetails: z.object({ orderId: z.string(), orderTotalAmount: z.number() }),
  transactions: z.array(z.object({ uuid: z.string() })).default([]),
});

function assertEnabled() {
  if (!env.izipay.enabled) throw new HttpError(503, 'El pago con tarjeta aún no está disponible');
}

/** Firma válida = HMAC-SHA256(kr-answer, clave) coincide con kr-hash. */
export function isValidSignature(answer: string, hash: string, key: string): boolean {
  const expected = Buffer.from(createHmac('sha256', key).update(answer, 'utf8').digest('hex'));
  const received = Buffer.from(hash.toLowerCase());
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const toCents = (amount: unknown) => Math.round(Number(amount) * 100);

/**
 * Registra el pago de un pedido. Si hay stock lo confirma y lo descuenta; si justo se agotó
 * alguna talla, deja el pedido PENDIENTE pero marcado como pagado para que la administradora
 * lo resuelva (cambiar talla o devolver el dinero).
 */
async function registerCardPayment(orderCode: string, amountCents: number, transactionId: string) {
  const order = await prisma.order.findUnique({ where: { code: orderCode }, include: { items: true } });
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  if (order.paidAt) return order; // ya registrado (llegó antes la otra notificación)
  if (toCents(order.total) !== amountCents) throw new HttpError(400, 'El monto pagado no coincide con el pedido');
  if (order.status === 'CANCELADO') {
    // Pagó un pedido cancelado: se deja constancia para devolver o reactivar manualmente.
    return prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: 'TARJETA', paidAt: new Date(), paymentRef: transactionId },
      include: { items: true },
    });
  }

  const paid = { paymentMethod: 'TARJETA', paidAt: new Date(), paymentRef: transactionId } as const;
  try {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDIENTE', paidAt: null },
        data: { ...paid, status: 'CONFIRMADO' },
      });
      if (count === 1) await takeStock(tx, order.items);
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    });
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 409)) throw err;
    return prisma.order.update({ where: { id: order.id }, data: paid, include: { items: true } });
  }
}

/** POST /api/orders/:code/card (cliente) — pide a Izipay el token para mostrar el formulario de pago. */
export async function createCardPayment(req: Request, res: Response) {
  assertEnabled();
  const order = await findCustomerOrder(req);
  if (order.status !== 'PENDIENTE' || order.paidAt) throw new HttpError(409, 'Este pedido ya no admite pagos');

  const { email } = startSchema.parse(req.body ?? {});
  const customerEmail = email ?? order.customerEmail;
  if (!customerEmail) throw new HttpError(400, 'Ingresa tu correo para pagar con tarjeta');
  if (email && email !== order.customerEmail) {
    await prisma.order.update({ where: { id: order.id }, data: { customerEmail: email } });
  }

  // No cobrar algo que se agotó mientras el cliente llenaba sus datos
  for (const item of order.items) {
    if (item.variantId === null) throw new HttpError(409, `${item.productName} ya no está disponible`);
    const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
    if (!variant || variant.stock < item.quantity) {
      throw new HttpError(409, `${item.productName} (talla ${item.size}) se agotó. Vuelve a armar tu pedido.`);
    }
  }

  const [firstName, ...rest] = order.customerName.split(' ');
  let payload: { status?: string; answer?: { formToken?: string; errorMessage?: string } };
  try {
    const response = await fetch(CREATE_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${env.izipay.username}:${env.izipay.password}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: toCents(order.total),
        currency: 'PEN',
        orderId: order.code,
        customer: {
          email: customerEmail,
          billingDetails: {
            firstName,
            lastName: rest.join(' ') || firstName,
            phoneNumber: order.customerPhone,
            country: 'PE',
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    payload = await response.json();
  } catch {
    throw new HttpError(502, 'No pudimos conectar con la pasarela de pagos. Inténtalo otra vez o paga con Yape.');
  }

  const formToken = payload.answer?.formToken;
  if (payload.status !== 'SUCCESS' || !formToken) {
    console.error('Izipay rechazó CreatePayment:', payload.answer?.errorMessage ?? payload.status);
    throw new HttpError(502, 'La pasarela de pagos no aceptó la solicitud. Inténtalo otra vez o paga con Yape.');
  }

  res.json({ formToken, publicKey: env.izipay.publicKey });
}

/** POST /api/orders/:code/card/confirm (cliente) — valida la respuesta firmada que recibió el navegador. */
export async function confirmCardPayment(req: Request, res: Response) {
  assertEnabled();
  const order = await findCustomerOrder(req);
  const { krAnswer, krHash } = confirmSchema.parse(req.body);

  if (!isValidSignature(krAnswer, krHash, env.izipay.hmacKey)) throw new HttpError(400, 'Firma de pago inválida');
  const answer = answerSchema.parse(JSON.parse(krAnswer));
  if (answer.orderDetails.orderId !== order.code) throw new HttpError(400, 'El pago no corresponde a este pedido');
  if (answer.orderStatus !== 'PAID') throw new HttpError(402, 'El pago no se completó. Puedes intentarlo de nuevo.');

  const updated = await registerCardPayment(order.code, answer.orderDetails.orderTotalAmount, answer.transactions[0]?.uuid ?? 'sin-id');
  res.json(serializeOrder(updated));
}

/**
 * POST /api/payments/izipay/ipn — notificación de servidor a servidor de Izipay.
 * Hay que registrar esta URL en el Back Office Vendedor:
 * Configuración > Reglas de notificación > URL de notificación al final del pago.
 */
export async function izipayNotification(req: Request, res: Response) {
  assertEnabled();
  const krAnswer = String(req.body?.['kr-answer'] ?? '');
  const krHash = String(req.body?.['kr-hash'] ?? '');
  // La IPN se firma con la contraseña de la tienda (no con la clave HMAC del navegador)
  if (!krAnswer || !isValidSignature(krAnswer, krHash, env.izipay.password)) {
    throw new HttpError(400, 'Firma inválida');
  }

  const answer = answerSchema.parse(JSON.parse(krAnswer));
  if (answer.orderStatus === 'PAID') {
    await registerCardPayment(answer.orderDetails.orderId, answer.orderDetails.orderTotalAmount, answer.transactions[0]?.uuid ?? 'sin-id');
  }
  res.status(200).send(`OK! OrderStatus is ${answer.orderStatus}`);
}
