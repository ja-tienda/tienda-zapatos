// Equivalencias de calzado: talla nacional (EUR/PE) -> US y largo de plantilla en CM.
// Se usan para autocompletar usSize/cmSize cuando la administradora crea una talla.
export const SHOE_SIZE_MAP: Record<string, { us: string; cm: string }> = {
  '35': { us: '5', cm: '22.5' },
  '36': { us: '5.5', cm: '23' },
  '37': { us: '6.5', cm: '23.5' },
  '38': { us: '7', cm: '24' },
  '39': { us: '7.5', cm: '25' },
  '40': { us: '8', cm: '25.5' },
  '41': { us: '9', cm: '26.5' },
  '42': { us: '9.5', cm: '27' },
  '43': { us: '10', cm: '27.5' },
};

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
