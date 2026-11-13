import type { Request, Response } from 'express';
import { env } from '../config/env';
import { loadSettings, saveSettings, settingsUpdateSchema } from '../config/settings';
import { HttpError } from '../utils/http';
import { removeUnusedUploads, saveImage, type UploadFolder } from '../utils/uploads';

const IMAGE_KEYS = ['logoUrl', 'heroImage', 'walletQrUrl'] as const;

/** GET /api/settings — textos, logo, contacto y datos de pago que usa la tienda. */
export async function getSettings(_req: Request, res: Response) {
  const settings = await loadSettings();
  res.json({ ...settings, cardPaymentsEnabled: env.izipay.enabled });
}

/** PUT /api/settings (admin) — guarda solo los campos enviados. */
export async function updateSettings(req: Request, res: Response) {
  const changes = settingsUpdateSchema.parse(req.body);
  const before = await loadSettings();
  const settings = await saveSettings(changes);
  // Si se reemplazó el logo, la portada o el QR, la imagen anterior se borra del disco
  void removeUnusedUploads(IMAGE_KEYS.filter((key) => before[key] !== settings[key]).map((key) => before[key]));
  res.json({ ...settings, cardPaymentsEnabled: env.izipay.enabled });
}

/**
 * POST /api/uploads?folder=productos|sitio (admin, multipart con el campo "file")
 * Sube una imagen desde el dispositivo y devuelve su URL para usarla en un producto,
 * una portada, el logo o el QR.
 */
export async function uploadImage(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, 'No llegó ninguna imagen');
  const folder: UploadFolder = req.query.folder === 'sitio' ? 'sitio' : 'productos';
  const url = await saveImage(req.file.buffer, folder);
  res.status(201).json({ url });
}
