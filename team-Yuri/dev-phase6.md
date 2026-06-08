# Developer Phase 6

## Phase Identifier
PHASE=6

## Status
STATUS: COMPLETE

## Source References
- `team-Yuri/PHASE.md`
- `team-Yuri/plan.md`
- `team-Yuri/arch-phase6.md`
- `team-Yuri/manager-phase6.md`
- `AGENTS.md`
- `.cursor/rules/20-testing.md`, `30-docs.md`, `40-project-structure.md`

## Implementation Summary
Delivery & Alerts: Prisma fields for email opt-out and send tracking, `MailService` (Resend/SMTP/log), email after `DEADLINE_APPROACHING` and `APPLICATION_STATUS` notification create, daily cron via `@nestjs/schedule`, profile API + `/profile` toggle. In-app notifications unchanged; email respects `emailNotificationsEnabled` and `MAIL_ENABLED`.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---:|---:|---|
| M1 Schema + migration | Yes | `20260610120000_delivery_alerts` applied |
| M2 MailService + env | Yes | `mail.service.ts`; `.env.example` vars |
| M3 Email on create | Yes | `createNotificationAndMaybeEmail` + `maybeSendEmail` |
| M4 Daily cron | Yes | `DeadlineSyncScheduler`; `ScheduleModule.forRoot()` |
| M5 Profile API + UI | Yes | `PUT`/`GET` `/student/profile`; checkbox on `/profile` |
| M6 Unit tests | Yes | 19 Jest tests PASS |
| M7 Docs | Yes | PROGRESS, AGENTS, dev-phase6 |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `packages/database/prisma/schema.prisma` | User + Notification email fields | M1 |
| `packages/database/prisma/migrations/20260610120000_delivery_alerts/` | SQL migration | M1 |
| `apps/api/package.json` | @nestjs/schedule, resend, nodemailer | M2/M4 |
| `apps/api/src/notification/mail.service.ts` | Email providers | M2 |
| `apps/api/src/notification/mail.service.spec.ts` | Mail tests | M6 |
| `apps/api/src/notification/notification.service.ts` | Email hooks | M3 |
| `apps/api/src/notification/notification.service.spec.ts` | Extended tests | M6 |
| `apps/api/src/notification/deadline-sync.scheduler.ts` | Cron job | M4 |
| `apps/api/src/notification/deadline-sync.scheduler.spec.ts` | Scheduler test | M6 |
| `apps/api/src/notification/notification.module.ts` | Register providers | M2–M4 |
| `apps/api/src/app.module.ts` | ScheduleModule | M4 |
| `apps/api/src/student/dto/update-profile.dto.ts` | emailNotificationsEnabled | M5 |
| `apps/api/src/student/student.service.ts` | User preference in profile | M5 |
| `apps/web/src/lib/api.ts` | StudentProfile type | M5 |
| `apps/web/src/app/profile/page.tsx` | Email toggle UI | M5 |
| `.env.example` | Phase 6 mail vars | M2 |
| `DOCS/PROGRESS.md` | Phase 6 section | M7 |
| `AGENTS.md` | Phase 6 pointer | M7 |

## Dependencies Installed

| Dependency / Tool | Command Used | Reason |
|---|---|---|
| `@nestjs/schedule` | `npm install @nestjs/schedule -w @scholarpath/api` | M4 cron |
| `resend` | `npm install resend -w @scholarpath/api` | M2 Resend provider |
| `nodemailer` | `npm install nodemailer -w @scholarpath/api` | M2 SMTP provider |
| `@types/nodemailer` | `npm install -D @types/nodemailer -w @scholarpath/api` | Types |

## Environment Variables (test / dev)

| Variable | Value used in tests |
|---|---|
| `MAIL_ENABLED` | `true` in mail.service.spec (log path); default `false` in `.env.example` |
| `MAIL_PROVIDER` | `log` |
| `EMAIL_FROM` | `notifications@scholarpath.local` (example) |
| `CRON_DEADLINE_SYNC` | unset (default `0 07 * * *` via `CronExpression.EVERY_DAY_AT_7AM`) |

## Unit Tests

| Field | Value |
|---|---|
| Command | `npm run test -w @scholarpath/api` |
| Result | PASS |
| Notes | 19 tests: mail (2), notification (6), scheduler (1), plus Phase 5 regression suites |

```
Test Suites: 6 passed, 6 total
Tests:       19 passed, 19 total
```

Sample log line (functional / log provider):
```
[MailService] Email (log): userId=u1 to=s***t@test.local subject=מועד אחרון
```

## Lint

| Field | Value |
|---|---|
| Command | (none configured) |
| Result | NOT AVAILABLE |
| Notes | Consistent with Phases 4–5 |

## Functional Testability

| Step | Action | Expected |
|---:|---|---|
| 1 | `MAIL_ENABLED=true`, `MAIL_PROVIDER=log`, restart API | Log lines on notification email |
| 2 | Admin sets scholarship deadline +3 days | — |
| 3 | Student application `IN_PROGRESS` | — |
| 4 | `POST /admin/notifications/sync-deadlines` (admin JWT) | In-app notification + MailService log |
| 5 | `/profile` — uncheck email toggle, save | `emailNotificationsEnabled=false` |
| 6 | Repeat sync for same app | No duplicate in-app (unique); no new email |
| 7 | Submit application | In-app SUBMITTED + log email when toggle on |

**Cron:** `DeadlineSyncScheduler` runs `syncDeadlineNotificationsForAllStudents()` daily at 07:00 UTC. Manual substitute: `POST /admin/notifications/sync-deadlines`.

**Credentials:** `student@scholarpath.local` / `student123`, `admin@scholarpath.local` / `admin123`

## Scope Compliance

| Item | Status |
|---|---|
| No scraping / IngestionJob | Yes |
| No push notifications | Yes |
| No “new recommendations” email | Yes |
| Phases 1–5 APIs preserved | Yes (regression tests pass) |

## Known Issues

| Issue | Mitigation |
|---|---|
| `npm run db:generate` EPERM when API dev server locks Prisma DLL | Stop API on port 3001, re-run `db:generate` |
| Migration applied even if generate failed | `migrate deploy` succeeded for `20260610120000_delivery_alerts` |

## Developer Declaration

Phase 6 scope from `manager-phase6.md` M1–M7 implemented. Unit tests **19/19 PASS**. Lint **NOT AVAILABLE**. **Declaration: PASS**
