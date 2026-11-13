import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { randomToken, sha256 } from '../utils/crypto';
import { HttpError } from '../utils/http';

/**
 * Sesiones con cookie httpOnly.
 * El navegador guarda un valor aleatorio que JavaScript no puede leer (httpOnly), que solo
 * viaja por https (secure) y que no se envía desde otros sitios (SameSite). En la base de
 * datos se guarda su huella, así se puede cerrar una sesión desde el servidor en cualquier
 * momento (al desactivar una cuenta o cambiar la contraseña).
 */
// El prefijo __Host- hace que el navegador rechace la cookie si no es Secure, con Path=/ y sin Domain.
export const SESSION_COOKIE = env.isProduction ? '__Host-ja_session' : 'ja_session';

const HOUR = 60 * 60 * 1000;
const TTL = { ADMIN: 12 * HOUR, CUSTOMER: 30 * 24 * HOUR } as const;

declare module 'express-serve-static-core' {
  interface Request {
    /** Usuario con sesión válida, cargado por `loadSession`. */
    user?: User;
    sessionId?: string;
  }
}

export function cookieOptions(maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.cookieSameSite,
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export async function startSession(res: Response, user: User): Promise<void> {
  const token = randomToken();
  const ttl = TTL[user.role];
  await prisma.session.create({
    data: { id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + ttl) },
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(ttl));
}

export async function endSession(req: Request, res: Response): Promise<void> {
  if (req.sessionId) await prisma.session.deleteMany({ where: { id: req.sessionId } });
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

/** Cierra todas las sesiones de un usuario (opcionalmente menos la actual). */
export async function endAllSessions(userId: number, exceptSessionId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

/** Si la petición trae una cookie de sesión válida, deja el usuario en `req.user`. */
export async function loadSession(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20) return next();

  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } });
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    return next();
  }
  req.user = session.user;
  req.sessionId = session.id;
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar'));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Tu sesión venció. Vuelve a iniciar sesión.'));
  if (req.user.role !== 'ADMIN') return next(new HttpError(403, 'Esta sección es solo para la administración'));
  next();
}

export const isAdminRequest = (req: Request): boolean => req.user?.role === 'ADMIN';

/** Borra las sesiones y los enlaces de recuperación vencidos (se llama cada cierto tiempo). */
export async function purgeExpiredAuth(): Promise<void> {
  const now = new Date();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * HOUR) } } });
}
