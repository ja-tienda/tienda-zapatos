import 'dotenv/config';
import { z } from 'zod';

/**
 * Variables de entorno, validadas al arrancar.
 * En producción (NODE_ENV=production) el servidor NO arranca si falta una obligatoria,
 * si una URL no usa https o si una integración quedó configurada a medias.
 * No hay valores secretos por defecto: lo que no se define, no existe.
 */
const isProduction = process.env.NODE_ENV === 'production';

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined);

const url = (name: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\/+$/, ''))
    .refine((v) => /^https?:\/\/[^\s/]+/.test(v), `${name} debe ser una URL completa (https://...)`)
    .refine((v) => !isProduction || v.startsWith('https://'), `${name} debe usar https en producción`);

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'falta DATABASE_URL'),

  // Dirección pública de la TIENDA (lo que el cliente escribe en el navegador).
  // Se usa en los enlaces de los correos, en Google OAuth, en CORS y en el sitemap.
  APP_URL: isProduction ? url('APP_URL') : url('APP_URL').default('http://localhost:5173'),
  // Dirección pública del BACKEND, solo si es distinta de APP_URL (sin proxy desde la tienda).
  PUBLIC_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\/+$/, '') : '')),
  // Orígenes extra autorizados a llamar a la API (separados por coma). APP_URL ya está incluido.
  CORS_ORIGIN: optional,
  // Cuántos proxys hay delante del backend (ver docs/LANZAMIENTO.md). En tu PC: 0.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  // Carpeta de imágenes subidas. En Railway debe apuntar al Volume.
  UPLOADS_DIR: optional,

  // "lax" cuando tienda y API comparten dominio (recomendado). "none" solo si están en
  // sitios distintos (dos dominios *.up.railway.app): funciona peor en Safari y Chrome.
  COOKIE_SAMESITE: z.enum(['lax', 'none']).default('lax'),

  // Primera administradora: solo se usa si todavía no existe ninguna cuenta de administración.
  ADMIN_USERNAME: optional,
  ADMIN_EMAIL: optional,
  ADMIN_INITIAL_PASSWORD: optional,

  // "Iniciar sesión con Google" (opcional: sin estas claves el botón no aparece)
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  // Envío de correos con Resend (recuperar contraseña, constancia de reclamos)
  RESEND_API_KEY: optional,
  MAIL_FROM: optional, // ej. "J & A <pedidos@tudominio.com>"

  // Pago con tarjeta (Izipay). Sin las 4 claves la opción sale como "Próximamente".
  IZIPAY_USERNAME: optional,
  IZIPAY_PASSWORD: optional,
  IZIPAY_PUBLIC_KEY: optional,
  IZIPAY_HMAC_KEY: optional,
});

function fail(problems: string[]): never {
  console.error('\n✖ Configuración inválida. Revisa las variables de entorno:\n');
  for (const p of problems) console.error(`  · ${p}`);
  console.error('\nLa lista completa está en .env.example\n');
  process.exit(1);
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  fail(parsed.error.issues.map((i) => `${i.path.join('.') || 'entorno'}: ${i.message}`));
}
const raw = parsed.data;

// Integraciones que solo funcionan completas: o todas sus claves, o ninguna.
const problems: string[] = [];
const allOrNone = (label: string, values: Record<string, string | undefined>) => {
  const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0 && missing.length < Object.keys(values).length) {
    problems.push(`${label} está a medias: falta ${missing.join(', ')}`);
  }
  return missing.length === 0;
};

const googleEnabled = allOrNone('Google OAuth', {
  GOOGLE_CLIENT_ID: raw.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: raw.GOOGLE_CLIENT_SECRET,
});
const mailEnabled = allOrNone('El envío de correos', { RESEND_API_KEY: raw.RESEND_API_KEY, MAIL_FROM: raw.MAIL_FROM });
const izipayEnabled = allOrNone('Izipay', {
  IZIPAY_USERNAME: raw.IZIPAY_USERNAME,
  IZIPAY_PASSWORD: raw.IZIPAY_PASSWORD,
  IZIPAY_PUBLIC_KEY: raw.IZIPAY_PUBLIC_KEY,
  IZIPAY_HMAC_KEY: raw.IZIPAY_HMAC_KEY,
});

if (isProduction) {
  if (raw.COOKIE_SAMESITE === 'none' && !raw.APP_URL.startsWith('https://')) {
    problems.push('COOKIE_SAMESITE=none exige https');
  }
  if (raw.IZIPAY_PASSWORD?.startsWith('testpassword_')) {
    console.warn('⚠ Izipay está con claves de PRUEBA: los pagos con tarjeta no cobran dinero real.');
  }
  if (!mailEnabled) {
    console.warn('⚠ Sin RESEND_API_KEY y MAIL_FROM no se envían correos: la recuperación de contraseña no funcionará.');
  }
}
if (problems.length > 0) fail(problems);

const appOrigin = new URL(raw.APP_URL).origin;
const extraOrigins = (raw.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const env = {
  isProduction,
  port: raw.PORT,
  databaseUrl: raw.DATABASE_URL,
  appUrl: raw.APP_URL,
  /** Dirección pública de la API: la propia si se definió, o la de la tienda (que la reenvía). */
  apiUrl: raw.PUBLIC_URL || raw.APP_URL,
  /** Prefijo de las imágenes subidas. Vacío = rutas relativas (/uploads/...). */
  publicUrl: raw.PUBLIC_URL,
  /** Orígenes desde los que el navegador puede llamar a la API con sesión. */
  allowedOrigins: [...new Set([appOrigin, ...extraOrigins])],
  trustProxy: raw.TRUST_PROXY,
  uploadsDir: raw.UPLOADS_DIR,
  cookieSameSite: raw.COOKIE_SAMESITE,
  admin: {
    username: raw.ADMIN_USERNAME,
    email: raw.ADMIN_EMAIL,
    initialPassword: raw.ADMIN_INITIAL_PASSWORD,
  },
  google: { enabled: googleEnabled, clientId: raw.GOOGLE_CLIENT_ID ?? '', clientSecret: raw.GOOGLE_CLIENT_SECRET ?? '' },
  mail: { enabled: mailEnabled, apiKey: raw.RESEND_API_KEY ?? '', from: raw.MAIL_FROM ?? '' },
  izipay: {
    enabled: izipayEnabled,
    username: raw.IZIPAY_USERNAME ?? '',
    password: raw.IZIPAY_PASSWORD ?? '',
    publicKey: raw.IZIPAY_PUBLIC_KEY ?? '',
    hmacKey: raw.IZIPAY_HMAC_KEY ?? '',
  },
};
