import { CreditCard, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../../services/api';
import type { Order } from '../../types';
import { formatPrice } from '../../utils/format';

interface Props {
  order: Order;
  orderToken: string;
  /** Se llama con el pedido ya pagado. */
  onPaid: (order: Order) => void;
}

const IZIPAY_ENDPOINT = 'https://static.micuentaweb.pe';
const THEME_CSS = `${IZIPAY_ENDPOINT}/static/js/krypton-client/V4.0/ext/classic.css`;
const THEME_JS = `${IZIPAY_ENDPOINT}/static/js/krypton-client/V4.0/ext/classic.js`;

function loadTheme() {
  if (!document.querySelector(`link[href="${THEME_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = THEME_CSS;
    document.head.appendChild(link);
  }
  if (!document.querySelector(`script[src="${THEME_JS}"]`)) {
    const script = document.createElement('script');
    script.src = THEME_JS;
    document.head.appendChild(script);
  }
}

/**
 * Pago con tarjeta mediante el formulario incrustado de Izipay.
 * Los datos de la tarjeta se escriben en campos que pertenecen a Izipay: nunca pasan
 * por nuestra tienda ni por nuestro servidor. Aquí solo se pide el permiso de cobro
 * (formToken) y, al terminar, se le reenvía al servidor la respuesta firmada para validarla.
 */
export default function CardPayment({ order, orderToken, onPaid }: Props) {
  const [email, setEmail] = useState(order.customerEmail ?? '');
  const [stage, setStage] = useState<'idle' | 'loading' | 'form' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const removeForms = useRef<(() => Promise<unknown>) | null>(null);

  // Al salir de la página se desmonta el formulario de Izipay
  useEffect(() => () => void removeForms.current?.().catch(() => {}), []);

  async function start() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Ingresa tu correo: ahí llega la constancia del pago.');
    setError(null);
    setStage('loading');
    try {
      const { formToken, publicKey } = await api.startCardPayment(order.code, orderToken, email.trim());
      loadTheme();
      const { default: KRGlue } = await import('@lyracom/embedded-form-glue');
      const { KR } = await KRGlue.loadLibrary(IZIPAY_ENDPOINT, publicKey);
      await KR.setFormConfig({ formToken, 'kr-language': 'es-ES' });

      await KR.onSubmit((payment) => {
        setStage('confirming');
        api
          .confirmCardPayment(order.code, orderToken, payment.rawClientAnswer, payment.hash)
          .then(onPaid)
          .catch((err: unknown) => {
            setError(err instanceof ApiError ? err.message : 'No pudimos confirmar el pago. Escríbenos por WhatsApp con tu código de pedido.');
            setStage('form');
          });
        return false; // nos quedamos en esta página (sin redirección de Izipay)
      });
      await KR.onError((event) => {
        setError(event.errorMessage || 'El pago no se pudo procesar. Revisa los datos de tu tarjeta.');
      });

      setStage('form');
      await KR.renderElements('#izipay-form');
      removeForms.current = () => KR.removeForms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el formulario de pago. Inténtalo de nuevo o paga con Yape.');
      setStage('idle');
    }
  }

  return (
    <div className="space-y-4">
      {stage === 'idle' || stage === 'loading' ? (
        <>
          <label className="block text-sm font-medium text-stone-700">
            Correo para tu constancia de pago
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm focus:border-stone-900 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={start}
            disabled={stage === 'loading'}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-600 disabled:cursor-wait disabled:opacity-70"
          >
            {stage === 'loading' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
            {stage === 'loading' ? 'Preparando el pago seguro…' : `Pagar ${formatPrice(order.total)} con tarjeta`}
          </button>
        </>
      ) : (
        stage === 'confirming' && (
          <p className="flex items-center gap-2 text-sm font-medium text-stone-700" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Confirmando tu pago…
          </p>
        )
      )}

      {/* Aquí Izipay dibuja sus campos de tarjeta */}
      <div id="izipay-form" ref={formRef} className={stage === 'form' || stage === 'confirming' ? '' : 'hidden'}>
        <div className="kr-embedded" />
      </div>

      {error && (
        <p className="flex gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <p className="text-xs text-stone-500">Pago procesado por Izipay. Tus datos de tarjeta no se guardan en esta tienda.</p>
    </div>
  );
}
