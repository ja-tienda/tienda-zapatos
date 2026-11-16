import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Complaint } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { loadSettings } from '../config/settings';
import { sendMail } from '../services/mailer';
import { HttpError, parseId } from '../utils/http';

/**
 * Libro de Reclamaciones virtual (Ley 29571 y su reglamento, D.S. 011-2011-PCM).
 * Cada hoja recibe un número correlativo, se guarda en la base de datos, se envía por correo
 * al consumidor como constancia y queda visible en el panel para responderla.
 * El plazo legal de respuesta es de 15 días hábiles.
 */
const text = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max);

const complaintSchema = z.object({
  type: z.enum(['RECLAMO', 'QUEJA']),
  customerName: text(3, 120, 'Ingresa tu nombre completo'),
  documentType: z.enum(['DNI', 'CE', 'PASAPORTE']),
  documentNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,15}$/, 'Número de documento inválido'),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()+-]/g, ''))
    .pipe(z.string().regex(/^\d{7,12}$/, 'Teléfono inválido')),
  email: z.string().trim().toLowerCase().pipe(z.email('Ingresa un correo válido').max(120)),
  address: text(5, 200, 'Ingresa tu domicilio'),
  guardianName: z.string().trim().max(120).nullish(),
  itemType: z.enum(['PRODUCTO', 'SERVICIO']),
  itemDescription: text(3, 300, 'Describe el producto o servicio'),
  amount: z.coerce.number().min(0).max(99999).nullish(),
  orderCode: z.string().trim().max(20).nullish(),
  detail: text(10, 3000, 'Cuéntanos qué pasó (mínimo 10 caracteres)'),
  request: text(5, 1500, 'Indica qué solución pides'),
  acceptTerms: z.literal(true, 'Debes confirmar que la información es verdadera'),
});

const responseSchema = z.object({ response: text(5, 3000, 'Escribe la respuesta') });

function serialize(c: Complaint) {
  return { ...c, amount: c.amount === null ? null : Number(c.amount) };
}

const TYPE_LABEL = { RECLAMO: 'Reclamo', QUEJA: 'Queja' } as const;

/** POST /api/complaints (público) */
export async function createComplaint(req: Request, res: Response) {
  const { acceptTerms: _accepted, ...data } = complaintSchema.parse(req.body);

  // El correlativo sale del id que asigna la base de datos: nunca se repite ni se salta
  const complaint = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: {
        ...data,
        guardianName: data.guardianName || null,
        orderCode: data.orderCode || null,
        amount: data.amount ?? null,
        code: `TMP-${randomBytes(8).toString('hex')}`,
      },
    });
    const code = `LR-${created.createdAt.getFullYear()}-${String(created.id).padStart(6, '0')}`;
    return tx.complaint.update({ where: { id: created.id }, data: { code } });
  });

  const settings = await loadSettings();
  const summary = [
    `Hoja de reclamación N.º ${complaint.code}`,
    `Fecha: ${complaint.createdAt.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`,
    `Tipo: ${TYPE_LABEL[complaint.type]}`,
    `Consumidor: ${complaint.customerName} (${complaint.documentType} ${complaint.documentNumber})`,
    `Bien contratado: ${complaint.itemType === 'PRODUCTO' ? 'Producto' : 'Servicio'} — ${complaint.itemDescription}`,
    ...(complaint.amount !== null ? [`Monto reclamado: S/ ${Number(complaint.amount).toFixed(2)}`] : []),
    ...(complaint.orderCode ? [`Pedido: ${complaint.orderCode}`] : []),
  ].join('\n');

  // Constancia para el consumidor (obligatoria) y aviso a la tienda
  const sent = await sendMail({
    to: complaint.email,
    subject: `Constancia de tu ${TYPE_LABEL[complaint.type].toLowerCase()} ${complaint.code} — J & A`,
    paragraphs: [
      `Hola ${complaint.customerName},`,
      'Registramos tu hoja en nuestro Libro de Reclamaciones. Esta es tu constancia:',
      summary,
      `Detalle:\n${complaint.detail}`,
      `Pedido del consumidor:\n${complaint.request}`,
      'Te responderemos a este correo en un plazo máximo de 15 días hábiles.',
      `${settings.businessName}${settings.businessRuc ? ` · RUC ${settings.businessRuc}` : ''}`,
    ],
    replyTo: settings.contactEmail || undefined,
  });
  if (settings.contactEmail) {
    await sendMail({
      to: settings.contactEmail,
      subject: `Nuevo ${TYPE_LABEL[complaint.type].toLowerCase()} ${complaint.code} en el Libro de Reclamaciones`,
      paragraphs: [summary, `Detalle:\n${complaint.detail}`, `Pide:\n${complaint.request}`, 'Respóndelo desde el panel (pestaña Reclamos). Plazo: 15 días hábiles.'],
      action: { label: 'Abrir el panel', url: `${env.appUrl}/admin/#reclamos` },
      replyTo: complaint.email,
    });
  }

  res.status(201).json({ code: complaint.code, createdAt: complaint.createdAt, emailSent: sent });
}

/** GET /api/complaints (admin) */
export async function listComplaints(_req: Request, res: Response) {
  const complaints = await prisma.complaint.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  res.json(complaints.map(serialize));
}

/** POST /api/complaints/:id/response (admin) — guarda la respuesta y la envía al consumidor. */
export async function respondComplaint(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { response } = responseSchema.parse(req.body);

  const current = await prisma.complaint.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Reclamo no encontrado');

  const complaint = await prisma.complaint.update({
    where: { id },
    data: { response, status: 'ATENDIDO', respondedAt: new Date() },
  });

  const settings = await loadSettings();
  const emailSent = await sendMail({
    to: complaint.email,
    subject: `Respuesta a tu ${TYPE_LABEL[complaint.type].toLowerCase()} ${complaint.code} — J & A`,
    paragraphs: [`Hola ${complaint.customerName},`, `Respondemos a tu hoja de reclamación N.º ${complaint.code}:`, response, settings.businessName],
    replyTo: settings.contactEmail || undefined,
  });

  res.json({ ...serialize(complaint), emailSent });
}
