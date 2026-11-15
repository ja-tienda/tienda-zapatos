import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Lo que hace el servidor del frontend en producción (`npm start` = vite preview), además
 * de entregar los archivos de la tienda:
 *
 *   1. Fuerza https y pone las cabeceras de seguridad de las páginas (CSP incluida).
 *   2. Escribe en el HTML el título, la descripción y la imagen de cada dirección, para
 *      Google y para las vistas previas de WhatsApp/Facebook (que no ejecutan JavaScript).
 *      Las direcciones que no existen responden con código 404.
 *   3. Entrega /sitemap.xml y /robots.txt (los genera el backend).
 *
 * El reenvío de /api y /uploads al backend se configura en vite.config.ts (preview.proxy).
 * Todo depende de BACKEND_URL: sin ella, el servidor solo entrega los archivos, como antes.
 */

type Next = () => void;

interface PageMeta {
  title: string;
  description: string;
  url: string;
  image: string | null;
  index: boolean;
  status: number;
}

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Orígenes de Izipay (formulario de pago incrustado). */
const IZIPAY = 'https://*.micuentaweb.pe https://*.lyra.com';

/**
 * Política de seguridad de contenido de las páginas: qué puede cargar y ejecutar el navegador.
 * - Scripts: solo los nuestros y el formulario de Izipay. Nada de scripts en línea.
 * - Estilos: los nuestros, los de Izipay y estilos en atributos (los usan React y Tailwind).
 * - Imágenes: cualquier https (fotos de productos por URL, Unsplash, backend).
 * - Marcos: solo la propia tienda (vista previa del panel) e Izipay (verificación 3-D Secure).
 * "Iniciar sesión con Google" no carga nada de Google en la página: es una redirección.
 */
function contentSecurityPolicy(apiOrigin: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${IZIPAY}`,
    `style-src 'self' 'unsafe-inline' ${IZIPAY}`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: ${IZIPAY}`,
    `connect-src 'self' ${apiOrigin} ${IZIPAY}`.replace(/\s+/g, ' '),
    `frame-src 'self' ${IZIPAY}`,
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function productionServer(options: { backendUrl: string; apiOrigin: string }): Plugin {
  const { backendUrl, apiOrigin } = options;
  const csp = contentSecurityPolicy(apiOrigin);
  let indexHtml: string | null = null;
  const metaCache = new Map<string, { meta: PageMeta; expires: number }>();

  function securityHeaders(req: IncomingMessage, res: ServerResponse, next: Next) {
    // Railway indica con esta cabecera si el visitante llegó por http
    if (String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'http') {
      res.statusCode = 308;
      res.setHeader('Location', `https://${req.headers.host}${req.url ?? '/'}`);
      return res.end();
    }
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), payment=(self), camera=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  }

  async function fetchMeta(path: string): Promise<PageMeta | null> {
    const cached = metaCache.get(path);
    if (cached && cached.expires > Date.now()) return cached.meta;
    try {
      const response = await fetch(`${backendUrl}/api/seo?path=${encodeURIComponent(path)}`, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const meta = (await response.json()) as PageMeta;
      if (metaCache.size > 500) metaCache.clear();
      metaCache.set(path, { meta, expires: Date.now() + 120_000 });
      return meta;
    } catch {
      return null; // si el backend no responde, la página se entrega igual con sus datos por defecto
    }
  }

  function render(html: string, meta: PageMeta): string {
    const content = (pattern: RegExp, value: string) => (source: string) =>
      source.replace(pattern, (_match, start: string, end: string) => `${start}${escapeAttr(value)}${end}`);
    const steps = [
      (s: string) => s.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(meta.title)}</title>`),
      content(/(<meta\s+name="description"\s+content=")[^"]*(")/, meta.description),
      content(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, meta.title),
      content(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, meta.description),
      content(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, meta.url),
      content(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, meta.image ?? ''),
      content(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, meta.url),
      content(/(<meta\s+name="robots"\s+content=")[^"]*(")/, meta.index ? 'index, follow' : 'noindex, nofollow'),
    ];
    return steps.reduce((source, step) => step(source), html);
  }

  /** ¿Es la navegación a una página de la tienda (no un archivo, ni la API, ni el panel)? */
  function isStorePage(req: IncomingMessage): boolean {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const path = (req.url ?? '/').split('?')[0];
    if (/\.[a-z0-9]+$/i.test(path)) return false;
    return !['/api', '/uploads', '/admin', '/assets'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  async function storePage(req: IncomingMessage, res: ServerResponse, next: Next) {
    if (!isStorePage(req)) return next();
    try {
      indexHtml ??= readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf8');
    } catch {
      return next();
    }
    const meta = await fetchMeta((req.url ?? '/').split('?')[0]);
    res.statusCode = meta?.status === 404 ? 404 : 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(meta ? render(indexHtml, meta) : indexHtml);
  }

  async function seoFiles(req: IncomingMessage, res: ServerResponse, next: Next) {
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/sitemap.xml' && path !== '/robots.txt') return next();
    try {
      const response = await fetch(`${backendUrl}/api/seo${path}`, { signal: AbortSignal.timeout(5000) });
      res.statusCode = response.status;
      res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.end(await response.text());
    } catch {
      res.statusCode = 503;
      res.end('');
    }
  }

  return {
    name: 'ja-production-server',
    configurePreviewServer(server) {
      server.middlewares.use(securityHeaders);
      server.middlewares.use((req, res, next) => void seoFiles(req, res, next));
      server.middlewares.use((req, res, next) => void storePage(req, res, next));
    },
  };
}
