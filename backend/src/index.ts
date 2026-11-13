import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { ensureAdminAccount } from './bootstrap';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { releaseExpiredOrders } from './controllers/order.controller';
import { izipayNotification } from './controllers/payment.controller';
import { loadSession, purgeExpiredAuth } from './middleware/auth';
import { forceHttps, limits, securityHeaders, verifyRequestOrigin } from './middleware/security';
import apiRoutes from './routes/api.routes';
import { errorHandler, notFound } from './utils/http';
import { UPLOADS_DIR } from './utils/uploads';

const app = express();
app.disable('x-powered-by');
// Necesario para ver la IP real del cliente (límites de intentos) detrás del proxy de Railway
app.set('trust proxy', env.trustProxy);

app.use(forceHttps);
app.use(securityHeaders);

// Notificación de pagos de Izipay: llega de servidor a servidor, como formulario y sin cookies.
// Va antes de CORS y de la protección CSRF porque no viene de un navegador; su seguridad es la firma.
app.post('/api/payments/izipay/ipn', express.urlencoded({ extended: false, limit: '200kb' }), izipayNotification);

// Solo nuestra tienda puede llamar a la API desde un navegador, y con cookies de sesión
app.use(
  cors({
    origin: env.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
    maxAge: 600,
  }),
);

// Fotos de productos, portadas, logo y QR: públicas. Los nombres son aleatorios y nunca se
// reutilizan, por eso el navegador puede guardarlas en caché mucho tiempo.
// Las capturas de pago NO se sirven aquí: solo por /api/receipts con sesión de administración.
app.use('/uploads/comprobantes', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, { index: false, dotfiles: 'deny', maxAge: '30d', immutable: true }),
);

app.use('/api', limits.general, express.json({ limit: '300kb' }), cookieParser(), verifyRequestOrigin, loadSession, apiRoutes);
app.use(notFound);
app.use(errorHandler);

async function start() {
  await ensureAdminAccount();

  const server = app.listen(env.port, () => {
    console.log(`API J & A lista en el puerto ${env.port} (${env.isProduction ? 'producción' : 'desarrollo'})`);
    console.log(`  Tienda: ${env.appUrl} · Google: ${env.google.enabled ? 'sí' : 'no'} · Correos: ${env.mail.enabled ? 'sí' : 'no'} · Tarjeta: ${env.izipay.enabled ? 'sí' : 'no'}`);
  });

  // Tareas de mantenimiento: liberar el stock de pedidos que nadie pagó y borrar sesiones vencidas
  const everyMinute = setInterval(() => {
    releaseExpiredOrders().catch((err) => console.error('No se pudo liberar stock vencido:', err instanceof Error ? err.message : err));
  }, 60_000);
  const everyHour = setInterval(() => {
    purgeExpiredAuth().catch((err) => console.error('No se pudo limpiar sesiones:', err instanceof Error ? err.message : err));
  }, 60 * 60_000);

  const shutdown = async () => {
    clearInterval(everyMinute);
    clearInterval(everyHour);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('El servidor no pudo arrancar:', err instanceof Error ? err.message : err);
  process.exit(1);
});
