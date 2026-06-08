# Architecture Phase 4

## Phase Identifier
PHASE=4

## Status
STATUS: APPROVED

## Phase Goal
Deliver a Retention Layer so students receive timely in-app (and optionally email) alerts about scholarship deadlines and application progress, increasing return visits during application cycles.

## Source References
- `DOCS/scholar_path_phases_plan_v_0.md` — Phase 4 scope
- `DOCS/scholar_path_prd.md` — notifications, deadline tracking
- `team-Yuri/plan.md` — Phase 4 section
- `AGENTS.md` — stack and out-of-scope for Phase 4
- Existing: `Scholarship.deadline`, `Application.status`, user profile

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| Add `Notification` NestJS module | Isolates retention concerns from Application/Matching | New controller, service, Prisma model |
| Persist notifications in PostgreSQL | Source of truth; supports read/unread and history | Migration required |
| In-app notifications first | Functionally testable without external email setup | Email can be Phase 4b or optional flag |
| Backend-triggered notification creation | Deadline cron or on-write hooks; not AI-owned | Service methods or scheduled job (simple interval acceptable for MVP) |
| Notification types enum | `DEADLINE_APPROACHING`, `APPLICATION_STATUS`, `SYSTEM` | Extensible schema |
| Web: bell icon + `/notifications` page | PRD dashboard reminders | Navbar + protected route |
| Do not modify application state machine rules | Phase 3 contract preserved | Notifications are informational only |

## Constraints / Non-Negotiables
- No scholarship scraping (Phase 5).
- No community module (Phase 5).
- AI does not create or mutate notifications autonomously.
- Hebrew UI strings; English code.
- Follow `20-testing.md`, `30-docs.md`, `40-project-structure.md`.
- Developer must add/run tests and lint where supported; document in `dev-phase4.md`.

## Technical Boundaries / Out of Scope
- Real scholarship ingestion / scraping
- Community posts/comments
- Push notifications to mobile native apps
- Complex workflow automation beyond reminders
- Modifying motivation letter or recommendation algorithms

## Dependencies and Interfaces

**Depends on:**
- Phase 1: User auth, scholarships with deadlines, applications
- Phase 2–3: stable profile and application workflow (unchanged)

**New API surface (indicative — Manager refines):**
- `GET /api/notifications` — list for current user
- `PATCH /api/notifications/:id/read` — mark read
- `POST /api/notifications/generate-deadline-reminders` — admin/dev trigger or internal cron hook for MVP

**Frontend:**
- Notification bell with unread count in `Navbar`
- `/notifications` page (protected)
- Optional: deadline badges on `/applications` and `/scholarships`

## Data / State Considerations

**Proposed Prisma model (Manager may refine fields):**

```text
Notification
  id, userId, type, title, body, readAt?, relatedScholarshipId?, relatedApplicationId?, createdAt
```

**Trigger logic (MVP):**
- Scholarship deadline within N days (e.g. 7) and user has application NOT_STARTED or IN_PROGRESS
- Optional: status change on application (future hook)

## Security / Privacy Considerations
- Notifications scoped to `userId` from JWT only
- No cross-user leakage
- Email addresses not exposed in notification payloads

## Testing and Lint Expectations
- Unit tests for notification service (create, list, mark read, deadline query)
- API integration test or documented manual API calls
- Lint on touched packages
- Evidence in `dev-phase4.md`

## Functional Testability

- **Page/screen the user can open:** `/notifications` — list of alerts; navbar bell shows unread count
- **User-visible behavior:** After seed/trigger, student sees deadline reminder for upcoming scholarship
- **Command-line flow:** `npm run dev`; optional script or API call to generate deadline reminders
- **API endpoint / request:** `GET /api/notifications` with Bearer token → 200 + array
- **Minimal end-to-end flow:** Login as student → open app → see bell badge → open notifications → mark one read → badge decrements
- **Expected observable result:** At least one notification created from deadline rule; read state persists after refresh

If infrastructure-only: N/A — phase must deliver user-visible notifications per plan.

## Handoff Notes for Manager
- Decide email in scope or defer to sub-task
- Specify exact deadline window (7 vs 14 days)
- Define Prisma migration naming and DTOs
- Plan Navbar UX and empty states
- Retroactive: no `manager-phase1..3` or `dev-phase1..3` — do not block Phase 4 on those files
- Align `DOCS/PROGRESS.md` update in Developer phase

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned: `PHASE=4` across PHASE.md, manager-phase4.md, dev-phase4.md.
- All manager milestones M1–M7 marked complete with file-level evidence.
- Architecture decisions honored: `NotificationModule`, PostgreSQL persistence, in-app first, 7-day deadline window, dedupe unique key, JWT-scoped access.
- Email explicitly out of scope — no SMTP/email code in notification module.
- API surface delivered per manager contract (`sync-deadlines` naming vs early arch draft `generate-deadline-reminders` — acceptable).
- Unit tests: 4/4 PASS (`notification.service.spec.ts`).
- Lint: NOT AVAILABLE — documented with reason; acceptable per `20-testing.md`.
- Functional evidence: API PASS (`sync=1`, `unread=1`); UI routes present (`/notifications`, NotificationBell).
- Phase 3 contracts preserved: state machine unchanged; SUBMITTED hook is informational only.
- Known limitations documented (no cron, seed deadline offset, EPERM on prisma generate) — acceptable for MVP.

### Required Corrections
None. Phase 4 approved for closure.
