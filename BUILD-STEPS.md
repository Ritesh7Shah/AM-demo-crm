# BUILD-STEPS — get this CRM running against a demo backend

> **Read `CLAUDE.md` first.** The CRM app runs but shows an **empty table** until you create the Supabase
> backend and connect it. Follow these steps in order; verify each before moving on. Your Claude Code can
> read all of this — ask it to explain or help with any step.

> **Key fact:** the CRM and the dashboard share **ONE** Supabase project + **ONE** login. If you're
> building the full demo stack, use the SAME demo Supabase project you used for `Demo-AM-Dashboard`.

---

## STEP 1 — Use (or create) the demo Supabase project
- If you already made a demo project for `Demo-AM-Dashboard`, **use that same one** (the CRM edits the
  same `contacts` table the dashboard reads).
- Otherwise: supabase.com → New project. Then Settings → API → copy the **Project URL** + **anon** key.

**Verify:** you can open the project's SQL editor.

---

## STEP 2 — Create the CRM backend (migrations)
The CRM's DB was built by the files in `supabase/migrations/` (7 timestamp-named SQL files; also copied
into `REFERENCE_MATERIAL/sql-migrations/` for easy reading). Run them in order in the SQL editor. They
create:
- the `contacts` table + columns,
- RLS on `contacts` (authenticated select/insert/update/delete — the team needs full access),
- the dynamic add/rename/drop-column RPC functions (used by the ColumnManager UI),
- realtime (`REPLICA IDENTITY FULL` + publication).

```
Open each file in supabase/migrations/ in timestamp order → paste → run.
```

> **If you're building the FULL stack (CRM + dashboard):** also run the dashboard's `setup.sql`
> (from the `Demo-AM-Dashboard` repo) on this SAME project. That adds the **stat engine** (dashboard_stats
> / stats_daily + triggers) and the **ads tables**. Without it, CRM edits won't produce dashboard metrics.

**Verify:**
```sql
-- contacts exists with its columns
select column_name, data_type from information_schema.columns
  where table_name='contacts' and table_schema='public' order by ordinal_position;
-- RLS policies present (select/insert/update/delete for authenticated)
select policyname, cmd from pg_policies where tablename='contacts';
-- realtime on
select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='contacts';
```

---

## STEP 3 — Create a login user
Supabase → Authentication → Users → Add user (email + password). Same auth pool as the dashboard, so this
login works for both.

**Verify:** the user appears in Authentication → Users.

---

## STEP 4 — Connect + run the CRM
```bash
cp .env.example .env      # fill in the demo Project URL + anon key
npm install
npm run dev               # opens on port 8080 (see vite.config.ts)
```
Log in with the Step-3 user.

**Verify:** the CRM loads and shows the (empty) leads table.

---

## STEP 5 — Use it: add + edit a lead, watch it sync
1. Add a lead (AddRecordDialog) — give it a `contact_id` like `demo_001`, status `outreach_1`.
2. Edit cells: change `status`, toggle `backoffice`, set `live=true`.
3. Open the same CRM in a second tab → edits appear live (realtime).
4. If you also installed the dashboard's stat engine (Step 2 note), check the stats moved:
```sql
select metric_key, metric_value from boosty_dashboard_stats where metric_value <> 0;
```

**Verify:** edits persist (reload), show in realtime, and (if stat engine present) move the dashboard stats.
✅ That proves the CRM ↔ Supabase ↔ (stat engine) chain works end-to-end.

---

## STEP 6 — Try the dynamic column feature
Open the **ColumnManager** → add a new column (e.g. `notes`, text). It calls a DB RPC that runs
`ALTER TABLE contacts ADD COLUMN`. Refresh → the new column shows in the table.

**Verify:** `select column_name from information_schema.columns where table_name='contacts'` includes your
new column.

---

## Deploy (when it works locally)
Push to GitHub (private) → connect to Netlify/Vercel → build `npm run build`, publish `dist/` → set the two
`VITE_*` env vars in the host. Every push auto-rebuilds.

---

## Golden rules (from the real operation)
- **Verify before saying "done."**
- **Back up before destructive DB changes.**
- **Stat triggers stay SECURITY DEFINER** (or CRM edits fail with RLS errors — this is the #1 CRM gotcha).
- **CRM + dashboard share ONE Supabase project.**
- **Never commit real keys** (anon = public OK; service_role = never).

---

## How this fits with the dashboard
| | Demo-AM-CRM (this) | Demo-AM-Dashboard |
|---|---|---|
| Role | WRITES `contacts` (team edits leads) | READS the stats those edits generate |
| Stack | React + TS + Vite + shadcn/ui | plain HTML/JS + Chart.js |
| Backend | same Supabase project | same Supabase project |
| Auth | shared login | shared login |
Build both against the **same** demo Supabase project to see the full loop: edit a lead in the CRM → the
dashboard's numbers change.
