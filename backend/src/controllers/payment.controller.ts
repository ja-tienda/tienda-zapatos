import { createHmac } from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { safeEqual } from '../utils/crypto';
import { HttpError } from '../utils/http';
import { PAYMENT_WINDOW_MS, findOwnOrder, takeStock } from './order.controller';

/**
 * Pago con tarjeta mediante Izipay (formulario incrustado, API REST V4).
 *
 *   1. createCardPayment  -> el servidor pide a Izipay un "formToken" por el total del pedido.
 *   2. El navegador muestra el formulario de Izipay con ese token. Los datos de la tarjeta
 *      van directo a Izipay: nunca pasan por nuestra tienda ni por este servidor.
 *   3. izipayNotification -> Izipay avisa a ESTE servidor (IPN) con el resultado, firmado.
 *
 * El pedido se marca como PAGADO únicamente en el paso 3, después de comprobar la firma
 * HMAC-SHA-256. Lo que diga el navegador sobre el pago no cambia nada: la página del
 * pedido solo consulta el estado hasta que llega la notificación.
 *
 * Documentación: https://secure.micuentaweb.pe/doc/es-PE/rest/V4.0/javascript/
 */
const CREATE_PAYMENT_URL = 'https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment';

const startSchema = z.object({ email: z.email('correo inválido').max(120).optional() });

/** Lo que usamos de la respuesta de Izipay (kr-answer). */
const answerSchema = z.object({
  orderStatus: z.string(), // PAID, UNPAID, RUNNING, PARTIALLY_PAID
  orderDetails: z.object({ orderId: z.string(), orderTotalAmount: z.number(), orderCurrency: z.string().optional() }),
  transactions: z
    .array(z.object({ uuid: z.string(), detailedStatus: z.string().optional(), errorMessage: z.string().nullish() }))
    .default([]),
});

function assertEnabled() {
  if (!env.izipay.enabled) throw new HttpError(503, 'El pago con tarjeta aún no está disponible');
}

/** Firma válida = HMAC-SHA256(kr-answer, clave) coincide con kr-hash (comparación en tiempo constante). */
export function isValidSignature(answer: string, hash: string, key: string): boolean {
  const expected = createHmac('sha256', key).update(answer, 'utf8').digest('hex');
  return safeEqual(expected, hash.toLowerCase());
}

const toCents = (amount: unknown) => Math.round(Number(amount) * 100);

/**
 * Registra un pago aprobado. Es idempotente: Izipay puede repetir la notificación.
 * El stock ya estaba reservado desde que se creó el pedido. Si el pago llega cuando la
 * reserva ya había vencido (pedido cancelado), se intenta reservar otra vez; si justo se
 * agotó, el pedido queda cancelado pero marcado como cobrado para devolver el dinero.
 */
async function registerCardPayment(orderCode: string, amountCents: number, currency: string | undefined, transactionId: string) {
  const order = await prisma.order.findUnique({ where: { code: orderCode }, include: { items: true } });
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  if (order.paymentRef === transactionId || (order.paidAt && order.paymentMethod === 'TARJETA')) return; // ya registrado
  if (toCents(order.total) !== amountCents || (currency && currency !== 'PEN')) {
    throw new HttpError(400, 'El monto pagado no coincide con el pedido');
  }

  const paid = { paymentMethod: 'TARJETA', paidAt: new Date(), paymentRef: transactionId, reservedUntil: null } as const;

  if (order.status === 'PENDIENTE') {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDIENTE' },
        data: { ...paid, status: 'PAGADO', stockReserved: true },
      });
      if (count === 1 && !order.stockReserved) await takeStock(tx, order.items);
    });
    return;
  }

  if (order.status === 'CANCELADO') {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({ where: { id: order.id, status: 'CANCELADO' }, data: { ...paid, status: 'PAGADO', stockReserved: true } });
        await takeStock(tx, order.items);
      });
    } catch (err) {
      if (!(err instanceof HttpError && err.status === 409)) throw err;
      // Cobrado pero sin stock: queda cancelado con la marca de pago para que se devuelva
      await prisma.order.update({ where: { id: order.id }, data: paid });
      console.error(`Pedido ${order.code}: se cobró con tarjeta pero ya no había stock. Hay que devolver el pago.`);
    }
  }
}

/** POST /api/orders/:code/card (su dueño) — pide a Izipay el token para mostrar el formulario de pago. */
export async function createCardPayment(req: Request, res: Response) {
  assertEnabled();
  const order = await findOwnOrder(req);
  if (order.status !== 'PENDIENTE') throw new HttpError(409, 'Este pedido ya no admite pagos');

  const { email } = startSchema.parse(req.body ?? {});
  const customerEmail = email ?? order.customerEmail ?? req.user!.email;

  const [firstName, ...rest] = order.customerName.split(' ');
  let payload: { status?: string; answer?: { formToken?: string; errorCode?: string } };
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
        // A dónde avisa Izipay el resultado. También conviene dejarla fija en su Back Office.
        ipnTargetUrl: `${env.apiUrl}/api/payments/izipay/ipn`,
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
    // Solo el código de error: nunca se registran datos del pago
    console.error('Izipay rechazó CreatePayment:', payload.answer?.errorCode ?? payload.status);
    throw new HttpError(502, 'La pasarela de pagos no aceptó la solicitud. Inténtalo otra vez o paga con Yape.');
  }

  // Mientras el cliente escribe su tarjeta no se le quita el stock reservado
  await prisma.order.update({
    where: { id: order.id },
    data: { reservedUntil: new Date(Date.now() + PAYMENT_WINDOW_MS), customerEmail },
  });

  // La clave pública es, como dice su nombre, pública: identifica a la tienda en el navegador
  res.json({ formToken, publicKey: env.izipay.publicKey });
}

/**
 * POST /api/payments/izipay/ipn — notificación de servidor a servidor de Izipay.
 * La IPN se firma con la CONTRASEÑA de la tienda (la respuesta al navegador, con la clave
 * HMAC). Siempre se responde 200 a una notificación auténtica, aunque el pago sea rechazado,
 * para que Izipay no la repita sin necesidad.
 */
export async function izipayNotification(req: Request, res: Response) {
  assertEnabled();
  const krAnswer = String(req.body?.['kr-answer'] ?? '');
  const krHash = String(req.body?.['kr-hash'] ?? '');
  if (!krAnswer || !krHash || !isValidSignature(krAnswer, krHash, env.izipay.password)) {
    throw new HttpError(400, 'Firma inválida');
  }

  const answer = answerSchema.parse(JSON.parse(krAnswer));
  const transaction = answer.transactions[0];

  if (answer.orderStatus === 'PAID') {
    await registerCardPayment(
      answer.orderDetails.orderId,
      answer.orderDetails.orderTotalAmount,
      answer.orderDetails.orderCurrency,
      transaction?.uuid ?? 'sin-id',
    );
  } else {
    // Rechazado, cancelado o abandonado: el pedido sigue PENDIENTE y el cliente puede
    // intentar otra vez o pagar con Yape. Si no paga, la reserva de stock vence sola.
    console.log(`Izipay: pedido ${answer.orderDetails.orderId} sin pagar (${answer.orderStatus}/${transaction?.detailedStatus ?? '-'})`);
  }

  res.status(200).send(`OK! OrderStatus is ${answer.orderStatus}`);
}
