import type { Request, Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { loadSettings } from '../config/settings';

/**
 * Datos para buscadores y para las vistas previas al compartir un enlace (WhatsApp, Facebook).
 * Esos robots no ejecutan JavaScript, así que el servidor del frontend pide aquí el título,
 * la descripción y la imagen de cada dirección y los escribe en el HTML antes de enviarlo.
 */
const STORE = 'J & A';
const STATIC_PAGES: Record<string, { title: string; description: string }> = {
  '/ofertas': { title: 'Ofertas y liquidación', description: 'Calzados, ropa y accesorios con precio rebajado. Stock real por talla.' },
  '/terminos': { title: 'Términos y condiciones', description: 'Condiciones de compra, pagos y envíos de la tienda J & A.' },
  '/privacidad': { title: 'Política de privacidad', description: 'Cómo cuidamos tus datos personales en J & A.' },
  '/cambios-y-devoluciones': { title: 'Cambios y devoluciones', description: 'Plazos y condiciones para cambiar o devolver tu compra en J & A.' },
  '/libro-de-reclamaciones': { title: 'Libro de Reclamaciones', description: 'Registra tu reclamo o queja en el Libro de Reclamaciones virtual de J & A.' },
};
// Páginas personales: existen, pero no deben aparecer en buscadores
const PRIVATE_PREFIXES = ['/checkout', '/pedido', '/cuenta', '/recuperar', '/restablecer'];

const absolute = (url: string | null | undefined) => (!url ? null : url.startsWith('http') ? url : `${env.apiUrl}${url}`);
const clip = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** GET /api/seo?path=/seccion/calzados */
export async function pageMeta(req: Request, res: Response) {
  const path = (typeof req.query.path === 'string' ? req.query.path : '/').split('?')[0].replace(/\/+$/, '') || '/';
  const settings = await loadSettings();
  const base = {
    siteName: `${STORE} — Calzados, ropa y accesorios`,
    url: `${env.appUrl}${path === '/' ? '' : path}`,
    image: absolute(settings.heroImage || settings.logoUrl),
    index: true,
    status: 200,
  };
  res.setHeader('Cache-Control', 'public, max-age=120');

  if (path === '/') {
    return res.json({ ...base, title: base.siteName, description: clip(settings.seoDescription) });
  }

  if (STATIC_PAGES[path]) {
    return res.json({ ...base, title: `${STATIC_PAGES[path].title} — ${STORE}`, description: STATIC_PAGES[path].description });
  }

  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return res.json({ ...base, title: base.siteName, description: clip(settings.seoDescription), index: false });
  }

  const section = path.match(/^\/seccion\/([a-z0-9-]+)$/);
  if (section) {
    const found = await prisma.section.findFirst({ where: { slug: section[1], isActive: true } });
    if (found) {
      return res.json({
        ...base,
        title: `${found.name} — ${STORE}`,
        description: clip(found.heroText || `${found.name} en ${STORE}. Stock real por talla y envíos a todo el Perú.`),
        image: absolute(found.coverImage) ?? base.image,
      });
    }
  }

  const product = path.match(/^\/producto\/([a-z0-9-]+)$/);
  if (product) {
    const found = await prisma.product.findFirst({ where: { slug: product[1], isActive: true, category: { isActive: true } } });
    if (found) {
      return res.json({
        ...base,
        title: `${found.name} — ${STORE}`,
        description: clip(`S/ ${Number(found.price).toFixed(2)} · ${found.description || `${found.name} en ${STORE}.`}`),
        image: absolute(found.images[0]) ?? base.image,
        type: 'product',
        price: Number(found.price).toFixed(2),
      });
    }
  }

  // Dirección que no existe: la tienda muestra su página 404 y los buscadores reciben el código 404
  res.json({ ...base, title: `Página no encontrada — ${STORE}`, description: clip(settings.seoDescription), index: false, status: 404 });
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** GET /api/seo/sitemap.xml — todas las páginas públicas, para Google Search Console. */
export async function sitemap(_req: Request, res: Response) {
  const [sections, products] = await Promise.all([
    prisma.section.findMany({ where: { isActive: true }, select: { slug: true } }),
    prisma.product.findMany({ where: { isActive: true, category: { isActive: true } }, select: { slug: true, updatedAt: true } }),
  ]);

  const urls: { loc: string; lastmod?: Date; priority: string }[] = [
    { loc: '/', priority: '1.0' },
    { loc: '/ofertas', priority: '0.8' },
    ...sections.map((s) => ({ loc: `/seccion/${s.slug}`, priority: '0.8' })),
    ...products.map((p) => ({ loc: `/producto/${p.slug}`, lastmod: p.updatedAt, priority: '0.6' })),
    ...['/cambios-y-devoluciones', '/terminos', '/privacidad', '/libro-de-reclamaciones'].map((loc) => ({ loc, priority: '0.2' })),
  ];

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${xml(`${env.appUrl}${u.loc === '/' ? '/' : u.loc}`)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
    )
    .join('\n');

  res.setHeader('Cache-Control', 'public, max-age=600');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

/** GET /api/seo/robots.txt */
export function robots(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /api/',
      'Disallow: /checkout',
      'Disallow: /pedido/',
      'Disallow: /cuenta',
      'Disallow: /recuperar',
      'Disallow: /restablecer',
      '',
      `Sitemap: ${env.appUrl}/sitemap.xml`,
      '',
    ].join('\n'),
  );
}
