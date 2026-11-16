import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from '../config/env';
import { HttpError } from '../utils/http';

/**
 * Cabeceras de seguridad de la API. El backend solo entrega JSON e imágenes, así que su
 * política de contenido es la más estricta posible. Las cabeceras de las PÁGINAS de la
 * tienda (incluida la CSP compatible con Izipay) las pone el servidor del frontend.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  // Las fotos de productos se muestran desde el dominio de la tienda
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: env.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

/**
 * Fuerza https en producción. Solo redirige lo que llegó por http desde internet (el proxy
 * de Railway lo indica con X-Forwarded-Proto); las llamadas internas entre servicios y el
 * chequeo de salud no traen esa cabecera y pasan tal cual.
 */
export function forceHttps(req: Request, res: Response, next: NextFunction) {
  if (!env.isProduction) return next();
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  if (proto !== 'http') return next();
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  next(new HttpError(400, 'Usa https'));
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protección CSRF para una API con cookies. Toda petición que modifica datos debe:
 *   1. traer la cabecera X-Requested-With (un formulario HTML de otro sitio no puede añadirla
 *      y, al ser una cabecera propia, CORS obliga al navegador a pedir permiso antes), y
 *   2. si el navegador informa de dónde viene (Origin o Referer), venir de nuestra tienda.
 * Se suma a SameSite en la cookie. La notificación de Izipay queda fuera: no usa cookies,
 * llega de servidor a servidor y se valida con su firma.
 */
export function verifyRequestOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  if (!req.headers['x-requested-with']) {
    return next(new HttpError(403, 'Petición no permitida'));
  }

  const origin = req.headers.origin ?? originOf(req.headers.referer);
  if (origin && !env.allowedOrigins.includes(origin)) {
    return next(new HttpError(403, 'Petición no permitida desde este sitio'));
  }
  next();
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid';
  }
}

/** Límite de peticiones por IP. `skipSuccessful` cuenta solo los intentos fallidos. */
export const limiter = (windowMinutes: number, limit: number, message: string, skipSuccessful = false) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests: skipSuccessful,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });

export const limits = {
  // Adivinar contraseñas: 10 fallos cada 15 min por IP (además del bloqueo por cuenta)
  login: limiter(15, 10, 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.', true),
  register: limiter(60, 10, 'Demasiados registros desde esta conexión. Inténtalo más tarde.'),
  // Evita usar la tienda para bombardear de correos a alguien
  passwordReset: limiter(60, 6, 'Demasiadas solicitudes. Inténtalo en una hora.'),
  checkout: limiter(10, 15, 'Demasiados pedidos seguidos. Inténtalo en unos minutos.'),
  upload: limiter(10, 12, 'Demasiados envíos seguidos. Inténtalo en unos minutos.'),
  card: limiter(10, 20, 'Demasiados intentos de pago. Inténtalo en unos minutos.'),
  complaint: limiter(60, 5, 'Demasiados envíos desde esta conexión. Inténtalo más tarde.'),
  // Tope general: frena scrapers y abusos sin molestar a un cliente normal
  general: limiter(1, 300, 'Demasiadas peticiones. Espera un momento.'),
};
