# Deep-Dive: Planning Phase

## Planning Philosophy

The purpose of planning is not to create perfect documents — it's to build shared understanding.
A plan is a communication tool. It will change. The discipline of creating it forces the team
to surface assumptions, conflicts, and gaps before they cost time and money in execution.

"Failing to plan is planning to fail" — but so is spending 6 months planning a 3-month project.
Tailor planning depth to project complexity and uncertainty.

---

## WBS Creation Guide

### The 100% Rule
The WBS must capture 100% of the project scope — everything in scope, nothing out of scope.
If it's not in the WBS, it's not in the project.

### Decomposition Process
1. Start with major deliverables (not activities)
2. Decompose until you reach "work packages" — small enough to estimate, assign, and track
3. Rule of thumb: each work package ≤ 80 hours effort (the "8/80 rule")
4. Create a WBS dictionary entry for each work package

### WBS Levels
```
Level 1: Project
Level 2: Phase or Major Deliverable
Level 3: Sub-Deliverable
Level 4: Work Package (lowest level — assignable, estimable)
```

### Common WBS Mistakes
- Using verbs (activities) instead of nouns (deliverables)
- Mixing decomposition levels (some areas over-decomposed, others not)
- Forgetting project management as a WBS element (it's always Level 2.1)
- Creating WBS in isolation without the team

---

## Schedule Development

### Steps
1. Define activities (from WBS work packages)
2. Sequence activities (identify dependencies: FS, FF, SS, SF)
3. Estimate durations (use analogous, parametric, or 3-point PERT estimates)
4. Assign resources
5. Identify the critical path
6. Compress if needed (fast-tracking or crashing)
7. Baseline the schedule

### Dependency Types
- **FS** (Finish-to-Start): Task B can't start until Task A finishes — most common
- **FF** (Finish-to-Finish): B can't finish until A finishes
- **SS** (Start-to-Start): B can't start until A starts
- **SF** (Start-to-Finish): rare, used in shift-change scenarios

### Critical Path Method (CPM)
The critical path is the longest sequence of dependent activities.
Any delay on the critical path delays the entire project.

```
Float = LS - ES = LF - EF
(where LS=Late Start, ES=Early Start, LF=Late Finish, EF=Early Finish)
Activities with Float = 0 are on the critical path.
```

### PERT (3-Point Estimate)
Use when there's significant uncertainty in duration estimates.
```
Expected Duration = (Optimistic + 4×Most Likely + Pessimistic) / 6
Standard Deviation = (Pessimistic - Optimistic) / 6
```

### Schedule Compression Techniques
| Technique | Method | Tradeoff |
|-----------|--------|---------|
| Fast-tracking | Run activities in parallel | Increases risk |
| Crashing | Add resources to critical path | Increases cost |

---

## Budget Planning

### Cost Estimation Methods
| Method | When to Use | Accuracy |
|--------|------------|---------|
| Analogous (top-down) | Early, low detail | ±25-50% |
| Parametric | Known relationship (e.g., cost/unit) | ±10-25% |
| Bottom-up | Detailed WBS available | ±5-10% |
| Three-point (PERT) | High uncertainty | ±5-15% |

### Budget Structure
```
Direct Costs (labor, materials, equipment)
+ Indirect Costs (overhead, admin)
= Project Cost Estimate
+ Contingency Reserve (known-unknowns: typically 10-20%)
= Cost Baseline
+ Management Reserve (unknown-unknowns: typically 5-10%)
= Project Budget
```

### Contingency vs. Management Reserve
- **Contingency Reserve**: PM's discretion — for identified risks that materialize
- **Management Reserve**: Sponsor's approval required — for unknown-unknown risks

---

## Risk Identification Techniques

### Brainstorming Prompts (use with team)
- "What could delay our schedule by more than 1 week?"
- "What could push us over budget by more than 10%?"
- "What would cause the customer to reject our deliverable?"
- "What external factors (regulatory, market, weather, vendor) could disrupt us?"
- "What technical unknowns could become showstoppers?"
- "What happens if our key person becomes unavailable?"

### Risk Categories (PMBOK RBS)
- Technical Risk (technology, complexity, interfaces)
- External Risk (vendors, regulatory, market, weather)
- Organizational Risk (resource conflicts, funding, priorities)
- PM Risk (estimation errors, planning gaps, communication failures)

### Probability-Impact Scoring
```
Probability: 1=Very Low, 2=Low, 3=Medium, 4=High, 5=Very High
Impact:      1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Critical

Risk Score = Probability × Impact
  1-4:  Low (Green) — Monitor
  5-9:  Medium (Amber) — Mitigate
  10-25: High/Critical (Red) — Immediate action required
```

---

## Communication Planning

### Key Questions
1. Who needs what information?
2. How frequently?
3. In what format?
4. By what channel?
5. Who is responsible for each communication?

### Communication Matrix Template
| Audience | Information | Format | Frequency | Channel | Owner |
|----------|------------|--------|-----------|---------|-------|
| Executive Sponsor | Budget/schedule/risks | 1-page dashboard | Monthly | Email + meeting | PM |
| Steering Committee | Progress vs. plan | Status report | Monthly | Presentation | PM |
| Project Team | Task status, blockers | Stand-up | Daily | Slack/Teams | Team Lead |
| End Users | Change announcements | Newsletter | As needed | Email | Change Manager |
| Vendor | Technical specs, issues | Technical meeting | Bi-weekly | Video call | Tech Lead |

### Communication Principles
- Over-communicate during change — silence breeds rumor
- Match detail level to audience (executive = 1 page; team = task list)
- Prefer push communication (send to stakeholders) over pull (they have to find it)
- Document all key decisions and distribute meeting notes within 24 hours

---

## Resource Planning & RACI

### Resource Histogram
Plot resource demand over time to identify peaks and valleys.
Level resources by shifting non-critical activities.

### Team Roles in PMBOK Context
| Role | Responsibilities |
|------|-----------------|
| Project Sponsor | Provides funding, removes organizational barriers, makes go/no-go decisions |
| Project Manager | Plans, executes, controls; owns communication and stakeholder management |
| Team Lead / Tech Lead | Technical decisions, team coordination, quality |
| Team Members | Execute work packages, report status, raise issues |
| Change Control Board | Reviews and approves/rejects change requests |
| Steering Committee | Strategic oversight, major decisions, issue escalation |

### RACI Best Practices
- One "A" per row (single point of accountability prevents "diffusion of responsibility")
- Limit "C" to those whose input genuinely changes the output (otherwise use "I")
- Review RACI when team membership changes
- Update RACI when scope changes add new deliverables
