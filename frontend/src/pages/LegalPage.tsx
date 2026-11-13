import { useStore } from '../context/StoreContext';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGES = {
  terms: { title: 'Términos y condiciones', key: 'termsText' },
  privacy: { title: 'Política de privacidad', key: 'privacyText' },
} as const;

/**
 * Términos y Política de privacidad. El texto se escribe en el panel (Contacto y pagos):
 * cada párrafo en su línea; las líneas cortas que empiezan con un número ("1. Pedidos")
 * se muestran como subtítulos.
 */
export default function LegalPage({ kind }: { kind: keyof typeof PAGES }) {
  const { settings, loading } = useStore();
  const page = PAGES[kind];
  usePageTitle(page.title);
  const text = settings[page.key];
  const blocks = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">{page.title}</h1>

      {loading && blocks.length === 0 ? (
        <div className="mt-8 space-y-3" aria-busy="true">
          {[90, 100, 70, 95, 60].map((w, i) => (
            <div key={i} className="h-4 animate-pulse rounded-full bg-stone-200" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <p className="mt-8 text-stone-600">Estamos preparando este documento. Escríbenos por WhatsApp si tienes alguna consulta.</p>
      ) : (
        <div className="mt-8 space-y-4 text-base leading-relaxed text-stone-700">
          {blocks.map((block, i) =>
            /^\d+[.)]\s/.test(block) && block.length < 90 ? (
              <h2 key={i} className="pt-4 font-display text-xl font-medium text-stone-900">
                {block}
              </h2>
            ) : (
              <p key={i}>{block}</p>
            ),
          )}
        </div>
      )}
    </article>
  );
}
