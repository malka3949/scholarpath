# ScholarPath – Architecture Plan (Unified v0.2)

> This document consolidates v0.1 + v0.2 into a single architectural source of truth.
> It defines the current system (MVP) + next evolution layer (Action Engine).

---

# 1. System Overview

ScholarPath is a modular monolith SaaS platform for:
- Scholarship discovery
- AI-assisted application writing
- Student progress tracking
- Decision guidance (Next Best Action system)

---

# 2. Architectural Principles

- Modular Monolith First (no microservices in MVP)
- PostgreSQL = Single Source of Truth
- AI is assistive only (no system control)
- Workflow/state-driven system
- Manual-first data ingestion (MVP phase)
- Action-driven UX evolution (Phase 7+)

---

# 3. High-Level Architecture
[ Next.js Frontend ]
↓
[ Node.js Modular Monolith Backend ]
↓
[ PostgreSQL Database ]
↓
[ Claude AI API Layer ]

---

# 4. Frontend (Next.js)

## Responsibilities
- Student dashboard
- Scholarship browsing
- Application workflow UI
- AI letter editor
- Admin panel

## Characteristics
- Dashboard-heavy SPA behavior
- SSR only for SEO scholarship pages
- Responsive web-first (no native mobile yet)

---

# 5. Backend (Node.js Modular Monolith)

## Core Modules

### 5.1 Auth Module
- Login / registration
- JWT sessions

---

### 5.2 Student Module
- Profile management
- Preferences
- Academic metadata

---

### 5.3 Scholarship Module
- CRUD scholarships
- Filtering & search
- Admin-managed content

---

### 5.4 Matching Module
- Rule-based filtering
- AI-assisted ranking

---

### 5.5 Application Module
State machine:

NOT_STARTED → IN_PROGRESS → SUBMITTED → ACCEPTED / REJECTED

---

### 5.6 AI Module
- Motivation letter generation
- Profile summarization
- Ranking enrichment

Constraints:
- Stateless execution
- No DB writes
- Backend-controlled invocation only

---

### 5.7 Notification Module
- Email notifications
- In-app alerts

Triggers:
- deadlines
- status changes
- recommendations

---

### 5.8 Admin Module
- Scholarship management
- User monitoring
- content control

---

# 6. Database (PostgreSQL)

## Users
- id
- email
- password_hash
- role

---

## StudentProfile
- user_id
- field_of_study
- year
- GPA
- preferences (JSONB)

---

## Scholarships
- id
- title
- description
- eligibility_rules (JSONB)
- deadline
- source_url
- tags

---

## Applications
- id
- user_id
- scholarship_id
- status
- motivation_letter
- timestamps

---

## Recommendations
- user_id
- scholarship_id
- score
- computed_at

---

## NEW: UserActions (Action Engine)

- id
- user_id
- type
- title
- description
- priority_score
- status (OPEN / DONE / DISMISSED)
- related_entity_type
- related_entity_id
- created_at
- updated_at

---

## OPTIONAL: SystemEvents

- id
- user_id
- event_type
- payload (JSONB)
- created_at

---

# 7. AI Layer (Claude API)

## Responsibilities
- Motivation letter generation
- Profile summarization
- Ranking enrichment

## Constraints
- Stateless
- No direct DB writes
- Cannot define system priority logic

---

# 8. Matching System (Phase 1)

## Step 1: Hard Filters
- field_of_study match
- year eligibility
- GPA threshold

## Step 2: AI Ranking
- relevance score (0–100)
- based on profile + scholarship content

---

# 9. Application Workflow

NOT_STARTED → IN_PROGRESS → SUBMITTED → ACCEPTED / REJECTED

Rules:
- user controls transitions
- AI only assists content creation
- external submission happens outside system

---

# 10. Notification System

## Channels
- Email (critical alerts)
- In-app notifications

## Triggers
- deadline approaching
- status change
- new recommendations
- system events

---

# 11. NEW: Action Engine (Next Best Action System)

## Purpose
Convert system signals into prioritized executable actions.

---

## Action Definition

UserAction:
- id
- type
- title
- description
- priority_score
- status
- related entity reference

---

## Inputs
- Applications
- Scholarships
- Profile completeness
- Recommendation scores
- System events

---

## Outputs
- Ranked action list (Top 3–5)

---

## Scoring Model (Phase 1)

priority_score =
- urgency (deadline proximity)
+ impact (success influence)
+ completion_gap
+ engagement_signals

---

## Action Types
- DEADLINE_ACTION
- COMPLETION_ACTION
- OPTIMIZATION_ACTION
- ENGAGEMENT_ACTION

---

## Critical Rule
> Recommendations are passive. Actions are executable.

---

# 12. Event Layer (Lightweight)

## Events
- APPLICATION_CREATED
- PROFILE_UPDATED
- DEADLINE_UPDATED
- RECOMMENDATION_GENERATED
- LETTER_GENERATED

## Flow
Event → Action Engine → Updated Actions → UI refresh

---

# 13. Frontend Dashboard Model

## UI Layers

### 1. Action Center (Primary)
- Top 3–5 actions

### 2. Opportunity Layer
- recommended scholarships

### 3. Pressure Layer
- deadlines & risks

---

# 14. Non-Functional Requirements

- Max 500 users (MVP)
- Page load < 2.5s
- AI response async up to 20s
- System must function without AI availability
- deterministic prioritization (no randomness)

---

# 15. Risks

- incorrect prioritization → trust loss
- action overload → cognitive fatigue
- recommendation vs action conflict
- cold start for recommendations
- notification fatigue

---

# 16. Migration Strategy

1. Keep current system unchanged
2. Run Action Engine in shadow mode
3. Compare outputs
4. Gradual UI replacement

---

# 17. System Philosophy

- Data Layer → truth
- Core Layer → operations
- Intelligence Layer → interpretation
- Action Layer → execution priority
- UI Layer → decision surface

---

# 18. Architectural Summary

ScholarPath evolves from:

> Scholarship tracking system

into:

> AI-driven decision & execution engine for student success