# Team Yuri Architecture Plan

## Document Status
STATUS: APPROVED (v3 realignment 2026-06-09)

## v3 Phase Mapping (Canonical Product Model)

Team Yuri execution phases align to **`DOCS/prd/scholar_path_prd_v3.md`** and **`DOCS/architecture/ScholarPath – Architecture Plan v3`**:

| v3 Phase | Layer | Team Yuri execution | Status |
|---|---|---|---|
| 1–6 | Foundation → Workflow | Phases 1–6 (MVP → Delivery & Alerts) | COMPLETE |
| **7** | Insight — Recommendation Engine | Phase 2 (Intelligence) + Matching | COMPLETE (retroactive) |
| **8** | Decision — Action Engine | Phase 7 MVP + **Phase 8 hardening** | MVP COMPLETE → **Phase 8 next** |
| **9** | Expansion — External Integration | Phase 9 (was “Real Data Pipeline” backlog) | BACKLOG |

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

## Phase 8: Action Engine v3 Alignment — PLANNED (next)

### Goal
Close gaps between Action Engine MVP (Team Yuri Phase 7) and **v3 Phase 8 contract**: full lifecycle, expiration, hybrid priority model, richer API, dashboard “View All”, nightly reconciliation — while preserving Phases 1–7 behavior.

### Scope
- `EXPIRED` status + deterministic expiration rules per `DOCS/Phases/phase_8_action_engine_dd.md`
- Add `OPPORTUNITY_ACTION` (high-value recommendation without application; distinct from `OPTIMIZATION_ACTION` / `ENGAGEMENT_ACTION`)
- Traceability: `sourceEventId`, `priorityVersion` on `UserAction` (agent guide §10)
- Hybrid scoring: base formula + business overrides + tie-breaker hierarchy (product DD §1, §Additional Product Rule)
- `GET /actions`: filter (`type`, `status`), sort, pagination (arch v3 §12)
- Nightly Action reconciliation cron (product DD §3; arch v3 §9)
- `/dashboard/actions` or equivalent “View All” (product DD §5 — max 5 on dashboard, remainder accessible)
- Unit tests; `arch-phase8` → `manager-phase8` → `dev-phase8`

### Out of Scope
- Full `SystemEvents` table and event replay UI (defer unless Manager proves minimal table needed for `sourceEventId`)
- AI priority logic, ML tuning, Phase 10+ predictive engine
- External ingestion (Phase 9)
- Push/SMS, new email types from actions

### Dependencies
Team Yuri Phase 7 Action Engine complete; v3 Phase 7 recommendations stable; `phase_8_action_engine_dd.md` approved product decisions.

### Functional Testability
- Expired deadline → `DEADLINE_ACTION` becomes `EXPIRED`, not returned in OPEN feed
- Dashboard shows ≤5 actions; “View All” lists paginated OPEN actions
- `GET /actions?status=OPEN&type=DEADLINE_ACTION&limit=10&offset=0` works
- Same user state → identical priority order after regenerate (determinism)
- `/recommendations` unchanged; no frontend priority computation for Action Center ordering

### Handoff Notes for Phase Design
`team-Yuri/arch-phase8.md` — STATUS: READY_FOR_MANAGER. Sources: Architecture v3 §8–14, PRD v3 §Phase 8, `phase_8_action_engine_dd.md`, agent implementation guide.

---

## Phase 9: External Integration Layer — BACKLOG

### Goal (v3)
Controlled external data ingestion: scholarships (and future jobs/universities), normalize to internal schema, emit structured events — **read-only from externals, no auto-actions**.

### Scope (draft — design in arch-phase9)
- Extend Phase 5 `IngestionModule` toward production workflow
- Optional `IngestionJob` table and scheduled runner
- Source allowlist, validation pipeline, admin ops visibility
- `EXTERNAL_DATA_SYNCED` event hook → Recommendation refresh (not direct Action creation)

### Out of Scope (initial)
Autonomous unsupervised scraping; external application submission; direct external writes to internal DB.

### Dependencies
Phase 8 complete; Phase 5 import foundation; legal/source allowlist decision.

### Handoff Notes
Replaces prior plan “Phase 8: Real Data Pipeline”. See `DOCS/scholar_path_phases_plan_v_0.md` for historical notes — reconcile in `arch-phase9.md`.

---

## Open Questions

| Question | Why It Matters | Required Decision |
|---|---|---|
| `OPPORTUNITY_ACTION` vs merge with `OPTIMIZATION_ACTION` | v3 PRD lists OPPORTUNITY; codebase has OPTIMIZATION | Architect default: add OPPORTUNITY; Manager may map generators |
| Scoring config storage | Hybrid model needs tunable weights | Manager: env vars vs DB config table (default: env + constants file) |
| Minimal event id for `sourceEventId` | Traceability without full event store | Manager: synthetic id from hook name + entity id + timestamp bucket |
| Scraping legal/source list for Phase 9 | Risk | Before Phase 9 design |
| Redirect authenticated `/` → `/dashboard`? | Nav UX | Manager choice (default: nav link only) |
