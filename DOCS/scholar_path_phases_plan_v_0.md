# ScholarPath – Phases Plan (v0.2)

## Overview
This document defines the phased execution plan for building ScholarPath. Each phase is incremental and dependency-based.

**Delivery status (2026-06):** Phases 1–5 MVP implemented. Phase 4–5 delivered a **subset** of the original v0.1 scope below (see *Delivered as* notes). Phase 6+ is planned backlog, not yet built.

---

## 🧱 Phase 1 — MVP Foundation (Core System)
**Goal:** Build a functional non-AI system.

### Scope
- User authentication (email + Google OAuth)
- Student profile system
- Admin panel for manual scholarship creation
- Scholarship browsing and search
- Application tracking (state machine only)

### Out of Scope
- AI features
- Automation / scraping
- Community system

### Exit Criteria
- Users can register and login
- Users can browse scholarships
- Users can track application status

---

## 🧠 Phase 2 — Intelligence Layer
**Goal:** Add personalization and AI-based ranking.

### Scope
- Rule-based filtering engine
- AI ranking using Claude API
- Recommendation system per user
- Profile summarization for AI prompts

### Exit Criteria
- Each user sees personalized scholarship rankings
- AI improves relevance over basic filtering

---

## ✍️ Phase 3 — AI Workflow Layer
**Goal:** Enable AI-assisted application content creation.

### Scope
- Motivation letter generator
- Application start workflow UI
- Draft saving and editing
- Link letters to applications

### Exit Criteria
- Users generate and edit full motivation letters
- Letters are attached to applications

---

## 🔔 Phase 4 — Retention Layer — COMPLETE (partial vs v0.1)
**Goal:** Increase user engagement and return rate.

### Scope (original v0.1)
- Email notifications
- In-app notifications
- Deadline tracking system
- Dashboard reminders

### Delivered as (actual MVP)
- In-app notifications (list, unread, mark read)
- Deadline sync on login (`POST /notifications/sync-deadlines`, 7-day window)
- `APPLICATION_STATUS` notification on SUBMITTED
- UI: bell, `/notifications`, deadline badges on applications

### Deferred to Phase 6
- Email delivery
- Scheduled/cron deadline jobs (no background scheduler)

### Exit Criteria
- Users receive timely alerts
- Users return to platform based on notifications

---

## 🌱 Phase 5 — Growth Layer — COMPLETE (partial vs v0.1)
**Goal:** Scale data and platform intelligence.

### Scope (original v0.1)
- Scholarship scraping/agent system
- Community module (posts/comments)
- Behavioral learning for ranking improvement
- External integrations

### Delivered as (actual MVP)
- Admin JSON bulk import (`IMPORTED` source)
- Community posts + comments (`/community`)
- Behavioral events (`VIEW`, `APPLY_START`) + recommendation score boost
- No autonomous scraping

### Deferred to Phase 7+
- Autonomous scraping/agents, `IngestionJob` table, external integrations

### Exit Criteria
- System auto-discovers scholarships *(deferred — manual/import path delivered)*
- Recommendation quality improves with usage signals *(boost delivered; no ML pipeline)*

---

## 📧 Phase 6 — Delivery & Alerts — PLANNED (not built)
**Goal:** Close the gap vs `scholar_path_architecture_plan_v_0.md` §10 — reliable outbound alerts and scheduled deadline checks.

### Scope
- Email provider integration (e.g. Resend/SMTP; env-configured)
- Email for `DEADLINE_APPROACHING` (same 7-day window rules as in-app)
- Email for `APPLICATION_STATUS` on SUBMITTED (optional mirror of in-app)
- Scheduled job (cron/`@nestjs/schedule`) to run deadline sync for all students daily
- User email preferences opt-out (minimal: global or per-type flag)
- Document env vars and test path in `dev-phase6.md`

### Out of Scope
- Autonomous scholarship scraping
- New recommendation push notifications (optional Phase 6b or Phase 7)
- Community DMs, admin user monitoring dashboard
- Mobile push

### Exit Criteria
- Student with active application and deadline in window receives **email** (test inbox)
- Cron run creates in-app + email notifications without requiring browser login
- Phases 1–5 flows unchanged; unit tests for mail + scheduler hooks

### Team Yuri artifacts (required before implementation)
- `team-Yuri/arch-phase6.md`, `manager-phase6.md`, then `PHASE=6` + Developer

---

## 🔍 Phase 7 — Real Data Pipeline — BACKLOG (not built)
**Goal:** Scholarships beyond demo seed and manual JSON import.

### Scope (candidate)
- Controlled ingestion from approved sources (not unsupervised production scrape without legal review)
- Optional `IngestionJob` persistence and admin visibility
- Data quality validation

### Out of Scope
- Full 24/7 autonomous agents without governance

---

## 🛠️ Phase 8 — Admin & Operations — BACKLOG (not built)
**Goal:** Operational visibility for pilot.

### Scope (candidate)
- Admin user list / basic activity view
- Production deploy runbook (out of app code or minimal)

---

## Still Not Planned as Phases (backlog / future)
- ML model training on behavior
- `SYSTEM` notification type usage
- “New recommendations” in-app alert
- Student unified dashboard, SSR/SEO for scholarships
- External SSO (university), LinkedIn
- E2E test suite, ESLint enforcement

---

## Architectural Principle
Each phase must be fully stable before moving to the next. No phase depends on incomplete previous phases.

