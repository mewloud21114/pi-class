// Browser: localStorage (SecureStore has no web implementation). The token expires
// server-side and is revoked on suspension, which limits the impact of a shared PC.
const KEY = 'piclass.token';
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export const getToken = async () => safe(() => localStorage.getItem(KEY), null);
export const setToken = async (t) => safe(() => localStorage.setItem(KEY, t));
export const clearToken = async () => safe(() => localStorage.removeItem(KEY));
