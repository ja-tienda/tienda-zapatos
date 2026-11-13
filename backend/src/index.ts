import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { prisma } from './config/prisma';
import apiRoutes from './routes/api.routes';
import { errorHandler, notFound } from './utils/http';
import { UPLOADS_DIR } from './utils/uploads';

const app = express();
app.set('trust proxy', env.trustProxy);

app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: '300kb' }));

// Imágenes subidas desde el panel y capturas de pago. Los nombres son aleatorios y nunca
// se reutilizan, por eso el navegador puede guardarlas en caché mucho tiempo.
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    index: false,
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);

app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`API J & A lista en http://localhost:${env.port}/api`);
  console.log(`Pago con tarjeta (Izipay): ${env.izipay.enabled ? 'activado' : 'sin configurar (faltan las claves IZIPAY_* en .env)'}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
