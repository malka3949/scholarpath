# ScholarPath – Product Requirements Document (MVP)

## 1. Executive Summary
ScholarPath is an AI-powered SaaS platform designed to support engineering and computer science students in Israel throughout their academic journey. The platform focuses on maximizing scholarship acquisition through intelligent matching, application tracking, and AI-assisted writing, while gradually expanding into career planning and academic management.

The MVP validates one core hypothesis:
> Students will apply to more scholarships when provided with intelligent matching, reminders, and AI-assisted application support.

---

## 2. Problem Statement
Students miss scholarship opportunities due to:
- Lack of awareness of available scholarships
- Poor tracking of deadlines and applications
- Difficulty writing strong motivation letters
- Fragmented tools for academic and career management

No unified system exists that connects scholarships, academic planning, and career opportunities in one intelligent platform.

---

## 3. Target Users / Personas
### Primary User (MVP)
- Computer Science students
- Engineering students (Software, Electrical, Computer Engineering)
- Undergraduate and graduate students in Israel

### Internal User
- Admin managing scholarships and career opportunities

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
- Achieve strong user retention via deadline-driven engagement

---

## 6. Success Metrics

### North Star Metric
- Number of scholarship applications submitted via platform

### Supporting Metrics
- % users finding at least 1 relevant scholarship
- Application conversion rate (view → apply)
- Weekly active users (WAU)
- AI-generated motivation letters usage rate
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
- Hybrid dashboard
- Email + in-app notifications
- Admin panel for content management

### Out of Scope
- Payments / real monetization
- Full automation of applications
- External integrations (LinkedIn, ATS)
- Advanced community features (DMs, groups, reputation)
- Mobile app (push notifications excluded)

---

## 8. MVP Definition
A web-based SaaS platform where students:
1. Register and create a profile
2. Receive personalized scholarship recommendations
3. Track application status
4. Use AI to generate motivation letters
5. Receive deadline alerts
6. Explore basic career opportunities
7. Engage in simple Q&A community

---

## 9. Functional Requirements

### 9.1 Authentication
- Email/password login
- Google OAuth login
- Profile onboarding flow

### 9.2 Scholarship Module
- Seeded database (~50 scholarships)
- Filtering and search
- AI-based matching engine
- Application tracking

### 9.3 AI Agent
- Semi-autonomous recommendation system
- Background processing of user profile
- Motivation letter generation
- Deadline detection

### 9.4 Application Tracking
Statuses:
- Not Started
- In Progress
- Submitted
- Accepted
- Rejected

### 9.5 Career Module
- Admin-created opportunities
- AI ranking per user profile
- Recommendations feed

### 9.6 Community
- Post creation
- Comments
- Search
- AI similarity detection for duplicate questions

### 9.7 Dashboard
Hybrid structure:
- Tasks & deadlines (left)
- AI recommendations (right)

### 9.8 Notifications
- Email: critical alerts
- In-app: system activity updates

---

## 10. Assumptions
- Students actively seek scholarships but lack discovery tools
- AI-generated content increases application completion
- Manual seed data is sufficient for MVP validation
- Users will engage with dashboard daily during application cycles

---

## 11. Risks
- Low quality scholarship data reduces trust
- AI-generated letters may feel generic
- Over-complex MVP may reduce adoption
- Cold start problem for community module
- High dependency on notification engagement

---

## 12. Open Questions
- Future monetization strategy beyond freemium
- Expansion beyond engineering students
- Level of automation allowed in future AI agent
- Long-term data sourcing strategy for scholarships

---

## 13. Phased Roadmap

### Phase 1 (MVP)
- Scholarship engine
- AI recommendations
- Tracking system
- Basic dashboard

### Phase 2
- Advanced career system
- Scraping automation
- Improved AI personalization

### Phase 3
- Full community ecosystem
- External integrations
- Mobile experience

