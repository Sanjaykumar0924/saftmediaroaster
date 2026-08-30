# Deploying outside Lovable (Vercel + independent Supabase)

This app is a TanStack Start (React 19 + Vite 7) project. Nothing in the runtime
requires Lovable hosting — all backend access goes through Supabase using
environment variables.

## 1. Environment variables

Copy `.env.example` to `.env` locally, and add the same keys in
**Vercel → Project Settings → Environment Variables** (Production + Preview):

| Variable | Scope | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | Supabase anon / publishable key |
| `VITE_SUPABASE_PROJECT_ID` | client | project ref |
| `SUPABASE_URL` | server | same URL |
| `SUPABASE_PUBLISHABLE_KEY` | server | same anon key (used to validate user bearer tokens) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | service role key — **server only, never `VITE_`** |

The service role key is only read inside `createServerFn` handlers via
`src/integrations/supabase/client.server.ts`, which is excluded from client
bundles by the `.server.ts` extension, so it never reaches the browser.

## 2. Build / deploy on Vercel

1. Push the repository to GitHub and import it in Vercel.
2. Framework preset: **Other**; Build command `npm run build`; Install `npm install`.
3. Nitro auto-detects Vercel and emits `.vercel/output` (Build Output API v3).
   If your CI does not expose Vercel's env markers, set `NITRO_PRESET=vercel`.
4. Add the env vars above, then deploy.

No Lovable services are contacted at runtime.

## 3. Independent Supabase project

Create a new Supabase project, then apply the migrations in
`supabase/migrations/` **in filename order** (they are the full portable schema:
tables, PKs/FKs, unique constraints, defaults, timestamps, triggers, functions,
grants and RLS policies for all 19 tables):

```bash
supabase link --project-ref <new-project-ref>
supabase db push          # applies supabase/migrations in order
```

Or paste each file, oldest first, into the SQL editor.

Also configure in the new project:
- **Auth → Providers**: enable Email, and Google if you use Gmail sign-in
  (add `https://<your-domain>/` and the Vercel URL as redirect URLs).
- **Auth → Policies**: leaked-password protection is currently off (relaxed
  member passwords) — keep or change to taste.
- **Storage**: create a private bucket named `avatars`.
- **Realtime**: enable replication for `messages`, `roster`, `availability`,
  `notifications`, `checklist_entries` (the app subscribes to these).

## 4. Moving the existing data (no data loss)

The schema migrations create empty tables; data is copied separately.

1. In Lovable: **Cloud → Advanced settings → Export data** to download the
   current database contents (includes `auth.users`, profiles, availability,
   roster, activity logs, notifications, checklists, teams, user roles).
2. In the new Supabase project, apply the schema first (step 3).
3. Import the exported rows in this order so foreign keys resolve:
   `auth.users` → `teams` → `profiles` → `user_roles` → `inventory_items` →
   `mpc_services` / `extra_services` → `roster` → `availability` /
   `extra_service_availability` → `attendance` → `checklist_entries` /
   `checklist_reports` / `checklist_shares` → `messages` → `announcements` →
   `notifications` → `activity_logs` → `app_settings` / `chat_settings`.

   For CSV per table: Supabase SQL editor → `COPY`/table import, or
   `psql "$NEW_DB_URL" -c "\copy public.profiles from 'profiles.csv' csv header"`.

Passwords survive because `auth.users` rows carry their `encrypted_password`;
users keep their existing email/Gmail logins. Nothing is deleted from the
current database by this process — you can keep running on Lovable until the
new project is verified.

## 5. Local development

```bash
npm install
npm run dev     # http://localhost:8080
npm run build   # production build
```
