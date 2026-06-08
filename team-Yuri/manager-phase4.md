# Manager Phase 4

## Phase Identifier
PHASE=4

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Ship an in-app Retention Layer: persisted notifications, deadline reminders for active applications, navbar unread badge, notifications page, and dashboard/application deadline cues—without email delivery in this phase.

## Source References
- `team-Yuri/PHASE.md`
- `team-Yuri/plan.md` — Phase 4 section
- `team-Yuri/arch-phase4.md`
- `AGENTS.md`
- `DOCS/scholar_path_phases_plan_v_0.md`
- `DOCS/scholar_path_prd.md`
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`
- Existing schema: `packages/database/prisma/schema.prisma`
- Existing UI: `apps/web/src/components/Navbar.tsx`, `apps/web/src/middleware.ts`

## Architecture Summary
Add `NotificationModule` to NestJS and `Notification` Prisma model. Deadline reminders are created by a deterministic sync service (not AI). Students consume notifications via REST; UI shows bell + `/notifications`. Email is explicitly deferred. Application state machine and Phase 3 letter workflow remain unchanged.

## Manager Decisions (resolves open questions)

| Topic | Decision | Rationale |
|---|---|---|
| Email in Phase 4 | **OUT OF SCOPE** | In-app path is functionally testable without SMTP/provider setup; aligns with Architect “in-app first” |
| Deadline window | **7 days** | `deadline >= now AND deadline <= now + 7 days` |
| Cron / scheduler | **OUT OF SCOPE for MVP** | Use explicit sync endpoints + optional frontend call after login |
| Application status notifications | **IN SCOPE (minimal)** | One notification when status becomes `SUBMITTED` (informational only) |
| Dedupe | **Required** | Prevent duplicate deadline alerts per user+application |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Database + module skeleton | Prisma enum/model, migration, `NotificationModule` registered in `AppModule` | Migration applies; API boots |
| M2 | Notification API (read path) | List, unread count, mark read, mark all read | Authenticated GET/PATCH return expected JSON |
| M3 | Deadline + status generators | `syncDeadlinesForUser`, dedupe, `SUBMITTED` hook | Sync creates ≥1 notification for demo student with near deadline |
| M4 | Sync triggers | Student sync endpoint; admin sync-all for demo | POST returns `{ created: number }` |
| M5 | Web UI | Navbar bell, `/notifications` page, API client helpers | E2E flow in Functional Testability passes |
| M6 | Dashboard reminders | Deadline hint on `/applications` cards | Visible date/badge when deadline ≤7 days |
| M7 | Tests + docs | Jest unit tests for service; update `DOCS/PROGRESS.md`, `AGENTS.md` phase pointer | `dev-phase4.md` shows PASS evidence |

## Detailed Development Plan

### M1 — Prisma schema and migration

**File:** `packages/database/prisma/schema.prisma`

Add enum:

```prisma
enum NotificationType {
  DEADLINE_APPROACHING
  APPLICATION_STATUS
  SYSTEM
}
```

Add model:

```prisma
model Notification {
  id            String           @id @default(cuid())
  userId        String           @map("user_id")
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type          NotificationType
  title         String
  body          String
  readAt        DateTime?        @map("read_at")
  scholarshipId String?          @map("scholarship_id")
  scholarship   Scholarship?     @relation(fields: [scholarshipId], references: [id], onDelete: SetNull)
  applicationId String?          @map("application_id")
  application   Application?     @relation(fields: [applicationId], references: [id], onDelete: SetNull)
  createdAt     DateTime         @default(now()) @map("created_at")

  @@unique([userId, type, applicationId], name: "notification_dedupe_app")
  @@index([userId, readAt])
  @@index([userId, createdAt(sort: Desc)])
  @@map("notifications")
}
```

Add reverse relations on `User`, `Scholarship`, `Application`.

**Migration name:** `20260602120000_notifications`

**Export:** Regenerate Prisma client; export `NotificationType` from `packages/database/src/index.ts` if enums are exported today.

**NestJS layout:**

```text
apps/api/src/notification/
  notification.module.ts
  notification.controller.ts
  notification.service.ts
  dto/
    mark-read.dto.ts          # optional if PATCH :id only
```

Register `NotificationModule` in `apps/api/src/app.module.ts`.

---

### M2 — API contracts (read path)

Base path: `/api/notifications` (global prefix already `/api` in `main.ts`).

All routes: `@UseGuards(JwtAuthGuard)`.

| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/notifications` | List current user notifications, newest first | `NotificationItem[]` |
| `GET` | `/notifications/unread-count` | Unread count for badge | `{ count: number }` |
| `PATCH` | `/notifications/:id/read` | Mark one read | `NotificationItem` |
| `PATCH` | `/notifications/read-all` | Mark all read for user | `{ updated: number }` |

**`NotificationItem` shape (API + frontend type):**

```typescript
{
  id: string;
  type: 'DEADLINE_APPROACHING' | 'APPLICATION_STATUS' | 'SYSTEM';
  title: string;
  body: string;
  readAt: string | null;
  scholarshipId: string | null;
  applicationId: string | null;
  createdAt: string;
  scholarship?: { id: string; title: string; deadline: string | null }; // optional embed
}
```

**Authorization:** Every query filters `where: { userId: req.user.sub }`. `:id` must belong to user or `404`.

**DTOs:** Use `class-validator` on write bodies if any; PATCH read endpoints may have empty body.

---

### M3 — Generator logic

**Constants** (service-level):

```text
DEADLINE_WINDOW_DAYS = 7
ACTIVE_STATUSES = [NOT_STARTED, IN_PROGRESS]
```

**`syncDeadlineNotifications(userId: string): Promise<number>`**

1. Find applications for `userId` where `status IN ACTIVE_STATUSES`.
2. Join `scholarship` where `deadline` is not null.
3. Filter: `deadline > now` AND `deadline <= now + 7 days`.
4. For each match, `upsert` or skip if `@@unique([userId, type, applicationId])` would conflict:
   - `type = DEADLINE_APPROACHING`
   - `title` (Hebrew): `מועד אחרון מתקרב: {scholarship.title}`
   - `body` (Hebrew): include formatted deadline date and status label; e.g. `המועד האחרון ל הגשה הוא {date}. סטטוס הבקשה: {statusLabel}.`
   - Set `scholarshipId`, `applicationId`.
5. Return count of newly created rows.

**`createApplicationStatusNotification` (hook)**

Call from `ApplicationService.updateStatus` after successful update **only when** `dto.status === SUBMITTED`:

- `type = APPLICATION_STATUS`
- `title`: `הבקשה סומנה כהוגשה`
- `body`: include scholarship title
- `applicationId`, `scholarshipId` from application
- Dedupe via same unique key (one per application for this type)

**Constraint:** Hook must not throw if notification insert fails; log and continue (notifications are ancillary).

---

### M4 — Sync triggers

| Method | Path | Guard | Behavior |
|---|---|---|---|
| `POST` | `/notifications/sync-deadlines` | JwtAuthGuard (student) | Runs `syncDeadlineNotifications` for `req.user.sub` |
| `POST` | `/admin/notifications/sync-deadlines` | JwtAuthGuard + AdminGuard | Runs sync for **all** students (loop users with role STUDENT) |

**Response:** `{ created: number }` (new notifications only).

**Frontend trigger (M5):** After successful session load on authenticated pages, call `POST /notifications/sync-deadlines` once per browser session (use `sessionStorage` flag `sp_deadline_sync_done`).

**Seed note:** Demo scholarships have rolling deadlines from seed; no seed change required if sync runs after login.

---

### M5 — Frontend

**`apps/web/src/lib/api.ts`**

- Types: `NotificationItem`, `UnreadCountResponse`
- Functions: `getNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, `syncDeadlineNotifications`

**`apps/web/src/components/Navbar.tsx`**

- Fetch unread count when `session.accessToken` present; refresh after mark-read.
- Bell icon (emoji or SVG) with badge if `count > 0`.
- Link to `/notifications`.

**`apps/web/src/app/notifications/page.tsx`**

- Protected route; list notifications; show unread styling.
- Actions: mark one read, mark all read.
- Button: `רענן תזכורות` → calls sync-deadlines then reloads list.
- Empty state Hebrew copy.
- Use design system classes (`sp-card`, `sp-page-title`, etc.).

**`apps/web/src/middleware.ts`**

- Add `/notifications` and `/notifications/:path*` to `protectedPaths` and `matcher`.

**Homepage (`apps/web/src/app/page.tsx`) — optional minimal**

- If unread count > 0, show small CTA card linking to `/notifications` (dashboard reminder).

---

### M6 — Applications list deadline cues

**`apps/web/src/app/applications/page.tsx`**

- For each application, if `scholarship.deadline` within 7 days and status in `NOT_STARTED` | `IN_PROGRESS`, show amber badge: `מועד אחרון בקרוב: {date}`.

---

### M7 — Testing and documentation

**Testing (required per `20-testing.md`):**

1. Add to `apps/api/package.json`:
   - `"test": "jest"`
   - devDependencies: `jest`, `ts-jest`, `@types/jest`, `@nestjs/testing`
   - `jest.config.js` at `apps/api/` or root targeting notification tests only
2. Create `apps/api/src/notification/notification.service.spec.ts`:
   - Mock `PrismaService`
   - Test `syncDeadlineNotifications` creates row when deadline in window
   - Test dedupe does not duplicate
   - Test mark read sets `readAt`
3. Run `npm run test -w @scholarpath/api` and document result in `dev-phase4.md`
4. Run lint if configured; if none, document `Lint: NOT AVAILABLE`

**Documentation (`30-docs.md`):**

- Update `DOCS/PROGRESS.md` — Phase 4 complete checklist
- Update `AGENTS.md` — Current Phase: 4 complete / Phase 5 next (Developer task)
- Add short section to `DOCS/POSTGRESQL_SETUP.md` or README only if new env vars (none expected)

---

## Acceptance / Gating Criteria

- [ ] Migration `notifications` applied successfully
- [ ] `GET /api/notifications` returns only calling user's rows
- [ ] `GET /api/notifications/unread-count` accurate after mark read
- [ ] `POST /api/notifications/sync-deadlines` creates deadline notification for demo student with active application + near deadline
- [ ] Marking application `SUBMITTED` creates at most one `APPLICATION_STATUS` notification
- [ ] No duplicate `DEADLINE_APPROACHING` for same application
- [ ] Navbar badge updates after mark read
- [ ] `/notifications` page loads and displays Hebrew content
- [ ] Phase 3 flows unchanged (letter generate/save/status rules)
- [ ] Unit tests pass for notification service
- [ ] `dev-phase4.md` complete with commands and results
- [ ] Email **not** implemented (no SMTP env vars required)

## Functional Testability Criteria

- **Page/screen the user can open:** `/notifications`
- **User-visible behavior:** Navbar shows unread badge; list shows deadline reminder in Hebrew
- **Command-line flow:** `npm run dev`; login as `student@scholarpath.local` / `student123`
- **API endpoint / request:** `GET http://localhost:3001/api/notifications/unread-count` with Bearer token → `{ count: N }`
- **Minimal end-to-end flow:** Login → (auto sync) → see bell badge → open `/notifications` → mark one read → badge decreases → refresh persists read state
- **Expected observable result:** ≥1 `DEADLINE_APPROACHING` notification after sync for seeded data

## Required Developer Evidence

`team-Yuri/dev-phase4.md` must include:

| Section | Required content |
|---|---|
| Phase identifier | `PHASE=4` |
| Implementation summary | What was built per milestone |
| Files changed | Paths list |
| Dependencies added | jest packages if added |
| Unit tests | Command + PASS/FAIL output |
| Lint | Command + result or NOT AVAILABLE reason |
| Functional testability | Step-by-step with URLs and demo credentials |
| Known issues | Any limitations |
| Scope compliance | Confirm email/scraping/community out of scope |
| Declaration | PASS only if all gating criteria met |

## Out of Scope

- Email sending (SMTP, Resend, templates)
- Mobile push notifications
- Scholarship scraping / real data ingestion
- Community module
- Cron/background workers (use sync endpoints only)
- Changes to recommendation or motivation letter algorithms
- Modifying application state machine transitions
- New top-level repository folders

## Risks / Open Questions

| Risk | Mitigation |
|---|---|
| No near-deadline seed data at test time | Admin sync-all or adjust one scholarship deadline in DB for test |
| GET-with-side-effects avoided | Sync only via POST |
| Jest setup time | Limited to notification service tests only |

| Open Question | Status |
|---|---|
| Email provider | Deferred — document in `dev-phase4.md` as Phase 5+ or Phase 4b |

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
Awaiting `dev-phase4.md` from Developer.

### Required Corrections
None at planning stage.
