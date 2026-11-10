# π-class

Educational platform for Mauritanian secondary-school students (4AS, 5C, 5D, 6C, 6D, 7C, 7D):
video lessons (الدروس), exercise sheets with corrections (التمارين) and national exam archives (الامتحانات).

- **Students** sign up with their phone number and level; an administrator approves the account before any content is visible.
  They watch courses, open exercise and exam PDFs, like and comment on lessons.
- **Administrators** approve sign-ups, add and edit courses / exercises / exams (with file upload), moderate comments,
  and see viewing statistics per course (views, students, progress, completions).

One codebase runs on **Android, iOS and the web**.

## Repository layout

| Folder | What it is |
|---|---|
| [`backend/`](backend) | REST API — Node.js, Express, PostgreSQL. Also serves the website. See [backend/README.md](backend/README.md). |
| [`mobile/`](mobile) | App — React Native / Expo (Expo Router). Builds the iOS / Android apps and the website. See [mobile/README.md](mobile/README.md). |
| [`backend/deploy/`](backend/deploy) | Production stack: Docker Compose with PostgreSQL, the API and Caddy (automatic HTTPS). |

Videos and PDFs live in S3-compatible object storage (e.g. Cloudflare R2). The bucket stays private: the API hands out
short-lived signed links, and uploads go straight from the admin's device to storage.

## Local development

Requirements: Node.js 20+, Docker (for PostgreSQL and a local S3 server).

```bash
# 1. Database and local storage
docker run -d --name piclass-pg -e POSTGRES_USER=piclass -e POSTGRES_PASSWORD=piclass -e POSTGRES_DB=piclass -p 55432:5432 postgres:16-alpine
docker run -d --name piclass-s3 -p 59000:9090 -e COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS=pi-class-media adobe/s3mock

# 2. API (fill backend/.env from backend/.env.example first)
cd backend && npm install && npm run db:migrate
ADMIN_PHONE=22000001 ADMIN_PASSWORD='choose-a-long-password' npm run create-admin
npm start

# 3. App (fill mobile/.env from mobile/.env.example), then scan the QR code with Expo Go
cd ../mobile && npm install && npx expo start

# Website: build once, the API serves it at http://localhost:3000
npm run build:web
```

## Security notes

- Passwords hashed with bcrypt; JWT sessions revoked immediately when an account is suspended.
- Students only reach content of their own level; all input validated server-side.
- Media links are presigned by the storage and expire (PDFs 15 min, videos 4 h); upload links are bound to the file type and size.
- No secrets in this repository: every `.env` file is git-ignored — copy the `.env.example` files.
