import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { imageRef } from '../config/settings';
import { isAdminRequest } from '../middleware/auth';
import { HttpError, parseId } from '../utils/http';
import { serializeSection, slugify } from '../utils/serialize';
import { removeUnusedUploads } from '../utils/uploads';

const fields = {
  name: z.string().trim().min(2, 'nombre muy corto').max(60),
  kind: z.enum(['CATEGORIA', 'COLECCION']),
  sizeType: z.enum(['CALZADO', 'ROPA', 'UNICA']),
  coverImage: imageRef.nullable(),
  heroTitle: z.string().trim().max(120),
  heroText: z.string().trim().max(300),
  ctaLabel: z.string().trim().min(1).max(40),
  showInCarousel: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
};

const createSchema = z.object({
  name: fields.name,
  kind: fields.kind,
  sizeType: fields.sizeType.default('UNICA'),
  coverImage: fields.coverImage.default(null),
  heroTitle: fields.heroTitle.default(''),
  heroText: fields.heroText.default(''),
  ctaLabel: fields.ctaLabel.default('Ver productos'),
  showInCarousel: fields.showInCarousel.default(false),
  sortOrder: fields.sortOrder.optional(),
  isActive: fields.isActive.default(true),
});

// El tipo (categoría / colección) no se puede cambiar después de crear la sección.
const updateSchema = z.object(fields).omit({ kind: true }).partial();

/** Cuenta solo productos visibles, para mostrar "6 modelos" en la tienda. */
const withCounts = (activeOnly: boolean) =>
  ({
    _count: {
      select: {
        categoryProducts: activeOnly ? { where: { isActive: true } } : true,
        collectionProducts: activeOnly ? { where: { isActive: true } } : true,
      },
    },
  }) as const;

async function uniqueSlug(name: string, ignoreId?: number): Promise<string> {
  const base = slugify(name) || 'seccion';
  let slug = base;
  for (let n = 2; ; n++) {
    const found = await prisma.section.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${base}-${n}`;
  }
}

/** GET /api/sections — público: solo activas. Con token y ?all=1: todas. */
export async function listSections(req: Request, res: Response) {
  const showAll = req.query.all === '1' && isAdminRequest(req);
  const sections = await prisma.section.findMany({
    where: showAll ? {} : { isActive: true },
    include: withCounts(!showAll),
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(sections.map(serializeSection));
}

/** POST /api/sections (admin) */
export async function createSection(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const last = await prisma.section.aggregate({ where: { kind: data.kind }, _max: { sortOrder: true } });
  const section = await prisma.section.create({
    data: {
      ...data,
      // Las colecciones no definen tallas: eso lo decide la categoría del producto
      sizeType: data.kind === 'CATEGORIA' ? data.sizeType : 'UNICA',
      heroTitle: data.heroTitle || data.name,
      slug: await uniqueSlug(data.name),
      sortOrder: data.sortOrder ?? (last._max.sortOrder ?? 0) + 1,
    },
    include: withCounts(false),
  });
  res.status(201).json(serializeSection(section));
}

/** PUT /api/sections/:id (admin) */
export async function updateSection(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const data = updateSchema.parse(req.body);
  const current = await prisma.section.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Sección no encontrada');

  const section = await prisma.section.update({
    where: { id },
    data: {
      ...data,
      ...(data.name && data.name !== current.name ? { slug: await uniqueSlug(data.name, id) } : {}),
    },
    include: withCounts(false),
  });
  if (data.coverImage !== undefined && data.coverImage !== current.coverImage) void removeUnusedUploads([current.coverImage]);
  res.json(serializeSection(section));
}

/** DELETE /api/sections/:id (admin) — una categoría con productos no se puede borrar. */
export async function deleteSection(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const section = await prisma.section.findUnique({ where: { id }, include: withCounts(false) });
  if (!section) throw new HttpError(404, 'Sección no encontrada');

  if (section.kind === 'CATEGORIA' && section._count.categoryProducts > 0) {
    throw new HttpError(
      409,
      `"${section.name}" tiene ${section._count.categoryProducts} producto(s). Cámbialos de categoría o elimínalos antes de borrarla (también puedes ocultarla).`,
    );
  }
  await prisma.section.delete({ where: { id } });
  void removeUnusedUploads([section.coverImage]);
  res.status(204).end();
}
