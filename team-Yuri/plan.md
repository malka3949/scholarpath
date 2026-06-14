# Team Yuri Architecture Plan

## Document Status
STATUS: APPROVED (v3 realignment 2026-06-09)

## v3 Phase Mapping (Canonical Product Model)

Team Yuri execution phases align to **`DOCS/prd/scholar_path_prd_v3.md`** and **`DOCS/architecture/ScholarPath – Architecture Plan v3`**:

| v3 Phase | Layer | Team Yuri execution | Status |
|---|---|---|---|
| 1–6 | Foundation → Workflow | Phases 1–6 (MVP → Delivery & Alerts) | COMPLETE |
| **7** | Insight — Recommendation Engine | Phase 2 (Intelligence) + Matching | COMPLETE (retroactive) |
| **8** | Decision — Action Engine | Phase 7 MVP + Phase 8 hardening | COMPLETE |
| **9** | Expansion — External Integration | Phase 9 — scholarships ingestion MVP | COMPLETE |

**Rule (v3):** Only the Action Engine defines user prioritization. Recommendations are signals only. See `DOCS/engineering/agent-guides/scholarpath-agent-implementation-guide-v1.md`.

**Legacy references:** v1/v2 PRD and architecture remain historical; v3 + `DOCS/Phases/phase_8_action_engine_dd.md` govern Phases 8+.

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
| Demo scholarship data confuses users | Trust | Document in README/plan; Real Data Pipeline in Phase 8 | plan.md |
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

## Phase 6: Delivery & Alerts — COMPLETE

### Goal
Email notifications + scheduled deadline sync; align with architecture notification layer (email + reliable triggers).

### Delivered
`MailService` (Resend/SMTP/log), email for `DEADLINE_APPROACHING` and `APPLICATION_STATUS`, `User.emailNotificationsEnabled`, `Notification.emailSentAt`, daily `DeadlineSyncScheduler`, profile toggle. See `arch-phase6.md`, `manager-phase6.md`, `dev-phase6.md` (all APPROVED).

### Out of Scope (honored)
Scraping, push notifications, "new recommendations" email, community expansion.

### Functional Testability
Email/log delivery on deadline sync and SUBMITTED; cron without browser; in-app unchanged.

---

## Phase 7 (v3): Recommendation Engine — RETROACTIVE_COMPLETE

### Goal (v3)
Insight layer: analyze user, rank opportunities, emit recommendations only — **no actions, no UI prioritization**.

### Team Yuri delivery
Implemented as **Phase 2 (Intelligence Layer)**: `MatchingModule`, `RuleFilterService`, `Recommendation` model, `/recommendations`, AI/rule ranking, profile summarization.

### v3 constraints (honored in codebase)
- Recommendations do not create `UserAction` rows
- No “what to do next” logic in Matching layer

### Functional Testability
- Page: `/recommendations`
- API: `GET /recommendations`, `POST /recommendations/refresh`

### Handoff Notes
No further Team Yuri phase required unless Recommendation Engine is extended (e.g. formal `RECOMMENDATION_GENERATED` event emission in Phase 8).

---

## Phase 7 (Team Yuri legacy): Action Engine MVP — COMPLETE

### Goal
First Action Engine delivery (pre-v3 numbering): `UserAction`, deterministic scoring, `/dashboard`, sync regeneration hooks.

### Delivered
See `team-Yuri/arch-phase7.md`, `manager-phase7.md`, `dev-phase7.md` (all APPROVED). Maps to **v3 Phase 8 MVP**.

### Gap vs v3 contract
Expiration lifecycle, `OPPORTUNITY_ACTION`, API pagination/filter, nightly reconciliation, traceability fields, hybrid scoring overrides — **Phase 8 (Team Yuri)**.

---

## Phase 8: Action Engine v3 Alignment — COMPLETE

### Goal
Close gaps between Action Engine MVP (Team Yuri Phase 7) and **v3 Phase 8 contract**: full lifecycle, expiration, hybrid priority model, richer API, dashboard “View All”, nightly reconciliation — while preserving Phases 1–7 behavior.

### Delivered
`EXPIRED` lifecycle, `OPPORTUNITY_ACTION`, hybrid priority-v2, traceability fields, paginated `GET /actions`, `ActionReconciliationScheduler`, `/dashboard/actions` View All. See `team-Yuri/arch-phase8.md`, `manager-phase8.md`, `dev-phase8.md` (all APPROVED).

### Out of Scope (honored)
Full `SystemEvents` table, AI priority logic, external ingestion (Phase 9), push/SMS.

### Functional Testability
Expired deadline actions excluded from OPEN feed; dashboard ≤5 + View All; deterministic priority order; `/recommendations` unchanged.

### Handoff Notes
Phase 8 architecturally closed. Ad-hoc post-close bugfixes (dashboard loading, `/actions` recursion) may need Developer patch note outside `dev-phase8.md`.

---

## Phase 9: External Integration Layer — COMPLETE

### Goal (v3)
**Controlled scholarship ingestion:** extend Phase 5 `IngestionModule` with enhanced admin bulk import **and** admin-triggered fetch from env allowlisted URLs/APIs; normalize to internal schema; audit via `IngestionJob`; emit `EXTERNAL_DATA_SYNCED` hook → Recommendation refresh only — **read-only from externals, no auto-actions**.

### Delivered (arch-phase9 APPROVED; dev-phase9 PASS; manager-phase9 APPROVED)
- `IngestionJob` table + job status lifecycle (`20260611120000_ingestion_jobs`)
- Import upsert/dedupe by normalized `sourceUrl`; extended `POST /admin/scholarships/import` response
- Allowlist env + `POST /admin/ingestion/fetch` (60s admin cooldown)
- `GET /admin/ingestion/jobs` (+ detail with `errorLog`)
- `IngestionSyncService` → batch `MatchingService.refreshRecommendations` (no direct Action Engine from ingestion)
- Optional `IngestionSyncScheduler` when `CRON_INGESTION_SYNC` set
- Admin UI: import counts, fetch form, job history (Hebrew)
- `fixtures/scholarships-external.json` + `local-fixture` dev key
- Unit tests 61/61 PASS

### Out of Scope (honored)
Autonomous unsupervised scraping; jobs/universities data models; external application submission; direct external DB writes; full event store; student-facing ingestion UI; new top-level folders; partial unique index on `sourceUrl`.

### Dependencies
Phase 8 complete; Phase 5 import foundation; Phase 7 matching refresh.

### Functional Testability
- Admin import with duplicate `sourceUrl` → update + job SUCCESS
- Admin fetch from allowlisted key → scholarships on `/scholarships` as IMPORTED
- Unknown fetch key → 400
- After sync → recommendations refresh smoke; `/dashboard` unchanged
- Ingestion failure → SEED/ADMIN data intact

### Handoff Notes
Phase 9 architecturally closed. Evidence: `team-Yuri/dev-phase9.md`. Next backlog: real data pipeline at scale / Phase 10+ per product roadmap — orchestrator sets `PHASE.md` when ready.

---

## Open Questions

| Question | Why It Matters | Required Decision |
|---|---|---|
| `OPPORTUNITY_ACTION` vs merge with `OPTIMIZATION_ACTION` | v3 PRD lists OPPORTUNITY; codebase has OPTIMIZATION | **Closed** — Phase 8: separate type, thresholds 80/70 |
| Scoring config storage | Hybrid model needs tunable weights | **Closed** — Phase 8: env vars + constants file |
| Minimal event id for `sourceEventId` | Traceability without full event store | **Closed** — Phase 8: synthetic id format |
| Scraping legal/source list for Phase 9 | Risk | **Closed** — Phase 9: env allowlist + admin-triggered fetch/import only; no autonomous scraping |
| Redirect authenticated `/` → `/dashboard`? | Nav UX | Manager choice (default: nav link only) |
