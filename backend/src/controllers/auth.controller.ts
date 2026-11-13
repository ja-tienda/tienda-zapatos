import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { cookieOptions, endAllSessions, endSession, startSession } from '../middleware/auth';
import { sendMail } from '../services/mailer';
import { hashPassword, passwordTooLong, randomToken, safeEqual, sha256, verifyPassword } from '../utils/crypto';
import { HttpError } from '../utils/http';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_MINUTES = 30;
const OAUTH_COOKIE = 'ja_oauth';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Ingresa un correo válido').max(120));

const newPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((p) => !passwordTooLong(p), 'La contraseña es demasiado larga (máximo 72 caracteres)')
  .refine((p) => !/^(.)\1+$/.test(p) && !['12345678', 'password', 'contraseña', 'qwertyui'].includes(p.toLowerCase()), {
    message: 'Elige una contraseña menos fácil de adivinar',
  });

const name = z.string().trim().min(3, 'Ingresa tu nombre completo').max(80);

const registerSchema = z.object({
  name,
  email,
  password: newPassword,
  acceptTerms: z.literal(true, 'Debes aceptar los términos y la política de privacidad'),
});
const loginSchema = z.object({ identifier: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().min(20).max(200), password: newPassword });
const changePasswordSchema = z.object({ currentPassword: z.string().max(200).optional(), newPassword });
const profileSchema = z.object({
  name,
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()+-]/g, ''))
    .pipe(z.union([z.literal(''), z.string().regex(/^\d{9,12}$/, 'Teléfono inválido (9 dígitos)')])),
});

/** Lo único del usuario que viaja al navegador. Nunca la contraseña ni su huella. */
export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    hasPassword: user.passwordHash !== null,
    hasGoogle: user.googleId !== null,
  };
}

/** GET /api/auth/me — quién tiene la sesión (o null) y qué formas de entrar están disponibles. */
export async function me(req: Request, res: Response) {
  res.json({ user: req.user ? publicUser(req.user) : null, googleEnabled: env.google.enabled });
}

/** POST /api/auth/register — cuenta de cliente con correo y contraseña. */
export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
  }

  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password), lastLoginAt: new Date() },
  });
  await startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}

/**
 * POST /api/auth/login — clientes (correo) y administradora (usuario o correo).
 * Tras 5 contraseñas incorrectas la cuenta se bloquea 15 minutos, además del límite por IP.
 */
export async function login(req: Request, res: Response) {
  const { identifier, password } = loginSchema.parse(req.body);
  const key = identifier.toLowerCase();

  const user = await prisma.user.findFirst({ where: { OR: [{ email: key }, { username: key }] } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new HttpError(429, `Cuenta bloqueada por demasiados intentos. Inténtalo en ${minutes} min o recupera tu contraseña.`);
  }

  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) {
    if (user) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
    }
    // Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  if (!user.isActive) throw new HttpError(403, 'Esta cuenta está desactivada. Escríbenos por WhatsApp.');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await startSession(res, updated);
  res.json({ user: publicUser(updated) });
}

/** POST /api/auth/logout */
export async function logout(req: Request, res: Response) {
  await endSession(req, res);
  res.status(204).end();
}

/**
 * POST /api/auth/forgot — envía un enlace de un solo uso que caduca en 30 minutos.
 * Responde siempre lo mismo, exista o no la cuenta.
 */
export async function forgotPassword(req: Request, res: Response) {
  const data = forgotSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (user?.isActive) {
    const token = randomToken();
    await prisma.$transaction([
      // Un enlace nuevo invalida los anteriores
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
      }),
    ]);
    const path = user.role === 'ADMIN' ? '/admin/' : '/restablecer';
    await sendMail({
      to: user.email,
      subject: 'Restablece tu contraseña — J & A',
      paragraphs: [
        `Hola ${user.name},`,
        `Recibimos una solicitud para cambiar la contraseña de tu cuenta. El enlace sirve una sola vez y caduca en ${RESET_MINUTES} minutos.`,
        'Si no fuiste tú, ignora este correo: tu contraseña sigue igual.',
      ],
      action: { label: 'Crear nueva contraseña', url: `${env.appUrl}${path}?token=${token}` },
    });
  }

  res.json({ ok: true });
}

/** POST /api/auth/reset — fija la nueva contraseña y cierra todas las sesiones abiertas. */
export async function resetPassword(req: Request, res: Response) {
  const data = resetSchema.parse(req.body);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(data.token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    throw new HttpError(400, 'El enlace ya no es válido o caducó. Solicita uno nuevo.');
  }

  // Se marca como usado con una condición: si dos peticiones llegan a la vez, solo una gana
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw new HttpError(400, 'El enlace ya fue usado. Solicita uno nuevo.');

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: {
      passwordHash: await hashPassword(data.password),
      failedLogins: 0,
      lockedUntil: null,
      // Abrir el enlace demuestra que el correo es suyo
      emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
    },
  });
  await endAllSessions(user.id);
  res.json({ ok: true, role: user.role });
}

/** POST /api/auth/password — cambiar la contraseña con sesión iniciada (pide la actual). */
export async function changePassword(req: Request, res: Response) {
  const user = req.user!;
  const data = changePasswordSchema.parse(req.body);

  // Una cuenta creada con Google aún no tiene contraseña: puede definir una sin "actual"
  if (user.passwordHash !== null) {
    const valid = await verifyPassword(data.currentPassword ?? '', user.passwordHash);
    if (!valid) throw new HttpError(400, 'La contraseña actual no es correcta');
    if (data.currentPassword === data.newPassword) throw new HttpError(400, 'La nueva contraseña debe ser distinta de la actual');
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.newPassword) } });
  // Las demás sesiones (otros dispositivos) se cierran; esta sigue abierta
  await endAllSessions(user.id, req.sessionId);
  res.json({ ok: true });
}

/** PUT /api/auth/profile — nombre y teléfono. */
export async function updateProfile(req: Request, res: Response) {
  const data = profileSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { name: data.name, phone: data.phone || null } });
  res.json({ user: publicUser(user) });
}

// ───────────────────────── Iniciar sesión con Google (OAuth 2.0 / OpenID Connect) ─────────────────────────
//
// Flujo "authorization code" hecho por el servidor:
//   1. /auth/google          -> redirige a Google con un `state` y un `nonce` aleatorios
//   2. Google vuelve a /auth/google/callback con un `code`
//   3. El servidor cambia ese code por un id_token usando el client secret (que nunca sale de aquí)
//   4. Se comprueba el id_token y se inicia la sesión con la misma cookie que el resto

const googleRedirectUri = () => `${env.apiUrl}/api/auth/google/callback`;

/** Solo se aceptan rutas internas ("/checkout"): evita que el enlace redirija a otro sitio. */
function safeNextPath(value: unknown): string {
  return typeof value === 'string' && /^\/[A-Za-z0-9\-_/]*$/.test(value) && !value.startsWith('//') ? value : '/cuenta';
}

/** GET /api/auth/google?next=/checkout */
export async function googleStart(req: Request, res: Response) {
  if (!env.google.enabled) throw new HttpError(404, 'El inicio de sesión con Google no está disponible');

  const state = randomToken();
  const nonce = randomToken();
  res.cookie(OAUTH_COOKIE, JSON.stringify({ state, nonce, next: safeNextPath(req.query.next) }), cookieOptions(10 * 60_000));

  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

const idTokenSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1),
  email: z.string(),
  email_verified: z.union([z.boolean(), z.string()]),
  name: z.string().optional(),
  nonce: z.string().optional(),
});

/** GET /api/auth/google/callback */
export async function googleCallback(req: Request, res: Response) {
  const back = (path: string, error?: string) => res.redirect(`${env.appUrl}${path}${error ? `?error=${error}` : ''}`);
  if (!env.google.enabled) return back('/cuenta', 'google');

  let saved: { state?: string; nonce?: string; next?: string } = {};
  try {
    saved = JSON.parse(String(req.cookies?.[OAUTH_COOKIE] ?? '{}'));
  } catch {
    /* cookie ausente o alterada */
  }
  res.clearCookie(OAUTH_COOKIE, cookieOptions());
  const next = safeNextPath(saved.next);

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  // El `state` debe ser el mismo que guardamos en la cookie de ESTE navegador
  if (!code || !saved.state || !saved.nonce || !safeEqual(state, saved.state)) return back('/cuenta', 'google');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.google.clientId,
        client_secret: env.google.clientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const tokens = (await tokenResponse.json()) as { id_token?: string };
    if (!tokenResponse.ok || !tokens.id_token) return back('/cuenta', 'google');

    // El id_token llegó directo de Google por https: basta comprobar sus datos
    const payload = idTokenSchema.parse(JSON.parse(Buffer.from(tokens.id_token.split('.')[1] ?? '', 'base64url').toString('utf8')));
    const issuerOk = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    if (
      !issuerOk ||
      payload.aud !== env.google.clientId ||
      payload.exp * 1000 < Date.now() ||
      !payload.nonce ||
      !safeEqual(payload.nonce, saved.nonce) ||
      !verified
    ) {
      return back('/cuenta', 'google');
    }

    const googleEmail = payload.email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { OR: [{ googleId: payload.sub }, { email: googleEmail }] } });

    if (user?.role === 'ADMIN') return back('/cuenta', 'google-admin'); // la administradora entra solo con su contraseña
    if (user && !user.isActive) return back('/cuenta', 'desactivada');

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleEmail,
          name: (payload.name ?? googleEmail.split('@')[0]).slice(0, 80),
          googleId: payload.sub,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });
    } else {
      const firstLink = user.googleId === null;
      // Si alguien registró este correo con contraseña sin demostrar que era suyo, esa
      // contraseña se anula al entrar el dueño real con Google (y se cierran sus sesiones).
      const dropPassword = firstLink && user.emailVerifiedAt === null;
      if (dropPassword) await endAllSessions(user.id);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          lastLoginAt: new Date(),
          ...(dropPassword ? { passwordHash: null } : {}),
        },
      });
    }

    await startSession(res, user);
    back(next);
  } catch (err) {
    console.error('Fallo en el inicio de sesión con Google:', err instanceof Error ? err.message : err);
    back('/cuenta', 'google');
  }
}
