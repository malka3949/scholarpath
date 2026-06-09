# ScholarPath – Phase 8 Product Decisions (Action Engine)

## 1. Priority Calculation Model

### Decision: C — Hybrid

### Rationale

מוצרית אנחנו רוצים:

* התנהגות צפויה ודטרמיניסטית
* יכולת לשנות משקלים בעתיד
* יכולת להוסיף חוקים עסקיים חריגים

מודל Formula בלבד יהיה קשיח מדי.

מודל Rule-Based בלבד יהפוך למסובך לתחזוקה.

לכן:

### Recommended Approach

Base Score:

* urgency
* impact
* completion_gap
* engagement

Business Overrides:

* Critical deadlines always promoted
* High-value opportunities may receive bonus priority
* Expired actions automatically deprioritized

---

## 2. Action Expiration Rules

### Decision: Approved

DEADLINE_ACTION
→ expires automatically after deadline

COMPLETION_ACTION
→ closes when completed

OPPORTUNITY_ACTION
→ expires after 30 days

ENGAGEMENT_ACTION
→ expires after 14 days

### Additional Rule

OPTIMIZATION_ACTION

→ expires after 30 days
→ or immediately when optimization condition is satisfied

Examples:

* Profile completion reaches target threshold
* Application quality issue resolved

---

## 3. Recalculation Strategy

### Decision: Approved

Recalculate when:

* Profile Updated
* Application Updated
* Recommendation Generated
* Daily Scheduled Job

### Product Requirement

The system should never rely solely on scheduled recalculation.

User-visible changes must be reflected quickly after meaningful actions.

---

## 4. Deduplication Rules

### Decision: Approved

Only one OPEN action may exist per:

user_id
+
action_type
+
related_entity_id

### Rationale

Prevents:

* duplicate reminders
* dashboard clutter
* notification fatigue

The user should never see multiple actions representing the same underlying task.

---

## 5. Dashboard Capacity

### Decision: Top 5 Actions

### Dashboard Rules

* Display maximum 5 actions.
* Display minimum 1 action when available.
* Remaining actions stay accessible via "View All".

### Rationale

The dashboard is a decision surface, not a task management system.

Showing too many actions weakens prioritization and increases cognitive load.

---

# Additional Product Rule

Priority Hierarchy

1. Deadline Risk
2. Submission Completion
3. Opportunity Discovery
4. Application Optimization
5. Profile Completion
6. Engagement

This hierarchy should act as the final tie-breaker when multiple actions receive similar scores.
