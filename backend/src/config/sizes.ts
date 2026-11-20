// Equivalencias de calzado: talla Perú -> talla USA y largo de plantilla en CM.
// Se usan para autocompletar usSize/cmSize cuando la administradora crea una talla
// sin escribir la equivalencia. Misma tabla que frontend/src/config/sizes.ts.

type Gender = 'NINO' | 'NINA' | 'DAMA' | 'CABALLERO' | 'UNISEX';

/** Adultos, horma de hombre/unisex (como en los catálogos: Perú 39 = US 6.5 … Perú 45 = US 11). */
const US_MEN: Record<string, number> = {
  '35': 3.5, '35.5': 4, '36': 4, '36.5': 4.5, '37': 5, '37.5': 5.5, '38': 5.5, '38.5': 6,
  '39': 6.5, '39.5': 6.5, '40': 7, '40.5': 7.5, '41': 8, '41.5': 8, '42': 8.5, '42.5': 9,
  '43': 9.5, '43.5': 9.5, '44': 10, '44.5': 10.5, '45': 11, '45.5': 11.5, '46': 12,
  '46.5': 12.5, '47': 13,
};

/** Niñas y niños (en USA, después de la 13.5 la numeración vuelve a empezar en 1). */
const US_KIDS: Record<string, number> = {
  '18': 2.5, '18.5': 3, '19': 3.5, '19.5': 4, '20': 4.5, '20.5': 4.5, '21': 5, '21.5': 5.5,
  '22': 6, '22.5': 6.5, '23': 6.5, '23.5': 7, '24': 7.5, '24.5': 7.5, '25': 8, '25.5': 8.5,
  '26': 9, '26.5': 9.5, '27': 10, '27.5': 10.5, '28': 11, '28.5': 11.5, '29': 11.5, '29.5': 12,
  '30': 12.5, '30.5': 13, '31': 13, '31.5': 13.5, '32': 1, '32.5': 1.5, '33': 1.5, '33.5': 2,
  '34': 2.5, '34.5': 3,
};

/** En dama la talla USA es 1.5 puntos mayor que en hombre. */
const WOMEN_OFFSET = 1.5;

const formatNumber = (n: number) => String(Math.round(n * 10) / 10);

/** "35,5" -> "35.5", "039" -> "39", " m " -> "M". Evita tallas repetidas escritas distinto. */
export function normalizeSize(raw: string): string {
  const s = raw.trim().replace(',', '.');
  const n = Number(s);
  if (s !== '' && Number.isFinite(n)) return formatNumber(n);
  return s.length <= 4 ? s.toUpperCase() : s;
}

/** Talla USA sugerida para una talla Perú según para quién es el calzado. */
export function usSizeFor(size: string, gender: Gender): string | null {
  const key = normalizeSize(size);
  const isKid = gender === 'NINO' || gender === 'NINA';
  if (isKid && US_KIDS[key] !== undefined) return formatNumber(US_KIDS[key]);
  const men = US_MEN[key];
  if (men !== undefined) return formatNumber(gender === 'DAMA' ? men + WOMEN_OFFSET : men);
  if (US_KIDS[key] !== undefined) return formatNumber(US_KIDS[key]);
  return null;
}

/** Largo aproximado de plantilla en CM (la talla Perú equivale a 1.5 × (cm + 1.5)). */
export function cmSizeFor(size: string): string | null {
  const n = Number(normalizeSize(size));
  if (!Number.isFinite(n) || n < 15 || n > 50) return null;
  return formatNumber(Math.round(((n * 2) / 3 - 1.5) * 2) / 2);
}

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/**
 * Posición estable para ordenar tallas: primero las numéricas de menor a mayor
 * (incluye tallas de niños como 28 o 30), luego XS–XXL y al final el resto ("Única").
 */
export function sizeSortOrder(size: string): number {
  const n = Number(size.replace(',', '.'));
  if (Number.isFinite(n) && size.trim() !== '') return Math.round(n * 10);
  const letter = LETTER_SIZES.indexOf(size.toUpperCase());
  return letter >= 0 ? 10_000 + letter : 20_000;
}
