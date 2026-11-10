/** PUT a picked file to a presigned URL (browser: the picker gives us a real File). */
export function putFile(url, asset, contentType) {
  return { size: asset.size || asset.file?.size, send: () => fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: asset.file }) };
}
