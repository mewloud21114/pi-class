import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized } from './api';
import { clearToken, getToken, setToken } from './tokenStore';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, token: null, user: null });

  const logout = useCallback(async () => {
    await clearToken();
    setState({ loading: false, token: null, user: null });
  }, []);

  // Restore the saved session on launch; the server re-checks the account is still active.
  useEffect(() => {
    onUnauthorized(() => logout());
    (async () => {
      const token = await getToken();
      if (!token) return setState({ loading: false, token: null, user: null });
      try {
        const { user } = await api('/auth/me', { token });
        setState({ loading: false, token, user });
      } catch (err) {
        // Offline: keep nothing rather than show stale content we cannot refresh.
        if (err.code !== 'NETWORK') await clearToken();
        setState({ loading: false, token: null, user: null });
      }
    })();
  }, [logout]);

  const login = useCallback(async (phone, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { phone, password } });
    await setToken(token);
    setState({ loading: false, token, user });
  }, []);

  const register = useCallback(
    (data) => api('/auth/register', { method: 'POST', body: data }),
    [],
  );

  const value = useMemo(() => ({ ...state, login, register, logout }), [state, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
