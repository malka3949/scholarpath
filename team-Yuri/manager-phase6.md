# Manager Phase 6

## Phase Identifier
PHASE=6

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Deliver **Delivery & Alerts**: outbound email for `DEADLINE_APPROACHING` and `APPLICATION_STATUS` (SUBMITTED) notifications, plus a **daily scheduled** bulk deadline sync—so students receive reminders without opening the app. Preserve all Phase 1–5 behavior; in-app notifications remain always on; email is opt-out via profile toggle.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=6`
- `team-Yuri/plan.md` — Phase 6 section
- `team-Yuri/arch-phase6.md` — architecture contract (READY_FOR_MANAGER)
- `AGENTS.md`
- `DOCS/scholar_path_phases_plan_v_0.md` (v0.2) — Phase 6
- `DOCS/scholar_path_architecture_plan_v_0.md` — §10 Notifications
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`
- Existing: `apps/api/src/notification/*`, `apps/web/src/app/profile/page.tsx`, `apps/web` notification bell

## Architecture Summary
Extend `NotificationModule` with `MailService` (Resend / SMTP / log providers). Add Prisma fields `User.emailNotificationsEnabled` and `Notification.emailSentAt`. After each successful in-app `notification.create` for eligible types, attempt email send; set `emailSentAt` on success. Register `@nestjs/schedule` with daily cron calling existing `syncDeadlineNotificationsForAllStudents()`. Extend `GET`/`PUT` `/student/profile` to expose/update email preference. Frontend toggle on `/profile`. Reuse `POST /admin/notifications/sync-deadlines` for manual/cron-equivalent E2E (no duplicate admin route).

## Manager Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Email provider default (docs) | **Resend** when production; `log` for local | Per arch; `MAIL_ENABLED=false` default in dev |
| In-app vs email | **In-app always on**; toggle = **email only** | Arch default; UI copy must state this clearly |
| Notification types emailed | `DEADLINE_APPROACHING`, `APPLICATION_STATUS` only | No `SYSTEM`; no “new recommendations” email |
| SUBMITTED email | **In scope** | Mirror existing in-app on status transition |
| Cron schedule | Default `0 7 * * *` UTC; override `CRON_DEADLINE_SYNC` | Single daily batch; document in dev-phase6 |
| Admin manual sync | **Reuse** `POST /admin/notifications/sync-deadlines` | Already exists; cron uses same service method |
| Profile API | Extend `UpdateProfileDto` + profile response | Avoid new route; matches existing `StudentController` |
| Email failure | Log warning; **do not** delete in-app row | Arch: retention first |
| Duplicate email | Skip if `emailSentAt` set | Idempotent retries/cron |
| New top-level module | **No** — under `notification/` | Per arch + `40-project-structure.md` |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Schema + migration | `emailNotificationsEnabled` on User; `emailSentAt` on Notification | `npm run db:migrate` succeeds; existing users default `true` |
| M2 | MailService + env | Provider abstraction (`resend` / `smtp` / `log`); `MAIL_ENABLED` gate | `log` provider writes send intent to Logger when enabled |
| M3 | Email on notification create | Hook after create for eligible types; set `emailSentAt` | New row gets email (or log); failure leaves in-app row |
| M4 | Daily cron | `@nestjs/schedule` → `syncDeadlineNotificationsForAllStudents` | Cron registered in `AppModule`; env override documented |
| M5 | Profile API + UI toggle | GET/PUT profile includes preference; `/profile` checkbox | Toggle persists; opt-out blocks email not in-app |
| M6 | Unit tests | Mail, opt-out, idempotency, cron handler, notification regression | `npm run test -w @scholarpath/api` PASS |
| M7 | Docs + dev evidence | `dev-phase6.md`, `PROGRESS.md`, `AGENTS.md`, env README snippet | Evidence complete; scope compliance declared |

## Detailed Development Plan

### M1 — Prisma schema and migration

**File:** `packages/database/prisma/schema.prisma`

```prisma
// User — add:
emailNotificationsEnabled Boolean @default(true) @map("email_notifications_enabled")

// Notification — add:
emailSentAt DateTime? @map("email_sent_at")
```

**Migration name (suggested):** `20260610120000_delivery_alerts`

**Post-migrate:** Existing users receive default `emailNotificationsEnabled = true` via column default.

**Export:** No new public enums required.

**Commands:**
```bash
npm run db:generate
npm run db:migrate
```

---

### M2 — MailService and environment wiring

**Location:** `apps/api/src/notification/mail.service.ts` (and register in `notification.module.ts`)

**Dependencies to add (workspace `apps/api`):**
- `@nestjs/schedule` (M4; may install in M2 or M4)
- Email transport: e.g. `resend` package for Resend API, and `nodemailer` for SMTP (Manager allows equivalent if same env contract)

**Environment variables (document in root or `apps/api` `.env.example` and `dev-phase6.md`):**

| Variable | Required when | Purpose |
|---|---|---|
| `MAIL_ENABLED` | — | `true` / `false`; default **false** in dev template |
| `MAIL_PROVIDER` | `MAIL_ENABLED=true` | `resend` \| `smtp` \| `log` |
| `EMAIL_FROM` | `MAIL_ENABLED=true` | Sender address |
| `RESEND_API_KEY` | provider=resend | API key |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | provider=smtp | SMTP |
| `CRON_DEADLINE_SYNC` | optional | Cron expression; default `0 7 * * *` |

**`MailService` behavior:**
- If `MAIL_ENABLED` is not `true` → no-op (return without error).
- `log` provider: `Logger.log` with `userId`, `to` (masked optional), `subject` only — **never** full body in production logs.
- `resend` / `smtp`: send plain-text (and optional simple HTML) with Hebrew `title`/`body` from notification.
- Throw or return structured error to caller; caller must not roll back notification row.

**Startup:** When `MAIL_ENABLED=true` and provider is `resend` or `smtp`, validate required vars; warn or fail per existing project env patterns (document choice in dev-phase6).

---

### M3 — Integrate email after notification create

**File:** `apps/api/src/notification/notification.service.ts`

**Refactor pattern (indicative):**
1. Private `createNotificationAndMaybeEmail(data)` — `prisma.notification.create`, then `maybeSendEmail(notificationId)`.
2. `maybeSendEmail`:
   - Load notification + `user.email`, `user.emailNotificationsEnabled`.
   - If type not in `[DEADLINE_APPROACHING, APPLICATION_STATUS]` → return.
   - If `emailSentAt` already set → return.
   - If `!emailNotificationsEnabled` or `!MAIL_ENABLED` → return.
   - Call `MailService.send`; on success `update { emailSentAt: new Date() }`.
   - On failure: `Logger.warn` with notification id only.

**Call sites to route through helper:**
- `syncDeadlineNotifications` — per successful create (inside try after create, or unified helper).
- `createApplicationStatusNotification` — after successful create.

**Do not change:**
- Dedupe `@@unique([userId, type, applicationId])` behavior (catch unique violation as today).
- `DEADLINE_WINDOW_DAYS = 7`, `ACTIVE_STATUSES` unchanged.
- Application state machine.

---

### M4 — Scheduled deadline sync

**Files:**
- `apps/api/src/notification/deadline-sync.scheduler.ts` (or `notification.scheduler.ts`)
- `apps/api/src/app.module.ts` — `ScheduleModule.forRoot()`

**Cron handler:**
```text
@Cron(process.env.CRON_DEADLINE_SYNC ?? '0 7 * * *')
→ notificationService.syncDeadlineNotificationsForAllStudents()
```

**Logging:** Log `created` count at info level (no student emails in log).

**Manual E2E:** `POST /api/admin/notifications/sync-deadlines` with admin JWT (unchanged path).

**Out of scope:** New admin alias endpoint unless needed for tests only (not required).

---

### M5 — Profile API and web toggle

**Backend — `apps/api/src/student/`:**

| File | Change |
|---|---|
| `dto/update-profile.dto.ts` | Add optional `@IsBoolean() emailNotificationsEnabled?: boolean` |
| `student.service.ts` | `getProfile`: return `{ ...studentProfile, emailNotificationsEnabled }` from `User` |
| `student.service.ts` | `updateProfile`: if `dto.emailNotificationsEnabled !== undefined`, update `User` |

**Response shape (GET/PUT):** Include `emailNotificationsEnabled: boolean` alongside existing profile fields.

**Frontend — `apps/web/src/app/profile/page.tsx`:**
- Checkbox: **"קבל התראות במייל"**
- Helper text: **"התראות באתר ימשיכו להופיע גם כשהמייל כבוי"** (or equivalent Hebrew per Manager decision)
- Load from `GET /student/profile` on mount (not only session)
- Include `emailNotificationsEnabled` in PUT body with academic fields

**Frontend — `apps/web/src/lib/api.ts`:**
- Extend `StudentProfile` type with `emailNotificationsEnabled?: boolean`

**Optional (low priority):** One line on `/notifications` page: email duplicates important alerts when enabled.

---

### M6 — Unit tests

**Minimum new/updated specs:**

| File | Tests |
|---|---|
| `mail.service.spec.ts` | `log` provider sends when enabled; no-op when `MAIL_ENABLED=false` |
| `notification.service.spec.ts` | Email skipped when `emailNotificationsEnabled=false`; `emailSentAt` prevents second send; regression: deadline sync + dedupe still pass |
| `deadline-sync.scheduler.spec.ts` or test public method | Cron handler calls `syncDeadlineNotificationsForAllStudents` (mock) |

**Command:**
```bash
npm run test -w @scholarpath/api
```

**Lint:** Document NOT AVAILABLE if unchanged.

---

### M7 — Documentation and developer evidence

**Update:**
- `DOCS/PROGRESS.md` — Phase 6 section (in progress → complete when done)
- `AGENTS.md` — Current Phase 6; list MailService, Schedule, env vars
- `team-Yuri/dev-phase6.md` — full evidence per checklist below

**Optional:** Short env block in project README if one exists; otherwise dev-phase6 is sufficient.

---

## Acceptance / Gating Criteria

- [ ] Migration applied; `User.emailNotificationsEnabled` defaults true for existing rows
- [ ] `Notification.emailSentAt` nullable; set only after successful send
- [ ] `MAIL_ENABLED=false` or `MAIL_PROVIDER=log` — no external send in dev default
- [ ] `MAIL_PROVIDER=log` + `MAIL_ENABLED=true` — log line proves send path
- [ ] Deadline in 7-day window + active application → admin sync creates in-app + email (or log)
- [ ] `emailNotificationsEnabled=false` → in-app still created; **no** email
- [ ] Re-run sync / duplicate create → no second email (`emailSentAt` / unique dedupe)
- [ ] Application → SUBMITTED → in-app + email (when enabled)
- [ ] Daily cron registered and documented (expression + manual substitute endpoint)
- [ ] `/profile` toggle loads and persists
- [ ] Phases 1–5 smoke: login, scholarships, recommendations refresh, application letter, community, import, notification bell
- [ ] No scraping, `IngestionJob`, push, or “new recommendations” email code
- [ ] Unit tests pass (`npm run test -w @scholarpath/api`)
- [ ] `dev-phase6.md` complete with declaration PASS

## Functional Testability Criteria

- **Page:** `/profile` (email toggle), `/notifications` (in-app list unchanged)
- **User-visible:** Email (or API log) after deadline sync or SUBMITTED when toggle on
- **CLI:** `npm run dev` with env; `npm run test -w @scholarpath/api`
- **API:**
  - `PUT /student/profile` with `{ "emailNotificationsEnabled": false }`
  - `POST /admin/notifications/sync-deadlines` (admin token)
- **Minimal E2E:**
  1. Login admin — set scholarship `deadline` to +3 days from today
  2. Login student — ensure application `IN_PROGRESS` for that scholarship
  3. Set `MAIL_ENABLED=true`, `MAIL_PROVIDER=log` — restart API
  4. Admin `POST /admin/notifications/sync-deadlines` — verify in-app notification + log send line
  5. Student `/profile` — disable email toggle — repeat sync — new in-app only if new app/deadline pair; **no** new email for same notification
  6. Submit application — verify SUBMITTED in-app + email/log when toggle on
  7. Smoke: `/community`, `/scholarships`, recommendations refresh
- **Credentials:** `admin@scholarpath.local` / `admin123`, `student@scholarpath.local` / `student123`

## Required Developer Evidence

`team-Yuri/dev-phase6.md` must include:

| Section | Required content |
|---|---|
| Phase identifier | `PHASE=6` |
| Milestones | Table M1–M7 with Yes/No |
| Files changed | Paths under `packages/database`, `apps/api`, `apps/web` |
| Dependencies | New npm packages (`@nestjs/schedule`, mail libs) |
| Env vars | Table with values used in test (redact secrets) |
| Unit tests | Command + PASS count |
| Lint | PASS or NOT AVAILABLE + reason |
| Functional | E2E steps above; sample log line or Resend test inbox proof |
| Cron | Default expression; how manual sync substitutes |
| Scope compliance | No scraping/push/recommendation email |
| Declaration | PASS or FAIL |

## Out of Scope

- “New recommendations” email or in-app alert
- `NotificationType.SYSTEM` usage
- SMS / mobile push
- Autonomous scraping, `IngestionJob`, community expansion
- Admin user monitoring (Phase 8)
- Marketing templates, drip campaigns, external unsubscribe links
- Replacing in-app notifications with email-only
- New top-level monorepo folders

## Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Resend domain not verified in pilot | Use `log` provider for demo; document Resend setup |
| Cron runs in dev unexpectedly | `MAIL_ENABLED` default false; document disabling schedule in test |
| `getProfile` only returned `StudentProfile` | M5 explicitly merges `User.emailNotificationsEnabled` |
| Email on unique-conflict skip | Only send when `create` succeeds (new row) |
| Windows `db:generate` EPERM | Stop API before migrate (document in dev-phase6) |

| Open Question | Status |
|---|---|
| Resend vs SMTP in production | Resend preferred in docs; SMTP optional via env |
| Optional note on `/notifications` | Nice-to-have; not gating |

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
Pending Phase 6 implementation and `dev-phase6.md`.

### Required Corrections
None at planning stage.
