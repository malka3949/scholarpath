# ScholarPath — Progress

**Current phase:** 8 — Action Engine v3 Alignment (complete)  
**Team Yuri pointer:** `team-Yuri/PHASE.md` → `PHASE=8`  
**Last updated:** 2026-06-09  
**Next:** Phase 9 — External Integration Layer (backlog). See `team-Yuri/plan.md`.

---

## Phase 8 — Action Engine v3 Alignment (complete)

### Backend
- [x] Migration `20260609120000_action_engine_v3` — EXPIRED, OPPORTUNITY_ACTION, traceability
- [x] `ActionExpirationService` — per-type expiration + COMPLETION→DONE
- [x] Hybrid priority-v2 scoring + tie-breaker + env weights
- [x] `GET /actions` — status, type, limit, offset, sort, total
- [x] `ActionReconciliationScheduler` — daily cron

### Frontend
- [x] `/dashboard/actions` — paginated View All (Hebrew)
- [x] Dashboard "הצג הכל" link; actions rendered in API order

### Verification
- [x] Jest: `npm run test -w @scholarpath/api` (44 tests PASS)
- [x] `team-Yuri/dev-phase8.md` evidence

---

## Phase 7 — Action Engine MVP (complete)

### Backend
- [x] `UserAction` model + enums + migration `20260608120000_action_engine`
- [x] `ActionModule` — scoring, generators, upsert/regenerate, stale dismiss
- [x] `GET /actions`, `POST /actions/regenerate`, `PATCH /actions/:id`
- [x] `POST /admin/actions/regenerate/:userId` (ADMIN)
- [x] Hooks: Application, Student, Matching, Events, Notification batch sync

### Frontend
- [x] `/dashboard` — Action Center, recommendations snippet, deadline pressure
- [x] Navbar "לוח בקרה"; middleware protects `/dashboard`
- [x] API client: `fetchActions`, `regenerateActions`, `updateActionStatus`

### Verification
- [x] Jest: `npm run test -w @scholarpath/api` (35 tests PASS)
- [x] `team-Yuri/dev-phase7.md` evidence
- [x] No AI priority, SystemEvents table, or scraping code

---

## Phase 6 — Delivery & Alerts (complete)

### Backend
- [x] `User.emailNotificationsEnabled`, `Notification.emailSentAt` + migration `20260610120000_delivery_alerts`
- [x] `MailService` — Resend / SMTP / log; env `MAIL_ENABLED`, `MAIL_PROVIDER`, `EMAIL_FROM`, etc.
- [x] Email after notification create (deadline + SUBMITTED)
- [x] `DeadlineSyncScheduler` — `@nestjs/schedule` daily cron
- [x] Profile API — `emailNotificationsEnabled` on GET/PUT `/student/profile`

### Frontend
- [x] `/profile` — checkbox "קבל התראות במייל" + helper text (in-app stays on)

### Verification
- [x] Jest: `npm run test -w @scholarpath/api` (19 tests PASS)
- [x] `team-Yuri/dev-phase6.md` evidence
- [x] No scraping / IngestionJob / push / recommendation-email code

---

## Phase 5 — Growth Layer (complete)

### Backend
- [x] `ScholarshipSource`, `ScholarshipEvent`, `CommunityPost`, `CommunityComment` + migration `20260603120000_growth_layer`
- [x] `IngestionModule` — bulk import `POST /admin/scholarships/import`
- [x] `EventsModule` — `POST /scholarships/:id/events`; APPLY_START on application create
- [x] `BehaviorBoostService` — boost in recommendation refresh (`baseScore * 0.85 + boost`, cap 15)
- [x] `CommunityModule` — posts + comments (public GET, JWT POST)

### Frontend
- [x] `/community` list + create; `/community/[id]` thread
- [x] Navbar link "קהילה"
- [x] Admin JSON import section
- [x] Source badges: `מיובא` / `דמו`; VIEW event on scholarship detail

### Verification
- [x] Jest: `npm run test -w @scholarpath/api` (14 tests PASS)
- [x] `team-Yuri/dev-phase5.md` evidence
- [x] No scraping / IngestionJob / email code

---

## Phase 4 — Retention Layer (complete)

### Backend
- [x] `Notification` model + migration `20260602120000_notifications`
- [x] `NotificationModule` — list, unread-count, mark read, read-all
- [x] `POST /notifications/sync-deadlines` (student)
- [x] `POST /admin/notifications/sync-deadlines` (admin)
- [x] Deadline reminders (7-day window, active applications)
- [x] `APPLICATION_STATUS` notification on SUBMITTED

### Frontend
- [x] `NotificationBell` in navbar + session sync
- [x] `/notifications` page
- [x] Deadline badge on `/applications`
- [x] `HomeNotificationsBanner` on homepage

### Verification
- [x] Jest: `npm run test -w @scholarpath/api` (4 tests PASS)
- [x] API: sync + unread-count verified
- [x] `team-Yuri/dev-phase4.md` evidence

---

## Phase 3 (complete)
Motivation letters, application workflow

## Phase 2 (complete)
Recommendations, AI ranking

## Phase 1 (complete)
Auth, scholarships, applications, admin

---

## Team Yuri Artifacts

| File | Status |
|------|--------|
| `team-Yuri/plan.md` | APPROVED |
| `team-Yuri/arch-phase4.md` | READY_FOR_MANAGER |
| `team-Yuri/manager-phase4.md` | READY_FOR_DEVELOPER |
| `team-Yuri/dev-phase4.md` | COMPLETE |

---

## Commands

```bash
npm run dev
npm run db:migrate
npm run test -w @scholarpath/api
```
