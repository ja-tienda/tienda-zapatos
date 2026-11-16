import { Check } from 'lucide-react';
import type { OrderStatus } from '../../types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDIENTE', label: 'Recibido' },
  { status: 'PAGADO', label: 'Pagado' },
  { status: 'ENVIADO', label: 'Enviado' },
  { status: 'ENTREGADO', label: 'Entregado' },
];

/** Línea de avance del pedido: Recibido → Pagado → Enviado → Entregado. */
export default function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'CANCELADO') return null;
  const current = STEPS.findIndex((s) => s.status === status);

  return (
    <ol className="flex items-start" aria-label="Avance del pedido">
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step.status} className="flex flex-1 flex-col items-center text-center" aria-current={i === current ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : i <= current ? 'bg-emerald-600' : 'bg-stone-200'}`} aria-hidden />
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  done ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-500'
                }`}
              >
                {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'opacity-0' : i < current ? 'bg-emerald-600' : 'bg-stone-200'}`} aria-hidden />
            </div>
            <span className={`mt-1.5 text-xs ${done ? 'font-semibold text-stone-900' : 'text-stone-500'}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
