import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

const ContentContext = createContext(null);

/** Loads the student's level content once and shares it between tabs and detail screens. */
export function ContentProvider({ children }) {
  const { token, user } = useAuth();
  const [state, setState] = useState({ data: null, loading: false, error: null });
  const levelCode = user?.role === 'STUDENT' ? user.level?.code : null;

  const refresh = useCallback(async () => {
    if (!levelCode) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(`/content/level/${levelCode}`, { token });
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [levelCode, token]);

  /** Applies a local change to one course (likes, comment count) without refetching everything. */
  const patchCourse = useCallback((id, changes) => {
    setState((s) => s.data && {
      ...s,
      data: { ...s.data, courses: s.data.courses.map((c) => (c.id === id ? { ...c, ...changes(c) } : c)) },
    });
  }, []);

  useEffect(() => {
    if (levelCode) refresh();
    else setState({ data: null, loading: false, error: null });
  }, [levelCode, refresh]);

  return <ContentContext.Provider value={{ ...state, refresh, patchCourse }}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext);
