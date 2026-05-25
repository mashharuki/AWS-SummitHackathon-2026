# Agile & Hybrid Project Management Reference

## When Agile Fits

Agile is not just about speed — it's about learning. Use Agile when:
- Requirements are unclear or evolving
- Customer feedback is essential to shape the product
- The team is small, co-located, and self-organizing
- Early delivery of partial value is desirable
- Innovation and experimentation are central to the work

Don't force Agile when contracts require fixed scope/price, when regulatory compliance demands exhaustive upfront documentation, or when the team lacks Agile experience and support.

---

## Scrum Framework

### Roles
| Role | Responsibilities |
|------|-----------------|
| **Product Owner** | Owns the product vision; manages and prioritizes the Product Backlog; defines acceptance criteria |
| **Scrum Master** | Facilitates ceremonies; removes impediments; coaches the team on Scrum; serves the organization |
| **Development Team** | Self-organizing cross-functional team (3-9 people); commits to Sprint Goals; owns quality |

### Artifacts
| Artifact | Purpose |
|----------|---------|
| **Product Backlog** | Ordered list of everything the product might need; owned by PO; constantly refined |
| **Sprint Backlog** | Items selected for the current sprint + plan for delivering them |
| **Increment** | Potentially releasable product at the end of each sprint; must meet Definition of Done |

### Ceremonies
| Ceremony | Timebox | Purpose |
|----------|---------|---------|
| **Sprint Planning** | 2-4h per 2-week sprint | Select backlog items; create sprint goal; decompose into tasks |
| **Daily Scrum** | 15 min | Inspect progress toward sprint goal; identify blockers |
| **Sprint Review** | 1-2h per 2-week sprint | Demo increment to stakeholders; gather feedback; update backlog |
| **Sprint Retrospective** | 1-1.5h per 2-week sprint | Inspect the process; identify improvements; commit to changes |
| **Backlog Refinement** | 10% of sprint capacity | Clarify, estimate, and order upcoming backlog items |

### Sprint Cycle (2-week example)
```
Week 1, Day 1: Sprint Planning (2-4h)
  → Daily Scrums (15 min each day)
Week 1, Days 2-5: Development
  → Daily Scrums
Week 2, Days 1-4: Development + testing + documentation
  → Daily Scrums
Week 2, Day 5: Sprint Review (1-2h) + Retrospective (1-1.5h)
  → Sprint ends; next sprint begins Monday
```

---

## User Story Framework

### Story Format
```
As a [type of user],
I want [a feature/capability],
So that [I get this benefit].
```

### INVEST Criteria
| Letter | Meaning | How to Apply |
|--------|---------|-------------|
| I | Independent | Story can be developed without dependency on another story |
| N | Negotiable | Details are not fixed contracts — they invite conversation |
| V | Valuable | Delivers value to the end user or business |
| E | Estimable | Team can provide a size estimate |
| S | Small | Fits within a single sprint |
| T | Testable | Acceptance criteria can be verified |

### Acceptance Criteria (Gherkin format)
```
Given [a context/precondition],
When [an action is taken],
Then [the expected outcome].
```

Example:
```
Given I am a logged-in user on the checkout page,
When I click "Place Order" with a valid payment method,
Then I receive an order confirmation email within 60 seconds.
```

---

## Story Point Estimation (Planning Poker)

### Fibonacci Scale
Use: 1, 2, 3, 5, 8, 13, 21 (and ? for "don't know yet")

### How to Run Planning Poker
1. PO reads and explains the story
2. Team members ask clarifying questions
3. Each person privately selects a number
4. All reveal simultaneously
5. High and low estimators explain reasoning
6. Re-estimate until consensus (or agree on average)

### Velocity Calculation
```
Velocity = Sum of story points completed in a sprint
Forecast = Remaining story points / Average velocity = Sprints remaining
```

---

## Kanban for Flow Management

### Core Principles
- Visualize the workflow
- Limit Work in Progress (WIP)
- Manage flow (watch cycle time, not start time)
- Make policies explicit
- Improve collaboratively

### Kanban Board Structure
```
| Backlog | To Do | In Progress (WIP limit: 3) | In Review | Done |
|---------|-------|---------------------------|-----------|------|
```

### WIP Limits
Set WIP limits to reduce multitasking and expose bottlenecks.
When a column is full, the team must help clear it before pulling new work.

### Key Metrics
- **Cycle Time**: Time from "started" to "done" for a single item
- **Throughput**: Items completed per unit of time
- **Cumulative Flow Diagram**: Shows WIP, throughput, and blockers over time

---

## Hybrid PM Framework

### When to Use Hybrid
Hybrid combines Waterfall's structure with Agile's adaptability:
- Fixed budget/schedule (predictive) + flexible features (agile)
- Regulatory-compliant documentation (predictive) + iterative delivery (agile)
- Complex infrastructure (predictive) + application development (agile)

### Hybrid Structure Example
```
Phase 1 — Initiation (Waterfall): Charter, stakeholder register, high-level scope
Phase 2 — Planning (Waterfall): Architecture, budget, master schedule, risk plan
Phase 3 — Delivery (Agile Sprints): Feature development in 2-week sprints
Phase 4 — Integration & Testing (Waterfall): System integration, UAT, sign-off
Phase 5 — Closing (Waterfall): Documentation, lessons learned, handover
```

### Managing Agile Within Waterfall Governance
- Define a "feature release cadence" — which sprints map to which milestones
- Use Product Backlog as the scope control mechanism
- Hold monthly steering committees aligned to sprint review cycles
- EVM can be applied using story points completed vs. planned

---

## Definition of Done (DoD) Template

The DoD makes quality explicit and non-negotiable. All items must pass before a story is "Done":

```
□ Code reviewed by at least 1 peer
□ All acceptance criteria verified
□ Unit tests written and passing (coverage ≥ 80%)
□ Integration tests passing
□ No critical/high severity bugs
□ Documentation updated (API docs, user guide if applicable)
□ Feature flagged or deployed to staging
□ Product Owner sign-off received
```

Customize this per team. The key is that the team agrees and enforces it consistently.

---

## Agile Metrics & Reporting

| Metric | Formula | Good Sign |
|--------|---------|----------|
| Velocity | Story points completed / sprint | Stable and predictable |
| Sprint Burndown | Remaining story points by day | Steady decline to zero |
| Release Burnup | Completed scope toward release target | Rising toward goal line |
| Cycle Time | End date - Start date per item | Decreasing trend |
| Defect Rate | Bugs found post-sprint / stories delivered | < 10% |
| Escaped Defects | Bugs found in production | Near zero |

### Retrospective Formats

**Start / Stop / Continue**
- What should we START doing?
- What should we STOP doing?
- What should we CONTINUE doing?

**4Ls (Liked / Learned / Lacked / Longed For)**
- Liked: What went well?
- Learned: What did we discover?
- Lacked: What was missing?
- Longed For: What do we wish we had?

**DAKI (Drop / Add / Keep / Improve)**
Useful for teams that want more actionable retrospective outcomes.

---

## SAFe (Scaled Agile Framework) Overview

For large programs with multiple Agile teams:

| Level | Focus |
|-------|-------|
| Team | Scrum/Kanban within individual teams |
| Program | PI Planning (Program Increment) every 10 weeks |
| Portfolio | Epic prioritization, value stream alignment |

Key SAFe concepts:
- **PI Planning**: 2-day event where all teams plan together for next 10 weeks
- **Art (Agile Release Train)**: Multiple Scrum teams delivering together
- **Inspect & Adapt**: Large-scale retrospective at end of each PI
