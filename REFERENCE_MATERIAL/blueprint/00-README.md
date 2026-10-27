# New Project Blueprint — start here

Reusable blueprint for rebuilding the **chatbot → CRM → dashboard → ads** stack (Boosty AI) for a new
client. **Same tech/architecture, different KPIs.** Read in order:

1. **[01-Supabase-Backend-Blueprint.md](01-Supabase-Backend-Blueprint.md)** — database side: `contacts`
   CRM, the dual-write stat engine (`boosty_dashboard_stats` + `boosty_stats_daily`), all triggers,
   the ads data pipeline, and RLS/RBAC. **Read §0 (big picture) and §6 (snapshot vs flow) first — they
   explain *why* the design is shaped this way.**
2. **[02-Dashboard-Analytics-Blueprint.md](02-Dashboard-Analytics-Blueprint.md)** — frontend: Vanilla
   JS + Vite + Chart.js, the one-filter data flow, every metric's computation, the 3-view layout, and
   the auth gate.
3. **[03-setup.sql](03-setup.sql)** — the whole backend as **one runnable script**. Find-replace
   `boosty_` → your prefix and `'boosty'` → your brand, adjust the enums, run top-to-bottom in the
   Supabase SQL editor, then set yourself admin (§10). This is Blueprint 1 turned into executable SQL.
4. **[frontend-bootstrap/](frontend-bootstrap/)** — drop-in project scaffolding (`package.json`,
   `vite.config.js`, `.env.example`, `netlify.toml`, `.gitignore`). Add `index.html` + `main.js`,
   `npm install`, `npm run dev`. See its own README for the bootstrap + deploy steps.

## The 5 things that make it correct (carry all of them over)
1. **Dual-write stat engine** — triggers pre-aggregate into two tiny tables; the dashboard never scans `contacts`.
2. **Snapshot vs flow** — never sum a "right now" metric over a date range (caused a real "−2 Total Live" bug).
3. **`fetchAllRows()` pagination** — Supabase caps responses at ~1000 rows.
4. **`SECURITY DEFINER` on stat triggers** — or RLS blocks CRM edits (this broke the live CRM once).
5. **No `ad`/`ads` in any DOM class/id** — ad blockers hide them.

## Sources
Built from the live `Boosty-dash/main.js` + `index.html`, the production `handle_contact_update`
function, and `Boosty-Supabase-sql-info/Boosty AI Supabase info.md`.

## ⚠ Verify against live Supabase before rebuilding
A few things couldn't be pulled from the DB here (the Supabase connector needs authorizing in an
interactive session), so confirm these directly in the Supabase SQL editor:
- Full `contacts` schema (the extra columns: `chat_history`, `signup_steps_sent`, the country/location field).
- The real `status` and `assigned_to` enum values (production has more than the saved sample — see Blueprint 1 §1.1).
- Exact columns of `ad_attribution` and `utm_clicks` (the dashboard never reads them directly).
- `handle_chat_history_change` function body (message-metric increments).
