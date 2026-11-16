/**
 * Aplica las migraciones pendientes antes de arrancar el servidor (lo llama `npm start`).
 *
 * Si existe MIGRATE_DATABASE_URL se usa esa conexión solo para migrar: así el servidor puede
 * funcionar el resto del tiempo con un usuario de base de datos de permisos mínimos
 * (DATABASE_URL), que no puede crear ni borrar tablas. Sin ella, se usa DATABASE_URL.
 * Ver docs/LANZAMIENTO.md, sección "Base de datos".
 */
const { spawnSync } = require('node:child_process');

const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('✖ Falta DATABASE_URL: no se pueden aplicar las migraciones.');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});

if (result.status !== 0) {
  console.error('✖ Las migraciones fallaron: el servidor no arranca para no trabajar con una base desactualizada.');
  process.exit(result.status ?? 1);
}
