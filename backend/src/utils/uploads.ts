import { randomBytes } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError } from './http';

/**
 * Carpeta de imágenes subidas. En Railway debe ser un Volume (UPLOADS_DIR), o se pierden
 * en cada despliegue. Hay que respaldarla junto con la base de datos.
 *   productos/  y  sitio/   -> públicas, se sirven en /uploads/...
 *   comprobantes/           -> PRIVADA: capturas de pago, solo las ve la administradora
 */
export const UPLOADS_DIR = path.resolve(env.uploadsDir ?? path.join(process.cwd(), 'uploads'));
export const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'comprobantes');
const RECEIPT_URL_PREFIX = '/api/receipts/';

export type UploadFolder = 'productos' | 'sitio';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_MB = 12;

/** Recibe un solo archivo en memoria (campo "file"); luego se procesa con saveImage(). */
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Formato no permitido. Usa una imagen JPG, PNG o WebP.'));
  },
}).single('file');

/**
 * Reprocesa la imagen: la endereza, la reduce y la convierte a WebP. Esto también descarta
 * los metadatos (GPS de la foto) y cualquier contenido que no sea una imagen real, aunque
 * el archivo diga ser JPG.
 */
async function writeWebp(buffer: Buffer, dir: string, maxSide: number): Promise<string> {
  const name = `${randomBytes(16).toString('hex')}.webp`;
  await mkdir(dir, { recursive: true });
  try {
    await sharp(buffer, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(dir, name));
  } catch {
    throw new HttpError(400, 'No pudimos leer la imagen. Prueba con otra foto (JPG, PNG o WebP).');
  }
  return name;
}

/** Guarda una imagen pública y devuelve su dirección, p. ej. "/uploads/productos/ab12….webp". */
export async function saveImage(buffer: Buffer, folder: UploadFolder, maxSide = 1600): Promise<string> {
  const name = await writeWebp(buffer, path.join(UPLOADS_DIR, folder), maxSide);
  return `${env.publicUrl}/uploads/${folder}/${name}`;
}

/** Guarda la captura de un pago en la carpeta privada. Devuelve la ruta protegida para verla. */
export async function saveReceipt(buffer: Buffer): Promise<string> {
  return `${RECEIPT_URL_PREFIX}${await writeWebp(buffer, RECEIPTS_DIR, 1600)}`;
}

export async function deleteReceipt(url: string | null | undefined): Promise<void> {
  const file = url?.startsWith(RECEIPT_URL_PREFIX) ? url.slice(RECEIPT_URL_PREFIX.length) : null;
  if (!file || !/^[a-f0-9]{32}\.webp$/.test(file)) return;
  await unlink(path.join(RECEIPTS_DIR, file)).catch(() => {});
}

/**
 * Limpieza de disco: borra las imágenes subidas que ya nadie usa (por ejemplo, las fotos de
 * un producto eliminado o una portada que se reemplazó). Antes de borrar comprueba que la
 * imagen no siga en ningún producto, sección ni ajuste. Nunca interrumpe la operación
 * principal: si algo falla, el archivo simplemente se queda.
 */
export async function removeUnusedUploads(candidates: (string | null | undefined)[]): Promise<void> {
  const urls = [...new Set(candidates)].filter((url): url is string => !!url && url.includes('/uploads/'));
  for (const url of urls) {
    try {
      const [inProducts, inSections, inSettings] = await Promise.all([
        prisma.product.count({ where: { images: { has: url } } }),
        prisma.section.count({ where: { coverImage: url } }),
        prisma.setting.count({ where: { value: url } }),
      ]);
      if (inProducts + inSections + inSettings === 0) await deleteUpload(url);
    } catch (err) {
      console.error('No se pudo limpiar una imagen sin uso:', err instanceof Error ? err.message : err);
    }
  }
}

/** Borra un archivo público subido. Nunca toca la carpeta de comprobantes ni sale de /uploads. */
async function deleteUpload(url: string): Promise<void> {
  const index = url.indexOf('/uploads/');
  if (index === -1) return;
  const target = path.resolve(UPLOADS_DIR, url.slice(index + '/uploads/'.length));
  if (!target.startsWith(UPLOADS_DIR + path.sep) || target.startsWith(RECEIPTS_DIR)) return;
  await unlink(target).catch(() => {});
}
