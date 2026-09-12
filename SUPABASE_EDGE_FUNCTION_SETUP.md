# Supabase Edge Function Setup — Public Source Fetch Relay

This is a one-time setup for StackBlitz development. The application remains on the normal workflow: update GitHub, refresh StackBlitz, test there. The Edge Function only fetches public roster, schedule, box-score, and XML URLs that StackBlitz WebContainers cannot fetch reliably themselves.

## Function name

`fetch-public-source`

## Dashboard deployment

1. Open the existing Supabase project.
2. Open **Edge Functions** in the left navigation.
3. Click **Deploy a new function**.
4. Choose **Via Editor**.
5. Name the function exactly `fetch-public-source`.
6. Replace the template code with the full contents of `supabase/functions/fetch-public-source/index.ts` from this repository.
7. Click **Deploy function** and wait for the deployment to report success.

No custom secrets are required. Supabase automatically provides the project environment required by `@supabase/server`, and the function requires a signed-in Supabase user (`auth: 'user'`).

## What the function does

- Accepts only authenticated POST requests.
- Accepts a JSON body shaped like `{ "url": "https://...", "maxBytes": 26214400 }`.
- Rejects non-HTTP(S), credential-bearing, localhost, and private-IP destinations.
- Follows at most five validated redirects.
- Caps fetched sources at the V1 25 MB evidence limit.
- Returns the exact fetched bytes plus source metadata headers.
- Does not use the Supabase secret key and does not read or write the database.

## App behavior

During StackBlitz local development (`SUPABASE_DB_ACCESS_MODE=user-scoped-only`), URL imports automatically call:

`<SUPABASE_URL>/functions/v1/fetch-public-source`

using the current signed-in user's access token and the existing publishable key. On a conventional server runtime, imports continue to fetch the source directly.
