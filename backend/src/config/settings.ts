import { z } from 'zod';
import { prisma } from './prisma';

/**
 * Ajustes de la tienda editables desde el panel.
 * Para agregar uno nuevo basta sumarlo aquí (valor por defecto + largo máximo):
 * la API y el panel lo aceptan sin tocar la base de datos.
 */
const DEFINITIONS = {
  // --- Apariencia ---
  logoUrl: { max: 500, image: true, default: '' },
  announcement: { max: 160, default: 'Envíos a todo el Perú por Shalom y Olva · Paga con Yape o Plin' },
  heroEyebrow: { max: 80, default: 'Nueva colección · Ingresos de la semana' },
  // Lo que va entre *asteriscos* se muestra resaltado en cursiva
  heroTitle: { max: 120, default: 'Zapatillas que *combinan* con todo.' },
  heroText: {
    max: 300,
    default: 'Calzados, ropa y accesorios elegidos uno por uno. Stock real por talla y atención directa de Jessica.',
  },
  heroButtonLabel: { max: 40, default: 'Ver la colección' },
  // Vacío = se muestra la foto del producto destacado
  heroImage: { max: 500, image: true, default: '' },

  // --- Contacto ---
  contactName: { max: 40, default: 'Jessica' },
  contactPhone: { max: 9, default: '957433392' },
  contactEmail: { max: 120, default: '' },
  businessHours: { max: 200, default: 'Lunes a sábado: 9:00 a. m. – 7:00 p. m.' },

  // --- Pagos con Yape / Plin ---
  walletNumber: { max: 9, default: '957433392' },
  walletHolder: { max: 80, default: 'Jessica Paola Ramos Luján' },
  walletQrUrl: { max: 500, image: true, default: '' },

  // --- Textos legales ---
  termsText: {
    max: 20000,
    default: [
      '1. Pedidos',
      'Los pedidos se realizan desde esta tienda virtual y se confirman cuando verificamos el pago. El stock mostrado es referencial hasta esa confirmación.',
      '',
      '2. Precios y pagos',
      'Los precios están en soles (S/) e incluyen impuestos. Aceptamos Yape, Plin, transferencia, tarjeta y, en algunas zonas, pago contra entrega.',
      '',
      '3. Envíos',
      'Enviamos a todo el Perú por Shalom y Olva, y hacemos delivery local. El costo y el plazo de envío se coordinan por WhatsApp según el destino.',
      '',
      '4. Cambios y devoluciones',
      'Aceptamos cambios por talla dentro de los 7 días de recibido el producto, sin uso y con su empaque original. El costo de envío del cambio lo asume el cliente, salvo error nuestro o falla de fábrica.',
      '',
      '5. Contacto',
      'Para cualquier consulta sobre tu pedido escríbenos por WhatsApp.',
    ].join('\n'),
  },
  privacyText: {
    max: 20000,
    default: [
      '1. Qué datos pedimos',
      'Solo los necesarios para atender tu pedido: nombre, teléfono, correo (opcional) y dirección o agencia de entrega.',
      '',
      '2. Para qué los usamos',
      'Para coordinar el pago y la entrega de tu pedido y responder tus consultas. No enviamos publicidad sin tu permiso.',
      '',
      '3. Con quién los compartimos',
      'Únicamente con la empresa de transporte que entrega tu pedido y, si pagas con tarjeta, con la pasarela de pagos. No vendemos tus datos.',
      '',
      '4. Comprobantes de pago',
      'La captura que envías para confirmar tu pago solo la ve nuestro equipo.',
      '',
      '5. Tus derechos',
      'Puedes pedirnos en cualquier momento que actualicemos o eliminemos tus datos escribiéndonos por WhatsApp o correo.',
    ].join('\n'),
  },
} satisfies Record<string, { max: number; default: string; image?: boolean }>;

export type SettingKey = keyof typeof DEFINITIONS;
export type Settings = Record<SettingKey, string>;

const KEYS = Object.keys(DEFINITIONS) as SettingKey[];

/** Una imagen válida es una URL http(s) o un archivo subido al servidor (/uploads/...). */
export function isImageRef(value: string): boolean {
  if (value.startsWith('/uploads/')) return !value.includes('..');
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const imageRef = z.string().trim().max(500).refine(isImageRef, 'Imagen inválida: sube un archivo o pega una URL http(s)');

const phone = z
  .string()
  .trim()
  .regex(/^9\d{8}$/, 'El celular debe tener 9 dígitos y empezar en 9');

/** Valida un guardado parcial desde el panel: solo claves conocidas, con su largo máximo. */
export const settingsUpdateSchema = z
  .object(
    Object.fromEntries(
      KEYS.map((key) => {
        const def = DEFINITIONS[key];
        if (key === 'contactPhone' || key === 'walletNumber') return [key, phone];
        if (key === 'contactEmail') return [key, z.union([z.literal(''), z.email('El correo no es válido').max(def.max)])];
        if ('image' in def && def.image) return [key, z.union([z.literal(''), imageRef])];
        return [key, z.string().trim().max(def.max, `El texto es demasiado largo (máximo ${def.max} caracteres)`)];
      }),
    ) as Record<SettingKey, z.ZodType<string>>,
  )
  .partial()
  .strict();

export async function loadSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(KEYS.map((key) => [key, stored.get(key) ?? DEFINITIONS[key].default])) as Settings;
}

export async function saveSettings(changes: Partial<Settings>): Promise<Settings> {
  const entries = Object.entries(changes).filter((e): e is [SettingKey, string] => e[1] !== undefined);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
  return loadSettings();
}
