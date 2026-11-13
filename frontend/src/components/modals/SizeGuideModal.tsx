import { CLOTHING_SIZE_TABLE, KIDS_SHOE_SIZE_TABLE, SHOE_SIZE_TABLE } from '../../config/constants';
import { useStore } from '../../context/StoreContext';
import { whatsappUrl } from '../../utils/format';
import Modal from './Modal';

const STEPS = [
  'Coloca una hoja de papel en el piso, pegada a la pared.',
  'Párate sobre la hoja con el talón tocando la pared. Hazlo por la tarde y con la media que usarás.',
  'Marca con un lápiz la punta de tu dedo más largo.',
  'Mide en centímetros desde el borde de la hoja hasta la marca. Repite con el otro pie y quédate con la medida mayor.',
  'Busca esa medida en la columna CM. Si estás entre dos tallas, elige la más grande.',
];

export default function SizeGuideModal({ onClose }: { onClose: () => void }) {
  const { settings } = useStore();
  return (
    <Modal title="Guía de Tallas" onClose={onClose} size="max-w-2xl">
      <div className="space-y-7 p-5 sm:p-6">
        <section>
          <h3 className="font-display text-xl font-medium text-stone-900">Calzado</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full text-center text-sm">
              <thead className="bg-stone-900 text-white">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Talla Perú / EUR</th>
                  <th className="px-3 py-2.5 font-semibold">US</th>
                  <th className="px-3 py-2.5 font-semibold">Plantilla (CM)</th>
                </tr>
              </thead>
              <tbody>
                {SHOE_SIZE_TABLE.map((row, i) => (
                  <tr key={row.eur} className={i % 2 ? 'bg-stone-50' : 'bg-white'}>
                    <td className="px-3 py-2 font-bold text-stone-900">{row.eur}</td>
                    <td className="px-3 py-2 text-stone-600">{row.us}</td>
                    <td className="px-3 py-2 text-stone-600">{row.cm} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Medidas referenciales: la horma puede variar un poco según el modelo.
          </p>
        </section>

        <section>
          <h3 className="font-display text-xl font-medium text-stone-900">Calzado de niñas y niños</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full text-center text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Talla Perú / EUR</th>
                  <th className="px-3 py-2.5 font-semibold">Largo del pie (CM)</th>
                </tr>
              </thead>
              <tbody>
                {KIDS_SHOE_SIZE_TABLE.map((row) => (
                  <tr key={row.eur} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-bold text-stone-900">{row.eur}</td>
                    <td className="px-3 py-2 text-stone-600">{row.cm} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Mide el pie de pie y con media. Si está entre dos tallas, elige la más grande: los pies crecen rápido.
          </p>
        </section>

        <section>
          <h3 className="font-display text-xl font-medium text-stone-900">Cómo medir tu pie en casa</h3>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-stone-600">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="font-display text-xl font-medium text-stone-900">Ropa (corte unisex)</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full text-center text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Talla</th>
                  <th className="px-3 py-2.5 font-semibold">Pecho (cm)</th>
                  <th className="px-3 py-2.5 font-semibold">Cintura (cm)</th>
                </tr>
              </thead>
              <tbody>
                {CLOTHING_SIZE_TABLE.map((row) => (
                  <tr key={row.size} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-bold text-stone-900">{row.size}</td>
                    <td className="px-3 py-2 text-stone-600">{row.chest}</td>
                    <td className="px-3 py-2 text-stone-600">{row.waist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
          ¿Sigues con dudas?{' '}
          <a
            href={whatsappUrl(settings.contactPhone, `¡Hola ${settings.contactName}! Necesito ayuda para elegir mi talla.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent-600 underline underline-offset-2"
          >
            Escríbele a {settings.contactName} por WhatsApp
          </a>{' '}
          y te ayuda a elegir.
        </p>
      </div>
    </Modal>
  );
}
