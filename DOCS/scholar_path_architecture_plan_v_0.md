# ScholarPath – Architecture Plan (v0.1)

> **Document note (2026-06):** This file is the original vision. **Implemented MVP** is documented in `DOCS/PROGRESS.md` and `team-Yuri/dev-phase*.md`. Gaps vs this doc (email, cron, scraping, admin user monitoring) are tracked in `DOCS/scholar_path_phases_plan_v_0.md` **v0.2** (Phase 6–8).

## 1. System Overview
ScholarPath is a modular monolith SaaS platform for scholarship discovery, AI-assisted application writing, and student progress tracking.

MVP scale: up to 500 users (pilot phase)
Primary goal: validate scholarship matching + AI-assisted motivation letter generation.

---

## 2. Architectural Principles

- **Modular Monolith First**: single backend, clear internal modules
- **AI as Assistive Layer**: AI never owns system state
- **PostgreSQL as Source of Truth**
- **Workflow-based design**: application lifecycle is state-driven
- **Manual-first data strategy (MVP)**

---

## 3. High-Level Architecture

```
[ Next.js Frontend ]
        ↓
[ Node.js Backend (Modular Monolith) ]
        ↓
[ PostgreSQL Database ]
        ↓
[ Claude API (AI Layer) ]
```

---

## 4. Frontend (Next.js)

### Responsibilities
- Student dashboard
- Scholarship browsing
- Application workflow UI
- AI-generated letter editor
- Admin panel

### Notes
- SSR only where needed (SEO for scholarships)
- Client-heavy dashboard interactions

---

## 5. Backend (Node.js Monolith)

### Modules

#### 5.1 Auth Module
- Login / registration
- JWT sessions

#### 5.2 Student Module
- Profile management
- Preferences

#### 5.3 Scholarship Module
- CRUD scholarships (admin)
- Filtering & search

#### 5.4 Matching Module
- Rule-based filtering
- AI ranking layer

#### 5.5 Application Module
- State machine:
  NOT_STARTED → IN_PROGRESS → SUBMITTED → ACCEPTED / REJECTED

#### 5.6 AI Module
- Motivation letter generation
- Profile summarization
- Ranking enrichment

#### 5.7 Notification Module
- Email notifications
- In-app alerts

#### 5.8 Admin Module
- Scholarship management
- User monitoring

---

## 6. Database (PostgreSQL)

### Core Tables

#### Users
- id
- email
- password_hash
- role

#### StudentProfile
- user_id
- field_of_study
- year
- GPA
- preferences (JSONB)

#### Scholarships
- id
- title
- description
- eligibility_rules (JSONB)
- deadline
- source_url
- tags

#### Applications
- id
- user_id
- scholarship_id
- status
- motivation_letter
- timestamps

#### Recommendations
- user_id
- scholarship_id
- score
- computed_at

---

## 7. AI Layer (Claude API)

### Responsibilities
- Motivation letter generation
- Scholarship ranking assistance
- Profile summarization

### Constraints
- No direct DB writes
- Stateless execution
- Always user-initiated or backend-triggered

---

## 8. Matching System

### Phase 1 Logic

1. Hard filters:
   - field_of_study match
   - year eligibility
   - GPA threshold

2. AI ranking:
   - score 0–100 relevance
   - based on profile + scholarship text

---

## 9. Application Workflow

State machine:

NOT_STARTED → IN_PROGRESS → SUBMITTED → ACCEPTED / REJECTED

Rules:
- user controls transitions
- AI only generates content
- external submission happens outside system

---

## 10. Notifications

- Email: deadlines & reminders
- In-app: system updates

Triggers:
- deadline approaching
- application status change
- new recommendations

---

## 11. Non-Functional Requirements

- Max 500 users (MVP)
- Page load < 2.5s
- AI response async acceptable up to 20s
- System must function without AI availability

---

## 12. Key Risks

- low-quality scholarship dataset
- generic AI outputs
- user drop-off due to notification overload
- cold start in recommendations

---

## 13. Architectural Summary

This system is intentionally layered:

1. Data Layer → scholarships + users
2. Core System Layer → tracking + workflows
3. Intelligence Layer → AI ranking + personalization
4. Experience Layer → UI + workflows + content generation
5. Growth Layer → automation + scaling

Key principle:
> Each layer must be fully functional before the next is introduced.

