import { PrismaClient, type Badge, type Gender } from '@prisma/client';
import { SHOE_SIZE_MAP, sizeSortOrder } from '../src/config/sizes';
import { slugify } from '../src/utils/serialize';

const prisma = new PrismaClient();

const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// Colecciones / temporadas de ejemplo (las categorías base las crea la migración).
const collections = [
  {
    name: 'Temporada Verano',
    slug: 'temporada-verano',
    coverImage: img('1552346154-21d32810aba3', 1600),
    heroTitle: 'Verano en *colores*',
    heroText: 'Modelos frescos y livianos para los días de sol.',
    ctaLabel: 'Ver la temporada',
    sortOrder: 1,
  },
  {
    name: 'Temporada Invierno',
    slug: 'temporada-invierno',
    coverImage: img('1620799140408-edc6dcb6d633', 1600),
    heroTitle: 'Abrígate con *estilo*',
    heroText: 'Poleras, botines y capas para los días fríos.',
    ctaLabel: 'Ver la temporada',
    sortOrder: 2,
  },
];

interface SeedProduct {
  name: string;
  brand: string;
  description: string;
  category: 'calzados' | 'ropa' | 'accesorios';
  collections?: string[];
  gender: Gender;
  price: number;
  originalPrice?: number;
  badge?: Badge;
  featured?: boolean;
  images: string[];
  /** talla -> stock */
  stock: Record<string, number>;
}

const products: SeedProduct[] = [
  {
    name: 'Urban Flow Coral Edition',
    brand: 'J & A Select',
    description:
      'Zapatilla urbana de perfil bajo con capellada transpirable y suela de espuma ligera. El color coral la vuelve la protagonista de cualquier outfit.',
    category: 'calzados',
    collections: ['temporada-verano'],
    gender: 'UNISEX',
    price: 219,
    originalPrice: 269,
    badge: 'OFERTA',
    featured: true,
    images: [img('1542291026-7eec264c27ff'), img('1606107557195-0e29a4b5b4aa'), img('1491553895911-0055eca6402d')],
    stock: { '36': 2, '37': 3, '38': 4, '39': 2, '40': 3, '41': 1, '42': 2 },
  },
  {
    name: 'Aura Retro Runner Rose & Cream',
    brand: 'Aura Street',
    description:
      'Runner de inspiración retro en tonos rosa y crema. Plantilla acolchada y suela con buen agarre para caminar todo el día.',
    category: 'calzados',
    collections: ['temporada-verano'],
    gender: 'DAMA',
    price: 189,
    originalPrice: 229,
    badge: 'OFERTA',
    featured: true,
    images: [img('1595950653106-6c9ebd614d3a'), img('1560769629-975ec94e6a86'), img('1543508282-6319a3e2621f')],
    stock: { '35': 2, '36': 4, '37': 3, '38': 1, '39': 0, '40': 2 },
  },
  {
    name: 'Shadow High-Top Obsidian Slate',
    brand: 'Court Icon',
    description:
      'Botín de caña alta estilo básquet en negro y gris pizarra. Refuerzo en el tobillo y acabado de cuero sintético fácil de limpiar.',
    category: 'calzados',
    collections: ['temporada-invierno'],
    gender: 'CABALLERO',
    price: 235,
    originalPrice: 280,
    badge: 'OFERTA',
    images: [img('1551107696-a4b0c5a0d9a2'), img('1597045566677-8cf032ed6634'), img('1552346154-21d32810aba3')],
    stock: { '38': 1, '39': 3, '40': 4, '41': 3, '42': 2, '43': 0 },
  },
  {
    name: 'Vortex Low Dunk Slate & Bone',
    brand: 'Court Icon',
    description:
      'Silueta dunk de caña baja en gris y hueso. Un clásico del streetwear que combina con jeans, cargos y joggers.',
    category: 'calzados',
    gender: 'UNISEX',
    price: 169,
    originalPrice: 210,
    badge: 'OFERTA',
    featured: true,
    images: [img('1600185365483-26d7a4cc7519'), img('1608231387042-66d1773070a5'), img('1549298916-b41d501d3772')],
    stock: { '36': 1, '37': 2, '38': 3, '39': 3, '40': 2, '41': 2, '42': 0 },
  },
  {
    name: 'Cloud Platform Pearl Blush',
    brand: 'Aura Street',
    description:
      'Zapatilla blanca con plataforma de 4 cm y detalles en rosa perla. Suma altura sin perder comodidad.',
    category: 'calzados',
    gender: 'DAMA',
    price: 149,
    originalPrice: 199,
    badge: 'ULTIMO_PAR',
    images: [img('1525966222134-fcfa99b8ae77'), img('1460353581641-37baddab0fa2'), img('1514989940723-e8e51635b782')],
    stock: { '35': 0, '36': 0, '37': 1, '38': 0, '39': 0 },
  },
  {
    name: 'Nitro Street Apex Coral/Black',
    brand: 'J & A Select',
    description:
      'Modelo deportivo con cámara de aire visible y contraste coral sobre negro. Recién llegado esta semana.',
    category: 'calzados',
    gender: 'CABALLERO',
    price: 209,
    badge: 'NUEVO',
    featured: true,
    images: [img('1556906781-9a412961c28c'), img('1539185441755-769473a23570'), img('1512374382149-233c42b6a83b')],
    stock: { '39': 3, '40': 5, '41': 4, '42': 3, '43': 2 },
  },
  {
    name: 'Mini Runner Kids Azul',
    brand: 'J & A Kids',
    description: 'Zapatilla liviana para niño con cierre de velcro y puntera reforzada. Lista para el recreo.',
    category: 'calzados',
    gender: 'NINO',
    price: 119,
    badge: 'NUEVO',
    images: [img('1587563871167-1ee9c731aefb'), img('1512374382149-233c42b6a83b')],
    stock: { '28': 2, '29': 3, '30': 3, '31': 2, '32': 1, '33': 2 },
  },
  {
    name: 'Mini Street Kids Rosa',
    brand: 'J & A Kids',
    description: 'Zapatilla urbana para niña con plantilla acolchada y suela flexible antideslizante.',
    category: 'calzados',
    collections: ['temporada-verano'],
    gender: 'NINA',
    price: 109,
    originalPrice: 129,
    badge: 'OFERTA',
    images: [img('1514989940723-e8e51635b782'), img('1460353581641-37baddab0fa2')],
    stock: { '27': 1, '28': 2, '29': 2, '30': 3, '31': 0, '32': 2 },
  },
  {
    name: 'Hoodie Oversize Heavyweight Washed Charcoal',
    brand: 'J & A Studio Apparel',
    description:
      'Polera con capucha de algodón grueso y corte oversize. Lavado tipo vintage en gris carbón, bolsillo canguro.',
    category: 'ropa',
    collections: ['temporada-invierno'],
    gender: 'UNISEX',
    price: 129,
    originalPrice: 159,
    badge: 'OFERTA',
    images: [img('1556821840-3a63f95609a7'), img('1620799140408-edc6dcb6d633')],
    stock: { S: 3, M: 5, L: 4, XL: 1 },
  },
  {
    name: 'Pantalón Cargo Utility Bone White',
    brand: 'J & A Studio Apparel',
    description: 'Cargo de drill en color hueso con seis bolsillos y basta regulable. Corte recto y holgado.',
    category: 'ropa',
    gender: 'UNISEX',
    price: 139,
    originalPrice: 169,
    badge: 'OFERTA',
    images: [img('1624378439575-d8705ad7ae80'), img('1594938298603-c8148c4dae35')],
    stock: { S: 2, M: 3, L: 0, XL: 2 },
  },
  {
    name: 'Bolso Crossbody Táctico Matte Black',
    brand: 'URBN Util',
    description:
      'Bolso cruzado impermeable en negro mate con tres compartimentos y correa ajustable. Ideal para el día a día.',
    category: 'accesorios',
    gender: 'UNISEX',
    price: 79,
    originalPrice: 99,
    badge: 'OFERTA',
    images: [img('1553062407-98eeb64c6a62'), img('1548036328-c9fa89d128fa')],
    stock: { Única: 6 },
  },
  {
    name: 'Gorra Vintage Washed + Pack Medias Crew',
    brand: 'URBN Util',
    description:
      'Combo: gorra de visera curva con lavado vintage y broche regulable, más pack de 3 pares de medias crew de algodón.',
    category: 'accesorios',
    collections: ['temporada-verano'],
    gender: 'UNISEX',
    price: 59,
    originalPrice: 79,
    badge: 'ULTIMO_PAR',
    images: [img('1588850561407-ed78c282e89b'), img('1521369909029-2afed882baee'), img('1586350977771-b3b0abd50c82')],
    stock: { Única: 1 },
  },
];

async function main() {
  // Reinicia el catálogo de prueba. Pedidos, ajustes y categorías editadas se conservan.
  await prisma.product.deleteMany();

  for (const c of collections) {
    await prisma.section.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, kind: 'COLECCION', showInCarousel: true },
    });
  }

  const sections = await prisma.section.findMany();
  const bySlug = new Map(sections.map((s) => [s.slug, s.id]));
  const categoryId = (slug: string) => {
    const id = bySlug.get(slug);
    if (!id) throw new Error(`Falta la categoría "${slug}". Ejecuta primero: npx prisma migrate deploy`);
    return id;
  };

  for (const [index, p] of products.entries()) {
    const { stock, category, collections: productCollections = [], ...fields } = p;
    await prisma.product.create({
      data: {
        ...fields,
        slug: slugify(p.name),
        category: { connect: { id: categoryId(category) } },
        collections: { connect: productCollections.flatMap((slug) => (bySlug.has(slug) ? [{ id: bySlug.get(slug)! }] : [])) },
        // Fechas escalonadas para que el orden "Destacados" sea estable
        createdAt: new Date(Date.now() - index * 60_000),
        variants: {
          create: Object.entries(stock).map(([size, qty]) => ({
            size,
            stock: qty,
            usSize: SHOE_SIZE_MAP[size]?.us ?? null,
            cmSize: SHOE_SIZE_MAP[size]?.cm ?? null,
            sortOrder: sizeSortOrder(size),
          })),
        },
      },
    });
  }

  const [count, variants, sectionCount] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.section.count(),
  ]);
  console.log(`Seed listo: ${count} productos, ${variants} tallas y ${sectionCount} secciones.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
