# Team Yuri Architecture Plan

## Document Status
STATUS: APPROVED

## Project Objective
ScholarPath helps CS and Engineering students in Israel discover scholarships, receive personalized recommendations, draft motivation letters with AI assistance, and track application status through a governed modular monolith (Next.js + NestJS + PostgreSQL).

## Users and Primary Use Cases
- **Student:** register/login, complete profile, browse scholarships, view personalized recommendations, start application workflow, generate/edit motivation letter, track application status.
- **Admin:** manually CRUD scholarships (demo and real entries).

## Facts
- Monorepo: Turborepo (`apps/web`, `apps/api`, `packages/database`).
- PostgreSQL is source of truth; Prisma ORM with migrations.
- Auth: NextAuth (credentials + optional Google OAuth) with JWT to NestJS API.
- Scholarship seed data (50 entries) is **demo/fabricated** for development — not scraped real scholarships.
- Phases 1–3 were implemented before Team Yuri governance; evidence in `DOCS/PROGRESS.md` and codebase.
- Claude API is optional (`ANTHROPIC_API_KEY`); rule-based and template fallbacks exist.

## Assumptions
- Local development on Windows with PostgreSQL 17.
- Hebrew RTL UI; English in code and artifacts.
- User orchestrates Team Yuri skills; skills do not chain automatically.
- Phase 4 will use a pragmatic notification approach (in-app first; email provider TBD in Manager design).

## Constraints
- Modular monolith — no microservices in MVP.
- AI never writes DB state directly; backend persists all state.
- Application state machine is user-controlled: `NOT_STARTED → IN_PROGRESS → SUBMITTED → ACCEPTED | REJECTED`.
- Motivation letter required before `SUBMITTED`.
- No new top-level folders without Architect approval (`40-project-structure.md`).
- Team Yuri artifacts live only under `team-Yuri/`.

## Architectural Principles
- Phase-stable increments; no phase depends on incomplete prior phase.
- Artifact-based handoffs (Architect → Manager → Developer → reviews).
- Plan → Perform in Steps → Verify; mandatory tests/lint evidence per Developer rules.
- Functional testability each phase (page, API, or E2E flow).

## Recommended High-Level Architecture

```text
[ Next.js apps/web ] ──HTTP──► [ NestJS apps/api ]
                                      │
                                      ▼
                              [ PostgreSQL + Prisma ]
                                      ▲
                              [ Claude API (assist) ]
```

**NestJS modules (current):** Auth, Student, Scholarship, Application, Admin, Matching, AI.

## Non-Functional Requirements
- System must run without AI API key (degraded ranking + template letters).
- Protected routes via Next.js middleware.
- DTO validation on API inputs.
- Local-only deploy for MVP.

## Risks and Mitigations

| Risk | Impact | Mitigation | Owner / Artifact |
|---|---|---|---|
| Demo scholarship data confuses users | Trust | Document in README/plan; Phase 5 scraping | plan.md |
| PostgreSQL setup friction | Blocked dev | `DOCS/POSTGRESQL_SETUP.md`, `db:setup` script | dev-phase docs |
| AI cost/latency | Poor UX | Optional key, fallbacks, user-initiated generation | arch-phase2/3 |
| No tests in repo yet | Regression | Phase 4+ Developer must add tests per `20-testing.md` | dev-phase4.md |

## Phased Delivery Plan

### Retroactive Note (Phases 1–3)
Implemented pre–Team Yuri. Treated as **RETROACTIVE_COMPLETE** for governance. No `manager-phase<N>.md` or `dev-phase<N>.md` artifacts exist for 1–3; evidence is codebase + `DOCS/PROGRESS.md`.

---

## Phase 1: MVP Foundation — RETROACTIVE_COMPLETE

### Goal
Functional non-AI system: auth, profile, scholarships, application tracking, admin CRUD.

### Scope
Email + Google auth, student profile, scholarship browse/search, application state machine, admin scholarship CRUD, PostgreSQL migrations, design system (Heebo, indigo/emerald).

### Architectural Direction
Turborepo monorepo; NestJS modules; Prisma schema for User, StudentProfile, Scholarship, Application.

### Non-Negotiable Constraints
Hebrew UI; JWT sessions; user-initiated status transitions.

### Out of Scope
AI, notifications, community, scraping.

### Dependencies
PostgreSQL local install.

### Verification Expectations
Register/login, browse scholarships, track application — manually verified during build.

### Functional Testability
- Page: `/scholarships`, `/applications`, `/profile`
- API: `GET /api/scholarships`, `POST /api/applications`
- E2E: register → browse → add application → change status

### Handoff Notes for Phase Design
Completed. See `apps/api`, `apps/web`, `packages/database/prisma`.

---

## Phase 2: Intelligence Layer — RETROACTIVE_COMPLETE

### Goal
Personalized scholarship rankings via rule filter + Claude ranking.

### Scope
`Recommendation` model, `RuleFilterService`, `MatchingModule`, `/recommendations` UI, profile summarization for AI prompts.

### Architectural Direction
Rule-based hard filters first; AI ranking layer; persist scores in `recommendations` table.

### Non-Negotiable Constraints
Works without `ANTHROPIC_API_KEY`; AI stateless; backend writes DB.

### Out of Scope
Motivation letters, notifications.

### Dependencies
Phase 1 complete; complete student profile for recommendations.

### Verification Expectations
Student sees ranked list; refresh regenerates scores.

### Functional Testability
- Page: `/recommendations`
- API: `GET /api/recommendations`, `POST /api/recommendations/refresh`

### Handoff Notes for Phase Design
Completed. See `apps/api/src/matching`, `apps/api/src/ai`.

---

## Phase 3: AI Workflow Layer — RETROACTIVE_COMPLETE

### Goal
AI-assisted motivation letter creation linked to applications.

### Scope
Letter generator (Claude + template), `/applications/[id]` workflow, draft save, start workflow endpoint, letter required before SUBMITTED.

### Architectural Direction
Extend `ClaudeService`; Application module owns letter persistence; user initiates generation.

### Non-Negotiable Constraints
AI generates content only; backend saves `motivationLetter`; user controls status.

### Out of Scope
Notifications, email.

### Dependencies
Phase 1 applications; Phase 2 profile summarization patterns.

### Verification Expectations
Generate letter, edit, save draft, advance status with letter present.

### Functional Testability
- Page: `/applications/[id]`
- API: `POST /api/applications/:id/generate-letter`, `PATCH /api/applications/:id/letter`
- E2E: start application → generate/save letter → mark IN_PROGRESS/SUBMITTED

### Handoff Notes for Phase Design
Completed. See `apps/api/src/application`, `apps/web/src/app/applications/[id]`.

---

## Phase 4: Retention Layer — COMPLETE

### Goal
Increase engagement via deadline awareness and notifications.

### Scope
In-app notifications, deadline tracking, dashboard reminders; email notifications (design choice in Manager phase).

### Architectural Direction
New `Notification` module; notification records in DB; triggers on deadline proximity and application events; bell/panel in web UI.

### Non-Negotiable Constraints
No scraping; no community; do not break existing application workflow.

### Out of Scope
Scholarship scraping, community, career module (Phase 5).

### Dependencies
Phases 1–3 stable; scholarships have `deadline` field; applications have status.

### Verification Expectations
Developer documents unit tests, lint, functional paths in `dev-phase4.md`.

### Functional Testability
- User sees in-app notification list/badge after trigger condition
- Deadline reminder visible on dashboard or applications list
- API: list/mark-read notifications (exact contract in `arch-phase4.md`)

### Handoff Notes for Phase Design
See `team-Yuri/arch-phase4.md`.

---

## Phase 5: Growth Layer — COMPLETE

### Goal
Growth Layer MVP: import, community, behavioral recommendation boost (not full scraping).

### Delivered
Admin JSON import, `CommunityModule`, `EventsModule` + behavior boost, source badges. See `dev-phase5.md`, `arch-phase5.md` (APPROVED).

### Deferred
Autonomous scraping, `IngestionJob`, email, external integrations.

### Functional Testability
Import visible with `מיובא`; community thread; boosted recommendation after events.

---

## Phase 6: Delivery & Alerts — PLANNED (next)

### Goal
Email notifications + scheduled deadline sync; align with `DOCS/scholar_path_architecture_plan_v_0.md` §10 (email + reliable triggers).

### Scope
- Email provider (Resend/SMTP via env)
- Emails for deadline approaching (7-day window, active applications)
- Email on application SUBMITTED (mirror in-app)
- Daily cron: `syncDeadlineNotifications` for all students
- Minimal unsubscribe / notification preferences
- Unit tests; `arch-phase6` → `manager-phase6` → `dev-phase6`

### Out of Scope
Scraping, community expansion, admin user monitoring, push notifications, ML pipelines.

### Dependencies
Phases 1–5 complete; existing `NotificationModule` and types.

### Functional Testability
- Test email received for deadline fixture scholarship
- Cron endpoint or scheduler creates notifications without user login
- In-app behavior unchanged

### Handoff Notes for Phase Design
`team-Yuri/arch-phase6.md` — STATUS: READY_FOR_MANAGER. See `DOCS/scholar_path_phases_plan_v_0.md` (v0.2).

---

## Phase 7+: Real Data / Admin Ops — BACKLOG

See `DOCS/scholar_path_phases_plan_v_0.md` — Phase 7 (data pipeline), Phase 8 (admin ops). Not started.

---

## Open Questions

| Question | Why It Matters | Required Decision |
|---|---|---|
| Email provider for Phase 6 (Resend vs SMTP) | Affects arch-phase6 | User before Yuri handoff |
| Include “new recommendations” email in Phase 6? | Scope size | Default: defer to Phase 7 |
| Scraping legal/source list for Phase 7 | Risk | Before Phase 7 design |
