# Architecture Phase 6

## Phase Identifier
PHASE=6

## Status
STATUS: APPROVED

## Phase Goal
Deliver **Delivery & Alerts**: outbound email for existing notification types and a **daily scheduled** deadline sync so students receive reminders without opening the app—closing the gap vs `DOCS/scholar_path_architecture_plan_v_0.md` §10 while preserving all Phase 1–5 behavior.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=6`
- `team-Yuri/plan.md` — Phase 6 section
- `DOCS/scholar_path_phases_plan_v_0.md` (v0.2) — Phase 6 Delivery & Alerts
- `DOCS/scholar_path_architecture_plan_v_0.md` — §5.7 Notification Module, §10 Notifications
- `team-Yuri/arch-phase4.md`, `team-Yuri/arch-phase5.md` — prior contracts
- Existing: `apps/api/src/notification/notification.service.ts`, `Notification` Prisma model, `NotificationBell` session sync

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **Extend `NotificationModule`** (no new top-level module) | Retention logic already centralized | Add `MailService` (or `EmailDeliveryService`) under `notification/` |
| **Provider: Resend first, SMTP optional via env** | Simple API, good DX for pilot; plan open question resolved for MVP | `MAIL_PROVIDER=resend \| smtp \| log`; `log` writes to Logger only (local dev) |
| **Email mirrors in-app triggers only** | Avoid scope creep (no “new recommendations” email) | Send on successful `notification.create` for `DEADLINE_APPROACHING` and `APPLICATION_STATUS` |
| **Reuse existing deadline rules** | Consistency with Phase 4 | 7-day window; applications `NOT_STARTED` \| `IN_PROGRESS`; same dedupe `@@unique([userId, type, applicationId])` |
| **`@nestjs/schedule` daily cron** | Reliable delivery without browser login | e.g. `0 7 * * *` UTC (document Israel-local equivalent in dev-phase6) |
| **Cron calls existing `syncDeadlineNotificationsForAllStudents`** | No duplicate business logic | Extend sync path to send email after each new row |
| **Opt-out on `User`** | Minimal preferences | `emailNotificationsEnabled Boolean @default(true)` on `User` (not JSON preferences) |
| **`emailSentAt` on `Notification`** | Idempotent email; safe retries | Skip send if `emailSentAt` already set; set after successful send |
| **Keep in-app session sync on bell** | Phase 4 UX preserved | `NotificationBell` still calls `POST /notifications/sync-deadlines` once per tab |
| **Hebrew email body** | Match product UI | Plain-text or simple HTML; title/body aligned with in-app strings |
| **No mobile push, no scraping** | Phase 7+ / out of scope | Unchanged boundaries |

## Constraints / Non-Negotiables
- Do not break Phases 1–5: auth, applications state machine, recommendations, community, import, behavior boost.
- Notifications remain **informational**; no auto state transitions.
- AI does not send emails or schedule jobs.
- Email must be **disabled by default in dev** when `MAIL_ENABLED=false` or `MAIL_PROVIDER=log`.
- No PII in logs beyond user id; never log full email body in production.
- Hebrew UI for settings label; English code.
- Developer: unit tests + `dev-phase6.md` per `20-testing.md`.
- No new top-level repo folders (`40-project-structure.md`).

## Technical Boundaries / Out of Scope
- “New recommendations” email or `NotificationType.SYSTEM` usage
- SMS / mobile push
- Autonomous scraping, `IngestionJob`, community expansion
- Admin user monitoring dashboard (Phase 8)
- Full marketing email templates / drip campaigns
- Unsubscribe via external link provider (MVP: in-app toggle only)
- Replacing in-app notifications with email-only

## Dependencies and Interfaces

**Depends on:**
- Phase 4: `NotificationModule`, types `DEADLINE_APPROACHING`, `APPLICATION_STATUS`, dedupe, sync methods
- Phase 1–3: `User.email`, applications, scholarships with `deadline`
- Phase 5: unchanged

**Extend (no new AppModule import required beyond Schedule):**
- `NotificationService` — after create, invoke mail send
- `ScheduleModule` registered in `AppModule`

**New / indicative API surface:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/student/profile` | JWT (STUDENT) | Response includes `emailNotificationsEnabled` |
| `PUT` | `/student/profile` | JWT (STUDENT) | Extend `UpdateProfileDto` with optional `emailNotificationsEnabled` |

**Reuse (no duplicate admin route):**
- `POST /admin/notifications/sync-deadlines` — already bulk-syncs all students; cron calls the same `syncDeadlineNotificationsForAllStudents()`; manual E2E uses this endpoint

Existing (unchanged paths):
- `POST /notifications/sync-deadlines` (student, once per tab via bell)

**Frontend:**
- `/profile` — toggle “קבל התראות במייל” (or section under profile)
- Optional: note in `/notifications` that email duplicates important alerts

**Environment variables (document in README / dev-phase6):**

| Variable | Purpose |
|---|---|
| `MAIL_ENABLED` | `true` / `false` — master switch |
| `MAIL_PROVIDER` | `resend` \| `smtp` \| `log` |
| `RESEND_API_KEY` | Resend API key when provider=resend |
| `EMAIL_FROM` | From address (verified domain in Resend) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | When provider=smtp |
| `CRON_DEADLINE_SYNC` | Cron expression override (default daily morning UTC) |

## Data / State Considerations

**Prisma migration (Manager refines naming):**

```prisma
// User — add:
emailNotificationsEnabled Boolean @default(true) @map("email_notifications_enabled")

// Notification — add:
emailSentAt DateTime? @map("email_sent_at")
```

**Email send flow:**
1. `NotificationService` creates in-app row (existing logic).
2. If `user.emailNotificationsEnabled && MAIL_ENABLED`, `MailService.send({ to, subject: title, text: body, html? })`.
3. On success, `update notification set emailSentAt = now()`.
4. On failure, log warning; **do not** roll back in-app notification.

**Cron flow:**
1. `@Cron` → `notificationService.syncDeadlineNotificationsForAllStudents()` (existing).
2. Each newly created notification triggers email path as above.

**SUBMITTED hook:**
- Extend `createApplicationStatusNotification` to send email after create (same path).

## Security / Privacy Considerations
- Send only to `User.email` for that `userId`; no BCC to admin.
- Rate-limit or batch cron to avoid provider throttling (Manager: single daily run acceptable).
- Validate `EMAIL_FROM` at startup when `MAIL_ENABLED=true`; fail fast in production config doc.
- Opt-out must stop emails immediately; in-app notifications may continue (Architect default: **email opt-out only**, in-app still on — Manager confirm in UI copy).

## Testing and Lint Expectations
- Unit tests: `MailService` with `log` provider; mock Resend client
- Unit tests: email skipped when `emailNotificationsEnabled=false`
- Unit tests: `emailSentAt` prevents duplicate send
- Unit tests: cron handler invokes sync (mock schedule or test public method)
- Regression: existing `notification.service.spec.ts` still PASS
- Command: `npm run test -w @scholarpath/api`
- Lint: document NOT AVAILABLE if unchanged

## Functional Testability

- **Page/screen:** `/profile` — email toggle visible and persists
- **User-visible:** With `MAIL_PROVIDER=log` or test Resend inbox, user receives email after deadline sync or SUBMITTED
- **Command-line:** `npm run dev` with `MAIL_ENABLED=true` and test API key; manual `POST /admin/notifications/sync-deadlines` as cron substitute
- **API:** PATCH profile notifications; cron creates rows + emails for fixture user with deadline in 7 days and active application
- **Minimal E2E:**
  1. Set scholarship deadline +3 days; student has IN_PROGRESS application
  2. Run admin scheduled sync (or wait cron in staging)
  3. Verify in-app notification + email (or log line)
  4. Toggle opt-out → run again → no second email
  5. Mark application SUBMITTED → in-app + email (if enabled)
- **Expected result:** Email delivery provable without browser session; Phases 1–5 smoke still pass

## Handoff Notes for Manager

Break into milestones (suggested M1–M7):
- **M1** Prisma: `emailNotificationsEnabled`, `emailSentAt` + migration
- **M2** `MailService` + env wiring (`resend` / `smtp` / `log`)
- **M3** Integrate send after notification create + `emailSentAt`
- **M4** `@nestjs/schedule` daily cron → same sync as `POST /admin/notifications/sync-deadlines` (no new admin path unless Manager prefers alias)
- **M5** Profile API + web toggle
- **M6** Unit tests (mail + cron + opt-out)
- **M7** `dev-phase6.md`, `PROGRESS.md`, `AGENTS.md`

**Defaults for Manager (no further Architect questions unless user objects):**
- Resend preferred when `MAIL_PROVIDER` unset in production docs
- SUBMITTED email **in scope** (mirror in-app)
- In-app notifications **always on**; toggle affects **email only**

**Credentials for E2E:** `student@scholarpath.local`, `admin@scholarpath.local` (existing seed).

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned: `PHASE=6` across PHASE.md, arch-phase6.md, manager-phase6.md, dev-phase6.md.
- All manager milestones M1–M7 marked complete in dev-phase6 with file/module evidence.
- Architecture honored: `NotificationModule` extended (no new top-level module); `MailService` with `resend` / `smtp` / `log` providers and `MAIL_ENABLED` gate; email only for `DEADLINE_APPROACHING` and `APPLICATION_STATUS`; `emailSentAt` idempotency; `User.emailNotificationsEnabled` opt-out (in-app always on); `DeadlineSyncScheduler` daily cron calling `syncDeadlineNotificationsForAllStudents()`; profile GET/PUT + `/profile` Hebrew toggle.
- Out of scope verified: no `IngestionJob`, scraper, push, or "new recommendations" email code under `apps/`.
- API surface unchanged except profile preference fields; admin sync endpoint reused for cron-equivalent E2E.
- Unit tests: 19/19 PASS per dev-phase6 (mail, notification opt-out/idempotency, scheduler, Phase 5 regression suites).
- Lint: NOT AVAILABLE — documented; acceptable per Phases 4–5 and `20-testing.md`.
- Functional evidence: dev-phase6 documents E2E path, MailService log sample, cron manual substitute via `POST /admin/notifications/sync-deadlines`. Manual full E2E recommended but not blocking (same bar as Phase 5).
- Phases 1–5 contracts preserved: application state machine unchanged; dedupe and 7-day window unchanged; AI does not send mail or schedule jobs.
- Known limitations acceptable: Windows `db:generate` EPERM when API locks Prisma DLL; optional `/notifications` email note not implemented (Manager nice-to-have).
- Process note at review time: `manager-phase6.md` `MANAGER_REVIEW_STATUS` was still `NOT_REVIEWED`; run Manager review for dual sign-off before Phase 7 planning.

### Required Corrections
None. Phase 6 approved for architecture closure. Delivery & Alerts gap vs architecture plan §10 (email + scheduled deadline sync) is satisfied at MVP scope; "new recommendations" email remains deferred per phase boundaries.
