import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from '../utils/http';

const TOKEN_TTL = '8h';

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, env.adminTokenSecret, { expiresIn: TOKEN_TTL });
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export function isAdminRequest(req: Request): boolean {
  const token = readToken(req);
  if (!token) return false;
  try {
    const payload = jwt.verify(token, env.adminTokenSecret);
    return typeof payload === 'object' && payload.role === 'admin';
  } catch {
    return false;
  }
}

/** Bloquea la ruta si no llega un token de administradora válido. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!isAdminRequest(req)) {
    return next(new HttpError(401, 'Sesión de administradora inválida o vencida. Ingresa tu PIN otra vez.'));
  }
  next();
}
