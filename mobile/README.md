# π-class — mobile app (iOS + Android)

React Native / Expo SDK 58, Expo Router. Talks to the API in `../backend`.

## Run on your phone

1. Start the API (`cd ../backend && npm start`).
2. Set the API address in `.env` — use the PC's Wi-Fi IP, not `localhost`:
   `EXPO_PUBLIC_API_URL=http://<your-pc-ip>:3000/api`
3. `npx expo start`
4. Install **Expo Go** on the phone (same Wi-Fi as the PC) and scan the QR code:
   Android → scan from the Expo Go app · iPhone → scan with the Camera app.

If the phone can't connect: `sudo ufw allow 3000,8081,59000/tcp`, or use `npx expo start --tunnel`
(the tunnel only covers the app bundle; the API must still be reachable from the phone).

## Website (PC)

The same code runs in a browser (React Native for Web).

```bash
npm run build:web        # -> dist/  (calls the API on the same origin: /api)
```

The API serves `dist/` itself, so students and admins just open `http://<server-ip>:3000` on a PC.
Rebuild after app changes; no API restart needed for a rebuild.

For live development in a browser: `npx expo start --web` (port 8081) — that origin must be in the API's
`CORS_ORIGINS`.

On web: the session token is kept in `localStorage`, dialogs use the browser's alert/confirm, PDFs open in a
new tab, and the layout is a centered column on wide screens. Browser uploads go straight to storage, so the
bucket needs a CORS rule allowing `PUT` from the site's origin (AWS S3 / R2 bucket CORS settings).

## When the PC's IP address changes

Update it in `.env` here (`EXPO_PUBLIC_API_URL`) and in `../backend/.env`
(`MEDIA_CDN_BASE_URL`, `S3_ENDPOINT`, `CORS_ORIGINS`), then restart the API and `npx expo start --clear`.

## Screens

- **Students**: login / sign-up (phone, password, level) → waiting for approval → tabs
  الدروس (video lessons) · التمارين (PDF + step-by-step solutions) · الامتحانات (exam archive by year) · profile.
- **Admins** (same app, admin login): pending sign-ups (activate / reject, filter by level),
  content list (publish / unpublish / delete), add a course / exercise / exam with file upload from the phone.

## Store builds

`npx eas-cli@latest build --platform android|ios` (needs an Expo account; iOS also needs an Apple developer account).
Production builds must use an **HTTPS** API URL — plain HTTP is only fine inside Expo Go for testing.
