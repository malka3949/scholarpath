# Developer Phase 8

## Phase Identifier
PHASE=8

## Status
STATUS: COMPLETE

## Source References
- `team-Yuri/PHASE.md`
- `team-Yuri/plan.md`
- `team-Yuri/arch-phase8.md`
- `team-Yuri/manager-phase8.md`
- `AGENTS.md`
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`

## Implementation Summary
Action Engine v3 alignment: `EXPIRED` lifecycle, `OPPORTUNITY_ACTION`, hybrid priority-v2 scoring with env weights and business overrides, tie-breaker sort, traceability fields (`sourceEventId`, `priorityVersion`), paginated `GET /actions`, daily reconciliation cron, and `/dashboard/actions` View All UI.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---:|---:|---|
| M1 Schema + migration | Yes | `20260609120000_action_engine_v3` |
| M2 ActionExpirationService | Yes | Per-type rules + 3 unit tests |
| M3 OPPORTUNITY_ACTION generator | Yes | Exclusivity vs OPTIMIZATION/ENGAGEMENT |
| M4 Hybrid scoring v2 | Yes | Overrides, tie-breaker, env weights |
| M5 GET /actions contract | Yes | filter, sort, pagination, total |
| M6 Reconciliation cron | Yes | `ActionReconciliationScheduler` |
| M7 View All UI | Yes | `/dashboard/actions` + "הצג הכל" link |
| M8 Frontend audit | Yes | No client action re-rank; doc below |
| M9 Tests + docs | Yes | 44 Jest PASS |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `packages/database/prisma/schema.prisma` | EXPIRED, OPPORTUNITY_ACTION, traceability columns | M1 |
| `packages/database/prisma/migrations/20260609120000_action_engine_v3/` | SQL migration | M1 |
| `apps/api/src/action/action-expiration.service.ts` | Expiration + COMPLETION→DONE | M2 |
| `apps/api/src/action/action-scoring.constants.ts` | Env weights, override constants | M4 |
| `apps/api/src/action/action-scoring.service.ts` | priority-v2, tie-breaker sort | M4 |
| `apps/api/src/action/action.service.ts` | Pipeline, OPPORTUNITY, findForUser | M3, M5 |
| `apps/api/src/action/action.controller.ts` | Query params, paginated response | M5 |
| `apps/api/src/action/action.types.ts` | Extended DTOs, constants | M3–M5 |
| `apps/api/src/action/action-reconciliation.scheduler.ts` | Daily cron | M6 |
| `apps/api/src/action/action.module.ts` | Register new providers | M2, M6 |
| `apps/api/src/action/*.spec.ts` | New/updated tests | M9 |
| `apps/web/src/app/dashboard/actions/page.tsx` | View All paginated UI | M7 |
| `apps/web/src/app/dashboard/page.tsx` | "הצג הכל", API order only | M7, M8 |
| `apps/web/src/lib/api.ts` | Paginated fetchActions params | M7 |
| `.env.example` | CRON_ACTION_RECONCILE, ACTION_WEIGHT_* | M6 |
| `DOCS/PROGRESS.md` | Phase 8 section | M9 |
| `AGENTS.md` | Phase 8 pointer | M9 |

## Expiration Rules (fixtures)

| Rule | Test fixture |
|---|---|
| DEADLINE past → EXPIRED | `action-expiration.service.spec.ts` past deadline |
| OPPORTUNITY 30d TTL | createdAt 31 days ago → EXPIRED |
| COMPLETION profile complete → DONE | complete profile → DONE |
| EXPIRED rows skip upsert | `action.service.spec.ts` EXPIRED skip |

## Scoring v2

**Env weights (defaults):** `ACTION_WEIGHT_URGENCY=0.4`, `IMPACT=0.3`, `COMPLETION_GAP=0.2`, `ENGAGEMENT=0.1`

**Overrides:**
- Critical deadline (≤3 days): +15 urgency
- High opportunity (score ≥85): +10 impact

**Sample:** `DEADLINE_ACTION`, daysLeft=3 → score **73** (with critical bonus)

**Tie-breaker:** ε=2; `DEADLINE_ACTION` ranks above `COMPLETION_ACTION` when scores close (`action-scoring.service.spec.ts`)

## API Examples

**GET `/api/actions?status=OPEN&limit=5&offset=0&sort=priority_score`:**

```json
{
  "items": [ { "id": "...", "type": "OPPORTUNITY_ACTION", "priorityScore": 72, "status": "OPEN", "priorityVersion": "priority-v2", "sourceEventId": "regenerate:SCHOLARSHIP:..." } ],
  "total": 3,
  "limit": 5,
  "offset": 0
}
```

**PATCH `{ "status": "EXPIRED" }`:** rejected by DTO validation (`400`)

## Regeneration Hooks
Unchanged from Phase 7: Application, Student, Matching, Events, Notification batch sync. Regenerate now runs expiration pass first.

## Unit Tests

```bash
npm run test -w @scholarpath/api
```

**Result:** 44/44 PASS (2026-06-09)

## Lint

NOT AVAILABLE — no project-wide lint script configured for API package (consistent with Phases 4–7).

## Functional Testability

1. Login `student@scholarpath.local` → `/dashboard` shows ≤5 actions in API order
2. Click **"הצג הכל"** → `/dashboard/actions` paginated OPEN list
3. Regenerate after past-deadline scholarship → `DEADLINE_ACTION` not in OPEN feed
4. Recommendation score ≥80 without application → `OPPORTUNITY_ACTION` in list
5. Smoke: `/recommendations`, `/applications`, `/notifications` unchanged

## Frontend Audit (M8)

- Action lists render API order only — no client-side sort by `priorityScore`
- `filterOpenOpportunities` on dashboard applies **only** to the recommendations opportunity layer, not Action Center prioritization

## Scope Compliance

- No AI priority logic in `ActionModule`
- No `SystemEvents` table
- No Phase 9 ingestion/scraping
- No new top-level repo folders

## Known Issues

- `npm run db:generate` may fail with EPERM on Windows if API dev server holds Prisma DLL — stop server before migrate/generate
- Regenerate response `total` reflects returned slice count, not full OPEN count (dashboard uses dedicated GET)

## Declaration

**PASS** — Phase 8 implementation complete per `manager-phase8.md` acceptance criteria; unit tests 44/44 PASS.
