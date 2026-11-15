import { ChevronDown, LoaderCircle, MessageCircle, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { STORE } from '../../config/constants';
import type { Customer, Order, OrderStatus } from '../../types';
import { formatDateTime, formatPrice, normalizeText } from '../../utils/format';
import OrdersPanel from './OrdersPanel';

interface Props {
  customers: Customer[];
  loadOrders: (customerId: number) => Promise<Order[]>;
  onSetActive: (customer: Customer, isActive: boolean) => Promise<void>;
  onSetOrderStatus: (orderId: number, status: OrderStatus) => Promise<Order | undefined>;
}

/** Clientes registrados: sus datos, sus pedidos y el botón para desactivar una cuenta. */
export default function CustomersPanel({ customers, loadOrders, onSetActive, onSetOrderStatus }: Props) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const term = normalizeText(query.trim());
  const filtered = term ? customers.filter((c) => normalizeText(`${c.name} ${c.email} ${c.phone ?? ''}`).includes(term)) : customers;

  async function toggle(customer: Customer) {
    if (openId === customer.id) return setOpenId(null);
    setOpenId(customer.id);
    setOrders(null);
    setOrders(await loadOrders(customer.id).catch(() => []));
  }

  async function setActive(customer: Customer, isActive: boolean) {
    const question = isActive
      ? `¿Reactivar la cuenta de ${customer.name}?`
      : `¿Desactivar la cuenta de ${customer.name}? Se cerrará su sesión y no podrá entrar ni comprar hasta que la reactives. Sus pedidos se conservan.`;
    if (!confirm(question)) return;
    setBusy(customer.id);
    try {
      await onSetActive(customer, isActive);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-stone-900">
          Clientes <span className="text-base font-medium text-stone-500">({customers.length})</span>
        </h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, correo o celular…"
          aria-label="Buscar cliente"
          className="w-full rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm focus:border-stone-900 focus:outline-none sm:w-80"
        />
      </div>

      {filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center text-sm text-stone-500">
          {customers.length === 0 ? 'Aún no hay clientes registrados. Aparecerán aquí cuando creen su cuenta al comprar.' : 'Ningún cliente coincide.'}
        </p>
      )}

      <ul className="space-y-3" aria-label="Clientes">
        {filtered.map((customer) => {
          const open = openId === customer.id;
          return (
            <li key={customer.id} className={`overflow-hidden rounded-2xl border bg-white ${customer.isActive ? 'border-stone-200' : 'border-dashed border-stone-300'}`}>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <span className={`grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold ${customer.isActive ? 'bg-accent-100 text-accent-700' : 'bg-stone-200 text-stone-500'}`}>
                  {customer.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 basis-52">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">
                    {customer.name}
                    {!customer.isActive && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-600">Desactivada</span>}
                    {customer.withGoogle && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">Google</span>}
                  </p>
                  <p className="truncate text-xs text-stone-500">{customer.email}</p>
                  <p className="text-xs text-stone-500">
                    Desde {formatDateTime(customer.createdAt)} · {customer.orderCount} {customer.orderCount === 1 ? 'pedido' : 'pedidos'} · compró{' '}
                    {formatPrice(customer.totalSpent)}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {customer.phone && (
                    <a
                      href={`https://wa.me/${STORE.countryCode}${customer.phone.replace(/^51(?=\d{9}$)/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`WhatsApp ${customer.phone}`}
                      aria-label={`Escribir a ${customer.name} por WhatsApp`}
                      className="grid size-9 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(customer)}
                    aria-expanded={open}
                    className="flex items-center gap-1 rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-900"
                  >
                    Ver pedidos
                    <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={busy === customer.id}
                    onClick={() => setActive(customer, !customer.isActive)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                      customer.isActive
                        ? 'border-stone-200 text-stone-700 hover:border-accent-600 hover:text-accent-600'
                        : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {customer.isActive ? <UserX className="size-3.5" aria-hidden /> : <UserCheck className="size-3.5" aria-hidden />}
                    {customer.isActive ? 'Desactivar' : 'Reactivar'}
                  </button>
                </div>
              </div>

              {open && (
                <div className="border-t border-stone-200 bg-stone-50 p-3 sm:p-4">
                  {orders === null ? (
                    <p className="flex items-center gap-2 py-4 text-sm text-stone-500">
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                      Cargando pedidos…
                    </p>
                  ) : (
                    <OrdersPanel
                      compact
                      orders={orders}
                      onSetStatus={async (orderId, status) => {
                        const updated = await onSetOrderStatus(orderId, status);
                        if (updated) setOrders((list) => list?.map((o) => (o.id === updated.id ? updated : o)) ?? null);
                      }}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
