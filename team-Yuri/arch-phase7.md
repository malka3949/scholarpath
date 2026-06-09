# Architecture Phase 7

## Phase Identifier
PHASE=7

## Status
STATUS: APPROVED

## Phase Goal
Deliver the **Action Engine (Next Best Action)**: convert existing system signals (applications, deadlines, profile gaps, recommendations, behavioral events) into a **deterministic, ranked list of executable actions** surfaced in a student **Action Center**—evolving the product from passive recommendations to prioritized execution guidance per `DOCS/architecture/scholar_path_architecture_plan_v2.md` §11–13 and PRD v2 hybrid dashboard.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=7`
- `team-Yuri/plan.md` — Phase 7 section (Action Engine)
- `DOCS/architecture/scholar_path_architecture_plan_v2.md` — §6 UserActions, §11 Action Engine, §12 Event Layer, §13 Frontend Dashboard Model, §16 Migration Strategy
- `DOCS/prd/scholar_path_prd_v2.md` — §9.7 Dashboard (hybrid: tasks + recommendations)
- `team-Yuri/arch-phase4.md`, `arch-phase5.md`, `arch-phase6.md` — prior contracts (notifications, events, email)
- Existing: `Application`, `Recommendation`, `Notification`, `StudentProfile`, `ScholarshipEvent`, `MatchingService`, `NotificationService`

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **New `ActionModule`** under `apps/api/src/action/` | Action Engine is a distinct layer (v2 §11); keeps scoring/persistence separate from Matching and Notification | Register in `AppModule`; export `ActionService` for hooks |
| **`UserAction` Prisma model** per v2 §6 | Single source of truth for ranked actions | Migration adds `user_actions` table with status lifecycle |
| **Deterministic scoring only (no AI priority)** | v2 §7 + §14: AI assistive; trust requires reproducible ranking | Same inputs → same `priority_score`; unit-testable formula |
| **Scoring formula (Phase 7 v1)** | Implements v2 §11 scoring model at MVP fidelity | `priority_score = urgency + impact + completion_gap + engagement_signals` (each 0–100 component, weighted sum capped at 100) |
| **Four action types** | v2 §11 Action Types | `DEADLINE_ACTION`, `COMPLETION_ACTION`, `OPTIMIZATION_ACTION`, `ENGAGEMENT_ACTION` |
| **Regenerate-on-signal (sync hooks), defer `SystemEvents` table** | v2 §12 optional; reduces Phase 7 schema scope | Application/Profile/Matching/Notification paths call `ActionService.regenerateForUser(userId)` after relevant writes; no separate event store in Phase 7 |
| **Top 3–5 OPEN actions returned** | v2 §11 Outputs | API default `limit=5`; UI shows 3–5 cards |
| **Action status lifecycle** | User can dismiss or complete | `OPEN` → `DONE` \| `DISMISSED`; regenerate may reopen or supersede stale OPEN rows |
| **Executable CTAs via deep links** | Critical rule: actions executable, recommendations passive | Each action includes `ctaPath` (e.g. `/applications/:id`, `/profile`, `/scholarships/:id`) — stored in `metadata` JSON or dedicated column |
| **Student dashboard route `/dashboard`** | PRD hybrid dashboard; home stays marketing landing | Authenticated students see Action Center + opportunity/pressure layers; optional redirect from `/` when session exists (Manager choice) |
| **Preserve existing pages** | v2 §16 migration: gradual UI replacement | `/recommendations`, `/applications`, notifications unchanged; Action Center **adds** guidance, does not remove feeds |
| **Idempotent regeneration** | Avoid duplicate OPEN actions for same entity+type | Unique constraint e.g. `@@unique([userId, type, relatedEntityType, relatedEntityId])` where entity present; upsert on regenerate |
| **Hebrew action copy** | Product UI language | `title` / `description` generated server-side in Hebrew; English enums in code |
| **No new top-level repo folders** | `40-project-structure.md` | Module under existing `apps/api`, `apps/web` |

## Constraints / Non-Negotiables
- Do not break Phases 1–6: auth, applications state machine, recommendations, community, import, notifications, email/cron.
- **Recommendations remain passive**; Action Engine may *reference* a scholarship/application but must not auto-transition application status.
- AI (Claude) **must not** compute `priority_score` or create `UserAction` rows.
- Scoring must be **deterministic** (no randomness, no ML pipeline).
- Notifications remain informational; actions are a **separate** UX layer (may overlap thematically with deadline alerts but distinct data model).
- Developer: unit tests + `dev-phase7.md` per `20-testing.md`.
- Hebrew UI for Action Center; English code and artifacts.

## Technical Boundaries / Out of Scope
- **Real Data Pipeline** — autonomous scraping, `IngestionJob` production agent, scheduled external ingestion (**Phase 8**)
- Full `SystemEvents` persistence table and event replay/debug UI
- Shadow-mode comparison dashboard (admin A/B of old vs new ranking) — optional log-only acceptable
- AI-generated action titles or dynamic priority
- Push notifications, SMS, new email types triggered by actions
- Admin user monitoring dashboard (**Phase 8** backlog)
- Career module action types beyond stub if career data not wired (defer `CAREER_*` types)
- Mobile native app
- Replacing `/recommendations` with actions-only UX

## Dependencies and Interfaces

**Depends on:**
- Phase 1: `Application`, `StudentProfile`, `Scholarship`, state machine
- Phase 2: `Recommendation` scores, profile completeness signals
- Phase 3: motivation letter presence on applications
- Phase 4–6: deadline proximity rules (7-day window), notification context (read-only input, not merged tables)
- Phase 5: `ScholarshipEvent` (VIEW, APPLY_START) for engagement_signals

**New backend module:**
- `ActionModule` — `ActionService`, `ActionController`, `ActionScoringService` (or scoring methods on service)

**Indicative API surface:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/actions` | JWT (STUDENT) | List top OPEN actions (`?limit=5`, sorted by `priority_score` desc) |
| `POST` | `/actions/regenerate` | JWT (STUDENT) | Manual refresh (rate-limited); recomputes all actions for caller |
| `PATCH` | `/actions/:id` | JWT (STUDENT) | Mark `DONE` or `DISMISSED` |
| `POST` | `/admin/actions/regenerate/:userId` | JWT (ADMIN) | Dev/support bulk recompute (optional, for E2E) |

**Regeneration hooks (call `ActionService.regenerateForUser` after success):**
- Application create/update/status change / letter save
- Student profile update
- Recommendation refresh complete
- Notification deadline sync (batch: per affected user only)
- Scholarship event record (APPLY_START)

**Frontend routes:**
- `/dashboard` — **Action Center** (primary), opportunity layer (top recommendations snippet), pressure layer (upcoming deadlines)
- Reuse existing components where possible (`HomeNotificationsBanner` patterns, recommendation cards)

**Action type → signal mapping (MVP generators):**

| Type | Example trigger | Example CTA |
|---|---|---|
| `DEADLINE_ACTION` | Application IN_PROGRESS, deadline ≤7d, letter empty or NOT_STARTED app | `/applications/:id` |
| `COMPLETION_ACTION` | Profile missing fieldOfStudy, year, or gpa | `/profile` |
| `OPTIMIZATION_ACTION` | High-score recommendation, no application yet | `/scholarships/:id` |
| `ENGAGEMENT_ACTION` | User viewed scholarship (VIEW event) but no APPLY_START | `/scholarships/:id` |

Manager may refine thresholds; Architect default weights (document in manager-phase7):
- urgency: 40% (inverse days to deadline, capped)
- impact: 30% (recommendation score or fixed per type)
- completion_gap: 20% (missing letter, incomplete profile)
- engagement_signals: 10% (recent VIEW without APPLY_START)

## Data / State Considerations

**Prisma migration (Manager refines naming):**

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

**Regeneration algorithm (high level):**
1. Load user context: profile, applications (+ scholarships), recommendations (top N), recent scholarship events, deadline window.
2. Compute candidate actions per type rules.
3. Score each candidate deterministically.
4. Upsert OPEN rows (update score/title if changed); mark stale OPEN rows DISMISSED or delete if no longer applicable.
5. Return top 5 by `priority_score`.

**User-initiated DONE/DISMISSED:**
- PATCH sets status; regeneration must not recreate same unique key until underlying signal changes (Manager defines reopen rules).

## Security / Privacy Considerations
- All action endpoints scoped to authenticated `userId`; admin regenerate requires ADMIN role.
- `regenerate` rate limit (e.g. 1/min per user) to prevent abuse.
- No cross-user entity references in `relatedEntityId`.
- Action descriptions must not leak other users' data.
- Log action counts, not full Hebrew body, in production.

## Testing and Lint Expectations
- Unit tests: scoring function determinism (fixture in → fixed score out)
- Unit tests: each action type generator produces expected action for fixture data
- Unit tests: upsert idempotency (double regenerate → single OPEN row per unique key)
- Unit tests: PATCH DONE/DISMISSED authorization and state transitions
- Integration-style test: application status change triggers hook (mock or spy on `ActionService`)
- Regression: existing Phase 4–6 notification and mail tests still PASS
- Command: `npm run test -w @scholarpath/api`
- Lint: document NOT AVAILABLE if unchanged

## Functional Testability

- **Page/screen:** `/dashboard` — logged-in student sees 3–5 action cards with Hebrew titles and CTA buttons
- **User-visible:** After incomplete profile, COMPLETION_ACTION appears; after starting application near deadline, DEADLINE_ACTION ranks high; dismiss action removes card until signal changes
- **Command-line:** `npm run dev`; seed user with fixture data; `GET /api/actions` with JWT returns ranked list
- **API:** `POST /actions/regenerate` refreshes list; `PATCH /actions/:id` with `{ status: "DISMISSED" }` updates row
- **Minimal E2E:**
  1. Login as seed student with incomplete profile → dashboard shows COMPLETION_ACTION
  2. Complete profile → regenerate → COMPLETION_ACTION gone or lower rank
  3. Create IN_PROGRESS application with deadline in 5 days, no letter → DEADLINE_ACTION top
  4. Dismiss action → card hidden
  5. `/recommendations` and `/applications` still work unchanged
- **Expected result:** Student sees prioritized executable next steps; deterministic scores reproducible in tests; Phases 1–6 smoke pass

## Handoff Notes for Manager

Break into milestones (suggested M1–M8):
- **M1** Prisma: `UserAction` model + enums + migration
- **M2** `ActionScoringService` — deterministic formula + unit tests
- **M3** `ActionService` — generators per action type + upsert/regenerate logic
- **M4** `ActionController` — GET list, PATCH status, POST regenerate (+ optional admin route)
- **M5** Hooks from Application, Student, Matching, Events (and batch hook after deadline sync)
- **M6** `/dashboard` UI — Action Center + opportunity/pressure sections (Hebrew)
- **M7** Nav link to dashboard for authenticated students; optional session redirect from `/`
- **M8** Unit tests, `dev-phase7.md`, update `DOCS/PROGRESS.md` / `AGENTS.md`

**Defaults for Manager (no further Architect questions unless user objects):**
- `/dashboard` as primary Action Center route (not replacing `/` marketing page for anonymous users)
- `SystemEvents` table **deferred**; sync hooks sufficient for Phase 7
- Top **5** actions API default; UI shows **3–5**
- Real Data Pipeline explicitly **Phase 8**, not Phase 7 stretch

**Credentials for E2E:** `student@scholarpath.local`, `admin@scholarpath.local` (existing seed).

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned: `PHASE=7` across PHASE.md, arch-phase7.md, manager-phase7.md (`MANAGER_REVIEW_STATUS: APPROVED`), dev-phase7.md (`STATUS: COMPLETE`, declaration PASS).
- All manager milestones M1–M8 evidenced in dev-phase7 with module/file paths; migration `20260608120000_action_engine` applied.
- Architecture honored per v2 §11–13: distinct `ActionModule`; `UserAction` model with four types and status lifecycle; deterministic weighted scoring (40/30/20/10); no AI in action layer; sync regeneration hooks (no `SystemEvents` table); API surface matches contract (`GET/POST/PATCH /actions`, admin regenerate); `/dashboard` hybrid layers (Action Center + opportunity + pressure); recommendations remain passive; Phases 1–6 boundaries preserved.
- Critical rule satisfied: actions executable via `ctaPath`; separate from notification data model.
- Manager defaults adopted: `/dashboard` without authenticated `/` redirect; lazy regenerate on empty GET; top-5 API limit; Real Data Pipeline deferred to Phase 8.
- Unit tests: 35/35 PASS per manager independent run and dev-phase7 (scoring determinism, generators, upsert/idempotency, controller, Phase 4–6 regression).
- Lint: NOT AVAILABLE — documented; acceptable per Phases 4–6 and `20-testing.md`.
- Functional testability: dev-phase7 documents E2E path for `/dashboard`, action dismiss, and regression smoke; manual browser verification recommended but not blocking (consistent with Phases 5–6).
- Out of scope verified: no `SystemEvents` table, no scraping/production ingestion agent, no AI priority logic under `apps/api/src/action/`.
- Known limitations acceptable: 429 rate limit not isolated in unit test; engagement generator fetches scholarship titles for viewed IDs outside recommendations.

### Required Corrections
None. Phase 7 approved for architecture closure. Action Engine MVP satisfies `scholar_path_architecture_plan_v2.md` §11–13 and PRD v2 hybrid dashboard intent. Phase 8 (Real Data Pipeline) remains backlog per plan.md.
