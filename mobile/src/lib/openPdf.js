import { Alert } from './dialog';
import * as WebBrowser from 'expo-web-browser';
import { api } from './api';

/** Gets a signed URL for a PDF and opens it in the in-app browser. */
export async function openPdf(path, token) {
  try {
    const { url } = await api(path, { token });
    await WebBrowser.openBrowserAsync(url);
  } catch (err) {
    Alert.alert('Erreur', err.message);
  }
}
