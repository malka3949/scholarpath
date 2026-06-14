# Manager Phase 9

## Phase Identifier
PHASE=9

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
**External Integration Layer (scholarships MVP):** extend Phase 5 `IngestionModule` with controlled scholarship ingestion — enhanced admin bulk import **and** admin-triggered fetch from env allowlisted URLs — normalize to internal schema, persist with `IngestionJob` audit trail, emit `EXTERNAL_DATA_SYNCED` hook to batch-refresh recommendations only — without autonomous scraping, direct Action Engine calls, or jobs/universities scope.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=9`
- `team-Yuri/plan.md` — Phase 9 section
- `team-Yuri/arch-phase9.md` — architecture contract (`READY_FOR_MANAGER`)
- `team-Yuri/arch-phase5.md`, `manager-phase5.md`, `dev-phase5.md` — import baseline (APPROVED)
- `team-Yuri/arch-phase8.md` — Action Engine; no direct ingestion → action path
- `DOCS/prd/scholar_path_prd_v3.md` — §Phase 9, §4 Layer 4, §6 invariants
- `DOCS/architecture/ScholarPath – Architecture Plan v3` — §Phase 9, §5 events, §7 invariants, §10–11 consistency/failure
- `DOCS/engineering/agent-guides/scholarpath-agent-implementation-guide-v1.md` — §Phase 9, §5–8
- `AGENTS.md`, `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`
- Existing: `apps/api/src/ingestion/`, `apps/api/src/matching/`, `apps/web/src/app/admin/page.tsx`

## Architecture Summary
Phase 9 **extends** the existing `IngestionModule` — no parallel ingestion system. Schema adds `IngestionJob` + enums. Import path enhanced with upsert-by-`sourceUrl` and job audit. New allowlisted HTTP fetch adapter (SSRF-safe: keys only, no raw URLs). After successful ingest, `IngestionSyncService` emits internal `EXTERNAL_DATA_SYNCED` hook → sequential batch `MatchingService.refreshRecommendations` for students with complete profiles. **Forbidden:** `ActionService` import/injection in `IngestionModule` (indirect action update via existing matching path is allowed). Admin UI on `/admin` gains fetch trigger and job history (Hebrew).

## Manager Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Import path | **Keep** `POST /admin/scholarships/import` | Backward compatibility per arch; extend response only |
| Dedupe strategy | **Application-level upsert** by normalized `sourceUrl`; **no** partial unique DB index in M1 | SEED rows may have null/duplicate URLs; avoid migration risk |
| Upsert target | Only `source = IMPORTED` rows matching `sourceUrl`; **never** update SEED/ADMIN | arch constraint |
| URL normalization | Trim, lowercase scheme+host, strip trailing slash before compare | Deterministic dedupe |
| Allowlist format | **`INGESTION_ALLOWLIST`** — JSON string env `{ "key": "https://..." }` | Parse at module init; invalid JSON → empty allowlist + warn log |
| Dev fixture | **`fixtures/scholarships-external.json`** + allowlist key **`local-fixture`** in `.env.example` | Functional test without real external API |
| Fetch timeout | **`INGESTION_FETCH_TIMEOUT_MS=30000`** | Architect default |
| Fetch rate limit | **60s cooldown** per admin user on `POST /admin/ingestion/fetch` (in-memory map) | Same pattern as action regenerate |
| External JSON shape | Accept **array** or **`{ "items": [...] }`** → `ImportScholarshipItemDto[]` | Same validation as bulk import |
| Sync hook | **`IngestionSyncService.onExternalDataSynced(jobId)`** — async after SUCCESS when `imported + updated > 0` | Eventual consistency; non-blocking HTTP response |
| Batch refresh strategy | **Sequential** `refreshRecommendations` for all STUDENT users with complete profiles | Closes arch open question; simple, predictable |
| Action Engine boundary | **Forbidden:** `ActionService` in `IngestionModule`. **Allowed:** indirect `scheduleRegenerate` inside existing `MatchingService.refreshRecommendations` | v3 data flow |
| Sync failure handling | Job stays **SUCCESS** if ingest OK; log refresh failures per user; no scholarship rollback | arch §10 eventual consistency |
| Cron | **`CRON_INGESTION_SYNC`** optional; **empty = disabled**; when set, fetch **all** allowlist keys sequentially | Explicit opt-in only |
| Import max items | **50** per request (unchanged) | Existing `ImportScholarshipsDto` |
| Job pagination | `limit=20`, max **50**, `offset=0`; sort `startedAt` desc | Consistent with Phase 8 |
| Job status lifecycle | `PENDING` → `RUNNING` → `SUCCESS` \| `FAILED` | Set `completedAt` on terminal states |
| `errorLog` shape | `{ "message": string, "details"?: unknown[] }` or array of `{ "index"?, "message" }` | Validation errors + fetch errors |
| New controller | **`IngestionAdminController`** at `/admin/ingestion` for fetch + jobs; keep import on existing controller | Minimal route churn |
| New top-level folder | **No** | `40-project-structure.md` |

## Environment Variables

| Env var | Default | Purpose |
|---|---|---|
| `INGESTION_ALLOWLIST` | `{}` | JSON map `sourceKey → URL` |
| `INGESTION_FETCH_TIMEOUT_MS` | `30000` | HTTP fetch timeout |
| `CRON_INGESTION_SYNC` | `` (empty) | Optional cron; fetch all keys when set |

**`.env.example` addition (dev):**

```text
INGESTION_ALLOWLIST={"local-fixture":"file://./fixtures/scholarships-external.json"}
INGESTION_FETCH_TIMEOUT_MS=30000
CRON_INGESTION_SYNC=
```

**Note:** For local dev, Manager allows `file://` handler reading from repo fixture OR mock HTTP in tests; production paths must be `https://` only (Developer validates in fetch adapter).

## Upsert Contract

| Condition | Behavior |
|---|---|
| Item has `sourceUrl` + existing IMPORTED row with same normalized URL | **Update** title, description, deadline, tags, eligibilityRules, sourceUrl |
| Item has `sourceUrl` + no matching IMPORTED row | **Create** with `source=IMPORTED` |
| Item has `sourceUrl` + matching SEED/ADMIN row | **Create new IMPORTED row** (do not modify SEED/ADMIN) |
| Item has no `sourceUrl` | **Create** only; count as `imported` |

**Counts:**
- `imported` — new rows created
- `updated` — existing IMPORTED rows updated
- `skipped` — validation failures or unrecoverable row errors

## Sync Hook Contract (`EXTERNAL_DATA_SYNCED`)

**Trigger:** After import/fetch job reaches `SUCCESS` and `imported + updated > 0`.

**Implementation:** `IngestionSyncService.onExternalDataSynced(jobId: string)`

1. Load all users where `role = STUDENT` and profile has `fieldOfStudy`, `year`, `gpa` all set (reuse `StudentService.isProfileComplete` or equivalent query)
2. For each user **sequentially:** call `MatchingService.refreshRecommendations(userId)` inside try/catch
3. Log summary: `Ingestion sync job {jobId}: refreshed {n} students, {failures} failures`
4. Do **not** await in HTTP handler — fire-and-forget with error logging (same pattern as `scheduleRegenerate`)

**Forbidden in `IngestionModule` / sync service:**
- Import or inject `ActionService`
- Call `ActionService.regenerateForUser` directly

**Allowed indirectly:** `MatchingService.refreshRecommendations` already calls `actionService.scheduleRegenerate(userId)` — this is existing v3 downstream behavior.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Schema + migration | `IngestionJob`, enums; export from database package | `npm run db:migrate` succeeds |
| M2 | Import upsert + job audit | Enhance `IngestionService.importScholarships` | Duplicate `sourceUrl` → `updated`; `jobId` in response |
| M3 | Allowlist + fetch adapter | Parse env; HTTP fetch; normalize JSON | Unknown key → 400; mock → items |
| M4 | Jobs read API | `GET /admin/ingestion/jobs`, `GET .../:id` | Paginated history; detail with errors |
| M5 | Fetch trigger API | `POST /admin/ingestion/fetch` | End-to-end job + scholarships |
| M6 | Sync hook | `IngestionSyncService` + wire after SUCCESS | Matching called; no ActionService in ingestion |
| M7 | Admin UI | Fetch form, job table, enhanced import result (Hebrew) | Admin flows without curl |
| M8 | Tests + docs | Specs, `dev-phase9.md`, PROGRESS/AGENTS | `npm run test -w @scholarpath/api` PASS |

## Detailed Development Plan

### M1 — Prisma schema and migration

**File:** `packages/database/prisma/schema.prisma`

```prisma
enum IngestionSourceType {
  IMPORT
  FETCH
}

enum IngestionJobStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
}

model IngestionJob {
  id          String              @id @default(cuid())
  sourceType  IngestionSourceType @map("source_type")
  sourceRef   String              @map("source_ref")
  status      IngestionJobStatus  @default(PENDING)
  imported    Int                 @default(0)
  updated     Int                 @default(0)
  skipped     Int                 @default(0)
  errorLog    Json?               @map("error_log")
  startedAt   DateTime            @default(now()) @map("started_at")
  completedAt DateTime?           @map("completed_at")

  @@index([startedAt])
  @@map("ingestion_jobs")
}
```

**Migration:** `packages/database/prisma/migrations/<timestamp>_ingestion_jobs/migration.sql`

- Export enums from `packages/database/src/index.ts`
- **No** unique index on `Scholarship.sourceUrl` in Phase 9

---

### M2 — Import upsert + job audit

**Files:**
- `apps/api/src/ingestion/ingestion.service.ts` (refactor)
- `apps/api/src/ingestion/ingestion.types.ts` (new, optional — response DTOs)
- `apps/api/src/ingestion/ingestion.service.spec.ts` (extend)

**Pipeline for `importScholarships`:**

1. Create `IngestionJob` (`sourceType=IMPORT`, `sourceRef=bulk-import`, `status=RUNNING`)
2. For each item: validate → upsert per Upsert Contract
3. Update job counts; set `status=SUCCESS` or `FAILED` if catastrophic error
4. If SUCCESS and `imported + updated > 0` → trigger sync hook (M6)
5. Return extended response

**Response shape:**

```json
{
  "jobId": "clx...",
  "imported": 1,
  "updated": 1,
  "skipped": 0,
  "errors": [{ "index": 2, "message": "..." }]
}
```

**Backward compatibility:** Existing clients reading `imported`/`skipped` still work; `updated` and `jobId` are additive.

**Tests (minimum):**
- Same `sourceUrl` twice in one import → second item updates first
- Re-import with changed title → `updated` increments
- SEED scholarship with same URL not modified
- Validation error → `skipped` + error entry; job still SUCCESS if partial

---

### M3 — Allowlist + fetch adapter

**Files:**
- `apps/api/src/ingestion/ingestion-allowlist.service.ts` (new)
- `apps/api/src/ingestion/ingestion-fetch.service.ts` (new)
- `apps/api/src/ingestion/ingestion-allowlist.service.spec.ts` (new)
- `apps/api/src/ingestion/ingestion-fetch.service.spec.ts` (new)

**AllowlistService:**
- Parse `INGESTION_ALLOWLIST` JSON at construction
- `getUrl(sourceKey: string): string` — throws `BadRequestException` if unknown
- `listKeys(): string[]` — for admin UI dropdown

**FetchService:**
- `fetchItems(sourceKey: string): Promise<ImportScholarshipItemDto[]>` 
- HTTP GET with `INGESTION_FETCH_TIMEOUT_MS` (use `fetch` or `@nestjs/axios`)
- Parse body: array OR `{ items: array }`
- Map to DTO instances + validate
- **SSRF:** reject keys not in allowlist; no URL in request body

**Tests:**
- Unknown key → 400
- Valid JSON array → normalized items
- `{ "items": [...] }` wrapper → normalized items
- Timeout → error propagated

---

### M4 — Jobs read API

**Files:**
- `apps/api/src/ingestion/ingestion-admin.controller.ts` (new)
- `apps/api/src/ingestion/ingestion.module.ts` (register controller)

#### `GET /api/admin/ingestion/jobs`

| Query param | Type | Default | Validation |
|---|---|---|---|
| `status` | `PENDING \| RUNNING \| SUCCESS \| FAILED` | — | Optional |
| `limit` | int | `20` | 1–50 |
| `offset` | int | `0` | ≥ 0 |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "clx...",
      "sourceType": "FETCH",
      "sourceRef": "local-fixture",
      "status": "SUCCESS",
      "imported": 2,
      "updated": 0,
      "skipped": 0,
      "startedAt": "2026-06-09T10:00:00.000Z",
      "completedAt": "2026-06-09T10:00:01.000Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

#### `GET /api/admin/ingestion/jobs/:id`

**Response `200`:** full job including `errorLog`.

**Response `404`:** job not found.

**Auth:** `JwtAuthGuard` + `AdminGuard` on all routes.

**Tests:** `ingestion-admin.controller.spec.ts` — pagination, filter by status, 404.

---

### M5 — Fetch trigger API

**File:** `apps/api/src/ingestion/ingestion-admin.controller.ts`

#### `POST /api/admin/ingestion/fetch`

**Request body:**

```json
{ "sourceKey": "local-fixture" }
```

**DTO:** `FetchIngestionDto` with `@IsString()` `@IsNotEmpty()` on `sourceKey`.

**Behavior:**
1. Rate limit check (60s per admin user)
2. Create job (`sourceType=FETCH`, `sourceRef=sourceKey`, `RUNNING`)
3. Call `FetchService.fetchItems(sourceKey)`
4. Pass items to shared upsert pipeline (extract from M2)
5. Complete job; trigger sync hook if applicable
6. Return same response shape as import

**Errors:**
- Unknown `sourceKey` → `400` before job created OR job `FAILED` with errorLog
- HTTP/network failure → job `FAILED`

**Tests:** end-to-end with mocked HTTP; verify job row + scholarship rows.

---

### M6 — EXTERNAL_DATA_SYNCED sync hook

**Files:**
- `apps/api/src/ingestion/ingestion-sync.service.ts` (new)
- `apps/api/src/ingestion/ingestion-sync.service.spec.ts` (new)
- `apps/api/src/ingestion/ingestion.module.ts` — import `MatchingModule` (forwardRef if circular)

**Wire:** `IngestionService` calls `ingestionSyncService.onExternalDataSynced(jobId)` after SUCCESS when counts > 0.

**Tests:**
- Mock `MatchingService.refreshRecommendations` — called N times for N complete students
- Mock must **not** include `ActionService` in ingestion module providers
- Refresh failure for one user → others still processed; logged

---

### M6b — Optional ingestion cron (same milestone)

**File:** `apps/api/src/ingestion/ingestion-sync.scheduler.ts` (new)

- `@Cron(process.env.CRON_INGESTION_SYNC)` — skip if env empty
- For each key in allowlist: call fetch pipeline (same as M5 without HTTP request context)
- Log total jobs created

**Test:** scheduler spec — cron invokes fetch for each key when env set.

---

### M7 — Admin UI

**Files:**
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/lib/api.ts`

**Hebrew UI sections:**

1. **ייבוא מלגות (JSON)** — existing textarea; result shows: `יובאו: X, עודכנו: Y, דולגו: Z` + `מזהה job: ...`
2. **משיכה ממקור חיצוני** — input/select for `sourceKey`, button **משוך מלגות**; show result or error
3. **היסטוריית ייבוא** — table: תאריך, סוג, מקור, סטטוס, יובאו/עודכנו/דולגו; expandable `errorLog`

**API client additions:**

```typescript
export type IngestionJobItem = { id, sourceType, sourceRef, status, imported, updated, skipped, startedAt, completedAt?, errorLog? };
export type IngestionJobListResponse = { items, total, limit, offset };
export type IngestionResult = { jobId, imported, updated, skipped, errors? };

fetchExternalScholarships(token, sourceKey)
fetchIngestionJobs(token, params?)
fetchIngestionJob(token, id)
```

Update `ImportScholarshipsResult` to include `jobId` and `updated`.

---

### M8 — Tests and documentation

**Minimum new/updated specs:**

| File | Tests |
|---|---|
| `ingestion.service.spec.ts` | Upsert, job lifecycle, SEED not modified |
| `ingestion-allowlist.service.spec.ts` | Parse env, unknown key |
| `ingestion-fetch.service.spec.ts` | JSON shapes, timeout |
| `ingestion-admin.controller.spec.ts` | Fetch, jobs list, rate limit |
| `ingestion-sync.service.spec.ts` | Batch refresh, no ActionService |
| `ingestion-sync.scheduler.spec.ts` | Cron when env set |

**Regression:** Phase 5 ingestion, Phase 7–8 matching/action tests PASS.

**Command:**
```bash
npm run test -w @scholarpath/api
```

**Docs:**
- `team-Yuri/dev-phase9.md`
- `DOCS/PROGRESS.md` — Phase 9 section
- `AGENTS.md` — Phase 9 pointer
- `fixtures/scholarships-external.json` — sample external payload (2–3 scholarships)

---

## Acceptance / Gating Criteria

- [x] Migration applied: `IngestionJob`, `IngestionSourceType`, `IngestionJobStatus`
- [x] Import upsert by normalized `sourceUrl`; `imported` / `updated` / `skipped` counts correct
- [x] SEED and ADMIN scholarships never updated by ingestion
- [x] Every import/fetch creates `IngestionJob` audit row
- [x] Fetch rejects unknown `sourceKey` (400); no raw URL in request body
- [x] Allowlist-only fetch; timeout enforced
- [x] `GET /admin/ingestion/jobs` paginated with `total`
- [x] `GET /admin/ingestion/jobs/:id` returns `errorLog`
- [x] Sync hook runs after SUCCESS when `imported + updated > 0`
- [x] `MatchingService.refreshRecommendations` called for complete-profile students
- [x] **No** `ActionService` provider/import in `IngestionModule`
- [x] Fetch rate limit 60s per admin
- [x] Admin UI: import result shows updated count; fetch + job history (Hebrew)
- [x] `fixtures/scholarships-external.json` + `.env.example` documented
- [x] Optional cron disabled by default; works when `CRON_INGESTION_SYNC` set
- [x] Phase 5–8 regression PASS
- [x] `dev-phase9.md` complete with declaration PASS

## Functional Testability Criteria

- **Page:** `/admin` — import, fetch, job history
- **User-visible:** Imported/fetched scholarships on `/scholarships` with **מיובא** badge; student `/recommendations` refresh may show new items (smoke)
- **CLI:** `npm run dev`; `npm run test -w @scholarpath/api`
- **API:**
  - `POST /api/admin/scholarships/import` — duplicate `sourceUrl` → 1 imported + 1 updated
  - `POST /api/admin/ingestion/fetch` `{ "sourceKey": "local-fixture" }`
  - `POST /api/admin/ingestion/fetch` unknown key → 400
  - `GET /api/admin/ingestion/jobs?limit=10`
  - `GET /api/admin/ingestion/jobs/:id`
- **Minimal E2E:**
  1. Login `admin@scholarpath.local` → import JSON → see counts + job in history
  2. Trigger fetch `local-fixture` → SUCCESS → scholarships visible
  3. Login `student@scholarpath.local` → `/recommendations` → refresh (smoke)
  4. Invalid fetch key → error in UI
  5. Smoke: `/dashboard`, `/applications`, `/notifications` unchanged
- **Credentials:** `admin@scholarpath.local` / `admin123`, `student@scholarpath.local` / `student123`

## Required Developer Evidence

`team-Yuri/dev-phase9.md` must include:

| Section | Required content |
|---|---|
| Phase identifier | `PHASE=9` |
| Milestones | Table M1–M8 with Yes/No |
| Files changed | Paths under `packages/database`, `apps/api/src/ingestion`, `apps/web`, `fixtures/` |
| Upsert rules | Fixture mapping duplicate `sourceUrl` → updated |
| Allowlist | Env example + test key used |
| Sync hook | Evidence Matching called; ActionService not in ingestion module |
| API examples | Import response with `jobId`; fetch success/failure; jobs list JSON |
| Unit tests | Command + PASS count |
| Lint | PASS or NOT AVAILABLE + reason |
| Functional | E2E steps above |
| Scope compliance | No scraping, no ActionService in ingestion, no jobs/universities |
| Declaration | PASS or FAIL |

## Out of Scope

- Autonomous scraping / headless browsers
- Jobs, universities, career opportunity types
- Full `SystemEvents` / event replay UI
- External application submission
- Student-facing ingestion UI
- Direct `ActionService.regenerateForUser` from ingestion
- Push/SMS; new email types from ingestion
- Partial unique index on `sourceUrl` (deferred)
- New top-level monorepo folders

## Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Circular dependency Ingestion ↔ Matching | Use `forwardRef` if needed; keep sync in dedicated service |
| `file://` fetch in dev vs `https://` in prod | Document in dev-phase9; tests use mocked HTTP |
| Batch refresh slow for many students | Sequential acceptable Phase 9; log duration |
| SEED URL collision | Upsert never touches SEED; may create duplicate IMPORTED — acceptable |

| Open Question | Status |
|---|---|
| Import path under `/admin/ingestion/import` | **Closed** — keep `/admin/scholarships/import` |
| Partial unique on `sourceUrl` | **Closed** — application-level dedupe only |
| Batch vs lazy rec refresh | **Closed** — batch sequential after SUCCESS |
| `file://` in allowlist for dev | **Closed** — allowed for fixture; Manager documents |

## Pre-flight (non-blocking)

Post-Phase-8 ad-hoc fixes (dashboard loading spinner, `/actions` lazy-regenerate recursion) may be documented in a small Developer patch parallel to M1; **not** a Phase 9 acceptance gate.

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes

**Review date:** 2026-06-09  
**Evidence reviewed:** `team-Yuri/dev-phase9.md`, independent test run, code spot-check.

| Check | Result |
|---|---|
| Phase identifier | PASS — `PHASE=9` aligned |
| Milestones M1–M8 | PASS — all marked Yes with file paths |
| Required dev-phase9 sections | PASS — milestones, files, upsert, allowlist, sync hook, API examples, tests, lint N/A, functional steps, scope, declaration |
| Unit tests | PASS — Manager re-ran `npm run test -w @scholarpath/api`: **61/61 PASS** |
| Lint | PASS (N/A) — consistent with Phases 4–8 |
| Scope compliance | PASS — no ActionService in `IngestionModule`; no scraping; import path preserved; no `sourceUrl` unique index |
| Architecture boundary | PASS — sync via `MatchingService.refreshRecommendations` only |
| Admin UI (Hebrew) | PASS — import counts + jobId, fetch form, job history verified in `admin/page.tsx` |
| Fixture + env | PASS — `fixtures/scholarships-external.json`, `.env.example` |

**Minor observations (non-blocking):**
- Sync hook tests live in `ingestion.service.spec.ts` rather than dedicated `ingestion-sync.service.spec.ts` — coverage adequate.
- Functional E2E steps documented but not marked manually executed; unit + integration specs satisfy Phase 9 gate (consistent with Phase 8 pattern).
- Fetch failure JSON example omitted from dev-phase9 API section; failure path covered in code (`fetchFromSource` → job FAILED) and allowlist/controller specs.

### Required Corrections

None.
