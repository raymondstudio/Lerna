# EduAgent AI — Project-Scoped Agent Rules

## Database Migrations & Normalization
1. **Zero Destructive Changes**: Do not run `DROP COLUMN` or `DROP TABLE` in any SQL migrations unless the column/table has been explicitly deprecated for at least one sprint.
2. **Backward Compatibility**: Always keep RPC functions aligned using `LEFT JOIN` and `COALESCE` logic on join keys to prevent filtering out users who have not completed onboarding.
3. **Trigger Coherence**: Whenever a new auth account is created or modified, ensure the triggers backfill `profiles`, `user_preferences`, `notification_preferences`, `subscriptions`, and `user_roles` atomically.

## Architecture Guidelines
1. **No Direct Client DB Queries**: No React components should query Supabase directly using client-side `supabase.from(...)`. All queries must route through Next.js API endpoints, which invoke the Repository/Service Layer.
2. **Centralized Repository Pattern**: Keep all direct Supabase queries inside `src/lib/repositories/` to preserve a clean single interface for database operations.
3. **No Mock Data / Placeholders**: Never return dummy stats or fallback KPI counters. Failures must return descriptive error payloads and display warnings in the UI.
