import { env } from './config/env';
import { prisma } from './config/prisma';
import { hashPassword, passwordTooLong } from './utils/crypto';

/**
 * Primera vez: si todavía no hay ninguna cuenta de administración, la crea con
 * ADMIN_USERNAME, ADMIN_EMAIL y ADMIN_INITIAL_PASSWORD. Después esas variables ya no se
 * usan (la contraseña se cambia desde el panel) y conviene borrar ADMIN_INITIAL_PASSWORD.
 * En producción el servidor no arranca sin una administradora: nadie podría entrar al panel.
 */
export async function ensureAdminAccount(): Promise<void> {
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (admins > 0) return;

  const { username, email, initialPassword } = env.admin;
  const problems: string[] = [];
  if (!username || !/^[a-z0-9._-]{3,30}$/i.test(username)) problems.push('ADMIN_USERNAME (3 a 30 letras o números, sin espacios)');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) problems.push('ADMIN_EMAIL (ahí llega el enlace para recuperar la contraseña)');
  if (!initialPassword || initialPassword.length < 10 || passwordTooLong(initialPassword)) {
    problems.push('ADMIN_INITIAL_PASSWORD (mínimo 10 caracteres)');
  }

  if (problems.length > 0) {
    const message = `Aún no existe una cuenta de administración. Define: ${problems.join(' · ')}`;
    if (env.isProduction) {
      console.error(`\n✖ ${message}\n`);
      process.exit(1);
    }
    console.warn(`⚠ ${message}`);
    return;
  }

  await prisma.user.create({
    data: {
      role: 'ADMIN',
      username: username!.toLowerCase(),
      email: email!.toLowerCase(),
      name: 'Administración',
      passwordHash: await hashPassword(initialPassword!),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✔ Cuenta de administración creada (usuario: ${username!.toLowerCase()}). Cambia la contraseña desde el panel y borra ADMIN_INITIAL_PASSWORD.`);
}
