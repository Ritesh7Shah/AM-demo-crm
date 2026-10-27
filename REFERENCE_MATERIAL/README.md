# REFERENCE_MATERIAL — Demo AM CRM

All the reference docs and SQL for building/understanding this CRM, in one place. Sanitized (no real keys).
Follow **`../BUILD-STEPS.md`** for the order; open these when you need detail.

| File / folder | What it is | Use it for |
|---|---|---|
| `CRM-Migration-Tracker.md` | The tracker doc describing how the CRM backend was built (tables, enums, edge functions, realtime, what stays vs changes per brand) | understanding the CRM's DB + architecture |
| `sql-migrations/*.sql` | Copies of the 7 Supabase migrations (also in `../supabase/migrations/`) that build the CRM backend — the `contacts` table, RLS, dynamic-column RPCs, realtime | BUILD-STEPS Step 2 — run these in timestamp order |
| `blueprint/01-Supabase-Backend-Blueprint.md` | **The a-to-z backend blueprint** (shared with the dashboard): tables, the stat engine, triggers, RLS, the SECURITY DEFINER gotcha, ads schema | deep reference for the whole backend |
| `blueprint/00-README.md` | Overview of the new-project blueprint kit | orientation |

> The CRM and the dashboard share ONE Supabase project. The backend blueprint here covers BOTH sides —
> the CRM writes `contacts`, the dashboard reads the stats those edits generate. Build both demos against
> the same demo Supabase project to see the full loop.

> Anything with `<PLACEHOLDER>` / `<YOUR_...>` = fill in your own value. Never commit real keys.
