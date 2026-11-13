import { randomBytes } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError } from './http';

/** Carpeta donde se guardan las imágenes subidas (backend/uploads). Hay que respaldarla junto con la BD. */
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

export type UploadFolder = 'productos' | 'sitio' | 'comprobantes';

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
 * Guarda la imagen optimizada: la endereza según su orientación, la reduce a un tamaño
 * razonable y la convierte a WebP. Reprocesarla también descarta metadatos (GPS de la foto)
 * y cualquier contenido que no sea una imagen real.
 * Devuelve la ruta pública, p. ej. "/uploads/productos/ab12….webp".
 */
export async function saveImage(buffer: Buffer, folder: UploadFolder, maxSide = 1600): Promise<string> {
  const name = `${randomBytes(16).toString('hex')}.webp`;
  const dir = path.join(UPLOADS_DIR, folder);
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

  return `${env.publicUrl}/uploads/${folder}/${name}`;
}

/**
 * Limpieza de disco: borra las imágenes subidas que ya nadie usa (por ejemplo, las fotos de
 * un producto eliminado o una portada que se reemplazó). Antes de borrar comprueba que la
 * imagen no siga en ningún producto, sección ni ajuste. Nunca interrumpe la operación
 * principal: si algo falla, el archivo simplemente se queda.
 */
export async function removeUnusedUploads(candidates: (string | null | undefined)[]): Promise<void> {
  const urls = [...new Set(candidates)].filter(
    (url): url is string => !!url && url.includes('/uploads/') && !url.includes('/uploads/comprobantes/'),
  );
  for (const url of urls) {
    try {
      const [inProducts, inSections, inSettings] = await Promise.all([
        prisma.product.count({ where: { images: { has: url } } }),
        prisma.section.count({ where: { coverImage: url } }),
        prisma.setting.count({ where: { value: url } }),
      ]);
      if (inProducts + inSections + inSettings === 0) await deleteUpload(url);
    } catch (err) {
      console.error('No se pudo limpiar la imagen', url, err);
    }
  }
}

/** Borra un archivo subido (si la ruta pertenece a /uploads). No falla si ya no existe. */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const index = url.indexOf('/uploads/');
  if (index === -1) return;
  const relative = url.slice(index + '/uploads/'.length);
  const target = path.resolve(UPLOADS_DIR, relative);
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return;
  await unlink(target).catch(() => {});
}
