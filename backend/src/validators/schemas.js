'use strict';

const { z } = require('zod');
const { normalizeMauritanianPhone } = require('../utils/phone');

const LEVEL_CODES = ['4AS', '5C', '5D', '6C', '6D', '7C', '7D'];

const phone = z
  .string({ required_error: 'phone is required' })
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizeMauritanianPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid Mauritanian phone number' });
      return z.NEVER;
    }
    return normalized;
  });

// bcrypt only uses the first 72 bytes — reject longer input instead of silently truncating.
const password = z
  .string({ required_error: 'password is required' })
  .min(8, 'Password must be at least 8 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain letters and digits');

const levelCode = z
  .string({ required_error: 'levelCode is required' })
  .trim()
  .toUpperCase()
  .pipe(z.enum(LEVEL_CODES, { errorMap: () => ({ message: `levelCode must be one of ${LEVEL_CODES.join(', ')}` }) }));

const register = z.object({
  phone,
  password,
  levelCode,
  fullName: z.string().trim().min(2).max(120).optional(),
}).strict();

const login = z.object({
  phone,
  password: z.string().min(1).max(200),
}).strict();

const uuidParam = z.object({ id: z.string().uuid() });

const pendingUsersQuery = z.object({
  level: z.string().trim().toUpperCase().pipe(z.enum(LEVEL_CODES)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const statusChangeBody = z.object({
  reason: z.string().trim().max(300).optional(),
}).strict();

// Accept either the numeric id (3) or the code (6C).
const levelParam = z.object({
  levelId: z.string().trim().regex(/^(\d{1,4}|[0-9][A-Za-z]{1,2})$/, 'levelId must be a numeric id or a level code'),
});

const examFileQuery = z.object({
  file: z.enum(['paper', 'correction']).default('paper'),
});

const solutionStepParams = z.object({
  id: z.string().uuid(),
  step: z.coerce.number().int().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Admin content management
// ---------------------------------------------------------------------------
const VIDEO_PROVIDERS = ['S3', 'BUNNY', 'VIMEO', 'CLOUDFLARE'];

// Keys come from POST /uploads (or an existing provider id); no traversal, no leading slash.
const objectKey = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/, 'Invalid object key')
  .refine((v) => !v.includes('..') && !v.includes('//'), 'Invalid object key');

const subject = z.string().trim().toUpperCase().regex(/^[A-Z_]{2,40}$/, 'subject must be an upper-case code, e.g. MATH');
const optionalText = (max) => z.string().trim().min(1).max(max).nullable().optional();
const nonEmpty = (o) => Object.keys(o).length > 0;

const uploadRequest = z.object({
  kind: z.enum(['COURSE_VIDEO', 'SOLUTION_VIDEO', 'EXERCISE_PDF', 'EXAM_PDF']),
  contentType: z.string().trim().toLowerCase(),
  sizeBytes: z.number().int().positive(),
}).strict();

const courseFields = {
  levelCode,
  subject: subject.optional(),
  chapter: optionalText(150),
  title: z.string().trim().min(2).max(200),
  description: optionalText(5000),
  videoProvider: z.enum(VIDEO_PROVIDERS),
  videoRef: objectKey,
  durationSeconds: z.number().int().positive().nullable().optional(),
  thumbnailUrl: z.string().trim().url().startsWith('https://').max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isPublished: z.boolean().optional(),
};

const solutionStep = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TEXT'), body: z.string().trim().min(1).max(20000) }).strict(),
  z.object({ type: z.literal('VIDEO'), videoProvider: z.enum(VIDEO_PROVIDERS), videoRef: objectKey }).strict(),
]);

const exerciseFields = {
  levelCode,
  courseId: z.string().uuid().nullable().optional(),
  subject: subject.optional(),
  chapter: optionalText(150),
  title: z.string().trim().min(2).max(200),
  difficulty: z.number().int().min(1).max(5).nullable().optional(),
  pdfKey: objectKey,
  correctionPdfKey: objectKey.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isPublished: z.boolean().optional(),
  // Ordered steps; step numbers are assigned from array order. On PATCH, the list replaces all steps.
  solutions: z.array(solutionStep).max(50).optional(),
};

const examFields = {
  levelCode,
  examType: z.enum(['BAC', 'BEPC', 'CONCOURS', 'MOCK']).optional(),
  session: z.enum(['NORMALE', 'COMPLEMENTAIRE']).optional(),
  year: z.number().int().min(1960).max(new Date().getUTCFullYear() + 1),
  subject: subject.optional(),
  title: z.string().trim().min(2).max(200),
  paperPdfKey: objectKey,
  correctionPdfKey: objectKey.nullable().optional(),
  isPublished: z.boolean().optional(),
};

// Create = required fields as declared; update = every field optional, at least one present.
const createAndUpdate = (fields) => ({
  create: z.object(fields).strict(),
  update: z.object(fields).partial().strict().refine(nonEmpty, 'Provide at least one field to update'),
});

const contentListQuery = z.object({
  level: z.string().trim().toUpperCase().pipe(z.enum(LEVEL_CODES)).optional(),
  subject: subject.optional(),
  published: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  year: z.coerce.number().int().min(1960).max(2100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------
const commentBody = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(1000),
}).strict();

const commentsQuery = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const viewProgress = z.object({
  positionSeconds: z.number().min(0).max(86400),
  durationSeconds: z.number().positive().max(86400).optional(),
}).strict();

const statsQuery = z.object({
  level: z.string().trim().toUpperCase().pipe(z.enum(LEVEL_CODES)).optional(),
});

module.exports = {
  LEVEL_CODES,
  commentBody,
  commentsQuery,
  viewProgress,
  statsQuery,
  uploadRequest,
  course: createAndUpdate(courseFields),
  exercise: createAndUpdate(exerciseFields),
  exam: createAndUpdate(examFields),
  contentListQuery,
  register,
  login,
  uuidParam,
  pendingUsersQuery,
  statusChangeBody,
  levelParam,
  examFileQuery,
  solutionStepParams,
};
