import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import { api } from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  /** Cliente con sesión iniciada, o null. */
  user: User | null;
  /** true mientras se comprueba si ya había una sesión abierta */
  loading: boolean;
  googleEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; acceptTerms: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;

  /** Ids de productos favoritos (de la cuenta, o de este navegador si aún no inició sesión). */
  favorites: number[];
  isFavorite: (productId: number) => boolean;
  toggleFavorite: (productId: number) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadGuestFavorites(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function saveGuestFavorites(ids: number[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(STORAGE_KEYS.favorites);
    else localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(ids));
  } catch {
    /* sin almacenamiento: los favoritos duran solo esta visita */
  }
}

/**
 * Sesión del cliente y favoritos.
 * La sesión vive en una cookie httpOnly que este código no puede leer: solo se le pregunta
 * al servidor "¿quién soy?". Se puede navegar y marcar favoritos sin cuenta; al iniciar
 * sesión, esos favoritos pasan a la cuenta y el carrito (que está en este navegador) se conserva.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [favorites, setFavorites] = useState<number[]>(loadGuestFavorites);

  /** Tras entrar: suma a la cuenta los corazones marcados sin sesión. */
  const adoptSession = useCallback(async (next: User) => {
    setUserState(next);
    try {
      const guest = loadGuestFavorites();
      const merged = guest.length > 0 ? await api.mergeFavorites(guest) : await api.getFavorites();
      saveGuestFavorites([]);
      setFavorites(merged);
    } catch {
      /* los favoritos se cargarán en la próxima visita */
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then(async (session) => {
        setGoogleEnabled(session.googleEnabled);
        if (session.user) await adoptSession(session.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adoptSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: next } = await api.login(email, password);
      await adoptSession(next);
    },
    [adoptSession],
  );

  const register = useCallback(
    async (data: { name: string; email: string; password: string; acceptTerms: boolean }) => {
      const { user: next } = await api.register(data);
      await adoptSession(next);
    },
    [adoptSession],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUserState(null);
    setFavorites([]);
  }, []);

  const toggleFavorite = useCallback(
    (productId: number) => {
      const active = favorites.includes(productId);
      // Se pinta al instante; si el servidor falla, se vuelve atrás
      const optimistic = active ? favorites.filter((id) => id !== productId) : [productId, ...favorites];
      setFavorites(optimistic);
      if (!user) {
        saveGuestFavorites(optimistic);
        return;
      }
      (active ? api.removeFavorite(productId) : api.addFavorite(productId)).then(setFavorites).catch(() => setFavorites(favorites));
    },
    [favorites, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      googleEnabled,
      login,
      register,
      logout,
      setUser: setUserState,
      favorites,
      isFavorite: (productId) => favorites.includes(productId),
      toggleFavorite,
    }),
    [user, loading, googleEnabled, login, register, logout, favorites, toggleFavorite],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
