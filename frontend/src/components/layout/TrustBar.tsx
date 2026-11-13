import { MessageCircle, PackageCheck, Truck, Wallet } from 'lucide-react';
import Reveal from '../ui/Reveal';

const BENEFITS = [
  { icon: Wallet, title: 'Paga con Yape o Plin', text: 'También transferencia y contra entrega' },
  { icon: Truck, title: 'Envíos a todo el Perú', text: 'Shalom, Olva y delivery local' },
  { icon: PackageCheck, title: 'Stock real por talla', text: 'Lo que ves es lo que hay' },
  { icon: MessageCircle, title: 'Atención por WhatsApp', text: 'Coordinas directo con Jessica' },
];

export default function TrustBar() {
  return (
    <section aria-label="Beneficios de comprar en J & A" className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
      <Reveal>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-3xl border border-stone-200/80 bg-white px-5 py-6 sm:px-8 lg:grid-cols-4 lg:divide-x lg:divide-stone-200/80">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col items-center gap-2 text-center lg:px-4">
              <span className="grid size-11 place-items-center rounded-full bg-accent-50 text-accent-600">
                <Icon className="size-5" strokeWidth={1.6} aria-hidden />
              </span>
              <p className="font-display text-base font-medium leading-tight text-stone-900">{title}</p>
              <p className="text-xs leading-snug text-stone-500">{text}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
