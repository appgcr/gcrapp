# Staging (test) server — practice without touching real cases

The live app uses the live server (`gcrapp-api.onrender.com`) and the live database. Anything tested there
touches real cases and uses the live Gemini quota. A staging server is a second copy with its own empty
database and its own Gemini key, so new features can be tried safely before they go live.

## What is already in the code

- `ValuationBackend/.env.staging.example` — every setting a staging server needs.
- With `NODE_ENV=staging` the server **never sends anything out**: no emails to banks or customers, no phone
  pushes, no WhatsApp (`services/testServer.js`). Real banks can never get a practice report or invoice.
  (Only if you really want it: `ALLOW_OUTGOING_ON_STAGING=true`.)
- The app shows a yellow **"TEST SERVER · practice data only"** tag on every screen when it talks to a server
  that is not the live one (`ValuationApp/src/utils/testServerBadge.js`).

## One-time setup (about 30 minutes)

1. **Database** — in MongoDB Atlas, create a new database (or a free cluster) named e.g. `gcr_staging`.
   Copy its connection string. Never use the live database's connection string here.
2. **Gemini key** — in Google AI Studio create a second API key (a separate project is best) with a small
   budget alert, e.g. ₹500 / month. Tests then never use up the live app's quota.
3. **Server** — in Render, create a new Web Service from the same GitHub repository, root
   `ValuationBackend`, and add the settings from `.env.staging.example`:
   - `NODE_ENV=staging`
   - `MONGODB_URI=` the staging database from step 1
   - `GEMINI_ENABLED=true`, `GEMINI_API_KEY=` the test key from step 2
   - new random `JWT_SECRET` / `JWT_REFRESH_SECRET` / `ENCRYPTION_KEY` (not the live ones)
   - `EMAIL_ENABLED=false`, `FCM_ENABLED=false`
   - Branch to deploy: a test branch (e.g. `staging`), so the live branch is not touched.
4. **First login** — on the staging server run `node scripts/create-super-admin.js` (Render → Shell) to make a
   test Super Admin, then add a test branch, bank list and a few test engineers.
5. **App pointed at staging** — for a test build or the website preview, set
   `VITE_API_URL=https://<your-staging-name>.onrender.com` (and `VITE_API_BASE_URL` the same).
   On this computer: `VITE_API_URL=https://<staging>.onrender.com npm --prefix ValuationApp run dev`.

## Every new feature

1. Push it to the `staging` branch → Render deploys the staging server.
2. Try it in the app with the yellow TEST SERVER tag showing.
3. When it is right, merge into the live branch.

Use only practice data on staging (the QA sample reports, made-up names). Do not copy real customers' documents there.
