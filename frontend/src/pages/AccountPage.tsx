import { Heart, LoaderCircle, LogOut, Package, TriangleAlert, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import AuthPanel from '../components/account/AuthPanel';
import ProductGrid from '../components/catalog/ProductGrid';
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, ROUTES } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../services/api';
import type { Order } from '../types';
import { formatDateTime, formatPrice } from '../utils/format';

const TABS = [
  { id: 'pedidos', label: 'Mis pedidos', icon: Package },
  { id: 'favoritos', label: 'Favoritos', icon: Heart },
  { id: 'datos', label: 'Mis datos', icon: UserRound },
] as const;
type TabId = (typeof TABS)[number]['id'];

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'No se pudo iniciar sesión con Google. Inténtalo otra vez o entra con tu correo.',
  'google-admin': 'Esa cuenta es de administración: entra desde el panel con tu usuario y contraseña.',
  desactivada: 'Esta cuenta está desactivada. Escríbenos por WhatsApp.',
};

const inputClass =
  'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 focus:border-stone-900 focus:outline-none';

/** Qué le falta hacer al cliente con un pedido pendiente. */
function nextStep(order: Order): string | null {
  if (order.status !== 'PENDIENTE') return null;
  if (order.hasReceipt) return 'Estamos verificando tu pago';
  if (order.paymentMethod) return 'Coordina el pago por WhatsApp';
  return 'Falta pagar';
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myOrders().then(setOrders).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudieron cargar tus pedidos'));
  }, []);

  if (error) return <p className="rounded-2xl bg-accent-50 p-4 text-sm text-accent-700">{error}</p>;
  if (!orders) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-stone-500" aria-busy="true">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Cargando tus pedidos…
      </p>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
        <Package className="mx-auto size-10 text-stone-300" strokeWidth={1.5} aria-hidden />
        <p className="mt-4 font-display text-xl font-medium text-stone-900">Aún no tienes pedidos</p>
        <Link to={ROUTES.catalog} className="mt-5 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600">
          Ver el catálogo
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        const step = nextStep(order);
        return (
          <li key={order.id}>
            <Link
              to={ROUTES.order(order.code)}
              className="block rounded-3xl border border-stone-200/80 bg-white p-5 transition-shadow hover:shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-bold text-stone-900">{order.code}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ORDER_STATUS_STYLES[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                <span className="text-xs text-stone-500">{formatDateTime(order.createdAt)}</span>
                <span className="ml-auto text-lg font-semibold text-stone-900">{formatPrice(order.total)}</span>
              </div>
              <p className="mt-2 text-sm text-stone-600">
                {order.items.map((i) => `${i.quantity} × ${i.productName} (${i.size})`).join(' · ')}
              </p>
              {step && <p className="mt-2 text-sm font-semibold text-amber-700">{step} →</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FavoritesTab() {
  const { favorites } = useAuth();
  const { products, loading, openProduct } = useStore();
  // Se respeta el orden en que se guardaron (los más recientes primero)
  const items = favorites.flatMap((id) => products.find((p) => p.id === id) ?? []);

  if (!loading && items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
        <Heart className="mx-auto size-10 text-stone-300" strokeWidth={1.5} aria-hidden />
        <p className="mt-4 font-display text-xl font-medium text-stone-900">Aún no guardas favoritos</p>
        <p className="mt-1 text-sm text-stone-500">Toca el corazón de un producto para tenerlo a la mano.</p>
        <Link to={ROUTES.catalog} className="mt-5 inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600">
          Ver el catálogo
        </Link>
      </div>
    );
  }
  return <ProductGrid products={items} loading={loading} onOpen={openProduct} onClearFilters={() => {}} />;
}

function ProfileTab() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user!.name);
  const [phone, setPhone] = useState(user!.phone ?? '');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy('profile');
    setProfileMsg(null);
    try {
      const { user: updated } = await api.updateProfile({ name: name.trim(), phone: phone.replace(/\s/g, '') });
      setUser(updated);
      setProfileMsg({ ok: true, text: 'Datos guardados.' });
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : 'No se pudo guardar' });
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setPasswordMsg({ ok: false, text: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    setBusy('password');
    setPasswordMsg(null);
    try {
      await api.changePassword(current, next);
      setUser({ ...user!, hasPassword: true });
      setCurrent('');
      setNext('');
      setPasswordMsg({ ok: true, text: 'Contraseña actualizada. Cerramos tu sesión en los demás dispositivos.' });
    } catch (err) {
      setPasswordMsg({ ok: false, text: err instanceof Error ? err.message : 'No se pudo cambiar' });
    } finally {
      setBusy(null);
    }
  }

  const message = (msg: { ok: boolean; text: string } | null) =>
    msg && (
      <p className={`text-sm font-medium ${msg.ok ? 'text-emerald-700' : 'text-accent-700'}`} role={msg.ok ? 'status' : 'alert'}>
        {msg.text}
      </p>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-7">
        <h2 className="font-display text-2xl font-medium text-stone-900">Mis datos</h2>
        <p className="text-sm text-stone-500">
          Correo: <strong className="font-semibold text-stone-900">{user!.email}</strong>
          {user!.hasGoogle && ' · vinculada con Google'}
        </p>
        <label className="block text-sm font-medium text-stone-700">
          Nombre completo
          <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Celular / WhatsApp
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
            className={inputClass}
          />
        </label>
        {message(profileMsg)}
        <button type="submit" disabled={busy === 'profile'} className="rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60">
          Guardar datos
        </button>
      </form>

      <form onSubmit={savePassword} className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-7">
        <h2 className="font-display text-2xl font-medium text-stone-900">{user!.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}</h2>
        {!user!.hasPassword && (
          <p className="text-sm text-stone-500">Entras con Google. Si quieres, crea una contraseña para entrar también con tu correo.</p>
        )}
        {user!.hasPassword && (
          <label className="block text-sm font-medium text-stone-700">
            Contraseña actual
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} maxLength={200} className={inputClass} />
          </label>
        )}
        <label className="block text-sm font-medium text-stone-700">
          Nueva contraseña
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} maxLength={72} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-stone-500">Mínimo 8 caracteres.</span>
        </label>
        {message(passwordMsg)}
        <button type="submit" disabled={busy === 'password'} className="rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60">
          {user!.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}
        </button>
      </form>
    </div>
  );
}

/** "Mi cuenta": pedidos con su estado, favoritos y datos. Sin sesión, muestra el inicio de sesión. */
export default function AccountPage() {
  const { user, loading, logout, favorites } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  usePageMeta('Mi cuenta');

  const requested = searchParams.get('seccion') as TabId | null;
  const tab: TabId = TABS.some((t) => t.id === requested) ? requested! : 'pedidos';
  const googleError = GOOGLE_ERRORS[searchParams.get('error') ?? ''];

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-32 text-sm text-stone-500" aria-busy="true">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Un momento…
      </p>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {googleError && (
          <p className="mx-auto mb-5 flex max-w-md gap-2 rounded-2xl bg-accent-50 p-4 text-sm text-accent-700" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {googleError}
          </p>
        )}
        <AuthPanel next={ROUTES.account} />
        {favorites.length > 0 && (
          <p className="mx-auto mt-4 max-w-md text-center text-sm text-stone-500">
            Tienes {favorites.length} {favorites.length === 1 ? 'favorito guardado' : 'favoritos guardados'} en este dispositivo: al entrar
            pasarán a tu cuenta.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">Mi cuenta</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">Hola, {user.name.split(' ')[0]}</h1>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-stone-900"
        >
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </button>
      </div>

      <div className="no-scrollbar -mx-4 mt-7 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Secciones de mi cuenta">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setSearchParams(id === 'pedidos' ? {} : { seccion: id }, { replace: true })}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {id === 'favoritos' && favorites.length > 0 && <span className="text-xs opacity-70">({favorites.length})</span>}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === 'pedidos' ? <OrdersTab /> : tab === 'favoritos' ? <FavoritesTab /> : <ProfileTab />}</div>
    </section>
  );
}
