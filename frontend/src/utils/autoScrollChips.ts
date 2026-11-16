/**
 * En filas con desplazamiento horizontal (menú, filtros, "Para", categorías, tallas),
 * al tocar una opción la fila se desliza para centrarla y dejar ver las demás.
 */
function findScroller(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  for (let i = 0; node && i < 4; i++, node = node.parentElement) {
    const ox = getComputedStyle(node).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth) return node;
  }
  return null;
}

document.addEventListener('click', (e) => {
  const item = (e.target as HTMLElement | null)?.closest<HTMLElement>('button, a, label');
  if (!item) return;
  const row = findScroller(item);
  if (!row) return;
  const rowBox = row.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  const offset = itemBox.left - rowBox.left - (rowBox.width - itemBox.width) / 2;
  row.scrollBy({ left: offset, behavior: 'smooth' });
});