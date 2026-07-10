import { create } from 'zustand';
import { storage } from '../lib/storage';
import { authApi } from '../api/auth';
import { setAuthTokenGetter, setUnauthorizedHandler } from '../api/client';
import { unregisterFromPush } from '../lib/push';
import { User } from '../types';

const TOKEN_KEY = 'pv_token';
const USER_KEY = 'pv_user';

// Read the `exp` claim without verifying the signature — the server does that.
// We only need to know whether restoring this session is worth attempting, so an
// unreadable token counts as expired.
function isExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof globalThis.atob !== 'function') return false;
    const json = globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json);
    if (typeof exp !== 'number') return true;
    return exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

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

      // An expired token would boot the agent into the logged-in UI and then 401
      // on the first request. Drop it here and show the login screen instead.
      if (!token || isExpired(token)) {
        await clearSession();
        return;
      }

      set({ token, user: userJson ? (JSON.parse(userJson) as User) : null });
    } catch {
      await clearSession();
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
    // Tear the push subscription down before dropping the token — it's an
    // authenticated call. Otherwise the device keeps a live subscription bound
    // to the previous agent, and whoever signs in next on this device receives
    // their notifications.
    await unregisterFromPush();
    await clearSession();
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

async function clearSession() {
  await Promise.all([storage.removeItem(TOKEN_KEY), storage.removeItem(USER_KEY)]);
}

// Let the api client read the current token for every request.
setAuthTokenGetter(() => useAuthStore.getState().token);

// A 401 from anywhere means the session is gone. Sign out rather than stranding
// the agent on a screen that can never load.
setUnauthorizedHandler(() => {
  const { token, logout } = useAuthStore.getState();
  if (token) logout().catch(() => {});
});
