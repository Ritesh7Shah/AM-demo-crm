# CLAUDE.md — Demo AM CRM (training project)

> **You are Claude Code opened inside the DEMO CRM project.** This is a training replica of a real
> client CRM (based on the "Boosty" brand, sanitized — no real keys, no real data). Its job: teach a
> new developer how our CRM is built, what data it edits, and how it connects to the same Supabase
> backend the dashboard reads. Read this whole file before doing substantive work.
>
> **Building it? → follow `BUILD-STEPS.md`.** The app runs but shows an empty table until you create the
> Supabase backend and connect it.
>
> **All reference docs + SQL are in `REFERENCE_MATERIAL/`** (the migration tracker, the migrations, and the
> a-to-z backend blueprint). Open it whenever you need detail.

---

## 0. TL;DR — what this project is
An internal **CRM** (lead-management tool) for a client brand. The team uses it to work leads —
edit status, assign to bot/human, flag backoffice, record deposits (FTD), etc. It's a **spreadsheet-style
editable table** over a Supabase `contacts` table, with realtime sync.
- **Stack:** **React + TypeScript + Vite + shadcn/ui + Tailwind CSS**. Data layer: **Supabase** (Postgres).
  (Origin note: this codebase started from a Lovable template — hence `lovable-tagger` in `vite.config.ts`
  and the shadcn/ui setup — but it is now developed and maintained in Claude Code. It is NOT a Lovable
  project you edit on lovable.dev; treat it as a normal React/Vite app.)
- **It shares ONE Supabase project + ONE auth login with the dashboard.** The CRM WRITES the `contacts`
  table (team edits); the dashboard READS the stats those edits generate (via triggers).
- Deploy: any static host (Netlify/Vercel). `npm run build` → `dist/`.

---

## 1. Run it locally
```bash
npm install
cp .env.example .env      # then fill in your demo Supabase URL + anon key
npm run dev               # Vite dev server (port 8080 — see vite.config.ts)
```
**Keys needed** (`.env`, see `.env.example`):
- `VITE_SUPABASE_URL` — your demo Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` — the **anon** (public) key. NOT service_role.
Read in `src/integrations/supabase/client.ts` via `import.meta.env.VITE_*`.

---

## 2. The codebase (what's where)
```
src/
  main.tsx                      app entry
  pages/
    LoginPage.tsx               Supabase Auth login
    ResetPasswordPage.tsx       password reset
    BoostyPage.tsx / Index.tsx  the main CRM screen (the table lives here)
    NotFound.tsx
  components/
    crm/
      CRMTable.tsx              ⭐ the editable spreadsheet table (the core UI)
      CellRenderer.tsx         renders a cell by column type
      CellEditor.tsx           inline editing of a cell
      ColumnHeaderCell.tsx     column headers (sort/rename)
      ColumnManager.tsx        add / rename / drop columns (calls DB RPCs)
      AddRecordDialog.tsx      add a new lead
      AddRowDialog.tsx         add a row
      FilterBar.tsx            filter/search the leads
      BulkSelectionBar.tsx     multi-select actions
      DeleteConfirmDialog.tsx  delete confirmation
      SyncStatusBadge.tsx      shows realtime connection state
    ui/                        shadcn/ui primitives (buttons, dialogs, etc.)
  hooks/
    useAuth.ts                 session/login state
    useBoosty.ts               top-level CRM state wiring
    useBoostyData.ts          ⭐ reads/writes contacts + realtime subscription
    useBoostySchema.ts         reads the live column list from the DB
  lib/
    columns.ts                ⭐ column types: which columns are enum/date/int/readonly + the enum values
    boostySchema.ts            schema helpers
    agentFlow.ts               assignment / agent-handling logic
    columns.ts / utils.ts
  store/
    crmStore.ts / useCRMStore.ts   client-side state (Zustand-style store)
  integrations/supabase/
    client.ts                 ⭐ creates the Supabase client from env vars
    types.ts                   generated DB types
supabase/migrations/           ⭐ the DB history — 7 SQL migrations that built the backend
```

---

## 3. The data model (shared with the dashboard)
The CRM edits the **`contacts`** table — the same table the dashboard's stat triggers watch. One row per
lead. The CRM shows these columns (see `src/lib/columns.ts` for the authoritative list + types):
| Column | Type | Notes |
|---|---|---|
| `id` | integer | readonly, PK |
| `name` | text | lead name |
| `contact_id` | text | Telegram id (readonly); also links to `ad_joiners.telegram_id` |
| `status` | enum | `new, outreach_1..5, live, quit` |
| `assigned_to` | enum | `bot, Human_AccountExists, Human_DepositMade, Human_General, Human_Manually, Human_Trash` |
| `backoffice` | bool | flagged for backoffice |
| `live` | bool | deposited/converted — **drives the FTD flag** on `ad_joiners` (via a DB trigger) |
| `first_contact_date`, `next_contact_date`, `ftd_date_mentioned`, `ftd_date_actual` | date | |
| `created_at`, `updated_at` | date | readonly, auto |

> **Editing a lead here fires the dashboard's stat triggers.** e.g. changing `status` moves the
> `status_*` counters; flipping `live` sets the FTD flag on the matching `ad_joiners` row. That's why the
> stat trigger functions must be **SECURITY DEFINER** — the CRM writes as an authenticated user, and the
> trigger's read-modify-write would otherwise be blocked by RLS. (This exact bug once broke the live CRM;
> see the dashboard project + the operation KNOWLEDGE-BASE §8.)

### Dynamic columns
The CRM can **add/rename/drop columns at runtime** (`ColumnManager.tsx`). This works via three SQL RPC
functions the migrations create (each wraps a dynamic `ALTER TABLE`):
| RPC (called via `supabase.rpc(...)`) | Args | Does |
|---|---|---|
| `add_column` | `table_name, column_name, column_type` | `ALTER TABLE … ADD COLUMN IF NOT EXISTS` |
| `rename_column` | `table_name, old_column_name, new_column_name` | `ALTER TABLE … RENAME COLUMN` |
| `drop_column` | `table_name, column_name` | `ALTER TABLE … DROP COLUMN IF EXISTS` |
So the `contacts` table's shape can grow from the UI. **These functions MUST exist** (they're in the
migrations) or the ColumnManager breaks. The frontend reads the live column list via `useBoostySchema.ts`
(querying `information_schema.columns`), so new columns appear automatically after an add.

### Realtime
`useBoostyData.ts` subscribes to a Supabase realtime channel on `contacts`, so edits by one team member
show up live for everyone. (`contacts` has `REPLICA IDENTITY FULL` + is in the `supabase_realtime`
publication — set in the migrations.)

---

## 4. The Supabase backend (how to recreate it)
Run the **`supabase/migrations/*.sql`** files in order (they're timestamp-named) on a fresh demo project.
They build:
1. The `contacts` table + its columns/enums.
2. RLS on `contacts` — authenticated users can select/insert/update/delete (the team needs full CRM access).
3. The dynamic-column RPC functions (add/rename/drop column from the UI).
4. Realtime (`REPLICA IDENTITY FULL` + publication).

> **Important:** the CRM shares its DB with the dashboard. The **stat engine** (dashboard_stats /
> stats_daily tables + `*_increment_stat` + the `handle_contact_*` triggers) lives on the SAME database.
> If you're building a full stack, run the **dashboard's `setup.sql`** too (it creates the stat engine +
> ads tables), OR the CRM edits won't produce dashboard metrics. In the real op both apps point at one
> Supabase project. See `BUILD-STEPS.md`.

---

## 5. Auth (shared with the dashboard)
`useAuth.ts` + `LoginPage.tsx` use Supabase Auth. The CRM and dashboard **share one auth pool** — a user
logs into either with the same credentials. RBAC (letting some users use the CRM but not the dashboard) is
enforced on the DASHBOARD side (a `user_roles` table + a frontend gate). The CRM stays open to any
authenticated user. See the dashboard project's CLAUDE.md §RBAC and the operation `PLAYBOOKS.md` P8.

---

## 6. Keys & secrets
| Key | Used by | Where |
|---|---|---|
| `VITE_SUPABASE_URL` | this CRM | `.env` / host env |
| `VITE_SUPABASE_ANON_KEY` | this CRM (public, safe to ship) | `.env` / host env |
| **service_role key** | backend writers (chatbot, edge functions) — NOT this repo | Supabase Settings → API; private |
- The anon key is public by design (ships in the browser). **RLS is the real security.** Never put the
  **service_role** key in this frontend or in git. Get keys from **Supabase → Settings → API**.

---

## 7. Gotchas
1. **Stat triggers on `contacts` must be SECURITY DEFINER** (§3) — or CRM edits fail with `new row
   violates row-level security policy`. This is a DB-side thing but it manifests as the CRM breaking.
2. **The CRM and dashboard share ONE Supabase project.** Don't point them at different DBs.
3. **`contact_id` is the join key** to the ads side (`ad_joiners.telegram_id`) and is readonly here.
4. **Verify before telling anyone it works** — check the actual row/behaviour.
5. **Never commit real keys.** anon key = public OK; service_role = never.

---

## 8. First tasks for the trainee
1. Recreate the backend (run the migrations + the dashboard's setup.sql) on a demo Supabase project.
2. Fill `.env`, `npm run dev`, log in.
3. Add a lead, edit its status/backoffice/live → confirm the row updates and (if the stat engine is
   installed) the dashboard stats move.
4. Add a new column via the ColumnManager → see the `contacts` table gain a column.
5. Trace one edit: UI cell → `useBoostyData.ts` `updateCell` → Supabase `contacts.update` → the stat
   trigger → the dashboard.

---

## 9. Verification queries (for the demo Supabase)
```sql
-- contacts table + its columns
select column_name, data_type from information_schema.columns
  where table_name='contacts' and table_schema='public' order by ordinal_position;

-- RLS policies on contacts (team needs select/insert/update/delete)
select policyname, cmd, roles from pg_policies where tablename='contacts';

-- realtime is on?  (contacts should be in the publication)
select * from pg_publication_tables where pubname='supabase_realtime' and tablename='contacts';

-- prove an edit fires stats (needs the dashboard's stat engine installed):
update contacts set status='live' where contact_id='demo_001';
select metric_key, metric_value from boosty_dashboard_stats where metric_key like 'status_%';
```
_(Results — to be filled in with the owner if desired.)_
