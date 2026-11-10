import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

/** PUT a picked file to a presigned URL (phones: stream it from disk). */
export function putFile(url, asset, contentType) {
  const file = new File(asset.uri);
  return { size: asset.size || file.size, send: () => expoFetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file }) };
}
