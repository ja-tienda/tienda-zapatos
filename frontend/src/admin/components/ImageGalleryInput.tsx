import { ChevronLeft, ChevronRight, ImageUp, LoaderCircle, Plus, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { fieldClass, useAdmin } from '../AdminContext';

interface Props {
  value: string[];
  onChange: (images: string[]) => void;
  max?: number;
}

/**
 * Fotos de un producto: se suben varias a la vez desde el dispositivo o se agregan por URL.
 * La primera es la foto principal; las flechas cambian el orden.
 */
export default function ImageGalleryInput({ value, onChange, max = 8 }: Props) {
  const { upload } = useAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const full = value.length >= max;

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, max - value.length);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    setPending(files.length);

    const uploaded: string[] = [];
    for (const file of files) {
      try {
        uploaded.push(await upload(file, 'productos'));
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : 'no se pudo subir'}`);
      }
      setPending((n) => n - 1);
    }
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
  }

  function addUrl() {
    const clean = url.trim();
    if (!clean) return;
    if (!/^https?:\/\//i.test(clean)) return setError('La URL debe empezar con http:// o https://');
    if (value.includes(clean)) return setError('Esa foto ya está en la lista.');
    setError(null);
    onChange([...value, clean]);
    setUrl('');
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">
        Fotos <span className="font-normal text-stone-400">(hasta {max}; la primera es la principal)</span>
      </p>

      <ul className="mt-2 flex flex-wrap gap-3">
        {value.map((src, i) => (
          <li key={src} className="group relative size-24 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            <img src={src} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded-full bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Principal
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, n) => n !== i))}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-white/95 text-stone-700 shadow-sm hover:bg-accent-600 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Mover foto ${i + 1} a la izquierda`}
                className="grid size-6 place-items-center rounded-full bg-white/95 text-stone-700 shadow-sm disabled:invisible"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                aria-label={`Mover foto ${i + 1} a la derecha`}
                className="grid size-6 place-items-center rounded-full bg-white/95 text-stone-700 shadow-sm disabled:invisible"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </li>
        ))}

        {Array.from({ length: pending }, (_, i) => (
          <li key={`pending-${i}`} className="grid size-24 place-items-center rounded-xl border border-stone-200 bg-stone-100">
            <LoaderCircle className="size-5 animate-spin text-stone-400" aria-label="Subiendo foto" />
          </li>
        ))}

        {!full && pending === 0 && (
          <li>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 text-center text-xs font-semibold text-stone-700 hover:border-stone-900"
            >
              <ImageUp className="size-5 text-accent-600" aria-hidden />
              Subir fotos
            </button>
          </li>
        )}
      </ul>

      {!full && (
        // No es un <form>: este componente vive dentro del formulario del producto
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="…o pega la URL de una foto (https://…)"
            aria-label="URL de una foto"
            className={`${fieldClass} mt-0 font-mono text-xs`}
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!url.trim()}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:border-stone-900 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            Agregar
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm font-medium text-accent-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
