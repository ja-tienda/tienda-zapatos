import type { Request, Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

/** GET /api/admin/summary — números rápidos para la cabecera del panel. */
export async function summary(_req: Request, res: Response) {
  const [products, activeProducts, pendingOrders, lowStock, outOfStock, pendingComplaints, customers] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count({ where: { status: 'PENDIENTE' } }),
    prisma.productVariant.count({ where: { isActive: true, stock: 1 } }),
    prisma.productVariant.count({ where: { isActive: true, stock: 0 } }),
    prisma.complaint.count({ where: { status: 'PENDIENTE' } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
  ]);
  res.json({ products, activeProducts, pendingOrders, lowStock, outOfStock, pendingComplaints, customers });
}

/**
 * GET /api/admin/diagnostics — cómo ve el servidor esta conexión y qué integraciones están
 * activas. Sirve para comprobar TRUST_PROXY y https después de desplegar. No muestra claves.
 */
export async function diagnostics(req: Request, res: Response) {
  res.json({
    production: env.isProduction,
    appUrl: env.appUrl,
    apiUrl: env.apiUrl,
    // Debe ser TU dirección IP pública. Si sale una IP interna (10.x, 100.x), sube TRUST_PROXY.
    yourIp: req.ip,
    forwardedFor: req.headers['x-forwarded-for'] ?? null,
    trustProxy: env.trustProxy,
    https: req.secure || String(req.headers['x-forwarded-proto'] ?? '').startsWith('https'),
    cookieSameSite: env.cookieSameSite,
    googleLogin: env.google.enabled,
    emails: env.mail.enabled,
    cardPayments: env.izipay.enabled,
    cardPaymentsMode: !env.izipay.enabled ? null : env.izipay.password.startsWith('testpassword_') ? 'prueba' : 'producción',
    googleRedirectUri: `${env.apiUrl}/api/auth/google/callback`,
    izipayNotificationUrl: `${env.apiUrl}/api/payments/izipay/ipn`,
  });
}
