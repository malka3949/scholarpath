# Architecture Phase 9

## Phase Identifier
PHASE=9

## Status
STATUS: APPROVED

## Phase Goal
**External Integration Layer (scholarships MVP):** extend Phase 5 `IngestionModule` with controlled scholarship ingestion from external sources — enhanced admin bulk import **and** admin-triggered fetch from env allowlisted URLs/APIs — normalize to internal schema, persist with audit trail (`IngestionJob`), emit `EXTERNAL_DATA_SYNCED` hook to refresh recommendations only — without autonomous scraping, direct Action Engine triggers, or jobs/universities scope.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=9`
- `team-Yuri/plan.md` — Phase 9 section
- `DOCS/prd/scholar_path_prd_v3.md` — §Phase 9 External Integration Layer, §4 Layer 4 Expansion, §6 invariants
- `DOCS/architecture/ScholarPath – Architecture Plan v3` — §Phase 9 External Integration, §5 Event-Driven Architecture, §6 Data Ownership, §7 Invariants, §10 Consistency, §11 Failure Model
- `DOCS/engineering/agent-guides/scholarpath-agent-implementation-guide-v1.md` — §Phase 9 Integration Layer, §5 Event Handling, §7 Data Flow Contract, §8 Failure Handling
- `team-Yuri/arch-phase5.md` — Growth Layer import baseline (APPROVED; deferred `IngestionJob`)
- `team-Yuri/arch-phase8.md` — Action Engine v3 (APPROVED); no direct ingestion → action path
- Existing: `apps/api/src/ingestion/`, `apps/api/src/matching/`, `ScholarshipSource.IMPORTED`

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **Phase 9 = extend IngestionModule, not greenfield** | Phase 5 delivered admin JSON import | Harden existing module; no parallel ingestion system |
| **Scholarships only in Phase 9 MVP** | PRD lists jobs/universities later; need functionally testable slice | Jobs, universities, career models explicitly out of scope |
| **Two ingestion paths (orchestrator approved)** | User chose import + allowlisted fetch | (A) enhanced bulk import with upsert; (B) admin-triggered HTTP fetch from allowlist |
| **Add `IngestionJob` table** | Phase 5 deferred; ops visibility required | Job status, counts, errors, timestamps per run |
| **Upsert + dedupe by `sourceUrl`** | Current import only `create`s; duplicates possible | Update existing IMPORTED row when `sourceUrl` matches; create when new |
| **Allowlist via env/config** | Legal/ops control without DB admin UI in Phase 9 | e.g. `INGESTION_ALLOWLIST` JSON map key → URL; Manager refines format |
| **Admin-initiated only** | v3 + agent guide: read-only externals; no unsupervised scraping | All fetch/import triggered by ADMIN; cron optional with explicit env gate |
| **`EXTERNAL_DATA_SYNCED` as internal hook** | Architecture v3 event type; full `SystemEvents` deferred (Phase 8) | Lightweight service method after successful batch → recommendation refresh |
| **Recommendation refresh only downstream** | v3 data flow: External → Recommendations → Actions (indirect) | Call `MatchingService.refreshRecommendations` (batch); **never** `ActionService.regenerateForUser` from ingestion |
| **Eventual consistency for external data** | Architecture v3 §10 | Ingest succeeds even if batch rec refresh fails (log + job partial state) |
| **Phase 9 failure isolation** | Architecture v3 §11 | Ingestion errors do not corrupt SEED/ADMIN rows; app runs on internal data |
| **Optional unique on `Scholarship.sourceUrl`** | Dedupe integrity | Manager validates migration impact on nullable/duplicate SEED rows |
| **Admin UI on `/admin`** | Consistent with Phase 5 import UX | Job history, trigger fetch, enhanced import (Hebrew) |
| **No new top-level folders** | `40-project-structure.md` | Modules under `apps/api/src/ingestion`, `apps/web/src/app/admin` |

## Constraints / Non-Negotiables
- External systems are **read-only** inputs; no submission to external systems.
- External data **must not** mutate internal state outside defined module ownership (`IngestionModule` → `Scholarship`).
- **No direct Action Engine** calls from ingestion (no auto-actions, no priority logic).
- **No autonomous/unsupervised scraping** (no headless browsers, no unbounded URL crawling).
- Human/admin initiates every import and fetch in Phase 9 MVP.
- Preserve Phases 1–8: auth, applications, recommendations, actions, notifications, community, email.
- `ScholarshipSource.SEED` demo rows **must not** be deleted or overwritten by ingestion.
- Developer: unit tests + `dev-phase9.md`; `npm run test -w @scholarpath/api` before PASS.
- Hebrew UI for new admin surfaces; English code and artifacts.

## Technical Boundaries / Out of Scope
- Autonomous 24/7 scraping agents
- Jobs, universities, career/opportunity types beyond `Scholarship`
- Full immutable `SystemEvents` table and event replay UI
- External application submission
- Direct writes from external systems to DB (bypassing ingestion validation)
- Student-facing ingestion UI
- Push/SMS; new email types from ingestion
- ML training pipelines
- Replacing PostgreSQL or monorepo structure
- New top-level repo folders

## Dependencies and Interfaces

**Depends on:**
- Phase 5: `IngestionModule`, `POST /admin/scholarships/import`, `ScholarshipSource.IMPORTED`
- Phase 7 (v3): `MatchingModule`, `Recommendation` model, `refreshRecommendations`
- Phase 8: Action Engine unchanged; may reflect new scholarships indirectly after rec refresh
- Phase 1: Admin role, Scholarship CRUD, `/scholarships` browse

**Schema additions (indicative):**

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
  sourceType  IngestionSourceType
  sourceRef   String              // allowlist key or "bulk-import"
  status      IngestionJobStatus  @default(PENDING)
  imported    Int                 @default(0)
  updated     Int                 @default(0)
  skipped     Int                 @default(0)
  errorLog    Json?
  startedAt   DateTime            @default(now()) @map("started_at")
  completedAt DateTime?           @map("completed_at")

  @@map("ingestion_jobs")
}
```

**Optional schema amendment:**
- Partial unique index on `Scholarship.sourceUrl` WHERE `sourceUrl IS NOT NULL` (Manager validates SEED null URLs)

**Ingestion pipeline (ordered):**

1. Create `IngestionJob` (RUNNING)
2. Validate + normalize payload (DTO / external JSON schema)
3. For each item: upsert by `sourceUrl` when present; else create with `source=IMPORTED`
4. Update job counts (imported / updated / skipped / errors)
5. On success: emit `EXTERNAL_DATA_SYNCED` hook → batch recommendation refresh
6. Mark job SUCCESS or FAILED

**Allowlist (Architect default — Manager may refine):**

```text
INGESTION_ALLOWLIST='{"demo-feed":"https://example.com/scholarships.json"}'
INGESTION_FETCH_TIMEOUT_MS=30000
CRON_INGESTION_SYNC=""   # empty = disabled; optional e.g. "0 6 * * *" UTC
```

**API surface (extends Phase 5):**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/admin/scholarships/import` | ADMIN | Enhanced bulk import (upsert, job record) — backward-compatible response shape extended |
| `POST` | `/admin/ingestion/fetch` | ADMIN | Body: `{ "sourceKey": "demo-feed" }` — fetch allowlisted URL, normalize, upsert |
| `GET` | `/admin/ingestion/jobs` | ADMIN | Paginated job history (`limit`, `offset`, optional `status`) |
| `GET` | `/admin/ingestion/jobs/:id` | ADMIN | Job detail + error log |

**Downstream hook (internal, not public API):**

| Hook | Trigger | Downstream |
|---|---|---|
| `EXTERNAL_DATA_SYNCED` | After job SUCCESS with imported+updated > 0 | `IngestionSyncService` → batch `MatchingService.refreshRecommendations` for students with complete profiles |

**Data flow (v3 contract):**

```text
Allowlisted URL / Admin JSON
        ↓
IngestionModule (validate → normalize → upsert)
        ↓
IngestionJob audit
        ↓
EXTERNAL_DATA_SYNCED hook
        ↓
MatchingModule.refreshRecommendations (batch)
        ↓
(Action Engine updates indirectly on existing user/event hooks — NOT from ingestion)
        ↓
Frontend: /scholarships, /recommendations
```

## Data / State Considerations
- `IngestionJob` rows are append-only audit log; no hard delete in Phase 9.
- Upsert rule: match `sourceUrl` (case-normalized URL); update title, description, deadline, tags, eligibilityRules; keep `source=IMPORTED`.
- Items without `sourceUrl` in bulk import: create only (no upsert key); count as `imported`.
- SEED and ADMIN scholarships: never updated by ingestion upsert (only IMPORTED rows or new IMPORTED creates).
- Fetch adapter expects JSON array or `{ "items": [...] }` wrapper — same normalized shape as import DTO (Manager documents schema).
- Idempotent re-fetch: same `sourceUrl` → update not duplicate.

## Security / Privacy Considerations
- All ingestion routes: `JwtAuthGuard` + `AdminGuard`.
- Fetch only to URLs in env allowlist; reject unknown `sourceKey` with 400.
- SSRF mitigation: no user-supplied raw URLs; only predefined keys → URLs from config.
- Do not log full external payloads containing PII in production logs; job `errorLog` may store validation messages only.
- Rate limit fetch endpoint (Manager: e.g. 1 req/min per admin or global cooldown).

## Testing and Lint Expectations
- Unit: validation/normalize; upsert by `sourceUrl`; allowlist reject unknown key
- Unit: job status transitions PENDING → RUNNING → SUCCESS/FAILED
- Unit: sync hook calls matching refresh (mocked); **never** calls ActionService.regenerate
- Unit: import backward compatibility (empty items, validation errors)
- Integration-style: fetch mock HTTP response → scholarships persisted
- Regression: Phase 5 ingestion tests updated; Phase 7–8 matching/action tests PASS
- Command: `npm run test -w @scholarpath/api`

## Functional Testability

- **Page/screen:** `/admin` — enhanced import section, fetch trigger, job history list
- **User-visible:** Admin imports/fetches → new/updated scholarships on `/scholarships` with `מיובא` badge; student refresh recommendations may surface new items (smoke)
- **Command-line:** `npm run dev`; optional fixture URL or local JSON for fetch test
- **API:**
  - `POST /admin/scholarships/import` with 2 items sharing `sourceUrl` → 1 imported, 1 updated; job SUCCESS
  - `POST /admin/ingestion/fetch` `{ "sourceKey": "demo-feed" }` → scholarships upserted
  - `POST /admin/ingestion/fetch` unknown key → 400; job FAILED or not started
  - `GET /admin/ingestion/jobs` → paginated list with counts
- **Minimal E2E:**
  1. Login `admin@scholarpath.local` → `/admin` → bulk import JSON → job SUCCESS
  2. Trigger allowlisted fetch → job SUCCESS → scholarship visible on `/scholarships`
  3. Login student → `/recommendations` → refresh → new scholarship may appear (smoke)
  4. Invalid fetch key → error shown in admin UI; no corrupt scholarships
  5. Smoke: `/dashboard`, `/applications`, `/notifications` unchanged
- **Expected result:** Controlled external scholarship data enters system with audit trail; recommendations can reflect new data; no auto-actions from ingestion

## Handoff Notes for Manager

Suggested milestones **M1–M8**:

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Schema + migration | `IngestionJob`, enums; optional `sourceUrl` unique | `npm run db:migrate` succeeds |
| M2 | Import upsert + job audit | Enhance `IngestionService.importScholarships` | Duplicate `sourceUrl` updates; job row created |
| M3 | Allowlist + fetch adapter | HTTP fetch from env map; timeout; SSRF-safe | Unknown key → 400; mock URL → upsert |
| M4 | Jobs API | `GET /admin/ingestion/jobs`, `GET .../:id` | Paginated history; detail with errors |
| M5 | Fetch API | `POST /admin/ingestion/fetch` | End-to-end fetch creates job + scholarships |
| M6 | EXTERNAL_DATA_SYNCED hook | `IngestionSyncService` batch rec refresh | Matching called; ActionService **not** called |
| M7 | Admin UI | Import enhancements, fetch form, job list (Hebrew) | Admin can run flows without curl |
| M8 | Tests + docs | `dev-phase9.md`, PROGRESS/AGENTS | `npm run test -w @scholarpath/api` PASS |

**Architect defaults (override only with user approval):**

| Topic | Default |
|---|---|
| Rec refresh after sync | Batch async refresh for students with complete profiles; log count |
| Fetch timeout | 30s (`INGESTION_FETCH_TIMEOUT_MS`) |
| Allowlist format | JSON map in env: key → URL |
| Cron | `CRON_INGESTION_SYNC` empty (disabled) unless explicitly set |
| Dedupe key | `sourceUrl` when present; else create-only |
| Import response | Extend with `{ jobId, imported, updated, skipped, errors? }` |
| Fixture for dev | Manager may ship `fixtures/scholarships-external.json` + allowlist key `local-fixture` pointing to file URL or mock |

**Pre-Phase-9 ad-hoc fixes (not in dev-phase8):** dashboard loading spinner + `/actions` lazy-regenerate recursion — recommend small Developer patch before or parallel to M1; not Phase 9 scope.

**Open for Manager to close:**
- Exact batch refresh strategy (all students vs staggered)
- Whether `POST /admin/scholarships/import` path moves under `/admin/ingestion/import` (Architect: keep existing path for backward compatibility)
- Partial unique index on `sourceUrl` vs application-level dedupe only

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes

Phase identifier aligned: `PHASE=9` across PHASE.md, arch-phase9.md, manager-phase9.md (`MANAGER_REVIEW_STATUS: APPROVED`), dev-phase9.md (`STATUS: COMPLETE`, declaration PASS).

All architect milestones M1–M8 reflected in manager plan and dev evidence. External Integration Layer contract satisfied: extended Phase 5 `IngestionModule` (not greenfield); `IngestionJob` audit; upsert-by-normalized-`sourceUrl` (application-level, no DB unique index); allowlisted fetch (`INGESTION_ALLOWLIST`); enhanced import path preserved; jobs read API; `POST /admin/ingestion/fetch` with SSRF-safe key-only body; 60s admin rate limit; `EXTERNAL_DATA_SYNCED` hook via sequential batch `MatchingService.refreshRecommendations`; **no** `ActionService` in `IngestionModule`; optional `CRON_INGESTION_SYNC` opt-in; Hebrew admin UI; dev fixture `local-fixture`.

Architectural constraints honored: read-only externals; SEED/ADMIN never overwritten; eventual consistency (ingest SUCCESS independent of rec refresh failures); no autonomous scraping; scholarships-only scope; no new top-level folders. Unit tests 61/61 PASS per manager independent verification. Lint NOT AVAILABLE — acceptable (Phases 4–8 precedent). Functional testability documented; manual E2E recommended, not blocking.

Manager closed open questions: batch sequential refresh; keep `/admin/scholarships/import`; application-level dedupe; `file://` for dev fixture.

Non-blocking carry-forward: functional E2E steps not marked manually executed; sync tests bundled in `ingestion.service.spec.ts`; fetch failure JSON example omitted from dev-phase9 API section; Windows Prisma EPERM during generate when dev server running.

### Required Corrections

None. Phase 9 approved for architecture closure. External Integration Layer (scholarships MVP) complete per Architecture Plan v3 §Phase 9 and PRD v3 §Layer 4.

**Orchestrator:** Update `team-Yuri/PHASE.md` to `PHASE=10` when starting next phase planning (if applicable per plan backlog).
