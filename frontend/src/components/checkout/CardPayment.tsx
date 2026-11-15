import { CreditCard, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../../services/api';
import type { Order } from '../../types';
import { formatPrice } from '../../utils/format';

interface Props {
  order: Order;
  /** Se llama con el pedido ya marcado como pagado POR EL SERVIDOR. */
  onPaid: (order: Order) => void;
}

const IZIPAY_ENDPOINT = 'https://static.micuentaweb.pe';
const THEME_CSS = `${IZIPAY_ENDPOINT}/static/js/krypton-client/V4.0/ext/classic.css`;
const THEME_JS = `${IZIPAY_ENDPOINT}/static/js/krypton-client/V4.0/ext/classic.js`;

/** Cada cuánto y hasta cuándo se pregunta al servidor si ya llegó la confirmación de Izipay. */
const POLL_MS = 2000;
const POLL_LIMIT_MS = 90_000;

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
 * - Los datos de la tarjeta se escriben en campos que pertenecen a Izipay: nunca pasan por
 *   nuestra tienda ni por nuestro servidor.
 * - Que el formulario diga "pagado" NO marca el pedido como pagado. Eso solo lo hace el
 *   servidor cuando recibe la notificación firmada de Izipay; aquí únicamente se consulta
 *   el estado del pedido hasta que esa confirmación llega.
 */
export default function CardPayment({ order, onPaid }: Props) {
  const [stage, setStage] = useState<'idle' | 'loading' | 'form' | 'confirming' | 'delayed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const removeForms = useRef<(() => Promise<unknown>) | null>(null);
  const alive = useRef(true);

  // Al salir de la página se desmonta el formulario de Izipay y se deja de consultar
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void removeForms.current?.().catch(() => {});
    };
  }, []);

  async function waitForConfirmation() {
    setStage('confirming');
    const started = Date.now();
    while (alive.current && Date.now() - started < POLL_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      try {
        const fresh = await api.getOrder(order.code);
        if (fresh.status !== 'PENDIENTE') return onPaid(fresh);
      } catch {
        /* un fallo de red no interrumpe la espera */
      }
    }
    // La notificación puede tardar: el pedido se actualizará solo en esta misma página
    if (alive.current) setStage('delayed');
  }

  async function start() {
    setError(null);
    setStage('loading');
    try {
      const { formToken, publicKey } = await api.startCardPayment(order.code);
      loadTheme();
      const { default: KRGlue } = await import('@lyracom/embedded-form-glue');
      const { KR } = await KRGlue.loadLibrary(IZIPAY_ENDPOINT, publicKey);
      await KR.setFormConfig({ formToken, 'kr-language': 'es-ES' });

      await KR.onSubmit(() => {
        void waitForConfirmation();
        return false; // nos quedamos en esta página (sin redirección de Izipay)
      });
      await KR.onError((event) => {
        // Tarjeta rechazada, datos incorrectos o pago cancelado: se puede volver a intentar
        setError(event.errorMessage || 'El pago no se pudo procesar. Revisa los datos de tu tarjeta o prueba con otra.');
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
      {(stage === 'idle' || stage === 'loading') && (
        <button
          type="button"
          onClick={start}
          disabled={stage === 'loading'}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-600 disabled:cursor-wait disabled:opacity-70"
        >
          {stage === 'loading' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
          {stage === 'loading' ? 'Preparando el pago seguro…' : `Pagar ${formatPrice(order.total)} con tarjeta`}
        </button>
      )}

      {stage === 'confirming' && (
        <p className="flex items-center gap-2 rounded-xl bg-stone-100 p-3 text-sm font-medium text-stone-700" role="status">
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
          Confirmando tu pago con el banco… No cierres esta página.
        </p>
      )}
      {stage === 'delayed' && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
          La confirmación está tardando más de lo normal. Si tu banco aprobó el pago, tu pedido pasará a “Pagado” en unos minutos
          (lo verás aquí y en Mi cuenta). No vuelvas a pagar: si tienes dudas, escríbenos por WhatsApp con tu código {order.code}.
        </p>
      )}

      {/* Aquí Izipay dibuja sus campos de tarjeta */}
      <div id="izipay-form" className={stage === 'form' ? '' : 'hidden'}>
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
