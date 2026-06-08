# Manager Phase 5

## Phase Identifier
PHASE=5

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Ship Growth Layer MVP: admin JSON scholarship import with `source` tracking, scholarship behavioral events that boost recommendations, and a community Q&A module (posts + comments)—without autonomous scraping, email, or advanced social features.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=5`
- `team-Yuri/plan.md` — Phase 5
- `team-Yuri/arch-phase5.md`
- `AGENTS.md`
- `DOCS/scholar_path_phases_plan_v_0.md`
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`
- Existing: `packages/database/prisma/schema.prisma`, `apps/api/src/matching/matching.service.ts`, `apps/api/src/admin/*`

## Architecture Summary
Extend Prisma with `ScholarshipSource`, `ScholarshipEvent`, `CommunityPost`, `CommunityComment`. Add `IngestionModule` (admin bulk import), `CommunityModule`, `BehaviorBoostService` used by `MatchingService` on refresh. Frontend: `/community`, admin import panel, event tracking on scholarship view and application create, source badge on scholarship cards.

## Manager Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Community read access | **Public** (no auth for GET) | Aligns with arch handoff; lowers friction for Q&A discovery |
| Community write access | **Auth required** (STUDENT or ADMIN) | Prevents anonymous spam |
| Autonomous scraping | **OUT OF SCOPE** | Arch constraint; import only |
| `IngestionJob` table | **OUT OF SCOPE** | Stub not needed for MVP; import endpoint sufficient |
| Event types | `VIEW`, `APPLY_START` | Per arch; `APPLY_START` on application create |
| Behavior formula | `min(100, round(baseScore * 0.85 + boost))` | Per arch; boost capped at 15 per scholarship |
| Existing scholarships | Migration sets `source = SEED` | Preserves demo data distinction |
| Admin create (single) | Keep `source = ADMIN` | Existing POST `/admin/scholarships` sets ADMIN |
| Import path | `POST /admin/scholarships/import` | Separate from single create |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Schema + migration | Enums, models, `Scholarship.source`, backfill SEED | `npm run db:migrate` succeeds |
| M2 | Ingestion API | Bulk import with validation, max 50 | POST import returns `{ imported, skipped }` |
| M3 | Events API + hooks | Record VIEW; APPLY_START on application create | Events in DB; boost > 0 after refresh |
| M4 | Behavior boost in matching | `BehaviorBoostService` + MatchingService integration | Refresh changes score when events exist |
| M5 | Community API | Posts + comments CRUD | GET public; POST auth |
| M6 | Community UI | `/community`, `/community/[id]`, navbar link | Post visible after create |
| M7 | Admin import UI + source badges | JSON textarea on `/admin`; tags on `/scholarships` | Imported row shows "מיובא" |
| M8 | Tests + docs | Unit tests; `dev-phase5.md`; PROGRESS/AGENTS | Jest PASS |

## Detailed Development Plan

### M1 — Prisma schema and migration

**File:** `packages/database/prisma/schema.prisma`

```prisma
enum ScholarshipSource {
  SEED
  ADMIN
  IMPORTED
}

enum ScholarshipEventType {
  VIEW
  APPLY_START
}

// Scholarship — add:
source ScholarshipSource @default(SEED) @map("source")

model ScholarshipEvent {
  id            String               @id @default(cuid())
  userId        String               @map("user_id")
  user          User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  scholarshipId String               @map("scholarship_id")
  scholarship   Scholarship          @relation(fields: [scholarshipId], references: [id], onDelete: Cascade)
  eventType     ScholarshipEventType @map("event_type")
  createdAt     DateTime             @default(now()) @map("created_at")

  @@index([userId, scholarshipId, createdAt])
  @@map("scholarship_events")
}

model CommunityPost {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  body      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  comments  CommunityComment[]

  @@index([createdAt(sort: Desc)])
  @@map("community_posts")
}

model CommunityComment {
  id        String        @id @default(cuid())
  postId    String        @map("post_id")
  post      CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String        @map("user_id")
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  body      String
  createdAt DateTime      @default(now()) @map("created_at")

  @@index([postId, createdAt])
  @@map("community_comments")
}
```

Add relations on `User`, `Scholarship`.

**Migration:** `20260603120000_growth_layer`

**Post-migration SQL in migration file:**
```sql
UPDATE scholarships SET source = 'SEED' WHERE source IS NULL;
```
(Or default handles new column; ensure existing rows become SEED.)

**Export** `ScholarshipSource`, `ScholarshipEventType` from `packages/database/src/index.ts`.

**Update `admin.service.ts` `createScholarship`:** set `source: ADMIN`.

---

### M2 — Ingestion API

**Module:** `apps/api/src/ingestion/`

| File | Purpose |
|---|---|
| `ingestion.module.ts` | Import AdminModule guards pattern |
| `ingestion.service.ts` | Validate + bulk create |
| `ingestion.controller.ts` | `POST /admin/scholarships/import` |
| `dto/import-scholarship-item.dto.ts` | Per-item validation |
| `dto/import-scholarships.dto.ts` | `{ items: ImportScholarshipItemDto[] }` max 50 |

**`ImportScholarshipItemDto` fields:**
- `title` string, min 3, max 200
- `description` string, min 10, max 5000
- `deadline` optional ISO date string
- `sourceUrl` optional URL
- `tags` optional string array, max 10 tags
- `eligibilityRules` optional object

**`POST /admin/scholarships/import`**
- Guards: `JwtAuthGuard`, `AdminGuard`
- Body: `{ items: [...] }` — `@ArrayMaxSize(50)`
- Response: `{ imported: number, skipped: number, errors?: { index: number, message: string }[] }`
- Each valid item: `prisma.scholarship.create({ source: IMPORTED, ... })`
- Invalid items: skip, collect error index (do not fail entire batch)

Register `IngestionModule` in `AppModule`. Controller path: `@Controller('admin/scholarships')` with `@Post('import')` — may extend via separate `IngestionController` under same path prefix or add method to admin module; prefer **`IngestionController`** at `admin/scholarships` only for `import` to avoid bloating AdminController.

---

### M3 — Scholarship events

**Module:** `apps/api/src/events/` (or under `scholarship/events.service.ts`)

| Method | Path | Guard | Body |
|---|---|---|---|
| `POST` | `/scholarships/:id/events` | JwtAuthGuard | `{ eventType: 'VIEW' \| 'APPLY_START' }` |

- Validate scholarship exists
- `userId` from JWT only
- `create` row in `scholarship_events`
- Return `{ ok: true }`

**Hooks (no extra API):**
1. **`scholarship/[id]/page.tsx`:** on mount, if session, `POST .../events` with `VIEW` (once per page load via useEffect).
2. **`ApplicationService.create`:** after successful create, insert `APPLY_START` event (use EventsService; do not throw on failure).

---

### M4 — Behavior boost in recommendations

**New:** `apps/api/src/matching/behavior-boost.service.ts`

```typescript
// calculateBoost(userId, scholarshipId): Promise<number>
// Rules (14-day window):
// - Any VIEW in window: +3 (max once counted)
// - Any APPLY_START in window: +8 (max once counted)
// - Total cap: 15 per scholarship
```

**Update `MatchingService.refreshRecommendations`:**

After computing `baseScore = ai?.score ?? match.ruleScore`:
```typescript
const boost = await this.behaviorBoost.calculateBoost(userId, match.scholarship.id);
const score = Math.min(100, Math.round(baseScore * 0.85 + boost));
let matchReason = ai?.reason ?? match.ruleReason;
if (boost > 0) matchReason += ' · מוגבר לפי פעילות';
```

Export `BehaviorBoostService` from MatchingModule; register provider.

**Unit tests:** `behavior-boost.service.spec.ts` — VIEW only +3; APPLY_START +8; cap 15.

---

### M5 — Community API

**Module:** `apps/api/src/community/`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/community/posts` | None | List posts, newest first, include `authorName`, `commentCount` |
| `POST` | `/community/posts` | JWT | Create post `{ title, body }` |
| `GET` | `/community/posts/:id` | None | Post + comments with `authorName` |
| `POST` | `/community/posts/:id/comments` | JWT | `{ body }` |

**DTOs:**
- `CreatePostDto`: title 5–120 chars, body 10–3000
- `CreateCommentDto`: body 1–1500

**Response shape `CommunityPostItem`:**
```typescript
{
  id, title, body, createdAt,
  authorName: string,
  commentCount?: number,
  comments?: CommunityCommentItem[]
}
```

Hebrew error messages via class-validator.

---

### M6 — Community UI

**Files:**
- `apps/web/src/app/community/page.tsx` — list + create form (auth required to submit)
- `apps/web/src/app/community/[id]/page.tsx` — thread + comment form
- `apps/web/src/lib/api.ts` — community + event + import types/functions
- `apps/web/src/components/Navbar.tsx` — link "קהילה" → `/community`
- `apps/web/src/middleware.ts` — **do not** protect `/community` (public read); protect only if adding write-only routes

**Create post:** redirect to `/community/[id]` after success.

**Design:** use `sp-card`, `sp-input`, `sp-btn-primary` classes.

---

### M7 — Admin import UI + source badges

**`apps/web/src/app/admin/page.tsx`:**
- New section "ייבוא מלגות (JSON)"
- Textarea for JSON array + "ייבוא" button
- Show result: imported/skipped counts
- Example JSON snippet in placeholder

**Scholarship list/detail:**
- `apps/web/src/app/scholarships/page.tsx` — if `source === 'IMPORTED'`, show tag `מיובא`; if `SEED`, optional `דמו` (muted)
- Extend `Scholarship` type in `api.ts` with `source?: 'SEED' | 'ADMIN' | 'IMPORTED'`

**API client:**
- `importScholarships(token, items)`
- `recordScholarshipEvent(token, scholarshipId, eventType)`
- Community CRUD functions

---

### M8 — Tests and documentation

**Unit tests (minimum):**
| File | Tests |
|---|---|
| `ingestion.service.spec.ts` | valid import; invalid item skipped; max 50 |
| `behavior-boost.service.spec.ts` | VIEW +3; APPLY_START +8; cap 15 |
| `community.service.spec.ts` | create post; add comment |

**Command:** `npm run test -w @scholarpath/api`

**Docs:**
- `DOCS/PROGRESS.md` — Phase 5 section
- `AGENTS.md` — Current Phase 5 complete / project complete at MVP
- `team-Yuri/dev-phase5.md` — full evidence

**Lint:** document NOT AVAILABLE if unchanged.

---

## Acceptance / Gating Criteria

- [x] Migration applied; existing scholarships have `source = SEED`
- [x] Admin import creates scholarships with `source = IMPORTED`
- [x] Imported scholarship visible in `/scholarships` with tag
- [x] `POST /scholarships/:id/events` records VIEW for authenticated user
- [x] Application create records APPLY_START
- [x] `POST /recommendations/refresh` produces higher score after events (document before/after in dev-phase5)
- [x] Community post + comment visible on `/community`
- [x] Public can read community without login
- [x] Phases 1–4 flows still work (smoke: login, recommendations, application letter, notifications)
- [x] No scraping/cron/email code
- [x] Unit tests pass
- [x] `dev-phase5.md` complete

## Functional Testability Criteria

- **Page:** `/community`, `/admin` (import section), `/scholarships`
- **User-visible:** tag "מיובא"; community thread; boosted recommendation reason text
- **CLI:** `npm run dev`; `npm run test -w @scholarpath/api`
- **API:** `POST /admin/scholarships/import` with admin token
- **E2E:**
  1. Login admin → paste JSON → import 1 scholarship
  2. Login student → see scholarship with "מיובא"
  3. Open scholarship detail (VIEW event)
  4. Start application (APPLY_START)
  5. Refresh recommendations → score/reason reflects boost
  6. Create community post → visible on `/community`
- **Credentials:** `admin@scholarpath.local` / `admin123`, `student@scholarpath.local` / `student123`

## Required Developer Evidence

`team-Yuri/dev-phase5.md` must include:
- Phase identifier PHASE=5
- Per-milestone completion table
- Files changed list
- Unit test command + PASS output
- Lint status
- Functional steps with before/after recommendation scores
- Scope compliance (no scraping/email)
- Declaration PASS/FAIL

## Out of Scope

- Autonomous scraping agents or scheduled scrapers
- `IngestionJob` persistence table
- Community DMs, groups, reputation, moderation queue
- Email notifications
- ML training pipelines
- Changes to application state machine
- New top-level repo folders

## Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Behavior formula lowers scores when boost=0 | Document in dev-phase5; acceptable per arch |
| Public community spam | Auth required for write; length limits |
| Large import JSON | Max 50; validate server-side |

| Open Question | Status |
|---|---|
| Email | Still deferred |

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned: `PHASE=5` in PHASE.md, dev-phase5.md, arch-phase5.md (Architect APPROVED).
- Developer evidence complete per Required Developer Evidence checklist (milestones M1–M8, files list, scope compliance, declaration PASS).
- Independent verification: `npm run test -w @scholarpath/api` — **14/14 PASS** (2026-06-02 Manager run).
- Lint: NOT AVAILABLE — documented in dev-phase5; acceptable (consistent with Phase 4).
- Implementation matches manager plan: IngestionModule, EventsModule, BehaviorBoostService, CommunityModule, web routes `/community`, admin import UI, source badges, VIEW/apply hooks.
- Scope: no `IngestionJob`, scraper, or email code under `apps/`.
- Functional testability: dev-phase5 includes before/after score examples and E2E script; user confirmed API routes live after resolving stale process on port 3001. Manual full E2E recommended but not blocking given unit coverage + documented path + operational confirmation.
- Regression: application state machine unchanged; notification tests still pass (4/14).

### Required Corrections
None. Phase 5 approved for closure.
