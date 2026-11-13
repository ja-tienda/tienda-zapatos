import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import { useState } from 'react';

const DEVICES = [
  { id: 'mobile', label: 'Celular', width: 390, icon: Smartphone },
  { id: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
  { id: 'desktop', label: 'Computadora', width: null, icon: Monitor },
] as const;

type DeviceId = (typeof DEVICES)[number]['id'];

/** Muestra la tienda real (no una copia) dentro del panel, al tamaño de cada dispositivo. */
export default function StorePreview() {
  const [device, setDevice] = useState<DeviceId>('mobile');
  const [reloadKey, setReloadKey] = useState(0);
  const current = DEVICES.find((d) => d.id === device)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-stone-200 bg-white p-1" role="group" aria-label="Tamaño de pantalla">
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-pressed={device === id}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${
                device === id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 hover:border-stone-900"
        >
          <RefreshCw className="size-4" aria-hidden />
          Recargar
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="ml-auto flex items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
        >
          <ExternalLink className="size-4" aria-hidden />
          Abrir la tienda
        </a>
      </div>

      <p className="text-sm text-stone-500">
        Esta es tu tienda real, tal como la ven tus clientes. Lo que guardas en el panel aparece aquí al instante y en
        los celulares de tus clientes en menos de 30 segundos.
      </p>

      <div className="overflow-x-auto rounded-3xl bg-stone-200 p-3 sm:p-5">
        <iframe
          key={reloadKey}
          src="/"
          title="Vista previa de la tienda"
          style={{ width: current.width ? `${current.width}px` : '100%' }}
          className="mx-auto block h-[75dvh] min-h-[34rem] max-w-none rounded-2xl border border-stone-300 bg-white shadow-xl"
        />
      </div>
    </div>
  );
}
