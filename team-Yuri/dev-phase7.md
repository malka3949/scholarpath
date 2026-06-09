# Developer Phase 7

## Phase Identifier
PHASE=7

## Status
STATUS: COMPLETE

## Source References
- `team-Yuri/PHASE.md`
- `team-Yuri/plan.md`
- `team-Yuri/arch-phase7.md`
- `team-Yuri/manager-phase7.md`
- `AGENTS.md`
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`

## Implementation Summary
Action Engine (Next Best Action): `UserAction` persistence, deterministic weighted scoring, four action generators, REST API with rate-limited regenerate, sync hooks from existing modules, and Hebrew `/dashboard` with Action Center + opportunity + pressure layers.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---:|---:|---|
| M1 Schema + migration | Yes | `20260608120000_action_engine` applied |
| M2 ActionScoringService | Yes | Weights 40/30/20/10; 5 unit tests |
| M3 ActionService | Yes | Generators, upsert, stale dismiss, signalHash reopen |
| M4 ActionController | Yes | GET lazy regenerate, POST regenerate 429, PATCH, admin route |
| M5 Regeneration hooks | Yes | Application, Student, Matching, Events, Notification |
| M6 `/dashboard` UI | Yes | Hebrew Action Center + layers |
| M7 Nav + API client | Yes | Navbar + `api.ts` helpers + middleware |
| M8 Tests + docs | Yes | 35 Jest PASS; PROGRESS, AGENTS, dev-phase7 |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `packages/database/prisma/schema.prisma` | UserAction enums + model | M1 |
| `packages/database/prisma/migrations/20260608120000_action_engine/` | SQL migration | M1 |
| `packages/database/src/index.ts` | Export new enums | M1 |
| `apps/api/src/action/*` | Module, service, scoring, controllers, DTOs, specs | M2–M4, M8 |
| `apps/api/src/app.module.ts` | Register ActionModule | M4 |
| `apps/api/src/application/application.service.ts` | Action hooks | M5 |
| `apps/api/src/application/application.module.ts` | Import ActionModule | M5 |
| `apps/api/src/student/student.service.ts` | Profile update hook | M5 |
| `apps/api/src/student/student.module.ts` | Import ActionModule | M5 |
| `apps/api/src/matching/matching.service.ts` | Refresh hook | M5 |
| `apps/api/src/matching/matching.module.ts` | Import ActionModule | M5 |
| `apps/api/src/events/events.service.ts` | Event record hook | M5 |
| `apps/api/src/events/events.module.ts` | Import ActionModule | M5 |
| `apps/api/src/notification/notification.service.ts` | Batch sync hook | M5 |
| `apps/api/src/notification/notification.module.ts` | Import ActionModule | M5 |
| `apps/api/src/notification/notification.service.spec.ts` | Mock ActionService | M8 |
| `apps/web/src/app/dashboard/page.tsx` | Dashboard UI | M6 |
| `apps/web/src/lib/api.ts` | Action types + fetch helpers | M7 |
| `apps/web/src/components/Navbar.tsx` | "לוח בקרה" link | M7 |
| `apps/web/src/middleware.ts` | Protect `/dashboard` | M7 |
| `DOCS/PROGRESS.md` | Phase 7 section | M8 |
| `AGENTS.md` | Phase 7 pointer | M8 |

## Scoring (Manager weights)

```text
priority_score = min(100, round(
  urgency * 0.40 + impact * 0.30 + completion_gap * 0.20 + engagement * 0.10
))
```

**Sample fixture:** `DEADLINE_ACTION`, daysLeft=3, no letter → score **67** (verified in `action-scoring.service.spec.ts`).

## API Examples

**GET `/api/actions?limit=5`** (student JWT):

```json
{
  "items": [
    {
      "id": "clx...",
      "type": "COMPLETION_ACTION",
      "title": "השלם/י את הפרופיל האקדמי שלך",
      "description": "הוספת תחום לימודים, שנת לימודים וממוצע...",
      "priorityScore": 25,
      "status": "OPEN",
      "relatedEntityType": "PROFILE",
      "relatedEntityId": "user-id",
      "ctaPath": "/profile",
      "createdAt": "2026-06-08T12:00:00.000Z",
      "updatedAt": "2026-06-08T12:00:00.000Z"
    }
  ]
}
```

**PATCH `/api/actions/:id`** body:

```json
{ "status": "DISMISSED" }
```

## Regeneration Hooks

| File | Trigger |
|---|---|
| `application.service.ts` | create, updateStatus, updateMotivationLetter, generateMotivationLetter |
| `student.service.ts` | updateProfile |
| `matching.service.ts` | refreshRecommendations |
| `events.service.ts` | recordEvent |
| `notification.service.ts` | syncDeadlineNotificationsForAllStudents (affected users only) |

## Unit Tests

| Field | Value |
|---|---|
| Command | `npm run test -w @scholarpath/api` |
| Result | PASS |
| Count | **35/35** (2026-06-08) |
| New specs | `action-scoring`, `action.service`, `action.controller` |

## Lint

| Field | Value |
|---|---|
| Result | NOT AVAILABLE |
| Reason | No project-wide lint script configured (consistent with Phases 4–6) |

## Functional Testability

**Manual E2E path (documented):**

1. `npm run dev` — login `student@scholarpath.local` / `student123`
2. Open `/dashboard` — lazy regenerate on empty OPEN shows actions
3. Incomplete profile → `COMPLETION_ACTION` with CTA `/profile`
4. Complete profile + regenerate → completion action removed or deprioritized
5. Application near deadline without letter → `DEADLINE_ACTION` ranks high
6. "התעלם" → card removed from list
7. Smoke: `/recommendations`, `/applications`, notification bell unchanged

**API smoke:** `GET /api/actions` returns `{ items: [...] }` sorted by `priorityScore` desc.

## Scope Compliance

- No AI calls in `apps/api/src/action/`
- No `SystemEvents` table
- No scraping / production `IngestionJob` agent
- No new top-level repo folders
- Application state machine and notification/mail paths unchanged

## Known Issues

- Windows: stop API before `db:generate` if EPERM on Prisma DLL (same as Phase 6)
- Engagement actions require scholarship row fetch for viewed IDs not in recommendations

## Declaration

**PASS** — All milestones M1–M8 complete; 35/35 unit tests PASS; functional path documented.
