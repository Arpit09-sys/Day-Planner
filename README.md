# Day Planner

A calm, responsive daily planner for planning, focused work, reflection, and secure cross-device sync.

## What it does

- Create, edit, complete, and organize daily tasks.
- Choose an intentional focus session when you want one; focus mode never opens automatically on startup.
- Use a light or dark theme with a responsive mobile layout.
- Create a secure sync account with a username and private sync code, then use those same details on a phone and laptop.
- Store tasks, plans, focus sessions, and momentum in MongoDB.
- Opt into a single daily email reminder at a chosen local time.
- Export or permanently delete account data.

## Run locally

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in `MONGODB_URI`. For secure account syncing outside local development, also set a long `AUTH_SECRET`.

3. Start the app.

   ```bash
   npm run dev
   ```

4. Visit `http://localhost:3000`.

## Syncing a phone and laptop

1. On the first device, finish onboarding and choose **Create account**.
2. Pick a unique username and a private sync code of at least six characters.
3. On the second device, choose **Sign in** and enter the same username and sync code.

The username is not the security credential; the sync code protects the account. Do not share it.

## Email reminders

1. Configure SMTP and `CRON_SECRET` in the deployment environment. Gmail requires an [App Password](https://support.google.com/accounts/answer/185833), not a normal Gmail password.
2. Deploy the production app.
3. In **Settings & Privacy**, enable Email Reminders, enter the email address where reminders should arrive, choose a time, and save.
4. Use **Send Test Notification** to verify delivery.

The scheduler evaluates each user’s configured timezone and sends only once per date/time slot. The bundled `vercel.json` runs the reminder check every five minutes. Vercel Hobby projects allow only one cron invocation per day, so a five-minute schedule requires a non-Hobby Vercel plan or another cron service that calls `GET /api/notifications/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`. See Vercel’s [Cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Deployment environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `AUTH_SECRET` | Yes in production | Signs secure sync sessions |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | For email | Sends reminder emails |
| `CRON_SECRET` | For scheduled email | Secures cron requests |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For browser push | Enables web-push notifications |

Never commit `.env` or sync/email secrets.

## Project structure

```text
index.html          App shell and accessible modals
style.css           Theme, responsive layout, and interactions
script.js           Client state, offline queue, sync, and UI behavior
server.js           Express app and Mongo connection
lib/auth.js         Sync-code hashing and signed session helpers
models/             MongoDB schemas
routes/             Authenticated planner, reminder, and privacy APIs
```
