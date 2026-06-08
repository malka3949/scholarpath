# ScholarPath – Product Requirements Document (MVP)

## 1. Executive Summary

ScholarPath is an AI-powered SaaS platform designed to support engineering and computer science students in Israel throughout their academic journey.

The platform focuses on maximizing scholarship acquisition through:
- Intelligent matching
- Application tracking
- AI-assisted writing

The MVP validates one core hypothesis:

> Students will apply to more scholarships when provided with intelligent matching, reminders, and AI-assisted application support.

---

## 2. Problem Statement

Students miss scholarship opportunities due to:
- Lack of awareness of available scholarships
- Poor tracking of deadlines and applications
- Difficulty writing strong motivation letters
- Fragmented tools for academic and career management

There is no unified system connecting scholarships, academic planning, and career opportunities.

---

## 3. Target Users / Personas

### Primary Users (MVP)
- Computer Science students
- Software Engineering students
- Electrical / Computer Engineering students
- Undergraduate and graduate students in Israel

### Internal Users
- Admin users managing scholarships and opportunities

---

## 4. Value Proposition

- Personalized scholarship matching using AI
- Automated deadline tracking and reminders
- AI-generated motivation letters
- Unified academic and career dashboard
- Reduced missed opportunities

---

## 5. Business Goals

- Increase scholarship application completion rate
- Validate AI-driven recommendation effectiveness
- Improve user retention via deadline-driven engagement

---

## 6. Success Metrics

### North Star Metric
- Number of scholarship applications submitted via platform

### Supporting Metrics
- % users who find at least 1 relevant scholarship
- Application conversion rate (view → apply)
- Weekly Active Users (WAU)
- AI motivation letter usage rate
- Notification engagement rate

---

## 7. Scope Definition

### In Scope (MVP)

- Scholarship matching system
- Student profile system
- AI recommendation engine
- Application tracking system
- Basic career opportunities module
- Basic community forum
- Hybrid dashboard (tasks + recommendations)
- Email + in-app notifications
- Admin panel for content management

---

### Out of Scope (MVP)

- Payments / monetization
- Full automation of applications
- External integrations (LinkedIn, ATS systems)
- Advanced community features (DMs, groups, reputation)
- Mobile application (push notifications excluded)

---

## 8. MVP Definition

A web-based SaaS platform where students can:

1. Register and create a profile
2. Receive personalized scholarship recommendations
3. Track application status
4. Use AI to generate motivation letters
5. Receive deadline alerts
6. Explore basic career opportunities
7. Engage in a simple Q&A community

---

## 9. Functional Requirements

### 9.1 Authentication
- Email/password login
- Google OAuth login
- User onboarding flow

---

### 9.2 Scholarship Module
- Seeded database (~50 scholarships)
- Filtering and search
- AI-based matching engine
- Application tracking

---

### 9.3 AI Recommendation Engine
- Profile-based recommendation system
- Background processing of user profile
- Motivation letter generation
- Deadline detection logic

---

### 9.4 Application Tracking

Statuses:
- Not Started
- In Progress
- Submitted
- Accepted
- Rejected

---

### 9.5 Career Module
- Admin-created opportunities
- AI ranking per user profile
- Recommendation feed

---

### 9.6 Community Module
- Post creation
- Comments
- Search
- Duplicate question detection (AI-based)

---

### 9.7 Dashboard

Hybrid structure:

- Left: Tasks & deadlines
- Right: AI recommendations

---

### 9.8 Notifications

- Email: critical alerts
- In-app: system updates and reminders

---

## 10. Assumptions

- Students actively seek scholarships but lack discovery tools
- AI-generated content increases application completion
- Seeded data is sufficient for MVP validation
- Users engage with dashboard frequently during application cycles

---

## 11. Risks

- Low-quality scholarship data reduces trust
- AI-generated letters may feel generic
- MVP may become too complex
- Cold start problem in community module
- Over-reliance on notifications for engagement

---

## 12. Open Questions

- Monetization strategy beyond freemium
- Expansion beyond engineering students
- Level of automation allowed in future AI systems
- Long-term data sourcing strategy for scholarships

---

## 13. Phased Roadmap

### Phase 1 (MVP)
- Scholarship engine
- AI recommendations
- Application tracking system
- Basic dashboard

### Phase 2
- Advanced career system
- Data automation / scraping
- Improved personalization

### Phase 3
- Full community ecosystem
- External integrations
- Mobile experience