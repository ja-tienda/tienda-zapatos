import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

/** Costo de bcrypt: ~250 ms por contraseña en un servidor normal. Subirlo con los años. */
const BCRYPT_ROUNDS = 12;

/** bcrypt solo usa los primeros 72 bytes: se rechaza lo más largo en vez de truncarlo en silencio. */
export const MAX_PASSWORD_BYTES = 72;

export function passwordTooLong(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Huella de relleno: cuando la cuenta no existe igual se hace una comparación, para que
// el tiempo de respuesta no delate si un correo está registrado.
const DUMMY_HASH = bcrypt.hashSync('contraseña-de-relleno', BCRYPT_ROUNDS);

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (passwordTooLong(password)) return false;
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH);
  return ok && !!hash;
}

/** Valor aleatorio para cookies de sesión y enlaces de un solo uso (256 bits). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** En la base de datos solo se guarda la huella del token, nunca el token. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
