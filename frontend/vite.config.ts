import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ProxyOptions } from 'vite';
import { productionServer } from './server/production';

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Dirección del backend VISTA DESDE ESTE SERVIDOR (no desde el navegador).
 * En Railway: la dirección interna del servicio backend. En tu PC: http://localhost:4000.
 * Con ella, la tienda reenvía /api y /uploads al backend y el navegador solo habla con un
 * dominio: las cookies de sesión son "de la casa" y no hace falta CORS.
 */
const BACKEND_URL = (process.env.BACKEND_URL ?? '').replace(/\/+$/, '');
/** Solo si la API se llama directo a otro dominio (sin reenvío). No es un secreto. */
const API_ORIGIN = (process.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const toBackend = (target: string): Record<string, ProxyOptions> => ({
  '/api': { target, changeOrigin: true },
  // Imágenes subidas desde el panel (las capturas de pago no se sirven aquí)
  '/uploads': { target, changeOrigin: true },
});

/** /admin (sin barra final) -> /admin/ para que cargue el panel y no la tienda. */
function adminRedirect(): Plugin {
  const redirect = (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void }, next: () => void) => {
    if (req.url === '/admin' || req.url?.startsWith('/admin?')) {
      res.statusCode = 302;
      res.setHeader('Location', '/admin/' + req.url.slice('/admin'.length));
      res.end();
      return;
    }
    next();
  };
  return {
    name: 'ja-admin-redirect',
    configureServer: (server) => void server.middlewares.use(redirect),
    configurePreviewServer: (server) => void server.middlewares.use(redirect),
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    adminRedirect(),
    // Cabeceras de seguridad, https, SEO y sitemap del servidor de producción (ver server/production.ts)
    ...(BACKEND_URL ? [productionServer({ backendUrl: BACKEND_URL, apiOrigin: API_ORIGIN })] : []),
  ],
  build: {
    // Dos páginas independientes: la tienda (/) y el panel (/admin/).
    // Cada una genera su propio paquete: la tienda no descarga el código del panel.
    rollupOptions: {
      input: {
        tienda: page('./index.html'),
        admin: page('./admin/index.html'),
      },
    },
  },
  // Producción (npm start): Railway inyecta PORT y el dominio público.
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    // Sin BACKEND_URL no se reenvía nada: la tienda llama a la API en VITE_API_URL (modo anterior)
    proxy: BACKEND_URL ? toBackend(BACKEND_URL) : {},
  },
  server: {
    port: 5173,
    strictPort: true,
    // En desarrollo, /api se reenvía al backend: no hace falta configurar CORS ni URLs.
    proxy: toBackend(BACKEND_URL || 'http://localhost:4000'),
  },
});
