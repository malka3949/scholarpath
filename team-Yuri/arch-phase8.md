# Architecture Phase 8

## Phase Identifier
PHASE=8

## Status
STATUS: APPROVED

## Phase Goal
**Align the Action Engine with v3 contract:** extend Team Yuri Phase 7 MVP to satisfy `DOCS/architecture/ScholarPath – Architecture Plan v3` §8–14, `DOCS/prd/scholar_path_prd_v3.md` Phase 8, and product decisions in `DOCS/Phases/phase_8_action_engine_dd.md` — without breaking Phases 1–7 or moving prioritization outside `ActionModule`.

## Source References
- `team-Yuri/PHASE.md` — orchestrator sets `PHASE=8`
- `team-Yuri/plan.md` — Phase 8 section (v3 realignment)
- `DOCS/prd/scholar_path_prd_v3.md` — §Phase 8 Action Engine, §5 Dashboard Model, §6 Product Principles
- `DOCS/architecture/ScholarPath – Architecture Plan v3` — §2 Core Principle, §8 Action Engine Contract, §9 Recalculation, §12 API Surface, §14 Invariants
- `DOCS/Phases/phase_8_action_engine_dd.md` — priority hybrid model, expiration, dedup, dashboard capacity, tie-breaker hierarchy
- `DOCS/engineering/agent-guides/scholarpath-agent-implementation-guide-v1.md` — §6–7 Action Engine rules, §10 traceability
- `team-Yuri/arch-phase7.md` — APPROVED MVP baseline (what exists today)
- Existing code: `apps/api/src/action/`, `apps/web/src/app/dashboard/`, `UserAction` Prisma model

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **Phase 8 = hardening, not greenfield** | Action Engine MVP delivered in Team Yuri Phase 7 | Extend `ActionModule`, schema migration, no parallel action system |
| **Adopt v3 lifecycle including `EXPIRED`** | arch v3 §8: `OPEN → EXPIRED`; product DD §2 expiration rules | Add enum value; expired rows excluded from OPEN feeds; cannot reopen |
| **Deterministic expiration job + inline on regenerate** | product DD §3: daily job + immediate reflection after user actions | `@Cron` reconciliation + existing hook path runs expiration pass |
| **Add `OPPORTUNITY_ACTION`** | PRD v3 §Phase 8 lists five types; high-value undiscovered scholarship | New generator: top recommendation, no application, open deadline; distinct CTA `/scholarships/:id` |
| **Keep four legacy types; do not remove** | Backward compatibility (arch v3 §15) | `OPTIMIZATION_ACTION` / `ENGAGEMENT_ACTION` remain; Manager defines non-overlap with OPPORTUNITY |
| **Hybrid priority model (Decision C)** | product DD §1 | Base weighted formula (Phase 7) + override layer + tie-breaker hierarchy when scores within epsilon |
| **`priorityVersion` on each action** | agent guide §10 rebuild capability | Constant e.g. `priority-v2`; bump when formula/overrides change |
| **`sourceEventId` synthetic traceability** | agent guide §10 without mandating full event store | Format: `{hook}:{entityType}:{entityId}:{signalHash}` from existing regeneration context |
| **Richer `GET /actions` contract** | arch v3 §12 | Query: `status`, `type`, `limit`, `offset`, `sort=priority_score\|createdAt` — **no** priority compute in controller |
| **Dashboard cap 5; View All route** | product DD §5 | `/dashboard` unchanged cap; new `/dashboard/actions` (or `/actions` page) paginated list |
| **UI consumes Action Engine order only** | arch v3 §14, agent guide §11 | Remove or relocate any frontend sort/filter that re-ranks actions; display filters for recommendations may remain if not masquerading as priority |
| **Strong consistency per user on regenerate** | arch v3 §10 | Single-user transaction or ordered steps: expire → dismiss stale → upsert → return |
| **Defer full `SystemEvents` table** | Phase 7 deferral still valid | Synthetic `sourceEventId` sufficient for Phase 8; event store is Phase 9+ if needed |
| **Configurable weights via env** | Hybrid model tunability without DB scope creep | e.g. `ACTION_WEIGHT_URGENCY=0.4`; defaults match Phase 7; document in `.env.example` |
| **No AI in priority path** | v3 invariants | Claude unchanged; scoring/overrides rule-based only |

## Constraints / Non-Negotiables
- Action Engine remains **single source of truth** for “what user should do next” (v3 §2, §7).
- **No duplicate OPEN actions** per `(userId, type, relatedEntityType, relatedEntityId)` — existing unique constraint preserved.
- **Deterministic:** identical DB state + `priorityVersion` → identical ranked OPEN list.
- Do not break Phases 1–7: auth, applications, recommendations, notifications, email, community, import, dashboard MVP.
- Recommendations layer **must not** create or rank `UserAction` rows.
- Expired actions **must not** appear in default OPEN dashboard/API feed.
- Developer: unit tests + `dev-phase8.md`; `npm run test -w @scholarpath/api` before PASS.
- Hebrew UI for new surfaces; English code and artifacts.

## Technical Boundaries / Out of Scope
- Full immutable event store with replay UI
- AI-generated priority, ML tuning, Phase 10+ predictive actions
- Phase 9 external ingestion, `IngestionJob` production agent, scraping
- Push/SMS; new email types triggered by actions
- Admin monitoring / shadow-mode comparison dashboard
- Replacing `/recommendations` with actions-only UX
- Career/job action types (no career data wired)

## Dependencies and Interfaces

**Depends on:**
- Team Yuri Phase 7: `ActionModule`, `UserAction`, hooks, `/dashboard`
- v3 Phase 7 (delivered): `MatchingModule`, `Recommendation` scores
- Phases 3–6: applications, deadlines, notifications (read-only signals)

**Schema changes (indicative):**

```prisma
enum UserActionType {
  DEADLINE_ACTION
  COMPLETION_ACTION
  OPTIMIZATION_ACTION
  OPPORTUNITY_ACTION   // NEW
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
  sourceEventId   String?  @map("source_event_id")
  priorityVersion String   @default("priority-v1") @map("priority_version")
  expiredAt       DateTime? @map("expired_at")
}
```

**Expiration rules (product DD §2 — enforce in `ActionExpirationService` or methods on `ActionService`):**

| Type | Rule |
|---|---|
| `DEADLINE_ACTION` | Expire when scholarship deadline passed |
| `COMPLETION_ACTION` | Close when profile complete (`DONE`); or expire if profile complete detected on regenerate |
| `OPPORTUNITY_ACTION` | Expire 30 days after `createdAt` |
| `ENGAGEMENT_ACTION` | Expire 14 days after `createdAt` |
| `OPTIMIZATION_ACTION` | Expire 30 days after `createdAt`, or when optimization condition resolved (e.g. application exists) |

**Priority tie-breaker hierarchy (product DD — apply when scores equal within ±2):**
1. Deadline Risk (`DEADLINE_ACTION`)
2. Submission Completion (IN_PROGRESS app without letter)
3. Opportunity Discovery (`OPPORTUNITY_ACTION`)
4. Application Optimization (`OPTIMIZATION_ACTION`)
5. Profile Completion (`COMPLETION_ACTION`)
6. Engagement (`ENGAGEMENT_ACTION`)

**Business overrides (product DD §1 — examples, Manager refines constants):**
- Critical deadline (≤3 days): +15 urgency bonus (cap 100)
- High-value opportunity (recommendation score ≥85): +10 impact bonus
- Expired/past-deadline candidates: do not upsert as OPEN

**API surface (extends Phase 7):**

| Method | Path | Query / Body | Purpose |
|---|---|---|---|
| `GET` | `/actions` | `status`, `type`, `limit`, `offset`, `sort` | Paginated list; default `status=OPEN`, `sort=priority_score` desc |
| `POST` | `/actions/regenerate` | unchanged | Recompute + expiration pass |
| `PATCH` | `/actions/:id` | `{ status: DONE \| DISMISSED }` | User completion; reject PATCH to EXPIRED |
| `POST` | `/admin/actions/regenerate/:userId` | unchanged | Support |

**Regeneration triggers (Phase 7 hooks retained + new):**
- All Phase 7 hooks (application, profile, matching, events, deadline sync)
- **New:** `ActionReconciliationScheduler` — daily cron (`CRON_ACTION_RECONCILE`, default align with deadline sync morning UTC)

**Frontend routes:**
- `/dashboard` — top ≤5 OPEN actions (unchanged primary surface)
- `/dashboard/actions` — View All paginated OPEN actions (Hebrew)
- Link from Action Center: "הצג הכל"

## Data / State Considerations
- Migration adds `EXPIRED`, `OPPORTUNITY_ACTION`, traceability columns; backfill `priorityVersion = priority-v1` on existing rows.
- Expiration sets `status = EXPIRED`, `expiredAt = now()`; idempotent if already EXPIRED.
- Regenerate algorithm (updated):
  1. Load user context
  2. **Expire** eligible OPEN rows per rules
  3. Build candidates (including `OPPORTUNITY_ACTION`)
  4. Score with hybrid model + overrides
  5. Apply tie-breaker for ordering
  6. Upsert OPEN; dismiss stale
  7. Return paginated slice per query
- `GET /actions` with `status=EXPIRED` allowed for history/debug; default student UI uses OPEN only.

## Security / Privacy Considerations
- Same JWT scoping as Phase 7; pagination cannot leak other users' actions.
- Rate limit on `regenerate` unchanged.
- `sourceEventId` must not embed PII beyond entity ids.

## Testing and Lint Expectations
- Unit: expiration rules per action type (fixture deadline passed → EXPIRED)
- Unit: `OPPORTUNITY_ACTION` generator pre/post conditions
- Unit: tie-breaker ordering when scores within epsilon
- Unit: hybrid override bonuses (critical deadline, high score)
- Unit: GET /actions filter/pagination/sort (controller + service)
- Unit: EXPIRED rows excluded from default OPEN query
- Unit: determinism — double regenerate same state → same order
- Regression: Phase 7 action tests + Phase 4–6 notification tests PASS
- Command: `npm run test -w @scholarpath/api`

## Functional Testability

- **Page/screen:** `/dashboard` shows ≤5 color-coded action cards; "הצג הכל" → `/dashboard/actions` with pagination
- **User-visible:** Scholarship deadline passes → related `DEADLINE_ACTION` disappears from dashboard (EXPIRED); high-score recommendation without app → `OPPORTUNITY_ACTION` appears
- **Command-line:** `npm run dev`; seed user; wait/trigger cron or call regenerate
- **API:** `GET /actions?status=OPEN&limit=5` and `GET /actions?status=OPEN&limit=10&offset=5`; expired deadline scholarship → no OPEN `DEADLINE_ACTION` for that app
- **Minimal E2E:**
  1. Student with near-deadline app → `DEADLINE_ACTION` top on dashboard
  2. Advance system date / use seed with past deadline → regenerate → action EXPIRED, not on dashboard
  3. High recommendation, no application → `OPPORTUNITY_ACTION` present
  4. View All lists >5 when many OPEN actions exist
  5. `/recommendations` order unchanged; notifications still work
- **Expected result:** Action Engine matches v3 contract; deterministic; traceable actions; no UI-side priority override

## Handoff Notes for Manager

Suggested milestones **M1–M9**:
- **M1** Prisma: `EXPIRED`, `OPPORTUNITY_ACTION`, `sourceEventId`, `priorityVersion`, `expiredAt` + migration
- **M2** `ActionExpirationService` — rules per type + unit tests
- **M3** `OPPORTUNITY_ACTION` generator + dedup with OPTIMIZATION/ENGAGEMENT (document rules)
- **M4** Hybrid scoring: overrides + tie-breaker + `priorityVersion` bump to `priority-v2`
- **M5** `GET /actions` query contract (filter, sort, pagination) + controller tests
- **M6** `ActionReconciliationScheduler` daily cron + env `CRON_ACTION_RECONCILE`
- **M7** `/dashboard/actions` View All UI (Hebrew) + link from dashboard
- **M8** Audit frontend: no action re-ranking in UI; document recommendation display filters
- **M9** Unit tests, `dev-phase8.md`, update `DOCS/PROGRESS.md` / `AGENTS.md`

**Defaults (Architect — override only with user approval):**
- Tie-breaker epsilon: **2 points** on `priorityScore`
- `OPPORTUNITY_ACTION` threshold: recommendation score **≥80**, no application, open deadline
- Pagination default: `limit=20`, max `limit=50`
- Cron default: same window as `CRON_DEADLINE_SYNC` or `0 7 * * *` UTC
- View All route: **`/dashboard/actions`**

**Ad-hoc UX fixes (pre-Phase 8, not in Team Yuri artifacts):** dashboard recommendation filtering, deadline submission blocking, notification color badges — Manager may include regression notes in acceptance criteria but not expand scope unless user requests.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes

Phase identifier aligned: `PHASE=8` across PHASE.md, arch-phase8.md, manager-phase8.md (`MANAGER_REVIEW_STATUS: APPROVED`), dev-phase8.md (`STATUS: COMPLETE`, declaration PASS).

All architect milestones M1–M9 reflected in manager plan and dev evidence. v3 Action Engine contract satisfied: `EXPIRED` lifecycle, `OPPORTUNITY_ACTION`, hybrid priority-v2 (env weights + overrides + tie-breaker ε=2), synthetic `sourceEventId`, paginated `GET /actions`, `ActionReconciliationScheduler`, `/dashboard/actions` View All, frontend API-order-only (M8). Phase 7 MVP extended in-place — no parallel system, no AI priority, no `SystemEvents`, no Phase 9 scope.

Architectural decisions honored: expiration before regenerate; COMPLETION→DONE; PATCH EXPIRED rejected; scholarship-type exclusivity; `priority-v1` backfill / `priority-v2` on upsert. Unit tests 44/44 PASS per manager independent run. Lint NOT AVAILABLE — acceptable. Functional testability documented; E2E manual verification recommended, not blocking.

Non-blocking carry-forward (manager + dev Known Issues): regenerate response `total` is slice length; ENGAGEMENT/OPTIMIZATION TTL paths lack dedicated unit fixtures — acceptable for Phase 8 closure.

### Required Corrections
None. Phase 8 approved for architecture closure. Action Engine v3 alignment complete per Architecture Plan v3 §8–14 and `phase_8_action_engine_dd.md`. Phase 9 (External Integration) is next backlog per plan.md.

**Orchestrator:** Update `team-Yuri/PHASE.md` to `PHASE=9` when starting Phase 9 planning.
