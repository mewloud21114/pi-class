'use strict';

const crypto = require('crypto');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const { s3, storageOrigins } = require('./s3');

/**
 * cdn mode: tamper-proof CDN URL. Token = base64url(HMAC-SHA256(secret, path + expires + userId)).
 * The CDN edge must recompute it and reject expired/forged links, otherwise this protects nothing.
 */
function signCdnUrl(objectKey, userId, expires) {
  const path = '/' + objectKey.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  const token = crypto
    .createHmac('sha256', env.MEDIA_SIGNING_SECRET)
    .update(`${path}${expires}${userId}`)
    .digest('base64url');
  // Keep any path prefix of the base URL (e.g. https://cdn.example.mr/media); `new URL('/x', base)` would drop it.
  const url = new URL(env.MEDIA_CDN_BASE_URL);
  url.pathname = url.pathname.replace(/\/+$/, '') + path;
  url.searchParams.set('token', token);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('uid', userId);
  return url.toString();
}

/**
 * Short-lived link to a private media object: { url, expiresAt }.
 * kind 'video' gets the longer video lifetime, everything else the PDF one.
 */
async function signMediaUrl(objectKey, userId, { kind = 'file' } = {}) {
  const ttl = kind === 'video' ? env.MEDIA_VIDEO_URL_TTL_SECONDS : env.MEDIA_URL_TTL_SECONDS;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const url = env.MEDIA_URL_MODE === 'cdn'
    ? signCdnUrl(objectKey, userId, expires)
    : await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }), { expiresIn: ttl });
  return { url, expiresAt: new Date(expires * 1000).toISOString() };
}

/** Origins the media URLs point to (for the Content-Security-Policy). */
function mediaOrigins() {
  if (env.MEDIA_URL_MODE === 'cdn') return [new URL(env.MEDIA_CDN_BASE_URL).origin];
  return storageOrigins();
}

module.exports = { signMediaUrl, mediaOrigins };
