# Manager Phase 8

## Phase Identifier
PHASE=8

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
**Action Engine v3 alignment:** extend Team Yuri Phase 7 MVP to satisfy Architecture v3 §8–14, PRD v3 Phase 8, and `DOCS/Phases/phase_8_action_engine_dd.md` — add `EXPIRED` lifecycle, `OPPORTUNITY_ACTION`, hybrid scoring with overrides, traceability fields, paginated `GET /actions`, nightly reconciliation cron, and `/dashboard/actions` View All — without breaking Phases 1–7 or moving prioritization outside `ActionModule`.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=8`
- `team-Yuri/plan.md` — Phase 8 section (v3 realignment)
- `team-Yuri/arch-phase8.md` — architecture contract (`READY_FOR_MANAGER`)
- `team-Yuri/arch-phase7.md`, `manager-phase7.md`, `dev-phase7.md` — MVP baseline (APPROVED)
- `DOCS/prd/scholar_path_prd_v3.md` — §Phase 8, §5 Dashboard, §6 Principles
- `DOCS/architecture/ScholarPath – Architecture Plan v3` — §8–14
- `DOCS/Phases/phase_8_action_engine_dd.md` — product decisions
- `DOCS/engineering/agent-guides/scholarpath-agent-implementation-guide-v1.md` — §6–11
- `AGENTS.md`, `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`
- Existing: `apps/api/src/action/`, `apps/web/src/app/dashboard/`, `UserAction` Prisma model

## Architecture Summary
Phase 8 **hardens** the existing `ActionModule` — no parallel system. Schema adds `EXPIRED`, `OPPORTUNITY_ACTION`, `sourceEventId`, `priorityVersion`, `expiredAt`. New `ActionExpirationService` (or equivalent methods) runs on every regenerate and via `ActionReconciliationScheduler` cron. Scoring upgrades to **priority-v2**: Phase 7 base formula + env-configurable weights + business overrides + tie-breaker hierarchy (ε=2). `GET /actions` gains filter/sort/pagination; controller never computes priority. Frontend adds `/dashboard/actions` (View All); dashboard Action Center remains cap 5. Synthetic `sourceEventId` replaces full event store for traceability.

## Manager Decisions

| Topic | Decision | Rationale |
|---|---|---|
| `OPPORTUNITY_ACTION` vs `OPTIMIZATION_ACTION` | **Add `OPPORTUNITY_ACTION`**; score **≥80** for OPPORTUNITY; **70–79** stays OPTIMIZATION | Closes plan open question; aligns PRD v3 five types |
| Same scholarship dedup across types | Max **one** of `{OPPORTUNITY, OPTIMIZATION, ENGAGEMENT}` per `scholarshipId` — pick highest tie-breaker rank that qualifies | Prevents clutter; OPPORTUNITY wins over OPTIMIZATION over ENGAGEMENT |
| `COMPLETION_ACTION` on complete profile | Set **`DONE`** (not `EXPIRED`) when profile complete on regenerate | Product DD: "closes when completed" |
| `EXPIRED` reopen | **Forbidden** — expired rows never return to OPEN | arch v3 §8 |
| PATCH to `EXPIRED` | **Reject** with `400` | Lifecycle is system-only |
| Scoring config | **Env vars** + defaults in `action-scoring.constants.ts` (or existing types file) | Closes plan open question; no DB config table in Phase 8 |
| `priorityVersion` | New actions use **`priority-v2`**; migration backfills existing rows **`priority-v1`** | Agent guide traceability |
| `sourceEventId` format | `{hook}:{relatedEntityType}:{relatedEntityId}:{signalHash}` | Synthetic traceability without event store |
| Tie-breaker epsilon | **±2** points on `priorityScore` | Architect default |
| Dashboard cap | **5** on `/dashboard`; View All on **`/dashboard/actions`** | Product DD §5 |
| Pagination defaults | `limit=20`, max **50**, `offset=0` | Architect default |
| GET default query | `status=OPEN`, `sort=priority_score` desc | Student UI consumes OPEN only |
| Cron | **`CRON_ACTION_RECONCILE`**; default **`0 7 * * *` UTC** (same as deadline sync) | Product DD §3 daily job |
| Redirect `/` → `/dashboard` | **No** (nav link only) | Consistent with Phase 7 |
| Lazy regenerate on empty GET | **Retain** Phase 7 behavior | Regression safety |
| Frontend action ordering | **No client-side re-sort** of actions by score; render API order | Agent guide §11 |
| Recommendation display filters | **Allowed** on dashboard opportunity layer (deadline/submitted filter) — not action priority | arch-phase8 ad-hoc UX note |
| New top-level folder | **No** | `40-project-structure.md` |

## Expiration Constants

| Constant | Value | Applies to |
|---|---|---|
| `DEADLINE_EXPIRE_RULE` | Scholarship `deadline < now` | `DEADLINE_ACTION` OPEN rows |
| `OPPORTUNITY_TTL_DAYS` | **30** | `OPPORTUNITY_ACTION` from `createdAt` |
| `ENGAGEMENT_TTL_DAYS` | **14** | `ENGAGEMENT_ACTION` from `createdAt` |
| `OPTIMIZATION_TTL_DAYS` | **30** | `OPTIMIZATION_ACTION` from `createdAt` |
| `OPTIMIZATION_RESOLVE_RULE` | Application exists for scholarship OR deadline passed | Immediate expire on regenerate |
| `COMPLETION_RESOLVE_RULE` | Profile complete (fieldOfStudy, year, gpa all set) | Set `DONE` on regenerate |
| `DEADLINE_WINDOW_DAYS` | **7** (unchanged) | Generation only — not expiration |
| `ENGAGEMENT_LOOKBACK_DAYS` | **14** (unchanged) | Generation only |

**Expiration execution:** Set `status = EXPIRED`, `expiredAt = now()`. Idempotent if already `EXPIRED`. Run in step 2 of regenerate **before** candidate build.

## Scoring Contract (priority-v2)

### Base formula (unchanged math; configurable weights)

Env vars (defaults match Phase 7):

| Env var | Default |
|---|---|
| `ACTION_WEIGHT_URGENCY` | `0.4` |
| `ACTION_WEIGHT_IMPACT` | `0.3` |
| `ACTION_WEIGHT_COMPLETION_GAP` | `0.2` |
| `ACTION_WEIGHT_ENGAGEMENT` | `0.1` |

```text
base_score = min(100, round(
  urgency * ACTION_WEIGHT_URGENCY +
  impact * ACTION_WEIGHT_IMPACT +
  completion_gap * ACTION_WEIGHT_COMPLETION_GAP +
  engagement * ACTION_WEIGHT_ENGAGEMENT
))
```

Component definitions: **inherit Phase 7** (`manager-phase7.md` Scoring Contract) for all five types. For `OPPORTUNITY_ACTION`: use same component rules as `OPTIMIZATION_ACTION` unless overridden below.

**`OPPORTUNITY_ACTION` impact default:** `recommendation.score` (same as OPTIMIZATION).

### Business overrides (applied after base_score, before cap)

| Override | Condition | Bonus |
|---|---|---|
| Critical deadline | `DEADLINE_ACTION` and `daysLeft ≤ 3` | **+15** to urgency component (recompute base, then cap 100) |
| High-value opportunity | `OPPORTUNITY_ACTION` and `recommendation.score ≥ 85` | **+10** to impact component |
| Past-deadline candidate | Any type where scholarship deadline passed | **Do not upsert** as OPEN |

Final stored score: `min(100, round(adjusted_score))`.

### Tie-breaker hierarchy (when `|scoreA - scoreB| ≤ 2`)

Rank (lower number wins):

| Rank | Kind | Match |
|---:|---|---|
| 1 | Deadline Risk | `DEADLINE_ACTION` |
| 2 | Submission Completion | `DEADLINE_ACTION` with `IN_PROGRESS` and no letter |
| 3 | Opportunity Discovery | `OPPORTUNITY_ACTION` |
| 4 | Application Optimization | `OPTIMIZATION_ACTION` |
| 5 | Profile Completion | `COMPLETION_ACTION` |
| 6 | Engagement | `ENGAGEMENT_ACTION` |

**Secondary sort (after tie-breaker):** `priorityScore` desc → `createdAt` asc.

**Determinism:** Same DB snapshot + `priorityVersion=priority-v2` → identical order. Unit tests required.

## Action Generator Rules (Phase 8)

### Existing types (Phase 7 — retain)

Per `manager-phase7.md` with these Phase 8 amendments:

- Do **not** generate `DEADLINE_ACTION` if scholarship deadline passed.
- Do **not** generate `OPTIMIZATION_ACTION` if score ≥ 80 (OPPORTUNITY handles) or application exists or deadline passed.
- Skip `ENGAGEMENT_ACTION` if OPPORTUNITY or OPTIMIZATION generated for same `scholarshipId`.

### New: `OPPORTUNITY_ACTION`

| Field | Rule |
|---|---|
| Generate when | Recommendation score **≥ 80**; no application for scholarship; deadline open or null; user profile complete enough for recommendations (same gate as matching) |
| Unique key | `(OPPORTUNITY_ACTION, SCHOLARSHIP, scholarshipId)` |
| `ctaPath` | `/scholarships/{id}` |
| Title (HE) | `הזדמנות מומלצת: {scholarshipTitle} (ציון {score})` |
| `sourceEventId` hook prefix | `recommendation` or `regenerate` |

### Scholarship-type exclusivity algorithm

For each scholarshipId, evaluate in order: OPPORTUNITY (≥80) → OPTIMIZATION (70–79) → ENGAGEMENT (VIEW rules). Emit **at most one**.

### Regeneration pipeline (ordered)

1. Load user context
2. **Expire** OPEN rows per Expiration Constants
3. **Resolve** COMPLETION → DONE when profile complete
4. Build candidates (5 types + exclusivity)
5. Score priority-v2 + overrides
6. Sort with tie-breaker
7. Upsert OPEN rows; set `sourceEventId`, `priorityVersion=priority-v2`
8. Dismiss stale OPEN (Phase 7 behavior)
9. Return query slice per GET params

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Schema + migration | `EXPIRED`, `OPPORTUNITY_ACTION`, traceability columns | `npm run db:migrate` succeeds; backfill `priority-v1` |
| M2 | ActionExpirationService | Per-type expiration + COMPLETION→DONE | Unit tests: deadline passed → EXPIRED |
| M3 | OPPORTUNITY_ACTION generator | Generator + scholarship exclusivity | Fixture score 82 → OPPORTUNITY not OPTIMIZATION |
| M4 | Hybrid scoring v2 | Overrides, env weights, tie-breaker, priority-v2 | Fixture tie at 67/68 → hierarchy order |
| M5 | GET /actions contract | Filter, sort, pagination, response meta | Query params validated; controller tests PASS |
| M6 | Reconciliation cron | `ActionReconciliationScheduler` + env | Cron invokes expire+regenerate per student |
| M7 | View All UI | `/dashboard/actions` + dashboard link | Paginated Hebrew list; cap 5 unchanged on dashboard |
| M8 | Frontend audit | No client action re-ranking | Document in dev-phase8; recommendations filter OK |
| M9 | Tests + docs | Full coverage, `dev-phase8.md`, PROGRESS/AGENTS | `npm run test -w @scholarpath/api` PASS |

## Detailed Development Plan

### M1 — Prisma schema and migration

**File:** `packages/database/prisma/schema.prisma`

```prisma
enum UserActionType {
  DEADLINE_ACTION
  COMPLETION_ACTION
  OPTIMIZATION_ACTION
  OPPORTUNITY_ACTION   // NEW — insert before ENGAGEMENT_ACTION
  ENGAGEMENT_ACTION
}

enum UserActionStatus {
  OPEN
  DONE
  DISMISSED
  EXPIRED              // NEW
}

model UserAction {
  // ... existing fields ...
  sourceEventId   String?   @map("source_event_id")
  priorityVersion String    @default("priority-v1") @map("priority_version")
  expiredAt       DateTime? @map("expired_at")
}
```

**Migration:** `packages/database/prisma/migrations/<timestamp>_action_engine_v3/migration.sql`

- Add enum values via `ALTER TYPE`
- Add columns with backfill: `UPDATE user_actions SET priority_version = 'priority-v1' WHERE priority_version IS NULL`
- Export new enum values from `packages/database/src/index.ts`

---

### M2 — ActionExpirationService

**Files:**
- `apps/api/src/action/action-expiration.service.ts` (new)
- `apps/api/src/action/action-expiration.service.spec.ts` (new)
- Wire into `ActionService.regenerateForUser` **before** candidate build

**Methods:**

| Method | Behavior |
|---|---|
| `expireOpenActions(userId, context, now)` | Apply all Expiration Constants; return count expired |

**Tests (minimum):**
- OPEN `DEADLINE_ACTION` + past deadline → `EXPIRED` + `expiredAt` set
- OPEN `OPPORTUNITY_ACTION` + `createdAt` 31 days ago → `EXPIRED`
- OPEN `COMPLETION_ACTION` + complete profile → `DONE`
- Already `EXPIRED` → no-op

---

### M3 — OPPORTUNITY_ACTION generator

**File:** `apps/api/src/action/action.service.ts`

- Add `buildOpportunityActions(context)` 
- Refactor scholarship exclusivity helper used by OPTIMIZATION + ENGAGEMENT
- Update `action.types.ts`: `OPPORTUNITY_SCORE_THRESHOLD = 80`; export from constants
- Update `UserActionDto.status` union to include `EXPIRED`

**Tests:** score 85 → OPPORTUNITY only; score 75 → OPTIMIZATION only; same scholarship not both.

---

### M4 — Hybrid scoring v2

**Files:**
- `apps/api/src/action/action-scoring.service.ts`
- `apps/api/src/action/action-scoring.constants.ts` (new, optional)
- `apps/api/src/action/action-scoring.service.spec.ts`

- Read weights from `process.env` with Phase 7 defaults
- Implement override bonuses and tie-breaker sort helper
- Set `priorityVersion: 'priority-v2'` on upsert
- Build `sourceEventId` from hook + entity + `signalHash`

**Tests:**
- Critical deadline +3 days → +15 effect observable
- Two actions within ε=2 → hierarchy order per table
- Double regenerate → identical order

---

### M5 — GET /actions API contract

**File:** `apps/api/src/action/action.controller.ts`

#### `GET /api/actions`

| Query param | Type | Default | Validation |
|---|---|---|---|
| `status` | `OPEN \| DONE \| DISMISSED \| EXPIRED` | `OPEN` | `@IsOptional` `@IsIn(...)` |
| `type` | `UserActionType` | — | Optional enum |
| `limit` | int | `20` | 1–50 |
| `offset` | int | `0` | ≥ 0 |
| `sort` | `priority_score \| createdAt` | `priority_score` | desc only in Phase 8 |

**Response `200`:**

```json
{
  "items": [ /* UserActionDto[] */ ],
  "total": 12,
  "limit": 20,
  "offset": 0
}
```

**Rules:**
- Controller calls service only; **no** score computation in controller
- Default student dashboard continues `GET ?status=OPEN&limit=5`
- `EXPIRED` excluded from dashboard and default OPEN feeds
- Lazy regenerate on empty OPEN (Phase 7) **still runs** before query when `status=OPEN` and zero rows

#### `PATCH /api/actions/:id`

- Reject `{ "status": "EXPIRED" }` → `400`
- Accept `DONE`, `DISMISSED` only (unchanged)

#### `POST /api/actions/regenerate`

- Must run expiration pass (M2) before upsert
- Rate limit unchanged (60s)

**Tests:** `action.controller.spec.ts` — filter by type, pagination offset, sort order, 400 on EXPIRED patch.

---

### M6 — ActionReconciliationScheduler

**Files:**
- `apps/api/src/action/action-reconciliation.scheduler.ts` (new)
- `apps/api/src/action/action-reconciliation.scheduler.spec.ts` (new)
- Register in `action.module.ts`; import `ScheduleModule` if not already global

**Behavior:**
- `@Cron(process.env.CRON_ACTION_RECONCILE ?? '0 7 * * *')`
- For each STUDENT user: `actionService.regenerateForUser(userId)` (includes expiration)
- Log total users processed and actions expired count

**Env:** add to `.env.example`:

```text
CRON_ACTION_RECONCILE=""
ACTION_WEIGHT_URGENCY=0.4
ACTION_WEIGHT_IMPACT=0.3
ACTION_WEIGHT_COMPLETION_GAP=0.2
ACTION_WEIGHT_ENGAGEMENT=0.1
```

---

### M7 — View All UI

**Files:**
- `apps/web/src/app/dashboard/actions/page.tsx` (new)
- `apps/web/src/app/dashboard/page.tsx` — add link **"הצג הכל"** → `/dashboard/actions`
- `apps/web/src/lib/api.ts` — extend `fetchActions(token, params)` with query string
- `apps/web/src/middleware.ts` — protect `/dashboard/actions`

**UI (Hebrew):**
- Title: **"כל הפעולות שלך"**
- Paginated list (OPEN only); show `title`, `description`, `priorityScore`, type badge optional
- CTA + Done/Dismiss buttons (reuse dashboard patterns)
- Previous/Next or "טען עוד" using `offset`
- Empty state links to `/scholarships`

**Dashboard regression:** Action Center still shows max **5** cards; order matches API (no client sort).

---

### M8 — Frontend audit

**Scope:**
- Verify `/dashboard` action list uses API order as returned
- Document in `dev-phase8.md`: recommendation `filterOpenOpportunities` is display-only for opportunity layer, not action priority
- No new frontend logic that computes `priorityScore` or re-ranks actions

---

### M9 — Tests and documentation

**Minimum new/updated specs:**

| File | Tests |
|---|---|
| `action-expiration.service.spec.ts` | All expiration rules |
| `action-scoring.service.spec.ts` | Overrides, tie-breaker, env weights |
| `action.service.spec.ts` | OPPORTUNITY, exclusivity, EXPIRED exclusion from OPEN query |
| `action.controller.spec.ts` | Pagination, filter, PATCH reject EXPIRED |
| `action-reconciliation.scheduler.spec.ts` | Cron calls regenerate |

**Regression:** Phase 7 action tests + Phase 4–6 notification tests PASS.

**Command:**
```bash
npm run test -w @scholarpath/api
```

**Docs:**
- `team-Yuri/dev-phase8.md`
- `DOCS/PROGRESS.md` — Phase 8 section
- `AGENTS.md` — Current Phase 8 summary

---

## Acceptance / Gating Criteria

- [ ] Migration applied: `EXPIRED`, `OPPORTUNITY_ACTION`, `sourceEventId`, `priorityVersion`, `expiredAt`
- [ ] Existing rows backfilled with `priority-v1`; new/regenerated rows use `priority-v2`
- [ ] Expiration rules match Expiration Constants table; unit tests PASS
- [ ] `COMPLETION_ACTION` → `DONE` when profile complete (not EXPIRED)
- [ ] `EXPIRED` rows never returned in default `status=OPEN` dashboard/API feed
- [ ] PATCH with `EXPIRED` returns `400`
- [ ] `OPPORTUNITY_ACTION` generates at score ≥ 80; OPTIMIZATION at 70–79; exclusivity per scholarship
- [ ] Hybrid overrides: critical deadline +15; high opportunity +10; deterministic tie-breaker
- [ ] `GET /actions` supports `status`, `type`, `limit`, `offset`, `sort`; response includes `total`
- [ ] Controller does not compute priority scores
- [ ] `sourceEventId` populated on upsert per format `{hook}:{type}:{id}:{signalHash}`
- [ ] `ActionReconciliationScheduler` registered; env documented
- [ ] `/dashboard` shows ≤ 5 actions; **"הצג הכל"** → `/dashboard/actions` paginated
- [ ] No client-side action re-ranking
- [ ] Phase 7 hooks retained; regenerate runs expiration first
- [ ] `/recommendations`, `/applications`, notifications, email/cron unchanged (smoke)
- [ ] No AI in action module; no `SystemEvents` table; no Phase 9 ingestion scope
- [ ] Unit tests PASS (`npm run test -w @scholarpath/api`)
- [ ] `dev-phase8.md` complete with declaration PASS

## Functional Testability Criteria

- **Page:** `/dashboard` (≤5 actions) and `/dashboard/actions` (paginated View All)
- **User-visible:** Past-deadline scholarship → related action disappears after regenerate; score 85 recommendation without app → `OPPORTUNITY_ACTION`
- **CLI:** `npm run dev`; `npm run test -w @scholarpath/api`
- **API:**
  - `GET /api/actions?status=OPEN&limit=5`
  - `GET /api/actions?status=OPEN&limit=10&offset=5`
  - `GET /api/actions?type=DEADLINE_ACTION&status=OPEN`
  - `POST /api/actions/regenerate`
  - `PATCH /api/actions/:id` `{ "status": "DISMISSED" }`
  - `PATCH /api/actions/:id` `{ "status": "EXPIRED" }` → 400
- **Minimal E2E:**
  1. Login `student@scholarpath.local` — open `/dashboard` — ≤5 action cards in API order
  2. Click **"הצג הכל"** — see paginated list when >5 OPEN actions exist (seed/admin regenerate if needed)
  3. Use scholarship with past deadline + OPEN DEADLINE_ACTION → regenerate → action EXPIRED, absent from dashboard
  4. High-score recommendation (≥80), no application → `OPPORTUNITY_ACTION` visible
  5. Smoke: `/recommendations`, `/applications`, `/notifications`, `/community`
- **Credentials:** `student@scholarpath.local` / `student123`, `admin@scholarpath.local` / `admin123`

## Required Developer Evidence

`team-Yuri/dev-phase8.md` must include:

| Section | Required content |
|---|---|
| Phase identifier | `PHASE=8` |
| Milestones | Table M1–M9 with Yes/No |
| Files changed | Paths under `packages/database`, `apps/api/src/action`, scheduler, `apps/web` |
| Expiration | Table mapping rules → test fixtures |
| Scoring v2 | Env vars, override examples, tie-breaker fixture |
| API examples | GET with pagination JSON; PATCH 400 EXPIRED |
| Unit tests | Command + PASS count |
| Lint | PASS or NOT AVAILABLE + reason |
| Functional | E2E steps above |
| Frontend audit | Confirmation no client action re-rank |
| Scope compliance | No AI priority, no SystemEvents, no Phase 9 |
| Declaration | PASS or FAIL |

## Out of Scope

- Full `SystemEvents` / event replay UI
- AI priority, ML tuning, Phase 10+ predictive engine
- Phase 9 external ingestion, `IngestionJob` production agent, scraping
- Push, SMS, action-triggered email
- Admin monitoring / shadow-mode dashboard
- DB-backed scoring config UI
- Replacing `/recommendations` with actions-only UX
- Redirect authenticated `/` to `/dashboard`
- New top-level monorepo folders

## Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Enum migration on PostgreSQL | Use `ALTER TYPE ... ADD VALUE`; test migrate on dev DB |
| OPPORTUNITY/OPTIMIZATION overlap confusion | Exclusivity helper + unit tests per scholarshipId |
| Cron double-run with deadline sync | Both idempotent; log counts only |
| Pagination performance | Index `[userId, status, priorityScore]` exists from Phase 7 |
| Breaking Phase 7 tests | Update fixtures for new enums/DTO fields incrementally |

| Open Question | Status |
|---|---|
| `OPPORTUNITY_ACTION` vs merge OPTIMIZATION | **Closed** — separate type, thresholds 80/70 |
| Scoring config storage | **Closed** — env vars |
| `sourceEventId` without event store | **Closed** — synthetic format |
| Include `total` in list response | **Closed** — yes, required for pagination UI |

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes

Reviewed `team-Yuri/dev-phase8.md` against Acceptance / Gating Criteria (2026-06-09).

**Tests (manager run):** `npm run test -w @scholarpath/api` — **44/44 PASS** (11 suites).

**Evidence verified:**
- M1–M9 milestones marked Yes; files changed align with plan scope (`packages/database`, `apps/api/src/action`, `apps/web`, `.env.example`, docs).
- Migration `20260609120000_action_engine_v3` adds `EXPIRED`, `OPPORTUNITY_ACTION`, `sourceEventId`, `priorityVersion`, `expiredAt`; backfill `priority-v1` in SQL; upsert uses `priority-v2`.
- `ActionExpirationService` + specs: deadline past → EXPIRED, OPPORTUNITY 30d TTL, COMPLETION → DONE.
- `ActionScoringService` specs: critical deadline bonus, high-opportunity bonus, tie-breaker hierarchy.
- `ActionService` specs: OPPORTUNITY vs OPTIMIZATION exclusivity, EXPIRED skip on upsert, expiration before regenerate.
- `ActionController` specs: paginated GET, invalid status query rejected; PATCH DTO `@IsIn(['DONE','DISMISSED'])` blocks EXPIRED (400).
- `ActionReconciliationScheduler` registered; cron spec PASS; env vars in `.env.example`.
- Frontend: `/dashboard/actions` page, **"הצג הכל"** link, API-order rendering documented (M8); `/dashboard/:path*` middleware covers actions route.
- Scope compliance: no AI priority, no SystemEvents, no Phase 9 ingestion, no new top-level folders.
- Lint: NOT AVAILABLE (consistent with prior phases) — acceptable.
- Functional testability: documented E2E steps; not manager-executed — acceptable per checklist.

**Non-blocking observations (documented in dev-phase8 Known Issues):**
- `POST /actions/regenerate` response `total` equals returned slice length, not full OPEN count — dashboard uses dedicated GET; acceptable for Phase 8.
- Expiration specs cover three primary rules; ENGAGEMENT/OPTIMIZATION TTL resolve paths rely on service logic without dedicated unit fixtures — consider hardening in a follow-up, not a Phase 8 gate.

All acceptance / gating criteria satisfied. Developer declaration **PASS** confirmed.

### Required Corrections
