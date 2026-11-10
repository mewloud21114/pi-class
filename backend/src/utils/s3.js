'use strict';

const { S3Client } = require('@aws-sdk/client-s3');
const env = require('../config/env');

/** Shared client for uploads, existence checks and presigned downloads. */
const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  // Otherwise the SDK bakes a checksum of an *empty* body into presigned PUT URLs and real
  // S3 / R2 reject the actual upload. Checksums stay on where an operation requires them.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

/**
 * Origins browsers fetch storage URLs from (for the Content-Security-Policy). Without
 * path-style addressing the SDK puts the bucket in the host name (bucket.<endpoint>).
 */
function storageOrigins() {
  if (!env.S3_ENDPOINT) return ['https://*.amazonaws.com'];
  const u = new URL(env.S3_ENDPOINT);
  return env.S3_FORCE_PATH_STYLE ? [u.origin] : [u.origin, `${u.protocol}//*.${u.host}`];
}

module.exports = { s3, storageOrigins };
