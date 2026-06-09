# Manager Phase 7

## Phase Identifier
PHASE=7

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Deliver the **Action Engine (Next Best Action)**: convert applications, deadlines, profile gaps, recommendations, and behavioral events into a **deterministic, ranked list of executable actions** for authenticated students. Surface actions in `/dashboard` (Action Center + opportunity + pressure layers). Preserve Phases 1–6; recommendations remain passive; no AI priority logic.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=7`
- `team-Yuri/plan.md` — Phase 7 section
- `team-Yuri/arch-phase7.md` — architecture contract (READY_FOR_MANAGER)
- `AGENTS.md`
- `DOCS/architecture/scholar_path_architecture_plan_v2.md` — §6, §11–13
- `DOCS/prd/scholar_path_prd_v2.md` — §9.7 Dashboard
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`
- Existing: `Application`, `Recommendation`, `Notification`, `StudentProfile`, `ScholarshipEvent`, `MatchingService`, `EventsService`, `Navbar.tsx`

## Architecture Summary
New `ActionModule` under `apps/api/src/action/` with `ActionService`, `ActionScoringService`, and `ActionController`. Prisma `UserAction` model with four action types and status lifecycle (`OPEN` → `DONE` | `DISMISSED`). Deterministic weighted scoring (no Claude). Regenerate-on-signal via sync hooks from Application, Student, Matching, Events, and post-deadline-sync batch. Frontend `/dashboard` with Hebrew Action Center cards (CTA deep links). No `SystemEvents` table; Real Data Pipeline deferred to Phase 8.

## Manager Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Dashboard route | **`/dashboard`** for authenticated Action Center | Per arch; `/` stays marketing landing for anonymous users |
| Redirect `/` → `/dashboard` when logged in | **No** (nav link only) | Reduces surprise; open question closed for Phase 7 |
| API default limit | **`limit=5`** on GET; UI renders **3–5** cards | Arch default; UI may hide lowest if layout tight |
| Scoring weights | urgency **40%**, impact **30%**, completion_gap **20%**, engagement **10%** | Arch defaults; see Scoring Contract below |
| High recommendation threshold | **`score >= 70`** for `OPTIMIZATION_ACTION` | Matches “high-score” intent; tunable in tests only |
| Deadline window for actions | **7 days** (align with notifications) | Reuse `DEADLINE_WINDOW_DAYS` constant pattern |
| Engagement lookback | **14 days** for VIEW without APPLY_START | Bounded signal; avoids stale actions |
| Recommendation fetch for generators | **Top 10** by score for user | Enough for optimization actions without full table scan |
| Stale OPEN actions | **Auto-dismiss** (`DISMISSED`) when generator no longer applies | Keeps list fresh; distinct from user dismiss |
| User `DISMISSED` / `DONE` | **Do not reopen** until underlying signal changes | Per arch; upsert skips rows with terminal status |
| `regenerate` rate limit | **1 request / 60s per user** | Prevent abuse; return `429` |
| Admin regenerate route | **`POST /admin/actions/regenerate/:userId`** — **in scope** | E2E/support; ADMIN role only |
| `SystemEvents` table | **Deferred** | Sync hooks only in Phase 7 |
| Hebrew copy | Server-generated **title** + **description** | Consistent with notification strings pattern |
| New top-level folder | **No** — `apps/api/src/action/`, `apps/web/src/app/dashboard/` | Per `40-project-structure.md` |
| AI in Action Engine | **Forbidden** for score or row creation | Arch non-negotiable |

## Scoring Contract (Phase 7 v1)

All component scores are **0–100 integers**. Final score:

```text
priority_score = min(100, round(
  urgency * 0.40 +
  impact * 0.30 +
  completion_gap * 0.20 +
  engagement_signals * 0.10
))
```

**Determinism:** Same user context snapshot → identical `priority_score`. Unit tests must assert fixed fixtures.

### Component definitions

| Component | When used | Formula (0–100) |
|---|---|---|
| **urgency** | `DEADLINE_ACTION` only | `daysLeft = max(0, ceil((deadline - now) / 1 day))`; if `daysLeft > 7` → action not generated; else `100 - (daysLeft * 100 / 7)` |
| **impact** | All types | `DEADLINE_ACTION`: `80`; `COMPLETION_ACTION`: `60`; `OPTIMIZATION_ACTION`: `recommendation.score`; `ENGAGEMENT_ACTION`: `50` |
| **completion_gap** | Per type | `DEADLINE_ACTION`: `100` if no letter or empty trim; `50` if letter exists but status `NOT_STARTED`; `0` if `IN_PROGRESS` with letter; `COMPLETION_ACTION`: `(missingFields / 3) * 100` where fields = fieldOfStudy, year, gpa; `OPTIMIZATION_ACTION` / `ENGAGEMENT_ACTION`: `30` default |
| **engagement_signals** | `ENGAGEMENT_ACTION` primary; others | `ENGAGEMENT_ACTION`: `100` if VIEW in 14d and no APPLY_START; `OPTIMIZATION_ACTION`: `20` if user has any VIEW on that scholarship; else `0` for other types |

**Tie-break:** Sort by `priority_score` desc, then `createdAt` asc (older first among equals).

## Action Generator Rules

| Type | Generate when | Unique key `(type, relatedEntityType, relatedEntityId)` | `ctaPath` | Hebrew title pattern (indicative) |
|---|---|---|---|---|
| `DEADLINE_ACTION` | App `NOT_STARTED` or `IN_PROGRESS`; scholarship deadline within 7 days; letter missing OR status `NOT_STARTED` | `(DEADLINE_ACTION, APPLICATION, applicationId)` | `/applications/{id}` | `השלם/י את הבקשה ל{scholarshipTitle} — נותרו {daysLeft} ימים` |
| `COMPLETION_ACTION` | Any of fieldOfStudy, year, gpa null/undefined on profile | `(COMPLETION_ACTION, PROFILE, userId)` | `/profile` | `השלם/י את הפרופיל האקדמי שלך` |
| `OPTIMIZATION_ACTION` | Recommendation score ≥ 70; no application for that scholarshipId | `(OPTIMIZATION_ACTION, SCHOLARSHIP, scholarshipId)` | `/scholarships/{id}` | `מלגה מומלצת: {scholarshipTitle} (ציון {score})` |
| `ENGAGEMENT_ACTION` | VIEW on scholarship in last 14d; no APPLY_START; no application row | `(ENGAGEMENT_ACTION, SCHOLARSHIP, scholarshipId)` | `/scholarships/{id}` | `המשך/י לבדוק: {scholarshipTitle}` |

**Regeneration steps (ActionService):**
1. Load context (profile, applications+scholarships, top 10 recommendations, events in 14d).
2. Build candidate list from rules above.
3. Score each candidate via `ActionScoringService`.
4. For each candidate: **upsert** if no row OR existing `OPEN`; update score/title/description/ctaPath if changed.
5. Rows with status `DISMISSED` or `DONE`: **skip** (no reopen) unless Manager-defined signal change (see below).
6. Existing `OPEN` rows not in candidate set → set `DISMISSED` (auto-stale).
7. Return top N OPEN by score.

**Signal change (reopen eligibility):** Only when unique key would be newly generated AND prior terminal row’s `updatedAt` is before a material change (e.g. deadline moved, profile field filled, new VIEW). Implementation: delete or archive terminal row on material change, OR use upsert that resets status to `OPEN` only when generator detects changed `metadata.version` — Developer may implement **delete terminal row on material signal change** (simplest acceptable approach).

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Schema + migration | `UserAction` model, enums, User relation | `npm run db:migrate` succeeds |
| M2 | ActionScoringService | Weighted deterministic formula + unit tests | Fixed fixture → fixed score; tests PASS |
| M3 | ActionService | Generators, upsert, regenerate, stale dismiss | Double regenerate → one OPEN row per unique key |
| M4 | ActionController + DTOs | REST API + rate limit + admin route | JWT-scoped CRUD; 429 on rapid regenerate |
| M5 | Regeneration hooks | Wire Application, Student, Matching, Events, Notification batch | Status/profile change updates actions async-safe |
| M6 | `/dashboard` UI | Action Center + opportunity + pressure (Hebrew) | Logged-in student sees 3–5 cards with CTAs |
| M7 | Nav + API client | Navbar link; `apps/web` types and fetch helpers | Authenticated nav includes dashboard |
| M8 | Tests + docs | Full unit coverage, `dev-phase7.md`, PROGRESS/AGENTS | `npm run test -w @scholarpath/api` PASS |

## Detailed Development Plan

### M1 — Prisma schema and migration

**File:** `packages/database/prisma/schema.prisma`

Add enums and model per `arch-phase7.md` (names may match exactly):

```prisma
enum UserActionType {
  DEADLINE_ACTION
  COMPLETION_ACTION
  OPTIMIZATION_ACTION
  ENGAGEMENT_ACTION
}

enum UserActionStatus {
  OPEN
  DONE
  DISMISSED
}

enum RelatedEntityType {
  APPLICATION
  SCHOLARSHIP
  PROFILE
  RECOMMENDATION
}

model UserAction {
  id                String             @id @default(cuid())
  userId            String             @map("user_id")
  user              User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  type              UserActionType
  title             String
  description       String
  priorityScore     Int                @map("priority_score")
  status            UserActionStatus   @default(OPEN)
  relatedEntityType RelatedEntityType? @map("related_entity_type")
  relatedEntityId   String?            @map("related_entity_id")
  ctaPath           String?            @map("cta_path")
  metadata          Json?
  createdAt         DateTime           @default(now()) @map("created_at")
  updatedAt         DateTime           @updatedAt @map("updated_at")

  @@unique([userId, type, relatedEntityType, relatedEntityId])
  @@index([userId, status, priorityScore])
  @@map("user_actions")
}
```

**User model:** add `userActions UserAction[]` relation.

**Migration name (suggested):** `20260608120000_action_engine`

**Commands:**
```bash
npm run db:generate
npm run db:migrate
```

---

### M2 — ActionScoringService

**Location:** `apps/api/src/action/action-scoring.service.ts`

**Exports:**
- `computePriorityScore(input: ActionScoreInput): number`
- `ActionScoreInput`: `{ type, daysLeft?, recommendationScore?, missingProfileFields?, hasLetter?, applicationStatus?, hasRecentView?, hasApplyStart? }`

**Tests:** `action-scoring.service.spec.ts` — at least 4 cases (one per action type) with frozen expected scores.

---

### M3 — ActionService

**Location:** `apps/api/src/action/action.service.ts`

**Public methods:**
- `regenerateForUser(userId: string): Promise<UserActionDto[]>`
- `findOpenForUser(userId: string, limit: number): Promise<UserActionDto[]>`
- `updateStatus(userId: string, actionId: string, status: 'DONE' | 'DISMISSED'): Promise<UserActionDto>`

**Private helpers:**
- `loadContext(userId)`
- `buildCandidates(context)`
- `upsertCandidates(userId, candidates)`
- `dismissStaleOpen(userId, activeKeys)`

**Module:** `action.module.ts` — import `PrismaModule`; export `ActionService` for hooks.

**Tests:** `action.service.spec.ts` — generator rules, upsert idempotency, stale dismiss, terminal status skip.

---

### M4 — ActionController + API contract

**Location:** `apps/api/src/action/action.controller.ts`

**Register:** `ActionModule` in `app.module.ts`.

**Global prefix:** `/api` (existing).

#### `GET /api/actions`

| | |
|---|---|
| Auth | JWT, role `STUDENT` (or any authenticated non-admin user path used elsewhere) |
| Query | `limit?: number` — default `5`, max `10` |
| Response `200` | `{ items: UserActionItem[] }` |

**UserActionItem:**
```typescript
{
  id: string;
  type: 'DEADLINE_ACTION' | 'COMPLETION_ACTION' | 'OPTIMIZATION_ACTION' | 'ENGAGEMENT_ACTION';
  title: string;
  description: string;
  priorityScore: number;
  status: 'OPEN';
  relatedEntityType: 'APPLICATION' | 'SCHOLARSHIP' | 'PROFILE' | 'RECOMMENDATION' | null;
  relatedEntityId: string | null;
  ctaPath: string | null;
  createdAt: string; // ISO
  updatedAt: string;
}
```

**Behavior:** Returns only `OPEN` rows, sorted by `priorityScore` desc. If empty, optionally lazy-call `regenerateForUser` once (Developer choice: **yes on first GET if zero OPEN** — improves cold start).

#### `POST /api/actions/regenerate`

| | |
|---|---|
| Auth | JWT (student) |
| Body | none |
| Response `200` | `{ items: UserActionItem[] }` |
| Response `429` | `{ message: string }` — rate limit exceeded |

#### `PATCH /api/actions/:id`

| | |
|---|---|
| Auth | JWT (student) |
| Body | `{ status: 'DONE' | 'DISMISSED' }` |
| Response `200` | `UserActionItem` (with updated status) |
| Response `404` | Action not found or not owned by user |

**Validation:** `@IsEnum(['DONE', 'DISMISSED'])`; reject `OPEN` as input.

#### `POST /api/admin/actions/regenerate/:userId`

| | |
|---|---|
| Auth | JWT, role `ADMIN` |
| Response `200` | `{ items: UserActionItem[] }` |
| Response `404` | User not found |

**Rate limit:** In-memory or simple timestamp map per userId for student regenerate (acceptable for MVP).

---

### M5 — Regeneration hooks

Call `actionService.regenerateForUser(userId)` **after successful write** (fire-and-forget with `.catch(Logger.warn)` acceptable; must not fail parent transaction).

| Source file | Trigger |
|---|---|
| `application.service.ts` | create application; update status; save letter |
| `student.service.ts` | update profile |
| `matching.service.ts` | after `refreshRecommendations` completes for user |
| `events.service.ts` | after `recordEvent` (VIEW or APPLY_START) |
| `notification.service.ts` | after `syncDeadlineNotificationsForAllStudents`, regenerate **only for users who received new notifications** (collect userIds during sync) |

**Module wiring:** Import `ActionModule` into `ApplicationModule`, `StudentModule`, `MatchingModule`, `EventsModule`, `NotificationModule` (avoid circular deps — use `forwardRef` if needed).

**Do not change:** Application state machine transitions; notification dedupe; mail send path.

---

### M6 — `/dashboard` UI

**Location:** `apps/web/src/app/dashboard/page.tsx`

**Auth:** Redirect unauthenticated users to `/login` (same pattern as `/profile`).

**Layout (Hebrew, RTL):**

1. **Action Center (primary)** — section title e.g. **"הפעולות הבאות שלך"**
   - Fetch `GET /api/actions` on mount
   - Render 3–5 cards: `title`, `description`, `priorityScore` badge optional, primary CTA button → `ctaPath` (Next.js `Link`)
   - Actions: **"סיימתי"** → `PATCH` status `DONE`; **"התעלם"** → `DISMISSED`
   - Empty state: **"אין פעולות כרגע — מעולה!"** + link to `/scholarships`
   - Manual refresh button → `POST /actions/regenerate` (respect 429 message)

2. **Opportunity layer** — section title e.g. **"הזדמנויות מומלצות"**
   - Reuse existing recommendations fetch (top 3) — link to `/recommendations`

3. **Pressure layer** — section title e.g. **"דדליינים קרובים"**
   - List applications with deadline ≤ 7 days (client filter from applications API or dedicated lightweight fetch)

**Styling:** Reuse `sp-card`, `sp-btn-primary`, existing design tokens.

---

### M7 — Nav and API client

**File:** `apps/web/src/components/Navbar.tsx`
- Add link **"לוח בקרה"** → `/dashboard` for authenticated students (between home area and scholarships or after recommendations)

**File:** `apps/web/src/lib/api.ts` (or equivalent)
- Types: `UserActionItem`, `UserActionListResponse`
- Functions: `fetchActions()`, `regenerateActions()`, `updateActionStatus(id, status)`

**Middleware:** Ensure `/dashboard` is protected if global middleware lists protected routes.

---

### M8 — Unit tests and documentation

**Minimum new specs:**

| File | Tests |
|---|---|
| `action-scoring.service.spec.ts` | Determinism; weight math; cap at 100 |
| `action.service.spec.ts` | Each generator; upsert; stale dismiss; DISMISSED not reopened |
| `action.controller.spec.ts` | Auth guard; PATCH validation; 404 wrong user |
| Hook test (optional) | Spy `regenerateForUser` on application update |

**Regression:** Phase 4–6 notification/mail tests still PASS.

**Command:**
```bash
npm run test -w @scholarpath/api
```

**Docs:**
- `team-Yuri/dev-phase7.md` — full evidence
- `DOCS/PROGRESS.md` — Phase 7 section
- `AGENTS.md` — Current Phase 7; ActionModule summary

---

## Acceptance / Gating Criteria

- [x] Migration applied; `user_actions` table and enums exist
- [x] `ActionModule` registered; no new top-level repo folders
- [x] Scoring matches Manager weights; unit tests prove determinism
- [x] All four action types generatable from seed/fixture data
- [x] `GET /api/actions` returns OPEN only, sorted by `priorityScore` desc, default limit 5
- [x] `POST /api/actions/regenerate` recomputes; rate limit returns 429 within 60s window
- [x] `PATCH /api/actions/:id` with `DONE` or `DISMISSED` works; wrong user → 404
- [x] `POST /api/admin/actions/regenerate/:userId` requires ADMIN
- [x] Hooks fire on application, profile, recommendation refresh, scholarship event, deadline sync batch
- [x] User-dismissed actions stay hidden until signal change (per reopen rules)
- [x] Stale OPEN actions auto-dismissed when no longer applicable
- [x] `/dashboard` shows Action Center with Hebrew copy and working CTAs
- [x] Navbar link **"לוח בקרה"** visible when authenticated
- [x] `/recommendations`, `/applications`, notifications, email/cron unchanged (smoke)
- [x] No AI calls in action module; no scraping / `IngestionJob` / `SystemEvents` table
- [x] Unit tests pass (`npm run test -w @scholarpath/api`)
- [x] `dev-phase7.md` complete with declaration PASS

## Functional Testability Criteria

- **Page:** `/dashboard` — Action Center + opportunity + pressure sections
- **User-visible:** Incomplete profile → `COMPLETION_ACTION`; near-deadline app without letter → `DEADLINE_ACTION` ranks high; dismiss removes card
- **CLI:** `npm run dev`; `npm run test -w @scholarpath/api`
- **API:**
  - `GET /api/actions?limit=5` (student JWT)
  - `POST /api/actions/regenerate` (student JWT)
  - `PATCH /api/actions/:id` body `{ "status": "DISMISSED" }`
  - `POST /api/admin/actions/regenerate/:userId` (admin JWT)
- **Minimal E2E:**
  1. Login `student@scholarpath.local` — clear profile field (or use seed user with incomplete profile)
  2. Open `/dashboard` — see `COMPLETION_ACTION` with CTA to `/profile`
  3. Complete profile fields — trigger regenerate — action gone or deprioritized
  4. Admin sets scholarship deadline +5 days; student has `IN_PROGRESS` application without letter
  5. Regenerate — `DEADLINE_ACTION` appears at top; CTA → `/applications/{id}`
  6. Dismiss action — card hidden from list
  7. Smoke: `/recommendations`, `/applications`, notification bell, `/community`
- **Credentials:** `student@scholarpath.local` / `student123`, `admin@scholarpath.local` / `admin123`

## Required Developer Evidence

`team-Yuri/dev-phase7.md` must include:

| Section | Required content |
|---|---|
| Phase identifier | `PHASE=7` |
| Milestones | Table M1–M8 with Yes/No |
| Files changed | Paths under `packages/database`, `apps/api/src/action`, hook files, `apps/web` |
| Scoring | Reference Manager weights; sample fixture → score |
| API examples | Sample JSON for GET list and PATCH |
| Unit tests | Command + PASS count |
| Lint | PASS or NOT AVAILABLE + reason |
| Functional | E2E steps above; screenshot or response snippet |
| Hooks | List of wired call sites |
| Scope compliance | No AI priority, no Phase 8 pipeline, no SystemEvents |
| Declaration | PASS or FAIL |

## Out of Scope

- Real Data Pipeline / autonomous scraping (**Phase 8**)
- `SystemEvents` persistence table
- AI-generated titles or `priority_score`
- Shadow-mode admin comparison UI
- Push, SMS, action-triggered email
- Admin user monitoring dashboard
- Career-specific action types (unless career data already wired — not required)
- Replacing `/recommendations` with actions-only UX
- Redirect authenticated `/` to `/dashboard`
- New top-level monorepo folders

## Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Circular module imports (Action ↔ Application) | `forwardRef`; keep hooks thin |
| Hook latency on hot paths | Fire-and-forget regenerate; log errors only |
| Action/notification overlap confuses users | Distinct UI section; actions are actionable CTAs |
| Unique constraint with null `relatedEntityId` | All generators must set entity type+id; PROFILE uses `userId` |
| Empty dashboard cold start | Lazy regenerate on first GET when zero OPEN |
| Windows `db:generate` EPERM | Stop API before migrate (document in dev-phase7) |

| Open Question | Status |
|---|---|
| Scoring weight tuning after user testing | Deferred; constants in scoring service |
| Lazy regenerate on first GET | **Approved** (Manager default) |

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned: `PHASE=7` across PHASE.md, dev-phase7.md, manager-phase7.md, arch-phase7.md.
- Developer evidence complete per Required Developer Evidence checklist (M1–M8, files list, scoring sample, API examples, hooks table, scope compliance, declaration PASS).
- Independent verification: `npm run test -w @scholarpath/api` — **35/35 PASS** (2026-06-08 Manager run).
- Lint: NOT AVAILABLE — documented in dev-phase7; acceptable (consistent with Phases 4–6).
- Implementation matches manager plan: `ActionModule` with deterministic 40/30/20/10 scoring; four generators; lazy regenerate on empty GET; rate-limited POST regenerate (429); PATCH DONE/DISMISSED; admin regenerate with `AdminGuard`; signalHash reopen via terminal-row delete; stale OPEN auto-dismiss.
- Hooks verified at call sites: Application (create/status/letter/generate), Student (profile), Matching (refresh), Events (recordEvent), Notification (batch sync affected users only).
- Frontend: `/dashboard` (Action Center + opportunity + pressure), Navbar "לוח בקרה", middleware protection, API client helpers.
- Scope: no Claude/AI imports under `apps/api/src/action/`; no `SystemEvents` table; no scraping/`IngestionJob` production agent; modules under existing `apps/api` / `apps/web` paths only.
- Regression: Phase 4–6 notification/mail/scheduler tests pass within 35-test run; ingestion/community/behavior-boost suites unchanged.
- Functional evidence: dev-phase7 documents E2E path; manual full browser E2E recommended but not blocking (same bar as Phases 5–6).
- Known limitations acceptable: 429 rate limit not isolated in unit test (implementation present in controller); engagement actions fetch scholarship titles for viewed IDs outside recommendations.

### Required Corrections
None. Phase 7 approved for Manager closure. Architect review (`arch-phase7.md` `ARCHITECT_REVIEW_STATUS`) pending for full phase sign-off.
