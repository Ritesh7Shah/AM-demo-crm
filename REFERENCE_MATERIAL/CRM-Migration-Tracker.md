# Boosty AI CRM — Migration Tracker

> **Client:** Boosty AI
> **Based on:** FXNL CRM template (hello-world-maker-6741-main)
> **Started:** 2026-06-16
> **Goal:** Reuse full tech stack and architecture, rebrand/reconfigure for Boosty AI

---

## Project Root

```
d:\fxnl-template-16june\hello-world-maker-6741-main\
```

---

## Tech Stack (DO NOT CHANGE)

| Layer | Tool |
|---|---|
| Framework | React 18.3.1 + Vite 5 + TypeScript 5.8 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix UI) |
| State | Zustand 5.0 + TanStack React Query 5.83 |
| Table | TanStack React Table 8.21 |
| Backend | Supabase (PostgreSQL + Edge Functions + Realtime) |
| Drag-Drop | @dnd-kit |
| Icons | lucide-react |
| Date | date-fns + react-day-picker |

---

## Existing Codebase — What It Is (FXNL Client)

### Main Table: `"FXNL"` (PostgreSQL, Supabase)

The entire CRM is built around one table called **FXNL** in Supabase.

**Core columns (inferred from code):**

| Column | Type | Notes |
|---|---|---|
| id | integer | PK, readonly |
| created_at | timestamptz | readonly |
| Client name | text | |
| Contact ID | text | |
| Country | text | |
| Lead Source | text | |
| Lead Status | enum | Hot / Warm / Cold |
| Bot Status | text/enum | Bot / Human-Manually / Human-Deposit Made / Human-account_exist / Human-🗑️ |
| Change Agent Status | enum | Bot / Human |
| Broker | enum | Vantage / AXI / BullWaves / VTmarket / Avatrade / Startrader |
| First qualification date | date | |
| deposit_completed | enum | Yes / No |
| current_stage | text | 0DAY / 30MINS / 36HOURS / 7DAYS |
| Inbox Link | text | Rendered as clickable link |
| Chat Summary | text | |
| QFTD | enum | Triggered / Manual Trigger / Negative Net Deposit / Not Eligible |
| 2QFTD | enum | same as QFTD |
| 3QFTD | enum | same as QFTD |
| 4QFTD | enum | same as QFTD |
| Send Upsell 1 Message | enum | Not sent / Send |
| Send Upsell 2 Message | enum | Not sent / Send |
| Send Upsell 3 Message | enum | Not sent / Send |
| Send Upsell 4 Message | enum | Not sent / Send |
| Upsell 1 Status | text | |
| Upsell 2 Status | text | |
| Upsell 3 Status | text | |
| Upsell 4 Status | text | |
| Client_Premium | enum | Yes / No |
| Qualified__CPA | enum | Yes / No |
| Closed_By | enum | George / Tenshi / Antonio / Joep / Ibrahim |
| Status | enum | Multiple action statuses |
| lead_status_sort | internal | Hidden helper column for sort order |
| Premium_Clients | text | 'Premium' value used to filter "Premium" view |

**Custom columns** are stored in a separate metadata table: `fxnl_custom_columns`

---

### ENUMs (All Hardcoded in `src/lib/fxnlSchema.ts` and `src/lib/columns.ts`)

```
Broker:             Vantage, AXI, BullWaves, VTmarket, Avatrade, Startrader
QFTD / 2-4QFTD:    Triggered, Manual Trigger, Negative Net Deposit, Not Eligible
Change Agent Status: Bot, Human
Send Upsell 1-4:    Not sent, Send
Client_Premium:     Yes, No
Qualified__CPA:     Yes, No
Closed_By:          George, Tenshi, Antonio, Joep, Ibrahim
Status:             (multiple action statuses — full list in fxnlSchema.ts)
Lead Status:        Hot, Warm, Cold
Bot Status:         Bot, Human-Manually, Human-Deposit Made, Human-account_exist, Human-🗑️
deposit_completed:  Yes, No
current_stage:      0DAY, 30MINS, 36HOURS, 7DAYS
```

---

### Edge Functions (supabase/functions/)

| Function | What it does |
|---|---|
| `get-fxnl-schema` | Reads column types + enum values from Postgres catalog. Merges with `fxnl_custom_columns`. Returns `{ enumColumns, columnTypes }` |
| `add-column` | Creates a new column on the FXNL table. If type is dropdown, creates a PG enum. Saves metadata to `fxnl_custom_columns`. |
| `delete-column` | Drops a column from FXNL. Drops associated PG enum. Removes from `fxnl_custom_columns`. |
| `trigger-agent-flow` | POSTs to external chatbot API at `app.automationmasters.nl`. Maps `agentStatus` → flow ID. Uses env var `CHATBOT_BUILDER_TOKEN`. |

---

### Realtime Subscription

- Table: `"FXNL"`, set to `REPLICA IDENTITY FULL` and added to `supabase_realtime` publication
- Subscription channel: `postgres_changes` on `public.FXNL`
- On **INSERT** → refetch current page
- On **UPDATE** → optimistic update in React Query cache (or refetch if filtered field changes)
- On **DELETE** → optimistic removal from cache
- Status: `connected / connecting / error` shown in `SyncStatusBadge`

---

### Key Files to Change for Boosty

| File | What needs to change |
|---|---|
| `src/integrations/supabase/client.ts` | New Supabase URL + Anon key |
| `src/integrations/supabase/types.ts` | Regenerate from Boosty Supabase project |
| `src/lib/fxnlSchema.ts` | Rename, replace ENUMs, column types for Boosty |
| `src/lib/columns.ts` | New column list, order, readonly/hidden columns |
| `src/lib/agentFlow.ts` | New chatbot/agent API (if Boosty uses one) |
| `src/hooks/useFXNL.ts` | Update table name (`"FXNL"` → Boosty table name), filter keys |
| `src/hooks/useFXNLSchema.ts` | Update table reference in fallback query |
| `src/hooks/useFXNLData.ts` | Update table name |
| `src/store/useCRMStore.ts` | Update localStorage keys (`fxnl-*` → `boosty-*`) |
| `src/store/crmStore.ts` | Same |
| `src/pages/FXNLPage.tsx` | Update view names, filter keys, any FXNL-specific logic |
| `supabase/functions/*/index.ts` | Update table name references from `FXNL` |
| `supabase/migrations/*.sql` | New migrations for Boosty table + RLS |
| `.env` / Supabase secrets | New credentials + chatbot token |

### What Stays the Same (Architecture — DO NOT TOUCH)

- Full React + Vite + TypeScript setup
- All shadcn/ui components
- TanStack Query + React Table setup
- Zustand store pattern
- Virtual scrolling implementation
- Drag-drop column reordering
- Real-time subscription architecture
- Inline cell editing system
- Filter/sort architecture
- Pagination system
- Auth flow (LoginPage, ResetPasswordPage, useAuth)
- Edge function pattern (just update table name inside)
- Two-view pattern (Contacts vs second view)
- Column manager / visibility / reordering
- Bulk select + delete
- Row detail panel
- localStorage persistence pattern

---

## Questions Pending From User

1. **Boosty Supabase project** — Do you have a new Supabase project already created? If yes, share URL + anon key.
2. **Table name** — What should the main table be called? (currently `"FXNL"`) → e.g., `"Boosty"` or `"leads"` or custom?
3. **Column structure** — What columns does Boosty need? Same pattern or completely different?
4. **ENUMs** — What are the valid values for dropdowns in Boosty's domain? (broker names, statuses, agents, etc.)
5. **Two views** — What should the two tab views be called? Currently "Contacts" and "Premium".
6. **Agent/chatbot integration** — Does Boosty use the same `automationmasters.nl` chatbot? Or a different one?
7. **Branding** — Any logo, color, or name changes in the UI?
8. **Closed_By / team members** — Who are the agents/closers for Boosty?
9. **Lead Status values** — Same Hot/Warm/Cold or different?
10. **current_stage / QFTD fields** — Are these relevant to Boosty's workflow or should they be replaced?

---

## Change Log

| Date | Step | File | Change | Status |
|---|---|---|---|---|
| 2026-06-17 | Audit | — | Initial codebase audit completed | Done |
| 2026-06-17 | 1 | `src/lib/boostySchema.ts` | **Created** — new schema with BoostyColumnType, BoostySchemaColumnType, Boosty ENUMs (status/assigned_to), STATIC_COLUMN_TYPES for all contacts columns | Done |
| 2026-06-17 | 1 | `src/lib/fxnlSchema.ts` | **Converted to shim** — re-exports everything from boostySchema with FXNLColumnType/FXNLSchemaColumnType aliases for backward compat until Step 4 | Done |
| 2026-06-17 | 1 | `src/lib/columns.ts` | **Rewritten** — Boosty column definitions: ENUM_COLUMNS (status/assigned_to), DATE_COLUMNS (5 date fields), READONLY_COLUMNS, DEFAULT_COLUMN_ORDER (13 contacts columns), new badge functions (getStatusBadgeClass, getAssignedToBadgeClass, getBooleanBadgeClass) | Done |
| 2026-06-17 | 1 | `src/lib/agentFlow.ts` | **Disabled** — AgentStatus updated to bot/human, function returns disabled stub, original invoke pattern kept in comment | Done |
| 2026-06-17 | 2 | `src/integrations/supabase/client.ts` | **Updated** — SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY replaced with BOOSTY_SUPABASE_URL / BOOSTY_SUPABASE_ANON_KEY placeholders. Old FXNL credentials removed. | Done |
| 2026-06-17 | 3 | `supabase/functions/get-fxnl-schema/index.ts` | `fxnl_custom_columns` → `boosty_custom_columns`; `c.relname = 'FXNL'` → `'contacts'`; `table_name = 'FXNL'` → `'contacts'` | Done |
| 2026-06-17 | 3 | `supabase/functions/add-column/index.ts` | `fxnl_custom_columns` → `boosty_custom_columns`; `table_name = 'FXNL'` → `'contacts'`; `ALTER TABLE "FXNL"` → `"contacts"` (both dropdown + non-dropdown paths) | Done |
| 2026-06-17 | 3 | `supabase/functions/delete-column/index.ts` | `SYSTEM_COLUMNS` updated to Boosty's 13 core columns; `fxnl_custom_columns` → `boosty_custom_columns`; `table_name = 'FXNL'` → `'contacts'`; `c.relname = 'FXNL'` → `'contacts'`; `ALTER TABLE "FXNL"` → `"contacts"` | Done |
| 2026-06-17 | 3 | `supabase/functions/trigger-agent-flow/index.ts` | Disabled — early return with `{ disabled: true }`; AGENT_FLOW_IDS keys updated to lowercase bot/human; full pattern preserved in comment block | Done |
| | 4 | hooks + components + pages | Rename all FXNL refs to Boosty, update table name, view names, imports | Pending |
| | 5 | stores | Update localStorage keys fxnl-* → boosty-* | Pending |
| | 6 | Branding | App name → Boosty AI CRM, view tabs → Contacts / Live | Pending |
| | 7 | Types | Regenerate Supabase types for contacts table | Pending |

---

## Notes

- All FXNL-specific identifiers should be renamed to Boosty equivalents
- localStorage keys use `fxnl-*` prefix — must update to avoid stale data from old project
- Edge functions reference `"FXNL"` table hardcoded in security whitelist — must update
- The `trigger-agent-flow` edge function hardcodes flow IDs for Bot/Human — Boosty may need different IDs
- `lead_status_sort` is a hidden DB helper column for sorting Lead Status — need equivalent for Boosty if keeping Lead Status concept
