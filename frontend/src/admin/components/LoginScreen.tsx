import { ArrowLeft, LoaderCircle, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { STORE } from '../../config/constants';
import { api } from '../../services/api';

export default function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pin || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.login(pin);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ingresar');
      setPin('');
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-stone-900 p-4">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className="flex flex-col items-center rounded-3xl bg-white px-6 py-10 text-center shadow-2xl">
          <span className="grid size-12 place-items-center rounded-full bg-stone-900 text-white">
            <Lock className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-stone-900">Panel {STORE.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Ingresa tu PIN para gestionar productos, stock y pedidos.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={12}
            aria-label="PIN de acceso"
            className="mt-6 w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:border-stone-900 focus:outline-none"
          />
          {error && (
            <p className="mt-3 text-sm font-medium text-accent-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!pin || loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-sm font-bold text-white hover:bg-stone-700 disabled:bg-stone-300"
          >
            {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Ingresar
          </button>
        </form>
        <a href="/" className="mt-5 flex items-center justify-center gap-1.5 text-sm text-stone-400 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la tienda
        </a>
      </div>
    </main>
  );
}
