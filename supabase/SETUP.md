# Turning on accounts (one-time setup, about 20 minutes)

Accounts are optional and off until you do this. When they're on, a student can sign in with Google and get a
progress map, a status on every LeetCode problem, and notes pinned to a step, synced on every computer. After this
setup there is **no upkeep**: a daily job keeps the free database awake and restores it if it is ever paused.

Why it's built this way: `notes/design-decisions.md`, decision 7.

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free plan, no card) and create a project. Pick a region near
   your students and save the database password somewhere safe (you won't need it day to day).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and press **Run**. It creates the tables, the rules
   that let each student see only their own rows, `ping()` for the keep-alive, and `delete_me()` for "Delete my
   account". It's safe to run again after changes.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

## 2. Let students sign in with Google

1. In [Google Cloud Console](https://console.cloud.google.com): create a project → **APIs & Services → OAuth
   consent screen**. Choose *External*, fill in the app name and your email, and add only the default scopes
   (email, profile, openid). Then set the publishing status to **In production**. While it says *Testing*, only
   test users you list can sign in.
   - **Branding: don't upload a logo.** A logo means submitting the app for Google's verification review (it can
     take weeks); without one, the basic scopes need no review.
   - **Application home page:** your site's address. The privacy policy and terms of service links are optional.
   - **Authorized domains:** add your site's domain (e.g. `your-site.vercel.app`) and `<your-project-ref>.supabase.co`,
     where Google sends students back after they sign in.
   - Google's screen will say "continue to `<ref>.supabase.co`". That's normal on Supabase's free plan; showing your
     own domain needs its paid custom-domain add-on.
2. **Credentials → Create credentials → OAuth client ID → Web application.** Under *Authorized redirect URIs*, add
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase, **Authentication → Sign In / Providers → Google**: turn it on and paste the client ID and secret.
4. **Authentication → URL Configuration**: set **Site URL** to your site (e.g. `https://your-site.vercel.app`) and add
   `https://your-site.vercel.app/**` to **Redirect URLs**, so students return to the page they signed in from.

## 3. Connect the site

1. In `assets/js/core.js`, fill in:
   ```js
   DSA.ACCOUNT = { url: "https://<your-project-ref>.supabase.co", anonKey: "<anon public key>" };
   ```
   Both values are meant to be public. The database rules from step 1 are what protect students' data.
2. Run `node tools/stamp.mjs` (core.js changed), commit, and push.

## 4. The keep-alive (so nothing is ever manual)

Free Supabase projects pause after a week without database activity. `api/keepalive.js` runs once a day on Vercel
Cron (`vercel.json → crons`) and calls the database three times. If the project is paused anyway, it restores it
through Supabase's Management API.

1. In Supabase, **Account → Access Tokens**: create a token named `keepalive`.
2. In Vercel, **Settings → Environment Variables** (Production), add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_ANON_KEY` | the anon public key |
   | `SUPABASE_ACCESS_TOKEN` | the token from step 1 |
   | `CRON_SECRET` | any long random string (Vercel sends it, so only Vercel Cron can run the job) |

3. Redeploy. In Vercel, **Settings → Cron Jobs** lists `/api/keepalive`, and **Run** triggers it once by hand: the
   function's log should say `{"ok":true,"pings":3}`.
4. **Test the self-healing once:** in Supabase, **Project Settings → General → Pause project**. When it shows as
   paused, run the cron job again in Vercel. The log should say `restored: true`, and the project comes back within a
   few minutes. If it doesn't, the token can't restore projects: make a new one and update `SUPABASE_ACCESS_TOKEN`.

## Checking it works

Open the site, press **Sign in → Continue with Google**, mark a LeetCode problem *Solved*, pin a note to a step, then
sign in on another browser: both should be there, and the course page's **Your progress** box shows the module.

## Limits to know about

- Supabase free plan: 50,000 monthly active users and 500 MB of database. A note keeps at most about 24 KB of steps,
  and a student can keep 200 notes.
- Vercel Hobby runs the keep-alive once a day, at some point within the scheduled hour. That's plenty for a one-week
  limit.
- Free tiers can change their rules. Only Supabase's paid plan can never pause.
