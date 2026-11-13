import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

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
  plugins: [react(), tailwindcss(), adminRedirect()],
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
  server: {
    port: 5173,
    strictPort: true,
    // En desarrollo, /api se reenvía al backend: no hace falta configurar CORS ni URLs.
    proxy: {
      '/api': 'http://localhost:4000',
      // Imágenes subidas desde el panel y capturas de pago
      '/uploads': 'http://localhost:4000',
    },
  },
});
