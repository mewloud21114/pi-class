import * as SecureStore from 'expo-secure-store';

// Phones: the session token lives in the iOS Keychain / Android Keystore.
const KEY = 'piclass.token';
export const getToken = () => SecureStore.getItemAsync(KEY).catch(() => null);
export const setToken = (t) => SecureStore.setItemAsync(KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(KEY).catch(() => {});
