import { Camera, Check, Copy, Download, ImageUp, LoaderCircle, Send, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '../../context/StoreContext';
import { ApiError, api } from '../../services/api';
import type { Order } from '../../types';
import { formatPhone, formatPrice } from '../../utils/format';

interface Props {
  order: Order;
  orderToken: string;
  /** Se llama con el pedido actualizado cuando el comprobante quedó guardado. */
  onSent: (order: Order) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Navegadores sin permiso de portapapeles: método clásico
      const input = document.createElement('input');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        copied ? 'bg-emerald-100 text-emerald-800' : 'text-accent-600 hover:bg-accent-50'
      }`}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{copied ? '¡Copiado!' : 'Copiar'}</span>
    </button>
  );
}

function DataRow({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
        <p className="truncate text-base font-semibold text-stone-900">{value}</p>
      </div>
      {copy && <CopyButton value={copy} label={`Copiar ${label.toLowerCase()}`} />}
    </div>
  );
}

/**
 * Pago con Yape o Plin: muestra el QR y los datos, y recibe la captura del pago.
 * La captura se guarda en el pedido para que la administradora la revise en su panel.
 */
export default function WalletPayment({ order, orderToken, onSent }: Props) {
  const { settings } = useStore();
  const [wallet, setWallet] = useState<'YAPE' | 'PLIN'>('YAPE');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Vista previa local de la captura elegida (se libera al cambiarla o salir)
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!chosen) return;
    if (!chosen.type.startsWith('image/')) return setError('Elige una imagen (captura o foto del comprobante).');
    if (chosen.size > 12 * 1024 * 1024) return setError('La imagen pesa demasiado (máximo 12 MB).');
    setError(null);
    setFile(chosen);
  }

  async function send() {
    if (!file) return setError('Adjunta la captura de tu pago para continuar.');
    setSending(true);
    setError(null);
    try {
      onSent(await api.sendReceipt(order.code, orderToken, file, wallet));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el comprobante. Inténtalo de nuevo.');
      setSending(false);
    }
  }

  const number = formatPhone(settings.walletNumber);
  const walletName = wallet === 'YAPE' ? 'Yape' : 'Plin';

  return (
    <div className="space-y-6">
      <div className="flex gap-2" role="radiogroup" aria-label="Billetera">
        {(['YAPE', 'PLIN'] as const).map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={wallet === w}
            onClick={() => setWallet(w)}
            className={`rounded-full border px-5 py-2 text-sm font-semibold transition-colors ${
              wallet === w
                ? w === 'YAPE'
                  ? 'border-purple-700 bg-purple-700 text-white'
                  : 'border-cyan-700 bg-cyan-700 text-white'
                : 'border-stone-200 text-stone-700 hover:border-stone-400'
            }`}
          >
            {w === 'YAPE' ? 'Yape' : 'Plin'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        {settings.walletQrUrl && (
          <div className="mx-auto sm:mx-0">
            <img
              src={settings.walletQrUrl}
              alt={`Código QR para pagar a ${settings.walletHolder}`}
              className="size-44 rounded-2xl border border-stone-200 bg-white object-contain p-2"
            />
            <a
              href={settings.walletQrUrl}
              download={`qr-pago-${order.code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-stone-900"
            >
              <Download className="size-3.5" aria-hidden />
              Descargar QR
            </a>
          </div>
        )}
        <div className="space-y-2">
          <DataRow label={`Número ${walletName}`} value={number} copy={settings.walletNumber} />
          <DataRow label="A nombre de" value={settings.walletHolder} />
          <DataRow label="Monto exacto" value={formatPrice(order.total)} copy={order.total.toFixed(2)} />
          <DataRow label="Código de tu pedido" value={order.code} copy={order.code} />
        </div>
      </div>

      <ol className="space-y-2 text-sm text-stone-600">
        {[
          <>
            Abre <strong className="text-stone-900">{walletName}</strong>
            {settings.walletQrUrl ? ' y escanea el QR, o paga al número ' : ' y paga al número '}
            <strong className="text-stone-900">{number}</strong>.
          </>,
          <>
            Verifica que el nombre sea <strong className="text-stone-900">{settings.walletHolder}</strong> y paga exactamente{' '}
            <strong className="text-stone-900">{formatPrice(order.total)}</strong>.
          </>,
          <>
            En el mensaje del pago escribe tu código <strong className="text-stone-900">{order.code}</strong>.
          </>,
          <>Toma una captura de la constancia y súbela aquí abajo.</>,
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div>
        <h3 className="font-display text-xl font-medium text-stone-900">Envía tu comprobante</h3>
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />

        {preview ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
            <img src={preview} alt="Captura elegida" className="h-24 w-16 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">{file?.name}</p>
              <button type="button" onClick={() => galleryRef.current?.click()} className="text-sm font-medium text-accent-600 hover:underline">
                Cambiar captura
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Quitar captura"
              className="grid size-9 place-items-center rounded-full text-stone-500 hover:bg-stone-200"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-stone-300 px-3 py-5 text-center hover:border-stone-900"
            >
              <ImageUp className="size-6 text-accent-600" strokeWidth={1.6} aria-hidden />
              <span className="text-sm font-semibold text-stone-900">Subir captura</span>
              <span className="text-xs text-stone-500">Desde tu galería</span>
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-stone-300 px-3 py-5 text-center hover:border-stone-900"
            >
              <Camera className="size-6 text-accent-600" strokeWidth={1.6} aria-hidden />
              <span className="text-sm font-semibold text-stone-900">Tomar foto</span>
              <span className="text-xs text-stone-500">Con la cámara</span>
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 flex gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
        >
          {sending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {sending ? 'Enviando comprobante…' : 'Ya pagué · Enviar comprobante'}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-stone-500">
          <ShieldCheck className="size-3.5" aria-hidden />
          Tu captura solo la ve nuestro equipo para confirmar el pago.
        </p>
      </div>
    </div>
  );
}
