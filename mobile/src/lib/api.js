import { Platform } from 'react-native';
import { putFile } from './putFile';

// The website build is served by the API itself, so it can call it on the same origin ('/api').
export const API_URL = (Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_API_URL) || process.env.EXPO_PUBLIC_API_URL;

// French messages for the error codes the API returns; anything else falls back to the server message.
const MESSAGES = {
  NETWORK: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
  INVALID_CREDENTIALS: 'Numéro de téléphone ou mot de passe incorrect.',
  ACCOUNT_PENDING: 'Votre compte est en attente de validation par un administrateur.',
  ACCOUNT_SUSPENDED: 'Votre compte a été suspendu.',
  ACCOUNT_REJECTED: 'Votre inscription a été refusée.',
  PHONE_ALREADY_REGISTERED: 'Ce numéro est déjà inscrit.',
  TOO_MANY_LOGIN_ATTEMPTS: 'Trop de tentatives. Réessayez dans 15 minutes.',
  TOO_MANY_REGISTRATIONS: "Trop d'inscriptions depuis ce réseau. Réessayez plus tard.",
  TOKEN_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
  INVALID_TOKEN: 'Votre session a expiré. Reconnectez-vous.',
  LEVEL_ACCESS_DENIED: "Ce contenu n'est pas disponible pour votre niveau.",
  CORRECTION_NOT_AVAILABLE: "Pas de corrigé disponible pour cet examen.",
  FILE_TOO_LARGE: 'Fichier trop volumineux.',
  UNSUPPORTED_CONTENT_TYPE: 'Type de fichier non accepté.',
  DUPLICATE_CONTENT: 'Cet examen existe déjà (même niveau, session, année et matière).',
  UPLOAD_FAILED: "L'envoi du fichier a échoué.",
  FILE_NOT_UPLOADED: "Le fichier n'a pas été reçu par le serveur. Réessayez.",
  TOO_MANY_COMMENTS: 'Vous commentez trop vite. Patientez une minute.',
  COMMENT_NOT_FOUND: 'Ce commentaire a déjà été supprimé.',
  COURSE_NOT_FOUND: "Ce cours n'est plus disponible.",
  LEVEL_CHANGE_BLOCKED: "Des exercices sont liés à ce cours : impossible de changer son niveau.",
  COURSE_LEVEL_MISMATCH: 'Le cours lié appartient à un autre niveau.',
};

export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(MESSAGES[code] || message || 'Une erreur est survenue.');
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Turns a VALIDATION_ERROR payload into one readable line. */
export function describeValidation(err) {
  const fields = err?.details?.fieldErrors;
  if (!fields) return err?.message;
  return Object.entries(fields).map(([f, msgs]) => `${f}: ${msgs[0]}`).join('\n') || err.message;
}

let unauthorizedHandler = null;
export const onUnauthorized = (fn) => { unauthorizedHandler = fn; };

export async function api(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error || {};
    const err = new ApiError(e.code || 'HTTP_' + res.status, e.message, res.status, e.details);
    // A revoked/expired session or a suspended account: drop the session everywhere.
    if (token && (res.status === 401 || e.code?.startsWith('ACCOUNT_'))) unauthorizedHandler?.(err);
    throw err;
  }
  return data;
}

const EXT_TYPES = { pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

/**
 * Upload flow: ask the API for a presigned slot, then PUT the file straight to storage.
 * Returns the object key to reference when creating the content.
 */
export async function uploadFile(token, kind, asset) {
  const contentType = asset.mimeType || EXT_TYPES[asset.name?.split('.').pop()?.toLowerCase()] || 'application/octet-stream';

  const prepared = (url) => putFile(url, asset, contentType);
  const sizeBytes = prepared(null).size;
  const slot = await api('/admin/uploads', { method: 'POST', token, body: { kind, contentType, sizeBytes } });

  let res;
  try {
    res = await prepared(slot.upload.url).send();
  } catch {
    throw new ApiError('UPLOAD_FAILED');
  }
  if (!res.ok) throw new ApiError('UPLOAD_FAILED', null, res.status);
  return slot.objectKey;
}
