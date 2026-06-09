# ScholarPath – Agent Implementation Guide v1.0

## 1. Purpose

This document defines **how engineering agents must implement ScholarPath systems** based on the approved architecture.

> Goal: Eliminate interpretation. Ensure deterministic implementation.

---

## 2. Core Principle

> Agents do not design. Agents implement.

Allowed:

* Implement modules exactly as specified
* Follow event contracts
* Follow state machines

Forbidden:

* Adding new business logic
* Changing priority rules
* Introducing new system behavior
* Bypassing Action Engine

---

## 3. System Architecture Reminder

Agents must respect:

* Phase 7: Recommendation Engine (signals only)
* Phase 8: Action Engine (decision layer)
* Phase 9: External Data (input only)

---

## 4. Implementation Boundaries

### Phase 7 (Recommendations)

Agents may:

* Compute relevance scores
* Generate ranked scholarships
* Emit recommendation events

Agents may NOT:

* Decide user priority
* Trigger Actions directly

---

### Phase 8 (Action Engine)

Agents MUST:

* Convert events → Actions
* Apply deterministic priority rules
* Ensure deduplication
* Maintain lifecycle state

Agents may NOT:

* Use AI for ranking decisions
* Bypass event pipeline
* Create ad-hoc actions

---

### Phase 9 (Integration Layer)

Agents MUST:

* Fetch external data
* Normalize external payloads
* Emit internal structured events

Agents may NOT:

* Submit external applications
* Modify external systems
* Trigger Actions directly

---

## 5. Event Handling Rules

### Mandatory Rules

* All events must be immutable
* All events must have version
* All events must be idempotent

### Processing Rule

```text
Event → Validate → Normalize → Emit downstream event
```

No direct DB mutations outside defined module ownership.

---

## 6. Action Engine Implementation Rules (CRITICAL)

### Rule 1: Single Source of Truth

Only Action Engine computes:

* priority_score
* ranking
* dashboard ordering

---

### Rule 2: Deduplication

```text
Unique Constraint:
(user_id + action_type + related_entity_id)
```

If exists → update
If not → create

---

### Rule 3: Determinism

Given same input state:

> Action Engine must always produce identical output

No randomness allowed.

---

### Rule 4: Expiration Handling

Agents MUST enforce:

* expired actions are not shown
* expired actions cannot be reopened
* expiration is deterministic

---

## 7. Data Flow Contract

```text
External Data (Phase 9)
        ↓
Recommendation Engine (Phase 7)
        ↓
Event Stream
        ↓
Action Engine (Phase 8)
        ↓
UI Layer
```

Agents must NEVER bypass this flow.

---

## 8. Failure Handling Rules

* Phase 7 failure → system continues with last known recommendations
* Phase 8 failure → freeze action updates, UI still renders cached actions
* Phase 9 failure → system runs on internal data only

---

## 9. API Implementation Rules

### /actions endpoint

Must support:

* pagination
* filtering by type
* sorting by priority_score

Must NOT:

* compute priority in API layer
* override Action Engine output

---

## 10. Logging & Traceability

Every Action MUST contain:

* source_event_id
* creation_timestamp
* priority_version

This ensures full rebuild capability.

---

## 11. Anti-Patterns (STRICTLY FORBIDDEN)

* “quick fix” logic inside API layer
* priority calculation inside frontend
* AI-based ranking override
* direct DB writes bypassing modules
* duplicate action creation without dedup logic

---

## 12. Golden Rule

> If logic affects “what user should do next” → it belongs ONLY in Action Engine.

---

## 13. Summary

Agents must operate under one constraint:

> Implementation is deterministic execution of architecture — not interpretation.

