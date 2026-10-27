# Blueprint 1 — Supabase Backend (CRM · Stats Engine · Ads Data)

> **Purpose:** Everything the *database side* of the Boosty project does, so you can rebuild the same
> chatbot → CRM → dashboard → ads stack for a new client. The KPIs will differ; the **architecture
> below should stay the same** — it's what makes the dashboard fast, correct, and filterable by date.
>
> Reconstructed from the live `main.js`, `index.html`, the `handle_contact_update` function pulled
> from production, and `Boosty AI Supabase info.md`. Where the sample SQL you saved is an *older*
> version than what actually runs, it's flagged as **⚠ production differs**.

---

## 0. The big picture (how the pieces connect)

```
                       ┌─────────────────────────────────────────────┐
   Telegram user  ──▶  │  ChatBotBuilder (CBB) bot                    │
                       │  - conversation flows                        │
                       │  - PATCHes contact fields to Supabase (REST) │
                       └───────────────┬─────────────────────────────┘
                                       │  insert / update rows
                                       ▼
             ┌──────────────────────────────────────────────────────┐
             │  contacts  (the CRM's single source of truth)         │
             │  every row = one lead                                 │
             └───────────────┬──────────────────────────────────────┘
                             │  AFTER INSERT/UPDATE/DELETE triggers
                             │  call boosty_increment_stat(key, ±n)
                             ▼
      ┌───────────────────────────┐        ┌────────────────────────────┐
      │ boosty_dashboard_stats    │        │ boosty_stats_daily         │
      │ LIFETIME snapshot         │        │ PER-DAY deltas             │
      │ (metric_key → value NOW)  │        │ (date, metric_key → ±value)│
      └───────────────┬───────────┘        └───────────────┬────────────┘
                      │                                     │
                      └──────────────┬──────────────────────┘
                                     ▼
                        Dashboard (reads both — see Blueprint 2)

   Ads side (separate pipeline, linked by telegram_id = contact_id):
      Meta Ads  ─(Google Sheet + Apps Script)─▶  ad_spend
      Telegram invite links (UTM) ────────────▶  ad_joiners
      contact goes "live" ──(handle_ftd_live)──▶  ad_joiners.ftd = true
```

**Two ideas do all the heavy lifting. Internalise these before rebuilding:**

1. **Dual-write stat engine.** Every meaningful change to a `contacts` row fires a trigger that calls
   one helper, `boosty_increment_stat(key, ±n)`, which writes to **two** tables at once: a **lifetime
   running total** (`boosty_dashboard_stats`) and a **per-day change log** (`boosty_stats_daily`).
   The dashboard never scans the whole `contacts` table to draw a KPI — it reads these tiny pre-aggregated tables. That's why it's instant even with 100k+ contacts.

2. **Snapshot metrics vs flow metrics.** Some numbers are "how many are in state X **right now**"
   (Total Live, pipeline stage counts, bot/human split) — these are **snapshots**. Others are
   "how many **happened** in a period" (messages sent, new leads) — these are **flows**. Flows may be
   summed over a date range; **snapshots must never be summed** (see §6 — this caused a real
   "-2 Total Live" bug on the live site).

---

## 1. Tables

### 1.1 `contacts` — the CRM
One row per lead. This is what the chatbot writes to and what your client edits in the CRM UI.

```sql
-- ENUMS (⚠ production has MORE values than this sample — see notes)
CREATE TYPE contact_status AS ENUM (
  'outreach_1','outreach_2','outreach_3','outreach_4','outreach_5','live','quit'
);
CREATE TYPE assigned_type AS ENUM ('bot','human');

CREATE TABLE contacts (
  id                 BIGSERIAL PRIMARY KEY,
  name               TEXT,
  contact_id         TEXT UNIQUE NOT NULL,     -- Telegram user id; the join key to ad_joiners
  first_contact_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  next_contact_date  DATE,
  status             contact_status DEFAULT 'outreach_1' NOT NULL,
  backoffice         BOOLEAN DEFAULT false NOT NULL,
  ftd_date_mentioned DATE,
  ftd_date_actual    DATE,
  live               BOOLEAN DEFAULT false NOT NULL,
  assigned_to        assigned_type DEFAULT 'bot' NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL
  -- ⚠ production ALSO has at least:
  --   chat_history        TEXT     -- full transcript "Speaker (YYYY-MM-DD HH:MM): msg"
  --   signup_steps_sent   TEXT     -- 'Yes' / 'No'
  --   a country/location field driving the geo map (surfaced as country_* stat keys)
);

CREATE INDEX idx_contacts_contact_id        ON contacts(contact_id);
CREATE INDEX idx_contacts_status            ON contacts(status);
CREATE INDEX idx_contacts_assigned_to       ON contacts(assigned_to);
CREATE INDEX idx_contacts_backoffice        ON contacts(backoffice);
CREATE INDEX idx_contacts_created_at        ON contacts(created_at DESC);
CREATE INDEX idx_contacts_next_contact_date ON contacts(next_contact_date);
CREATE INDEX idx_contacts_live              ON contacts(live);

-- Realtime (CRM live-sync)
ALTER TABLE contacts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
```

**⚠ Where production diverges from the sample enum** (the dashboard code proves these exist):
- **`status`** carries a **`new`** value too. The dashboard's pipeline maps `status_new`
  ("No Follow-ups Yet"), `status_outreach_1..4` (Day 3/10/17/24), `status_quit` (Day 31), plus
  `status_live`. So the real status set ≈ `new, outreach_1..4, live, quit` (Day-N follow-up cadence).
- **`assigned_to`** is more granular than `bot/human`. The dashboard reads
  `assigned_bot` **and** `assigned_Human_DepositMade`, `assigned_Human_Manually`,
  `assigned_Human_AccountExists`, `assigned_Human_Trash`. So the human bucket is sub-typed by reason.
  → For the new project, define the `assigned_to` values you actually need up front; the stat keys are
  auto-derived as `assigned_<value>` (see the trigger in §3).

> **Design rule that made this work:** the stat key is literally `'status_' || status` and
> `'assigned_' || assigned_to`. So **whatever enum values you pick, the stats tables and dashboard keys
> follow automatically** — no per-value code. Keep that pattern.

### 1.2 `boosty_dashboard_stats` — LIFETIME snapshot (running totals *right now*)
```sql
CREATE TABLE boosty_dashboard_stats (
  id           BIGSERIAL PRIMARY KEY,
  metric_key   TEXT UNIQUE NOT NULL,
  metric_value NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);
```
One row per metric. `metric_value` is the current total/count. This is what "All Time" and every
snapshot KPI reads. Seed the keys you know up front (the rest get created on first increment):
```sql
INSERT INTO boosty_dashboard_stats (metric_key, metric_value) VALUES
  ('total_contacts',0),
  ('status_new',0),('status_outreach_1',0),('status_outreach_2',0),
  ('status_outreach_3',0),('status_outreach_4',0),('status_live',0),('status_quit',0),
  ('total_backoffice',0),('total_ftd_mentioned',0),('total_ftd_actual',0),
  ('assigned_bot',0),('assigned_human',0),
  ('signup_steps_sent_yes',0),('signup_steps_sent_no',0),
  ('total_messages',0),('total_bot_messages',0),('total_human_messages',0),
  ('total_messages_jan',0),('total_messages_juan',0);
-- country_* keys are created dynamically as leads arrive.
```

### 1.3 `boosty_stats_daily` — PER-DAY change log (deltas)
```sql
CREATE TABLE boosty_stats_daily (
  date       DATE NOT NULL,
  metric_key TEXT NOT NULL,
  value      NUMERIC DEFAULT 0,       -- NET change for that key on that day (+entered / −left)
  PRIMARY KEY (date, metric_key)
);
CREATE INDEX idx_boosty_stats_daily_date ON boosty_stats_daily(date DESC);
```
One row per (day, metric). `value` is the **net change** on that day. Summing a **flow** metric's rows
over a date range = the period total. Summing a **snapshot** metric's rows = a delta that can go
negative — **don't** (see §6).

> ⚠ **Column-name gotcha:** this table's value column is `value`, but the dashboard defensively reads
> `metric_value ?? value`. Keep the name `value` OR update the reader. Be consistent — mixed names
> were a source of confusion.

### 1.4 `user_roles` — RBAC (added later; keep it from day one)
```sql
CREATE TABLE user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL DEFAULT 'crm'   -- 'admin' = dashboard access; anything else = CRM only
);
```
Lets one Supabase Auth project back **both** apps: `admin` sees the dashboard, everyone else is
CRM-only. Full policy + gate in §8.

### 1.5 Ads tables
The dashboard only ever **reads** these; they're fed by external pipelines (§7).

**`ad_joiners`** — one row per person who joined via a tracked Telegram invite link.
Columns the code relies on:
```
telegram_id   TEXT      -- == contacts.contact_id  (the link between ads and CRM)
join_date     TIMESTAMPTZ
ftd           BOOLEAN   -- became a depositor (set by handle_ftd_live)
ftd_date      TIMESTAMPTZ
ad, ad_set, campaign, placement, source, medium   TEXT  -- UTM breakdown
invite_hash   TEXT      -- the unique Telegram invite link used
brand         TEXT      -- 'boosty'  (multi-tenant scoping)
```

**`ad_spend`** — one row per (ad, day) of spend.
```
ad            TEXT
amount_spent  NUMERIC
date          DATE
brand         TEXT      -- 'boosty'
```

**`ad_attribution`, `utm_clicks`** — exist and are RLS-locked, but **the dashboard never queries them
directly** (attribution is derived client-side from `ad_joiners`). ⚠ **Verify their exact columns in
Supabase** if the new project needs them; they're part of the ingestion pipeline, not the read path.

---

## 2. The stat engine — `boosty_increment_stat()` (the heart of it)

Every trigger funnels through this one helper. It **dual-writes**: lifetime total **and** today's delta.

```sql
CREATE OR REPLACE FUNCTION boosty_increment_stat(p_key TEXT, p_by NUMERIC DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  -- (A) lifetime running total
  INSERT INTO boosty_dashboard_stats (metric_key, metric_value, last_updated)
    VALUES (p_key, p_by, now())
    ON CONFLICT (metric_key)
    DO UPDATE SET metric_value = boosty_dashboard_stats.metric_value + p_by,
                  last_updated = now();

  -- (B) per-day net change
  INSERT INTO boosty_stats_daily (date, metric_key, value)
    VALUES (CURRENT_DATE, p_key, p_by)
    ON CONFLICT (date, metric_key)
    DO UPDATE SET value = boosty_stats_daily.value + p_by;
END;
$$ LANGUAGE plpgsql;
```
Call `boosty_increment_stat('status_live', 1)` when someone enters "live", `(..., -1)` when they
leave. The two tables stay in sync automatically.

---

## 3. Triggers on `contacts`

All of these must be **`SECURITY DEFINER`** (see §8.3 — this was a live incident). Order doesn't matter; they're independent.

### 3.1 INSERT — count a brand-new lead
```sql
CREATE OR REPLACE FUNCTION handle_contact_insert()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  PERFORM boosty_increment_stat('total_contacts');
  PERFORM boosty_increment_stat('status_'   || NEW.status::TEXT);
  PERFORM boosty_increment_stat('assigned_' || NEW.assigned_to::TEXT);
  IF NEW.backoffice          THEN PERFORM boosty_increment_stat('total_backoffice');     END IF;
  IF NEW.ftd_date_mentioned IS NOT NULL THEN PERFORM boosty_increment_stat('total_ftd_mentioned'); END IF;
  IF NEW.ftd_date_actual    IS NOT NULL THEN PERFORM boosty_increment_stat('total_ftd_actual');    END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_insert AFTER INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION handle_contact_insert();
```

### 3.2 UPDATE — move counters when a field *changes* (this is the production version)
Every branch is **guarded** so re-writing the same value is a no-op — that's why the CBB drip can
PATCH the same `status`/`backoffice` every 7 minutes without inflating anything.
```sql
CREATE OR REPLACE FUNCTION handle_contact_update()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM boosty_increment_stat('status_' || OLD.status::TEXT, -1);
    PERFORM boosty_increment_stat('status_' || NEW.status::TEXT,  1);
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    PERFORM boosty_increment_stat('assigned_' || OLD.assigned_to::TEXT, -1);
    PERFORM boosty_increment_stat('assigned_' || NEW.assigned_to::TEXT,  1);
  END IF;

  IF OLD.backoffice = false AND NEW.backoffice = true THEN PERFORM boosty_increment_stat('total_backoffice');     END IF;
  IF OLD.backoffice = true  AND NEW.backoffice = false THEN PERFORM boosty_increment_stat('total_backoffice', -1); END IF;

  IF OLD.ftd_date_mentioned IS NULL AND NEW.ftd_date_mentioned IS NOT NULL THEN PERFORM boosty_increment_stat('total_ftd_mentioned'); END IF;
  IF OLD.ftd_date_actual    IS NULL AND NEW.ftd_date_actual    IS NOT NULL THEN PERFORM boosty_increment_stat('total_ftd_actual');    END IF;

  IF OLD.signup_steps_sent IS DISTINCT FROM NEW.signup_steps_sent THEN
    IF OLD.signup_steps_sent = 'Yes' THEN PERFORM boosty_increment_stat('signup_steps_sent_yes', -1);
    ELSIF OLD.signup_steps_sent = 'No' THEN PERFORM boosty_increment_stat('signup_steps_sent_no', -1); END IF;
    IF NEW.signup_steps_sent = 'Yes' THEN PERFORM boosty_increment_stat('signup_steps_sent_yes', 1);
    ELSIF NEW.signup_steps_sent = 'No' THEN PERFORM boosty_increment_stat('signup_steps_sent_no', 1); END IF;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_update AFTER UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION handle_contact_update();
```
> **⚠ Empty-value trap:** because branches fire on *change*, patching a **blank** value counts as a real
> change (e.g. `status: outreach_1 → ''` does `status_outreach_1 -1`, `status_ +1`, creating a junk
> `status_` key). Guard the CBB drip so it only patches non-empty values.

### 3.3 `updated_at` stamp
```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```
(This one touches no other table, so it doesn't strictly need SECURITY DEFINER.)

### 3.4 FTD ↔ live automation (two-directional) — links CRM to the ads FTD flag
When your client flips a contact `live = true` (they deposited), the matching `ad_joiners` row gets
`ftd = true`. It's **two-directional**: turning live off, or deleting the contact, clears the FTD.
```sql
CREATE OR REPLACE FUNCTION handle_ftd_live()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  IF NEW.live = true AND (OLD.live IS DISTINCT FROM true) THEN
    UPDATE ad_joiners
      SET ftd = true, ftd_date = GREATEST(now(), join_date)   -- never before the join
      WHERE telegram_id = NEW.contact_id::text;
  ELSIF NEW.live IS DISTINCT FROM true AND OLD.live = true THEN
    UPDATE ad_joiners SET ftd = false, ftd_date = NULL
      WHERE telegram_id = NEW.contact_id::text;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER ftd_live_trigger AFTER UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION handle_ftd_live();

CREATE OR REPLACE FUNCTION handle_contact_delete()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  UPDATE ad_joiners SET ftd = false, ftd_date = NULL
    WHERE telegram_id = OLD.contact_id::text;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER ftd_contact_delete AFTER DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION handle_contact_delete();
```
> These are **blind `UPDATE ... WHERE`** (no read-back), which is why they kept working for non-admins
> even under RLS, while the read-modify-write stat triggers did not (§8.3).

### 3.5 Chat-history → message metrics
`handle_chat_history_change` (trigger `trg_chat_history_change`) parses `contacts.chat_history` when it
changes and increments the message keys (`total_messages`, `total_bot_messages`,
`total_human_messages`, per-agent `total_messages_jan/_juan`). The full transcript format is
`Speaker (YYYY-MM-DD HH:MM…): message` per line. A one-time backfill re-derives history from existing
transcripts — see §5.

---

## 4. Message metrics: the transcript-parsing model

Messages aren't a simple counter — they're extracted from the transcript so per-day and per-agent
counts are accurate. The parser splits `chat_history` into `(date, speaker)` pairs:

- `Bot` → `total_bot_messages`
- a named human agent (`Jan`, `juan`) → that agent's key
- anyone **not** `Bot`/`User` → `total_human_messages`
- every non-`User` line → `total_messages` (⚠ confirm whether "User"/lead lines count for your client)

For the new project, decide who the named agents are and mirror the speaker → key mapping.

---

## 5. One-time backfill (recompute message stats from transcripts)

Use this whenever message counts drift or after import. It clears message keys from the daily table and
rebuilds them from every transcript.
```sql
DELETE FROM boosty_stats_daily
WHERE metric_key IN ('total_messages','total_bot_messages','total_human_messages',
                     'total_messages_jan','total_messages_juan');

CREATE OR REPLACE FUNCTION extract_message_dates(chat_text TEXT)
RETURNS TABLE(msg_date DATE, speaker TEXT) AS $$
DECLARE line TEXT; matches TEXT[]; spk TEXT; date_str TEXT;
BEGIN
  IF chat_text IS NULL OR chat_text = '' OR chat_text LIKE 'Not available%' THEN RETURN; END IF;
  FOREACH line IN ARRAY string_to_array(chat_text, E'\n') LOOP
    line := btrim(line);
    CONTINUE WHEN line = '';
    matches := regexp_match(line, '^(\S+)\s+\((\d{4}-\d{2}-\d{2})[^)]*\):');
    IF matches IS NOT NULL THEN
      spk := matches[1]; date_str := matches[2];
      BEGIN msg_date := date_str::DATE; speaker := spk; RETURN NEXT;
      EXCEPTION WHEN OTHERS THEN CONTINUE; END;
    END IF;
  END LOOP;
END; $$ LANGUAGE plpgsql;

CREATE TEMP TABLE temp_message_breakdown AS
SELECT m.msg_date, m.speaker
FROM contacts c CROSS JOIN LATERAL extract_message_dates(c.chat_history) m
WHERE c.chat_history IS NOT NULL AND c.chat_history NOT LIKE 'Not available%';

-- then GROUP BY msg_date into boosty_stats_daily for each key
-- (total_messages = all; bot = speaker 'Bot'; jan = 'Jan'; juan = 'juan';
--  human = speaker NOT IN ('Bot','User')) with ON CONFLICT DO UPDATE SET value = EXCLUDED.value
DROP TABLE temp_message_breakdown;
```
(Full per-key INSERTs are in `Boosty AI Supabase info.md` §STEP 4 — copy them verbatim.)

---

## 6. Snapshot vs flow — the rule that prevents negative KPIs

**Real bug we hit:** "Total Live" showed **−2** on the 7-day filter. Cause: the client removed people
from the live list (they quit), so those days had **negative** `status_live` deltas in
`boosty_stats_daily`. Summing 7 days of "+entered − left" produced a net negative.

**Rule:**
- **Flow metrics** (`total_contacts`, `total_messages`, `total_bot/human_messages`, per-agent messages,
  `signup_steps_sent_*`) — safe to **sum** daily rows over a range.
- **Snapshot metrics** (`status_live`, `status_new`, `status_quit`, `status_outreach_*`, `assigned_*`) —
  **never sum**. Always read the current value from `boosty_dashboard_stats`.

The dashboard enforces this (see Blueprint 2 §4, `CURRENT_STATE_KEYS`). Keep the same split when you
choose the new client's KPIs — decide for each metric: *is it "how many right now" or "how many happened"?*

---

## 7. Ads data pipeline (how ads got connected)

Two independent feeds, joined to the CRM by `telegram_id = contact_id`.

**A) Spend — `ad_spend` (from Meta Ads).**
Meta ad numbers land in a **Google Sheet**; a **Google Apps Script** pushes rows into `ad_spend`
(`ad, amount_spent, date, brand`). It's **brand-based and account-agnostic** — adding a new Meta ad
account "just works" as long as rows carry `brand = 'boosty'`. Total spend is `SUM(amount_spent)`.

**B) Joiners — `ad_joiners` (from Telegram invite links).**
Each ad/channel uses a **unique Telegram invite link** carrying UTM params
(`source/medium/campaign/ad_set/ad/placement`) + an `invite_hash`. When someone joins, a row is
written with their `telegram_id` and `join_date`. **Tracking started `2026-07-08`** (`AD_UTM_START`) —
joiners before that have no `ad` (null) and are excluded from attributed metrics.

**C) FTD — linked from the CRM.** `handle_ftd_live` (§3.4) sets `ad_joiners.ftd` when a contact goes
live. So "which ad produced a depositor" is derived without the ads pipeline knowing about deposits.

**D) Attribution of *chats* to ads.** `contacts` has no ad column, so the dashboard builds a
`telegram_id → ad` map from `ad_joiners` and attributes each contact (chat) to its ad that way.

> For a new client: replicate the invite-link UTM scheme + the Sheet→AppsScript spend sync, keep the
> `telegram_id = contact_id` join, set your own `AD_UTM_START`, and scope everything by `brand`.

---

## 8. Security — RLS + RBAC (both apps, one auth)

### 8.1 Baseline (while building)
Every table starts with RLS **on** and a permissive allow-all so the apps work:
```sql
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
-- same pattern for stats/ads tables
```
The anon key is **public** (it ships in the frontend bundle), so RLS — not key secrecy — is the real
lock. Never rely on hiding the key.

### 8.2 Dashboard = admin-only (restrictive SELECT + role helper)
Add a role check that returns rows **only** to admins, ANDed on top of the permissive policies:
```sql
CREATE OR REPLACE FUNCTION is_dashboard_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles
                 WHERE user_id = auth.uid() AND role = 'admin');
$$;

-- Users can read their OWN role (needed by the helper + frontend gate)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own role" ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Lock every DASHBOARD-ONLY table to admins, for reads only:
CREATE POLICY "admins_only_select" ON boosty_dashboard_stats
  AS RESTRICTIVE FOR SELECT TO authenticated USING ( is_dashboard_admin() );
-- repeat for: boosty_stats_daily, ad_joiners, ad_spend, ad_attribution, utm_clicks
```
- **RESTRICTIVE + FOR SELECT** = "on top of whatever else allows it, you must also be an admin, and only
  for reading." Writes are untouched; the CRM tables (`contacts`) are **not** locked, so CRM users work
  normally.
- Non-admins reading these tables get **zero rows** — the dashboard is genuinely empty for them, not
  just hidden by JS.

### 8.3 ⚠ THE GOTCHA THAT BROKE THE LIVE CRM — read this before shipping RLS
After locking those tables read-only-to-admins, **CRM employees could no longer edit `status`/`backoffice`**.
Error: `new row violates row-level security policy "admins_only_select" for table "boosty_dashboard_stats"`.

**Why:** editing a contact fires `handle_contact_update`, which does a **read-modify-write** on
`boosty_dashboard_stats` (via `boosty_increment_stat`'s `ON CONFLICT DO UPDATE`). That hidden **read**
is blocked by the restrictive SELECT policy when the editor isn't an admin. (`live` still worked because
`handle_ftd_live` is a *blind* update with no read-back.)

**Fix:** make the stat-writing trigger functions **`SECURITY DEFINER`** so they run privileged and
bypass RLS — the CRM keeps working, the dashboard stays locked:
```sql
ALTER FUNCTION handle_contact_insert()      SECURITY DEFINER;
ALTER FUNCTION handle_contact_update()      SECURITY DEFINER;
ALTER FUNCTION handle_contact_delete()      SECURITY DEFINER;
ALTER FUNCTION handle_ftd_live()            SECURITY DEFINER;
ALTER FUNCTION handle_chat_history_change() SECURITY DEFINER;
-- verify:  SELECT proname, prosecdef FROM pg_proc WHERE proname LIKE 'handle_%';  -- all true
```
**Build it this way from the start:** any trigger that maintains an RLS-locked table must be
`SECURITY DEFINER`. Reversible with `SECURITY INVOKER`; no data is ever touched by the change.

### 8.4 Frontend gate (clean UX on top of the DB lock)
The dashboard's login checks the role and shows a message instead of an empty page (Blueprint 2 §9).
New users default to CRM-only automatically (no `user_roles` row ⇒ not admin). Onboarding an employee:
create the Auth user (auto-confirm), optionally `insert into user_roles values ('<id>','crm')`.

---

## 9. Known gotchas / lessons (don't relearn these)

| Symptom | Root cause | Fix |
|---|---|---|
| KPI capped at exactly 1000 (e.g. joiners 1000 not 1079) | Supabase caps one API response at ~1000 rows | Paginate with `.range()` — `fetchAllRows()` in the frontend |
| "Total Live −2" on date filters | Summing daily **deltas** of a **snapshot** metric | Read snapshots from `boosty_dashboard_stats`, never sum (§6) |
| CRM edits fail under RLS | Read-modify-write stat trigger blocked by restrictive SELECT | `SECURITY DEFINER` on stat triggers (§8.3) |
| Orphan `ftd = true` with no contact | Contact deleted; automation was one-directional | Two-directional `handle_ftd_live` + delete trigger (§3.4) |
| Junk `status_` / wrong counter | Drip patched an **empty** status value | Only patch non-empty values (§3.2 note) |
| Re-patching same value every 7 min | *(non-issue)* triggers are `IS DISTINCT FROM`-guarded | Safe — no inflation |

---

## 10. Rebuild checklist for the new client

1. `contacts` with the exact `status` / `assigned_to` values the new funnel needs (keys auto-derive).
2. `boosty_dashboard_stats` + `boosty_stats_daily` (rename per client) + `boosty_increment_stat`.
3. Triggers: insert / update / delete / updated_at / ftd_live / chat_history — **all `SECURITY DEFINER`**
   except the pure `updated_at` stamp.
4. Decide each KPI's type (**snapshot vs flow**) and list your `CURRENT_STATE_KEYS` for the frontend.
5. Ads: `ad_joiners` + `ad_spend` (+ attribution/utm if used), `telegram_id = contact_id` join, your own
   `AD_UTM_START`, `brand` scoping, Sheet→AppsScript spend sync, UTM invite links.
6. `user_roles` + `is_dashboard_admin()` + restrictive `admins_only_select` on dashboard tables + the
   frontend gate. Set your own account to `admin`.
7. Realtime on `contacts` for CRM live-sync.
8. Backfill message stats once after import.

→ Frontend/dashboard side is **Blueprint 2**.
