# Deep-Dive: Monitoring & Controlling

## Why Monitoring & Controlling Matters

Execution without monitoring is flying blind. Projects rarely fail because of one catastrophic event —
they fail because small variances accumulate unnoticed until recovery is impossible.
The purpose of M&C is early detection and early correction.

A good PM is not surprised at the end of a project. They see problems 2-4 weeks before they become crises
and act while there's still room to maneuver.

---

## Earned Value Management (EVM)

EVM is the most rigorous way to measure schedule and cost performance simultaneously.
It tells you not just "how much have you spent?" but "how much value have you gotten for that spend?"

### Core EVM Variables
```
BAC = Budget at Completion (total approved budget)
PV  = Planned Value       (how much work should have been done by now, in budget terms)
EV  = Earned Value        (how much work has actually been done, measured in budget terms)
AC  = Actual Cost         (how much has actually been spent)
```

### EVM Formulas
```
Schedule Variance      SV  = EV - PV     (negative = behind schedule)
Cost Variance          CV  = EV - AC     (negative = over budget)
Schedule Performance   SPI = EV / PV     (< 1.0 = behind schedule)
Cost Performance       CPI = EV / AC     (< 1.0 = over budget)

Estimate at Completion EAC = BAC / CPI   (most common forecast)
Estimate to Complete   ETC = EAC - AC
Variance at Completion VAC = BAC - EAC   (negative = over budget at end)
TCPI (to complete SPI) TCPI = (BAC - EV) / (BAC - AC) or (EAC - AC)
```

### Interpreting EVM Results
| SPI | CPI | Situation |
|-----|-----|-----------|
| > 1.0 | > 1.0 | Ahead of schedule AND under budget — excellent |
| > 1.0 | < 1.0 | Ahead of schedule BUT over budget — investigate quality shortcuts |
| < 1.0 | > 1.0 | Behind schedule BUT under budget — may recover |
| < 1.0 | < 1.0 | Behind schedule AND over budget — recovery plan needed urgently |

### EVM Example
```
Project: 100k budget, 20-week duration
Week 10:
  PV = 50,000   (should have spent 50% of budget)
  EV = 40,000   (only 40% of work done)
  AC = 55,000   (actually spent 55,000)

  SV  = 40,000 - 50,000 = -10,000 (behind schedule by $10k worth of work)
  CV  = 40,000 - 55,000 = -15,000 (over budget by $15,000)
  SPI = 40,000 / 50,000 = 0.80    (only doing 80% of planned work rate)
  CPI = 40,000 / 55,000 = 0.73    (getting 73 cents of value per $1 spent)
  EAC = 100,000 / 0.73 = 137,000  (forecast to complete at $137,000 — 37% overrun)
```

---

## Change Control Process

Change is inevitable. The goal is not to prevent change but to manage it deliberately.
Uncontrolled change (scope creep) is one of the top causes of project failure.

### Change Control Process
```
1. Change Requested (anyone can submit)
2. Change Logged (PM records in Change Log)
3. Impact Assessment (PM + team analyze cost, schedule, risk, quality impacts)
4. Review & Decision (Change Control Board or Sponsor)
   → Approved: update plan, baselines, and communicate
   → Rejected: document reason, notify requestor
   → Deferred: revisit in next planning cycle
5. Implementation (if approved)
6. Closure (update Change Log with outcome)
```

### Change Request Template
```markdown
**Change Request ID**: CR-[NNN]
**Date**: [DATE]
**Requested By**: [NAME / ROLE]
**Priority**: High / Medium / Low

**Description of Change**: [What specifically is being requested]

**Justification / Business Case**: [Why this change is needed]

**Impact Analysis**:
- Schedule Impact: [+/- N days/weeks]
- Budget Impact: [+/- N amount]
- Scope Impact: [What is added/removed]
- Risk Impact: [Any new risks introduced]
- Quality Impact: [Any quality considerations]
- Dependencies: [Other work affected]

**Recommended Action**: Approve / Reject / Defer
**PM Recommendation**: [Reasoning]

**CCB Decision**: Approved / Rejected / Deferred
**Decision Date**: [DATE]
**Decision By**: [NAME]
**Notes**: [Conditions, adjustments, or rationale]
```

---

## Project Health Dashboard

### Key Performance Indicators (KPIs)
Design dashboards to answer: "Is this project healthy?"

| KPI | Formula | Target | Alert Threshold |
|-----|---------|--------|-----------------|
| Schedule Performance Index | EV/PV | ≥ 1.0 | < 0.9 |
| Cost Performance Index | EV/AC | ≥ 1.0 | < 0.9 |
| Risk Exposure | Sum (probability × impact) | Decreasing | Increasing trend |
| Issue Resolution Rate | Closed issues / Total issues | > 80% | < 60% |
| Milestone Adherence | On-time milestones / Total milestones | ≥ 90% | < 80% |
| Scope Change Rate | Approved changes / Original baseline | < 10% | > 20% |
| Defect Rate (Agile) | Bugs found / Stories completed | < 10% | > 20% |

### RAG Status Definitions
**🟢 Green**: On track — no action required
**🟡 Amber**: At risk — mitigation in progress; sponsor should be aware
**🔴 Red**: Off track — needs immediate action; escalation required

Define quantitative thresholds for each metric and area (don't leave RAG to subjective judgment).

---

## Risk Monitoring

Risks are dynamic — they change throughout the project lifecycle.

### Risk Review Cadence
- Weekly: PM reviews top risks with team; update status
- Monthly: Steering committee reviews risk register; retire closed risks; add new ones
- Phase gates: Full risk re-assessment before each major phase

### Risk Status Categories
- **Open**: Risk is active and response is planned/in progress
- **Materializing**: Risk event is occurring
- **Closed**: Risk has passed or been resolved
- **Occurred**: Risk event happened; move to Issues log

### Risk → Issue Escalation
When a risk materializes, it becomes an issue. Treat issues differently:
- Issues need resolution NOW (not prevention)
- Assign a single owner with authority to resolve
- Set a firm resolution date
- Track in Issues Log separately from Risk Register

---

## Scope Control

### How Scope Creep Happens
- Informal requests ("can you just add...?")
- Gold-plating (team adds unrequested features)
- Poorly defined requirements (everything gets interpreted broadly)
- Stakeholder pressure without change control

### Preventing Scope Creep
1. Have a clear, approved WBS and scope statement
2. Train the team: "nice ideas → backlog, not sprint"
3. Process ALL scope changes through change control (even small ones)
4. Make scope additions visible: "We can add that, but it means delaying X by 2 weeks"
5. Regular scope reviews at steering committee meetings

### Scope Verification (Validation)
Before closing phases or delivering milestones, get formal acceptance:
- Walk stakeholders through deliverables against acceptance criteria
- Document what is accepted and what needs rework
- Get written sign-off before moving to next phase

---

## Escalation Framework

When to escalate (PM to Sponsor):
- Budget variance > [threshold: typically 10%]
- Schedule slip > [threshold: typically 2 weeks]
- A risk has materialized and cannot be mitigated within PM authority
- A scope change request exceeds PM approval authority
- Team conflict that the PM cannot resolve
- External blocker (vendor failure, regulatory change)

Escalation best practice:
- Escalate with proposed solutions, not just problems
- Be specific about what decision is needed and by when
- Quantify the impact of non-action
- Bring one recommendation, not multiple options if possible
