# SmartSociety — Project Handoff / Context Briefing

*Read this file first if you're a new Claude Code session picking up this
project. It exists purely to get you oriented fast — it is not a permanent
part of the project's own documentation set (see `docs/` for that) and can be
deleted once it's no longer useful.*

---

## 1. What this project is

**SmartSociety** — a full-stack housing society management system (resident
billing, QR visitor gate passes, complaint/helpdesk with SLA tracking,
amenity booking, notices/polls, emergency alerts) built against a
*"Full-Stack Application Development"* Software Requirements Specification
for a contest/academic submission (Contest-AZM / Aptech Learning). The
original SRS PDF is **not** in this repo (git-ignored) — ask the user for it
if you need the literal requirements text; otherwise `docs/requirements.md`
and `docs/SRS-COMPLIANCE.md` already trace every requirement to what was
built.

**Tech stack:** Next.js 15 (App Router, server actions) · React 19 ·
TypeScript strict · Tailwind CSS 4 · PostgreSQL 17 via Prisma 6 · bcrypt +
signed JWT session auth · Vitest + Playwright tests.

Four roles: **Administrator, Resident, Security Guard, Maintenance Staff.**
Full feature list and architecture: `README.md`, `docs/architecture.md`.

---

## 2. Current deployment state (as of this handoff)

| Item | Value |
|---|---|
| GitHub repo | `github.com/aaliyandevs/SmartSociety` (public, `main` branch, auto-deploys on push) |
| Vercel project | `smartsociety`, team **Aaliyan Devs' projects** |
| **Live URL** | **https://smartsocietyhub.vercel.app** |
| Database | Neon Postgres (free tier), region `iad1` (matches Vercel deployment region) |
| Env vars set in Vercel | `DATABASE_URL` (Neon pooled connection), `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` — **verify `NEXT_PUBLIC_APP_URL` actually says `https://smartsocietyhub.vercel.app` and not an older domain; this was flagged as possibly stale and never explicitly confirmed fixed** |
| Local dev DB | Separate from production — `npm run db:up` starts a bundled local PostgreSQL 17, unrelated to Neon |

**Do not** commit real secrets (`AUTH_SECRET` value, the Neon connection
string, `.env` contents) into this repo — it's public. The `.gitignore`
already excludes `.env`, `*.pdf`, `*.docx`, `*.mp4`, `node_modules`, `.next`,
`.postgres`.

### Demo accounts (seeded in both local and production DB)

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@smartsociety.local` | `Admin@12345` |
| Resident | `resident@smartsociety.local` | `Resident@12345` |
| Security Guard | `guard@smartsociety.local` | `Guard@12345` |
| Maintenance Staff | `maintenance@smartsociety.local` | `Maintenance@12345` |

**In progress:** the user is removing the one-click demo-account buttons from
the `/login` page UI (for a cleaner public-facing login screen). The accounts
above still work either way unless/until their passwords are changed — only
the convenience buttons are going away, not the accounts themselves.

---

## 3. Documentation already produced

- `docs/` — full markdown documentation set: problem-definition, requirements,
  architecture, database-design, testing, installation, assumptions,
  workflows (activity diagrams), dfd, er-diagram, use-cases, sitemap, api,
  user-guide, and `SRS-COMPLIANCE.md` (requirement-by-requirement checklist,
  61/63 fully met — see it for the 2 known gaps and why).
- Two Word-doc exports were built for submission (git-ignored, **local only**,
  not in this repo): a full version and a condensed ~15-page version. If you
  need to regenerate these, the prior session used Pandoc + Mermaid rendered
  to PNG via mermaid.ink; ask the user if they still have the `.docx` files
  locally before rebuilding from scratch.

---

## 4. Submission status

A submission ZIP (`SmartSociety-Submission.zip`, git-ignored, local only) was
built containing: full source, `docs/`, the condensed `.docx`, `database/schema.sql`,
and the demo video. It was verified byte-for-byte via SHA256 after extraction —
confirmed non-corrupt.

### ⚠️ Active issue: the demo video was rejected

The submission video originally had an **ElevenLabs (AI) voiceover**, which
the submission platform detected and rejected for being synthetic. The fix
in progress: **replace the audio track with a human recording**, keeping the
same screen-capture visuals (no need to re-record the screen). A precisely
timed narration script (~330 words / 4:11, broken into 9 paragraphs with
per-segment timestamp/pacing guidance) was already written for the user to
read aloud. Once they send back an audio file, the plan is to use `ffmpeg`
to strip the old track and mux in the new one.

**Known content gap in the video** (accepted as-is by the user, not blocking):
the Maintenance Staff role is never logged into or demonstrated on camera.
The SRS only explicitly lists Resident/Security/Administration as named
functional-requirement categories (§1.6), so this is a soft gap, not a
missing named requirement.

---

## 5. Environment notes for a fresh machine

- No `gh` CLI was available in the prior session — plain `git` + a connected
  **Vercel MCP integration** were used instead for GitHub push and Vercel
  deploy/domain/env operations. The user logs into Claude with the same
  account on both machines, and Vercel/other integrations are account-linked
  (not machine-local), so these MCP tools should already be available here
  too — try them directly (e.g. `list_teams`, `get_project`) rather than
  assuming a manual-dashboard fallback is needed. Two things Vercel's MCP
  toolset could **not** do even in the prior session: set environment
  variables, and add a free custom `.vercel.app` domain — those genuinely
  require the user to click through the Vercel dashboard themselves.
- `ffmpeg` is **not** installed by default — it was manually downloaded
  (BtbN static Windows build) only when needed for video analysis/muxing.
  Not required for normal `npm run dev` / build work.
- Standard project setup is unchanged from `README.md`: `npm install` →
  `npm run setup` → `npm run dev`.

---

## 6. What's next

The user said they have **some new changes to make** to the project but
hadn't specified what yet at the time this handoff was written — ask them
directly what they want changed. Everything above is background context,
not a task list.
