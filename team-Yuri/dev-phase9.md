# Developer Phase 9

## Phase Identifier
PHASE=9

## Status
STATUS: COMPLETE

## Source References
- `team-Yuri/PHASE.md`
- `team-Yuri/plan.md`
- `team-Yuri/arch-phase9.md`
- `team-Yuri/manager-phase9.md`
- `AGENTS.md`
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`

## Implementation Summary
External Integration Layer (scholarships MVP): extended Phase 5 `IngestionModule` with `IngestionJob` audit trail, upsert-by-normalized-`sourceUrl`, allowlisted fetch adapter, jobs read API, fetch trigger with rate limit, `EXTERNAL_DATA_SYNCED` sync hook via `MatchingService.refreshRecommendations` (no direct `ActionService` in ingestion), optional cron, Hebrew admin UI, and fixture for local dev.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---:|---:|---|
| M1 Schema + migration | Yes | `20260611120000_ingestion_jobs` |
| M2 Import upsert + job audit | Yes | `jobId`, `updated` in response |
| M3 Allowlist + fetch adapter | Yes | `file://` + `https://`; array or `{ items }` |
| M4 Jobs read API | Yes | `GET /admin/ingestion/jobs`, `GET .../:id` |
| M5 Fetch trigger API | Yes | `POST /admin/ingestion/fetch`, 60s cooldown |
| M6 Sync hook + cron | Yes | `IngestionSyncService`; scheduler opt-in |
| M7 Admin UI | Yes | Import counts, fetch form, job history (Hebrew) |
| M8 Tests + docs | Yes | 61 Jest PASS |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `packages/database/prisma/schema.prisma` | `IngestionJob`, enums | M1 |
| `packages/database/prisma/migrations/20260611120000_ingestion_jobs/` | SQL migration | M1 |
| `packages/database/src/index.ts` | Export new enums/types | M1 |
| `apps/api/src/ingestion/ingestion.service.ts` | Upsert, jobs, sync hook | M2, M5, M6 |
| `apps/api/src/ingestion/ingestion.types.ts` | Response types, URL normalize | M2 |
| `apps/api/src/ingestion/ingestion-allowlist.service.ts` | Env allowlist parser | M3 |
| `apps/api/src/ingestion/ingestion-fetch.service.ts` | HTTP/file fetch adapter | M3 |
| `apps/api/src/ingestion/ingestion-admin.controller.ts` | Jobs API + fetch | M4, M5 |
| `apps/api/src/ingestion/ingestion-sync.scheduler.ts` | Optional cron | M6 |
| `apps/api/src/ingestion/ingestion.module.ts` | Wire MatchingModule, providers | M6 |
| `apps/api/src/ingestion/dto/*.ts` | Fetch + list DTOs | M4, M5 |
| `apps/api/src/ingestion/*.spec.ts` | Unit tests | M8 |
| `fixtures/scholarships-external.json` | Dev external payload | M3 |
| `apps/web/src/lib/api.ts` | Ingestion API client | M7 |
| `apps/web/src/app/admin/page.tsx` | Fetch form, job table | M7 |
| `.env.example` | Ingestion env vars | M3 |
| `DOCS/PROGRESS.md` | Phase 9 section | M8 |
| `AGENTS.md` | Phase 9 pointer | M8 |

## Upsert Rules (fixtures)

| Scenario | Expected |
|---|---|
| Same `sourceUrl` re-imported | `updated: 1`, existing IMPORTED row updated |
| SEED row with same URL | New IMPORTED row created; SEED untouched |
| No `sourceUrl` | Always `imported`; no dedupe |

Verified in `ingestion.service.spec.ts`.

## Allowlist

```text
INGESTION_ALLOWLIST={"local-fixture":"file://./fixtures/scholarships-external.json"}
```

Test key used: `local-fixture`

## Sync Hook

- `IngestionSyncService.onExternalDataSynced(jobId)` called after SUCCESS when `imported + updated > 0`
- Sequential `MatchingService.refreshRecommendations` for students with complete profiles
- **No** `ActionService` import/injection in `IngestionModule` (verified via grep)
- Indirect action update via existing matching path is allowed per manager contract

## API Examples

### Import response
```json
{
  "jobId": "clx...",
  "imported": 1,
  "updated": 1,
  "skipped": 0
}
```

### Fetch success
```json
{
  "jobId": "clx...",
  "imported": 2,
  "updated": 1,
  "skipped": 0
}
```

### Jobs list
```json
{
  "items": [{ "id", "sourceType", "sourceRef", "status", "imported", "updated", "skipped", "startedAt", "completedAt" }],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

## Unit Tests

```bash
npm run test -w @scholarpath/api
```

**Result:** 61/61 PASS (2026-06-09)

New ingestion specs: `ingestion.service.spec.ts`, `ingestion-allowlist.service.spec.ts`, `ingestion-fetch.service.spec.ts`, `ingestion-admin.controller.spec.ts`, `ingestion-sync.scheduler.spec.ts`, `ingestion.types.spec.ts`

## Lint

NOT AVAILABLE — no project-wide lint script configured for API package (consistent with Phases 4–8).

## Functional Testability

1. Login `admin@scholarpath.local` → `/admin` → import JSON → see `יובאו / עודכנו / דולגו` + `jobId`
2. Fetch `local-fixture` → SUCCESS → scholarships visible on `/scholarships`
3. Re-fetch same fixture → `updated` count increases
4. Unknown fetch key → 400 error in UI
5. Job history table shows recent runs on `/admin`
6. Student `/recommendations` refresh smoke after ingest (sync hook)
7. Regression smoke: `/dashboard`, `/applications`, `/notifications` unchanged

## Scope Compliance

- No autonomous scraping
- No `ActionService` in `IngestionModule`
- No jobs/universities ingestion
- No unique index on `Scholarship.sourceUrl`
- No new top-level repo folders
- Import path unchanged: `POST /admin/scholarships/import`

## Known Issues

- `npx prisma generate` may fail with EPERM on Windows if dev server holds Prisma DLL — stop server before generate
- Fetch validation errors in external payload fail entire fetch job (by design for Phase 9 fetch adapter)

## Declaration

**PASS** — Phase 9 implementation complete per `manager-phase9.md` acceptance criteria; unit tests 61/61 PASS.
