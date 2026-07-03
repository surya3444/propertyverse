import { create } from 'zustand';
import { storage } from '../lib/storage';
import { authApi } from '../api/auth';
import { setAuthTokenGetter } from '../api/client';
import { User } from '../types';

const TOKEN_KEY = 'pv_token';
const USER_KEY = 'pv_user';

interface AuthState {
  token: string | null;
  user: User | null;
  /** True until we've checked storage for an existing session. */
  initializing: boolean;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  initializing: true,
  loading: false,
  error: null,

  // Restore a saved session on app launch.
  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        storage.getItem(TOKEN_KEY),
        storage.getItem(USER_KEY),
      ]);
      set({
        token: token ?? null,
        user: userJson ? (JSON.parse(userJson) as User) : null,
      });
    } finally {
      set({ initializing: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      await persistSession(res.token, res.user);
      set({ token: res.token, user: res.user, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? 'Login failed.' });
      throw err;
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.register(data);
      await persistSession(res.token, res.user);
      set({ token: res.token, user: res.user, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? 'Registration failed.' });
      throw err;
    }
  },

  logout: async () => {
    await Promise.all([storage.removeItem(TOKEN_KEY), storage.removeItem(USER_KEY)]);
    set({ token: null, user: null });
  },

  clearError: () => set({ error: null }),
}));

async function persistSession(token: string, user: User) {
  await Promise.all([
    storage.setItem(TOKEN_KEY, token),
    storage.setItem(USER_KEY, JSON.stringify(user)),
  ]);
}

// Let the api client read the current token for every request.
setAuthTokenGetter(() => useAuthStore.getState().token);
