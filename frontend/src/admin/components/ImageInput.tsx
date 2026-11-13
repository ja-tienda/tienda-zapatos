import { ImageUp, Link2, LoaderCircle, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { fieldClass, useAdmin } from '../AdminContext';

interface Props {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  folder: 'productos' | 'sitio';
  /** Forma de la vista previa (clases de Tailwind). */
  previewClass?: string;
  /** "contain" para logos y QR (no recorta); "cover" para fotos y portadas. */
  fit?: 'cover' | 'contain';
}

/** Campo de una sola imagen: se sube desde el dispositivo o se pega una URL. */
export default function ImageInput({
  label,
  hint,
  value,
  onChange,
  folder,
  previewClass = 'h-28 w-44',
  fit = 'cover',
}: Props) {
  const { upload } = useAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await upload(file, folder));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{label}</p>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className={`${previewClass} grid shrink-0 place-items-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100`}>
          {uploading ? (
            <LoaderCircle className="size-5 animate-spin text-stone-400" aria-label="Subiendo" />
          ) : value ? (
            <img src={value} alt="" className={`size-full ${fit === 'contain' ? 'object-contain p-1.5' : 'object-cover'}`} />
          ) : (
            <span className="px-2 text-center text-xs text-stone-400">Sin imagen</span>
          )}
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
          >
            <ImageUp className="size-4" aria-hidden />
            {value ? 'Cambiar imagen' : 'Subir desde tu dispositivo'}
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowUrl((s) => !s)} className="flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900">
              <Link2 className="size-3.5" aria-hidden />
              Usar una URL
            </button>
            {value && (
              <button type="button" onClick={() => onChange('')} className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700">
                <Trash2 className="size-3.5" aria-hidden />
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>

      {showUrl && (
        <input
          type="url"
          value={value.startsWith('/uploads/') ? '' : value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="https://…"
          aria-label={`URL de ${label.toLowerCase()}`}
          className={`${fieldClass} font-mono text-xs`}
        />
      )}
      {error && (
        <p className="mt-2 text-sm font-medium text-accent-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
