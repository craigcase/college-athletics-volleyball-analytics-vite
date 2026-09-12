# Migration Notes — v0.6.0

v0.6.0 is the local-first reset after the Sites migration.

The key change is authorization, not UI: local API handlers no longer use the Supabase secret key. Each signed-in request is scoped with the user's JWT and the publishable key, and Supabase Row Level Security controls what that user can read or write.

This restores the intended development loop: build → GitHub → refresh StackBlitz → verify → guided test → next build.

A one-time Supabase migration, `202609120001_user_scoped_rls.sql`, is required before Program Setup can create/read data under the new user-scoped model.
