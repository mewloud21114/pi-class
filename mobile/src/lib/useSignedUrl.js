import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

/** Fetches a short-lived signed media URL from the API ({ url, expiresAt, viewId? }). */
export function useSignedUrl(path, method = 'POST') {
  const { token } = useAuth();
  const [state, setState] = useState({ url: null, viewId: null, error: null });

  useEffect(() => {
    let alive = true;
    setState({ url: null, viewId: null, error: null });
    api(path, { method, token })
      .then((r) => alive && setState({ url: r.url, viewId: r.viewId ?? null, error: null }))
      .catch((error) => alive && setState({ url: null, viewId: null, error }));
    return () => { alive = false; };
  }, [path, method, token]);

  return state;
}
