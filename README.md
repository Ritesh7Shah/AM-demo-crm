# Demo AM CRM

A training replica of a client CRM (lead-management tool) for the multi-brand automation operation.
Sanitized — no real keys or data.

**Stack:** React + TypeScript + Vite + shadcn/ui + Tailwind CSS · Supabase (Postgres) data layer.

> Origin note: this codebase started from a Lovable template (hence `lovable-tagger` in `vite.config.ts`
> and the shadcn/ui setup), but it is now developed and maintained in **Claude Code** — treat it as a
> normal React/Vite app, not a Lovable project.

## Get started
```sh
npm install
cp .env.example .env      # fill in your demo Supabase URL + anon key
npm run dev               # http://localhost:8080
```

## Read these
- **`CLAUDE.md`** — full project context (what it is, the data model, the codebase map, gotchas). Read first.
- **`BUILD-STEPS.md`** — step-by-step to create the backend and get the CRM running against it.
- **`supabase/migrations/`** — the SQL that builds the CRM's backend (run in timestamp order).

## What it is
An editable, spreadsheet-style CRM over a Supabase `contacts` table, with realtime sync and dynamic
columns. It shares one Supabase project + one login with the dashboard: the CRM **writes** leads, the
dashboard **reads** the stats those edits generate.

## Deploy
`npm run build` → `dist/`. Host on Netlify/Vercel; set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars.
Never commit the real `.env` or any service_role key.
