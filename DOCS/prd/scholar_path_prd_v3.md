# ScholarPath – Master Product PRD (Phase 1–9)

## 1. Executive Summary

ScholarPath היא מערכת SaaS מבוססת AI שמלווה סטודנטים בתהליך השגת מלגות והזדמנויות אקדמיות וקריירה.

המערכת התפתחה לאורך 9 פאזות:

> ממערכת גילוי מלגות → למערכת קבלת החלטות ופעולה (Action-Driven Decision System)

---

## 2. Core Product Vision

להפוך את ScholarPath למערכת שמובילה סטודנטים ל:

* גילוי הזדמנויות
* קבלת החלטות נכונות
* ביצוע פעולות קריטיות בזמן
* מקסום סיכויי הצלחה אקדמית

---

## 3. System Evolution (High Level)

### Phase 1 – Scholarship Discovery MVP

* בסיס נתונים של מלגות
* התאמה בסיסית
* Tracking ראשוני

### Phase 2 – Personalization Layer

* שיפור התאמות
* פרופיל משתמש מתקדם

### Phase 3 – Opportunity Expansion

* הרחבת סוגי הזדמנויות
* מלגות + קריירה

### Phase 4 – Community Layer

* קהילה בסיסית
* Q&A

### Phase 5 – Intelligence Layer

* AI writing assistance
* ניתוח פרופיל

### Phase 6 – Workflow Optimization

* ניהול תהליכים
* סטטוסים

---

### Phase 7 – Recommendation Engine (Insight Layer)

## Goal

להבין ולהעריך התאמה להזדמנויות.

## Role

* ניתוח משתמש
* דירוג הזדמנויות
* יצירת recommendations בלבד

## Output

* רשימת הזדמנויות מדורגת

## Constraint

* לא מקבל החלטות פעולה

---

### Phase 8 – Action Engine (Decision Layer)

## Goal

לקבוע מה המשתמש צריך לעשות עכשיו.

## Core Principle

> Single Source of Truth for Prioritization

## Responsibilities

* המרת recommendations ל-actions
* חישוב priority score
* פתרון קונפליקטים
* יצירת Action Center

## Action Types

* DEADLINE_ACTION
* COMPLETION_ACTION
* OPTIMIZATION_ACTION
* OPPORTUNITY_ACTION
* ENGAGEMENT_ACTION

## Output

* Top 3–5 actions בלבד

---

### Phase 9 – External Integration Layer

## Goal

הרחבת מקורות הזדמנויות

## Responsibilities

* חיבור למקורות חיצוניים:

  * מלגות
  * אוניברסיטאות
  * משרות
* ingestion בלבד
* ללא ביצוע פעולות אוטומטיות

---

## 4. Unified Product Architecture (Logical Layers)

### Layer 1 – Data Layer

* Users
* Scholarships
* Applications
* Events

---

### Layer 2 – Insight Layer (Phase 7)

* Recommendation Engine
* Scoring system
* Matching logic

---

### Layer 3 – Decision Layer (Phase 8)

* Action Engine
* Prioritization logic
* Conflict resolution

---

### Layer 4 – Expansion Layer (Phase 9)

* External integrations
* Opportunity ingestion

---

### Layer 5 – Experience Layer

* Dashboard
* Notifications
* UI decision surfaces

---

## 5. Dashboard Model

### Primary – Action Center

* 3–5 actions בלבד
* שכבת החלטה מרכזית

### Secondary – Recommendations

* מידע נוסף בלבד

### Tertiary – Deadlines & Risks

* הקשר בלבד

---

## 6. Product Principles

### 1. Action-First System

המערכת תמיד מובילה לפעולה.

### 2. Single Source of Truth

Action Engine בלבד קובע עדיפות.

### 3. No Information Overload

מקסימום 5 actions למשתמש.

### 4. Deterministic Decisions

עדיפויות חייבות להיות עקביות.

### 5. Assisted AI Only

AI לא מקבל החלטות מערכתיות לבד.

---

## 7. Success Metrics

### North Star Metric

* Number of scholarship applications submitted

### Supporting Metrics

* Action completion rate
* Recommendation → Action conversion
* WAU
* Deadline miss reduction
* Action Center engagement

---

## 8. Key System Guarantees

* לא יותר מ־5 פעולות פתוחות
* כל פעולה חייבת להיות actionable
* Action Engine הוא שכבת ההחלטה היחידה
* Recommendations אינם משפיעים ישירות על UI prioritization
* External data לא מפעיל actions אוטומטיים

---

## 9. Strategic Outcome

ScholarPath מתפתח ל:

> AI-Driven Action System for Student Success

מערכת שלא רק מציגה הזדמנויות — אלא מגדירה למשתמש מה לעשות עכשיו כדי להצליח.
