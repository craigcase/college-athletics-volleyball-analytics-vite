# Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/202609090001_initial.sql`.
3. In StackBlitz encrypted environment variables add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. In Netlify environment variables add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_EVIDENCE_BUCKET=volleyball-evidence`.
5. Enable email/password auth in Supabase Authentication.
6. Deploy through Netlify. Privileged roster/schedule/match imports run only through Netlify Functions using the server-only secret key.
