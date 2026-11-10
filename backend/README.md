# π-class API

Backend for the π-class mobile app (Mauritanian secondary students). Node.js 20+ · Express · PostgreSQL 14+.

## Setup

```bash
npm install
cp .env.example .env            # set JWT_SECRET, MEDIA_SIGNING_SECRET and the S3_* storage settings
npm run db:init                 # db/schema.sql + db/seed.sql (education levels)
ADMIN_PHONE=22000001 ADMIN_PASSWORD='a-long-password' npm run create-admin
npm start
```

## Account workflow

`register` → status `PENDING` → admin `activate` → `ACTIVE` → `login` returns a JWT.
`suspend` / `reject` bump `token_version`, so tokens already issued stop working immediately.
Every change is written to `account_status_history`.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{ phone, password, levelCode, fullName? }` → 201, status `PENDING` |
| POST | `/api/auth/login` | — | `{ phone, password }` → `{ token, user }`. 403 `ACCOUNT_PENDING` / `ACCOUNT_SUSPENDED` / `ACCOUNT_REJECTED` |
| GET | `/api/auth/me` | active user | |
| GET | `/api/admin/users/pending?level=7C&page=1&pageSize=20` | admin | oldest first, paginated |
| PATCH | `/api/admin/users/:id/activate` | admin | idempotent, `{ reason? }` |
| PATCH | `/api/admin/users/:id/suspend` · `/reject` | admin | revokes tokens |
| GET | `/api/content/level/:levelId` | active user | `levelId` = numeric id or code (`7C`). Students: own level only |
| POST | `/api/content/courses/:id/playback` | active user | short-lived signed video URL |
| GET | `/api/content/exercises/:id/pdf?file=paper\|correction` | active user | signed PDF URL (sheet or its correction) |
| POST | `/api/content/exercises/:id/solutions/:step/playback` | active user | signed video URL for a solution step |
| GET | `/api/content/exams/:id/file?file=paper\|correction` | active user | signed PDF URL |

### Admin content management (admin token required)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/admin/uploads` | `{ kind, contentType, sizeBytes }` → `{ objectKey, upload: { method, url, headers, expiresAt } }` |
| GET · POST | `/api/admin/courses` | list (`?level=&subject=&published=&page=&pageSize=`) · create |
| GET · PATCH · DELETE | `/api/admin/courses/:id` | PATCH is partial |
| GET · POST | `/api/admin/exercises` | create accepts `solutions: [{type:"TEXT",body} \| {type:"VIDEO",videoProvider,videoRef}]` |
| GET · PATCH · DELETE | `/api/admin/exercises/:id` | sending `solutions` on PATCH replaces every step |
| GET · POST | `/api/admin/exams` | list also takes `?year=` |
| GET · PATCH · DELETE | `/api/admin/exams/:id` | `correctionPdfKey: null` removes the correction |

**Uploading a file** — files go straight to storage, never through the API:

1. `POST /api/admin/uploads` with `kind` = `COURSE_VIDEO`, `SOLUTION_VIDEO`, `EXERCISE_PDF` or `EXAM_PDF`.
   Videos: `video/mp4`, `video/webm`, `video/quicktime` (≤ `MAX_VIDEO_UPLOAD_BYTES`); PDFs: `application/pdf` (≤ `MAX_PDF_UPLOAD_BYTES`).
2. `PUT` the file to `upload.url` with exactly `upload.headers` — the type and size are part of the signature, so anything else is refused.
3. Create the item using `objectKey` as `videoRef` / `pdfKey` / `paperPdfKey` / `correctionPdfKey`. The API checks the object exists before saving.

Items are created as drafts (`isPublished: false`) and stay invisible to students until published.
Videos hosted elsewhere (`videoProvider` `BUNNY`, `VIMEO`, `CLOUDFLARE`) take the provider's video id as `videoRef` and skip the storage check.

**Integrity rules**: an exercise's linked course must be on the same level; a course with exercises can't change level;
the same exam (level + type + session + year + subject) can't be created twice (409); deleting a course keeps its exercises and unlinks them.
Deleting an item does not delete its file from storage — configure a bucket lifecycle rule or clean up separately.

Errors always look like `{ "error": { "code": "...", "message": "...", "details"? } }` — the app should switch on `code`.

## Security notes

- bcrypt (cost 12 by default); passwords > 72 bytes are rejected rather than silently truncated.
- Login does a dummy bcrypt compare for unknown numbers, so timing doesn't reveal who is registered; the account status is only disclosed after the password is verified.
- JWT: HS256 pinned, issuer/audience checked; the user is reloaded on every request (status + `token_version`).
- `role` and `status` are never read from the request body (`.strict()` schemas reject unknown fields).
- Raw storage keys (`video_ref`, `pdf_key`, …) are never returned; clients get HMAC-signed URLs, bound to the user id, that expire after `MEDIA_URL_TTL_SECONDS`. Configure the same secret on the CDN edge (Bunny token auth, Cloudflare Worker, Nginx `secure_link`, …).
- Rate limits: 10 failed logins / 15 min, 5 registrations / hour, 300 req/min per IP.
- Phone numbers normalised to E.164 (`+222` + 8 digits starting with 2, 3 or 4).
