'use strict';

require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('pi-class-api'),
  JWT_AUDIENCE: z.string().default('pi-class-mobile'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  // How students get video/PDF links:
  //   s3  (default) — the storage's own presigned GET URLs; the bucket stays private and checks them itself.
  //   cdn — HMAC-signed CDN URLs; ONLY safe if the CDN edge verifies the token (Bunny token auth, etc.).
  MEDIA_URL_MODE: z.enum(['s3', 'cdn']).default('s3'),
  MEDIA_CDN_BASE_URL: z.string().url().optional(),
  MEDIA_SIGNING_SECRET: z.string().min(32).optional(),
  MEDIA_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),          // PDFs
  // A player re-requests the same URL for every chunk, so a video link must outlive the lesson.
  MEDIA_VIDEO_URL_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(4 * 3600),

  // S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, DO Spaces, ...)
  S3_ENDPOINT: z.string().url().optional(),           // omit for AWS S3
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  MAX_VIDEO_UPLOAD_BYTES: z.coerce.number().int().positive().default(4 * 1024 ** 3),  // 4 GiB (single PUT limit is 5 GiB)
  MAX_PDF_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 ** 2),   // 50 MiB

  // Built website (mobile/ `npm run build:web`); served at / when the folder exists.
  WEB_DIST_DIR: z.string().default(require('path').resolve(__dirname, '../../../mobile/dist')),
});

const parsed = schema
  .superRefine((e, ctx) => {
    if (e.MEDIA_URL_MODE === 'cdn' && (!e.MEDIA_CDN_BASE_URL || !e.MEDIA_SIGNING_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['MEDIA_URL_MODE'], message: 'cdn mode needs MEDIA_CDN_BASE_URL and MEDIA_SIGNING_SECRET' });
    }
  })
  .safeParse(process.env);
if (!parsed.success) {
  // Fail fast: never boot with a missing or weak secret.
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = Object.freeze(parsed.data);
