# Architecture Phase 5

## Phase Identifier
PHASE=5

## Status
STATUS: APPROVED

## Phase Goal
Deliver a Growth Layer MVP: structured scholarship ingestion (beyond demo seed), a basic community Q&A surface, and behavioral signals that improve recommendation relevance—without full autonomous scraping agents or advanced social features.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=5`
- `team-Yuri/plan.md` — Phase 5 section
- `DOCS/scholar_path_phases_plan_v_0.md` — Growth Layer
- `DOCS/scholar_path_prd.md` — community, scaling data
- `DOCS/scholar_path_architecture_plan_v_0.md` — Growth Layer
- Completed: Phases 1–4 (auth, recommendations, letters, notifications)

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| Ingestion via admin-controlled import first | Functionally testable without production scraper infra | `POST /admin/scholarships/import` + `sourceType` field on Scholarship |
| Defer autonomous scraping agent | High legal/ops risk; not needed for MVP proof | Optional `IngestionJob` stub table only; no cron agent |
| Community MVP: posts + comments only | PRD simple Q&A; avoids DMs/groups/reputation | `CommunityModule`, `/community` UI |
| Behavioral events table | Improves ranking without ML pipeline | `ScholarshipEvent` + score boost in MatchingService |
| Ranking blend, not replace | Preserves Phase 2 rule+AI base | `finalScore = aiScore * 0.85 + behaviorBoost` (cap 100) |
| Mark scholarship origin | Distinguish demo vs imported | Enum `ScholarshipSource`: `SEED`, `ADMIN`, `IMPORTED` |
| No new top-level folders | Per `40-project-structure.md` | Modules under existing `apps/api`, `apps/web` |

## Constraints / Non-Negotiables
- Do not remove or break Phases 1–4 flows (auth, applications, letters, notifications).
- No email delivery (deferred from Phase 4).
- No mobile push.
- AI does not auto-post in community or auto-ingest scholarships.
- Hebrew UI; English code.
- Developer must add unit tests for new services and document evidence in `dev-phase5.md`.
- Human/admin initiates imports; no unsupervised web scraping in production paths.

## Technical Boundaries / Out of Scope
- Autonomous 24/7 scraping agents
- Community DMs, groups, reputation system
- Full external integrations (LinkedIn, university SSO, etc.)
- ML model training pipelines
- Replacing PostgreSQL or monorepo structure
- Phase 6+ features not listed in plan

## Dependencies and Interfaces

**Depends on:**
- Phase 1: Scholarship CRUD, admin role
- Phase 2: MatchingService, Recommendation table
- Phase 3–4: unchanged

**New backend modules:**
- `IngestionModule` (admin import + validation)
- `CommunityModule` (posts, comments)
- Extend `MatchingModule` with behavioral boost

**Indicative API surface:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/scholarships/import` | Bulk import JSON scholarships (ADMIN) |
| `GET` | `/community/posts` | List posts (auth optional: read public, write auth) |
| `POST` | `/community/posts` | Create post (STUDENT+) |
| `GET` | `/community/posts/:id` | Post + comments |
| `POST` | `/community/posts/:id/comments` | Add comment |
| `POST` | `/scholarships/:id/events` | Record VIEW / APPLY_CLICK (auth) |
| `POST` | `/recommendations/refresh` | Existing; recomputes with behavior boost |

**Frontend routes:**
- `/community` — post list + create
- `/community/[id]` — thread view
- Admin: import UI section on `/admin` (JSON paste or file upload)

## Data / State Considerations

**Schema additions (Manager refines):**

```prisma
enum ScholarshipSource {
  SEED
  ADMIN
  IMPORTED
}

// Add to Scholarship: source ScholarshipSource @default(SEED)

model ScholarshipEvent {
  id            String   @id @default(cuid())
  userId        String
  scholarshipId String
  eventType     String   // VIEW | APPLY_START
  createdAt     DateTime @default(now())
  @@index([userId, scholarshipId])
}

model CommunityPost {
  id        String   @id @default(cuid())
  userId    String
  title     String
  body      String
  createdAt DateTime @default(now())
  comments  CommunityComment[]
}

model CommunityComment {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  body      String
  createdAt DateTime @default(now())
}
```

**Import format (JSON array):**
```json
[{ "title": "...", "description": "...", "deadline": "ISO8601", "sourceUrl": "...", "tags": [], "eligibilityRules": {} }]
```

**Behavior boost rules (MVP):**
- `VIEW` on scholarship in last 14 days: +3 to recommendation score
- `APPLY_START` (application created): +8
- Cap behavior boost at +15 per scholarship

## Security / Privacy Considerations
- Import endpoint: ADMIN only; validate URLs; max 50 items per request
- Community: students post as authenticated users; sanitize length limits
- Events: user can only write events for self
- No PII in community posts beyond display name from profile

## Testing and Lint Expectations
- Unit tests: ingestion validator, behavior boost calculator, community service
- Extend or add Jest in `apps/api`
- Functional: import → scholarship visible; post → visible; refresh recommendations with boost
- Document in `dev-phase5.md`

## Functional Testability

- **Page/screen:** `/community` shows posts; `/admin` import section works
- **User-visible:** Imported scholarship appears in `/scholarships` with tag "מיובא"
- **API:** `POST /admin/scholarships/import` → new rows; `GET /community/posts` → includes new post
- **E2E:** Admin imports 1 scholarship → student sees it → student views → refresh recommendations → score changes for that scholarship
- **Expected result:** At least one IMPORTED scholarship; one community thread; measurable score delta after events

## Handoff Notes for Manager
- Break into milestones M1–M8 (schema, ingestion, events, ranking, community API, community UI, admin import UI, tests)
- Decide: community read without login (yes for browse, auth for write)
- Seed: keep existing 50 demo rows as `SEED`; do not delete on import
- Update `DOCS/PROGRESS.md` and `AGENTS.md` when Developer completes
- Email still out of scope

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned: `PHASE=5` across PHASE.md, manager-phase5.md, dev-phase5.md.
- All manager milestones M1–M8 marked complete with module/file evidence.
- Architecture honored: `ScholarshipSource`, `ScholarshipEvent`, admin JSON import (no autonomous scraping), `CommunityModule` (posts + comments), behavior boost in `MatchingService.refreshRecommendations` with documented formula.
- Out of scope verified: no `IngestionJob`, no scraper/cron/email code in `apps/`.
- API surface: import, community CRUD, `POST /scholarships/:id/events`, existing refresh with boost.
- Unit tests: 14/14 PASS (ingestion, behavior-boost, community, notification regression).
- Lint: NOT AVAILABLE — documented; acceptable per prior phases and `20-testing.md`.
- Functional evidence: dev-phase5 documents E2E path and score examples; user confirmed dev server operational after resolving stale `dist` on port 3001.
- Phases 1–4 contracts preserved: application state machine unchanged; notifications unchanged.
- Known limitations acceptable: EPERM on `db:generate` when API locks DLL; base score ×0.85 before boost per design.

### Required Corrections
None. Phase 5 approved for closure. MVP scope in `plan.md` Phases 1–5 is satisfied at Growth Layer MVP (import + community + behavior), not full plan scraping scope (deferred).
