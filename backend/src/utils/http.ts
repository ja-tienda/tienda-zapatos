import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

// En producción el cliente recibe solo el mensaje; los detalles técnicos se quedan en el servidor
const isProduction = process.env.NODE_ENV === 'production';

/** Error con código HTTP que el cliente puede mostrar tal cual. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identificador inválido');
  return id;
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join('.');
    return res.status(400).json({
      error: first ? `${field ? field + ': ' : ''}${first.message}` : 'Datos inválidos',
      ...(isProduction ? {} : { details: err.issues }),
    });
  }
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'La imagen pesa demasiado (máximo 12 MB).' : 'No se pudo recibir el archivo.';
    return res.status(400).json({ error: message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Registro no encontrado' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
    if (err.code === 'P2003') return res.status(409).json({ error: 'No se puede eliminar: tiene elementos asociados' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  // Al registro va el error completo (para diagnosticar); al cliente, nunca el detalle ni la traza
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado. Inténtalo de nuevo en un momento.' });
}
