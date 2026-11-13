import { Fragment } from 'react';

/**
 * Muestra un título donde lo escrito entre *asteriscos* sale resaltado en cursiva y color.
 * Ejemplo: "Zapatillas que *combinan* con todo."
 */
export default function RichTitle({ text, highlightClass = 'text-accent-600' }: { text: string; highlightClass?: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <em key={i} className={`font-normal italic ${highlightClass}`}>
            {part}
          </em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
