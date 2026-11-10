import { api } from './api';

/**
 * Browsers block window.open after an await (no longer a direct click), so the tab is
 * opened immediately and pointed at the signed URL once the API answers.
 */
export async function openPdf(path, token) {
  const tab = window.open('', '_blank');
  try {
    const { url } = await api(path, { token });
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    window.alert(`Erreur\n\n${err.message}`);
  }
}
