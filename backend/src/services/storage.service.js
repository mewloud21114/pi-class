'use strict';

const crypto = require('crypto');
const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const { s3 } = require('../utils/s3');

const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const PDF_TYPES = { 'application/pdf': 'pdf' };

/** What each upload slot accepts and where it lands in the bucket. */
const UPLOAD_KINDS = {
  COURSE_VIDEO:   { prefix: 'courses/videos',      types: VIDEO_TYPES, maxBytes: () => env.MAX_VIDEO_UPLOAD_BYTES },
  SOLUTION_VIDEO: { prefix: 'exercises/solutions', types: VIDEO_TYPES, maxBytes: () => env.MAX_VIDEO_UPLOAD_BYTES },
  EXERCISE_PDF:   { prefix: 'exercises/pdf',       types: PDF_TYPES,   maxBytes: () => env.MAX_PDF_UPLOAD_BYTES },
  EXAM_PDF:       { prefix: 'exams/pdf',           types: PDF_TYPES,   maxBytes: () => env.MAX_PDF_UPLOAD_BYTES },
};

/**
 * Returns a presigned PUT URL. Content-Type and Content-Length are part of the
 * signature, so the client cannot upload a different type or a bigger file.
 * The object key is generated server-side; the client file name is never used in it.
 */
async function createUploadUrl({ kind, contentType, sizeBytes }) {
  const spec = UPLOAD_KINDS[kind];
  const ext = spec.types[contentType];
  if (!ext) {
    throw AppError.badRequest('UNSUPPORTED_CONTENT_TYPE', `${kind} accepts: ${Object.keys(spec.types).join(', ')}`);
  }
  if (sizeBytes > spec.maxBytes()) {
    throw AppError.badRequest('FILE_TOO_LARGE', `${kind} files must be at most ${spec.maxBytes()} bytes`);
  }

  const now = new Date();
  const objectKey = `${spec.prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, ContentType: contentType, ContentLength: sizeBytes }),
    // content-type must be listed explicitly to be part of the signature (content-length already is).
    { expiresIn: env.UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type']) },
  );

  return {
    objectKey,
    upload: {
      method: 'PUT',
      url: uploadUrl,
      headers: { 'Content-Type': contentType, 'Content-Length': String(sizeBytes) },
      expiresAt: new Date(now.getTime() + env.UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    },
  };
}

/** Refuses to reference an object that was never (successfully) uploaded. */
async function assertObjectExists(objectKey, field) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') {
      throw AppError.badRequest('FILE_NOT_UPLOADED', `No uploaded file found for ${field}`, { field, objectKey });
    }
    throw err;
  }
}

module.exports = { UPLOAD_KINDS, createUploadUrl, assertObjectExists };
