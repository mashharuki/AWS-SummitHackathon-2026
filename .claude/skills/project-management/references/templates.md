# PM Artifact Templates

Use these templates as-is or tailor them to the project's size and complexity.
Fill in `[BRACKETS]` with actual project information.

---

## Project Charter {#charter}

```markdown
# Project Charter: [PROJECT NAME]

**Version**: 1.0 | **Date**: [DATE] | **Status**: Draft / Approved

## Project Overview
| Field | Value |
|-------|-------|
| Project Name | [NAME] |
| Project Sponsor | [NAME, TITLE] |
| Project Manager | [NAME] |
| Start Date | [DATE] |
| Target End Date | [DATE] |
| Budget (Estimated) | [AMOUNT] |

## Problem / Opportunity Statement
[2-3 sentences: What problem does this solve? What opportunity does it capture?]

## Project Objectives (SMART)
1. [Specific, Measurable, Achievable, Relevant, Time-bound objective 1]
2. [Objective 2]
3. [Objective 3]

## Scope
**In Scope**:
- [Deliverable/feature 1]
- [Deliverable/feature 2]

**Out of Scope**:
- [Explicitly excluded item 1]
- [Explicitly excluded item 2]

## Key Milestones
| Milestone | Target Date |
|-----------|-------------|
| Project Kickoff | [DATE] |
| [Milestone 1] | [DATE] |
| [Milestone 2] | [DATE] |
| Project Closure | [DATE] |

## Budget Summary
| Category | Estimated Cost |
|----------|---------------|
| Labor | [AMOUNT] |
| Tools/Software | [AMOUNT] |
| Other | [AMOUNT] |
| Contingency (10%) | [AMOUNT] |
| **Total** | **[AMOUNT]** |

## Key Stakeholders
| Name | Role | Interest | Influence |
|------|------|----------|-----------|
| [NAME] | Sponsor | High | High |
| [NAME] | Customer | High | Medium |
| [NAME] | Team Lead | Medium | High |

## Constraints
- Budget: [Constraint]
- Timeline: [Constraint]
- Resources: [Constraint]
- Technology: [Constraint]

## Assumptions
- [Assumption 1]
- [Assumption 2]

## Risks (High Level)
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| [Risk 1] | H/M/L | H/M/L | [Brief strategy] |

## PM Authority
The Project Manager is authorized to:
- Approve scope changes up to [AMOUNT/THRESHOLD]
- Allocate team resources within the approved plan
- Escalate to sponsor for decisions exceeding the above thresholds

## Signatures
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Sponsor | | | |
| Project Manager | | | |
| Key Stakeholder | | | |
```

---

## Stakeholder Register {#stakeholder}

```markdown
# Stakeholder Register: [PROJECT NAME]

**Last Updated**: [DATE]

| ID | Name | Organization/Role | Contact | Interest in Project | Influence | Current Engagement | Desired Engagement | Strategy |
|----|------|------------------|---------|---------------------|-----------|-------------------|-------------------|---------|
| S01 | [Name] | [Role] | [Email] | [What they care about] | H/M/L | Unaware/Resistant/Neutral/Supportive/Leading | [Target] | [How to engage] |
| S02 | | | | | | | | |

## Stakeholder Grid (Power / Interest)
```
High Power |  Keep Satisfied  |  Manage Closely  |
           |                  |                  |
Low Power  |     Monitor      |   Keep Informed  |
           |   Low Interest   |   High Interest  |
```

## Engagement Plan Summary
| Stakeholder | Communication Method | Frequency | Responsible |
|-------------|---------------------|-----------|-------------|
| [Name] | Steering committee | Monthly | PM |
| [Name] | Weekly status email | Weekly | PM |
| [Name] | Slack / chat | Daily | Team Lead |
```

---

## Work Breakdown Structure (WBS) {#wbs}

The WBS decomposes deliverables (not activities). Follow the 100% rule: the WBS must capture 100% of project scope.

```markdown
# WBS: [PROJECT NAME]

## Level 1 — Project
1.0 [PROJECT NAME]

## Level 2 — Phase / Major Deliverable
1.1 Project Management
1.2 [Phase/Deliverable A]
1.3 [Phase/Deliverable B]
1.4 [Phase/Deliverable C]

## Level 3 — Sub-Deliverables
1.1.1 Project Charter
1.1.2 Project Plan
1.1.3 Status Reports
1.1.4 Lessons Learned

1.2.1 [Sub-deliverable A1]
1.2.2 [Sub-deliverable A2]

1.3.1 [Sub-deliverable B1]
1.3.2 [Sub-deliverable B2]

## WBS Dictionary (for each work package)
| WBS ID | Name | Description | Owner | Duration | Effort | Cost |
|--------|------|-------------|-------|----------|--------|------|
| 1.2.1 | [Name] | [What it produces] | [Person] | [Days] | [Hours] | [¥/$ amount] |
```

**Tips**:
- Each work package should be ≤2 weeks (for predictive) or ≤1 sprint (for agile)
- Assign a single owner per work package
- Work packages are the lowest level — they roll up to activities in the schedule

---

## Risk Register {#risk}

```markdown
# Risk Register: [PROJECT NAME]

**Last Updated**: [DATE]

| ID | Category | Risk Description | Probability (1-5) | Impact (1-5) | Score | Priority | Owner | Response Strategy | Response Actions | Status |
|----|----------|-----------------|-------------------|--------------|-------|----------|-------|-------------------|-----------------|--------|
| R01 | Schedule | [What could go wrong] | 3 | 4 | 12 | High | [Name] | Mitigate/Avoid/Transfer/Accept | [Specific actions] | Open |
| R02 | Budget | | | | | | | | | |
| R03 | Technical | | | | | | | | | |
| R04 | Stakeholder | | | | | | | | | |
| R05 | Resource | | | | | | | | | |

## Risk Scoring Matrix
```
         | Low (1-2) | Medium (3) | High (4-5) |
---------|-----------|------------|------------|
High (4-5)|  Medium  |    High    |  Critical  |
Med  (3) |    Low   |   Medium   |    High    |
Low (1-2)|  Minimal |    Low     |   Medium   |
```

## Risk Response Strategies
- **Avoid**: Change the plan to eliminate the risk
- **Mitigate**: Reduce probability or impact
- **Transfer**: Shift risk to a third party (insurance, contract)
- **Accept**: Acknowledge and monitor; budget contingency if needed

## Risk Appetite Statement
[High/Medium/Low risk tolerance, rationale, and threshold for escalation]
```

---

## RACI Matrix {#raci}

```markdown
# RACI Matrix: [PROJECT NAME]

R = Responsible (does the work)
A = Accountable (owns the outcome, signs off)
C = Consulted (provides input, 2-way communication)
I = Informed (receives updates, 1-way communication)

| Deliverable / Activity | PM | Sponsor | [Role A] | [Role B] | [Role C] | Customer |
|------------------------|----|---------|---------|---------|---------|---------| 
| Project Charter | R | A | C | I | I | C |
| WBS Creation | R | I | C | C | I | I |
| [Deliverable 1] | A | I | R | C | C | R |
| [Deliverable 2] | A | I | C | R | R | I |
| Change Requests | R | A | C | C | I | C |
| Status Reports | R | I | I | I | I | I |
| Project Closure | R | A | C | C | C | C |

**Rules**:
- Only ONE Accountable per row
- Responsible and Accountable can be same person
- Minimize "Consulted" to avoid bottlenecks
```

---

## Weekly Status Report {#status}

```markdown
# Project Status Report

**Project**: [NAME] | **Period**: [START DATE] – [END DATE]
**PM**: [NAME] | **Report #**: [N]

## Overall Status
| Area | Status | Trend |
|------|--------|-------|
| Schedule | 🟢 On Track / 🟡 At Risk / 🔴 Delayed | ↑ / → / ↓ |
| Budget | 🟢 / 🟡 / 🔴 | ↑ / → / ↓ |
| Scope | 🟢 / 🟡 / 🔴 | ↑ / → / ↓ |
| Quality | 🟢 / 🟡 / 🔴 | ↑ / → / ↓ |
| Risk | 🟢 / 🟡 / 🔴 | ↑ / → / ↓ |

## Accomplishments This Period
- [What was completed]
- [Milestone achieved if any]
- [Issues resolved]

## Planned for Next Period
- [Upcoming deliverables]
- [Key activities]
- [Decision needed by]

## Issues & Blockers
| # | Issue | Impact | Owner | Due Date | Status |
|---|-------|--------|-------|----------|--------|
| 1 | [Description] | H/M/L | [Name] | [Date] | Open/Resolved |

## Key Risks (Top 3)
| Risk | Status | Response |
|------|--------|---------|
| [Description] | Active/Closed | [Action taken] |

## Budget Summary
| Metric | Value |
|--------|-------|
| Approved Budget | [AMOUNT] |
| Spent to Date | [AMOUNT] |
| Forecast at Completion | [AMOUNT] |
| Variance | [AMOUNT] (🟢/🟡/🔴) |

## Schedule Summary
| Metric | Value |
|--------|-------|
| Planned % Complete | [%] |
| Actual % Complete | [%] |
| SPI (Schedule Perf. Index) | [VALUE] |
| CPI (Cost Perf. Index) | [VALUE] |

## Decisions Needed
- [Decision 1] — needed by [DATE] — from [STAKEHOLDER]
```

---

## Lessons Learned Register {#lessons}

```markdown
# Lessons Learned Register: [PROJECT NAME]

**Phase / Period**: [NAME] | **Facilitated by**: [PM] | **Date**: [DATE]

| ID | Category | What Happened | Root Cause | Impact | Recommendation | Priority |
|----|----------|--------------|-----------|--------|---------------|----------|
| L01 | Process | [Description] | [Why it happened] | H/M/L | [What to do next time] | H/M/L |
| L02 | Technical | | | | | |
| L03 | Stakeholder | | | | | |
| L04 | Team | | | | | |
| L05 | Scope/Change | | | | | |

## Lessons Learned Session Agenda
1. What went well? (15 min — celebrate successes)
2. What didn't go as planned? (20 min — no blame, focus on process)
3. What would we do differently? (20 min — actionable recommendations)
4. What should we share with other teams? (5 min — knowledge transfer)

## Categories
- Process, Technical, Stakeholder, Team, Schedule, Budget, Scope, Risk, Communication, Tools
```

---

## Project Closure Report {#closure}

```markdown
# Project Closure Report: [PROJECT NAME]

**Date**: [DATE] | **PM**: [NAME] | **Sponsor**: [NAME]

## Executive Summary
[2-3 sentences: Project completed, key outcomes, major achievements and challenges]

## Objectives Achievement
| Objective | Target | Achieved | Status |
|-----------|--------|----------|--------|
| [Objective 1] | [Metric] | [Actual] | ✅/⚠️/❌ |
| [Objective 2] | | | |

## Schedule Performance
| Metric | Planned | Actual |
|--------|---------|--------|
| Start Date | [DATE] | [DATE] |
| End Date | [DATE] | [DATE] |
| Duration | [N weeks] | [N weeks] |
| Variance | | [+/-N days] |

## Budget Performance
| Category | Budget | Actual | Variance |
|----------|--------|--------|---------|
| Labor | [AMOUNT] | [AMOUNT] | [AMOUNT] |
| Other | [AMOUNT] | [AMOUNT] | [AMOUNT] |
| **Total** | [AMOUNT] | [AMOUNT] | [AMOUNT] |

## Key Deliverables
| Deliverable | Status | Acceptance Date | Notes |
|-------------|--------|-----------------|-------|
| [Name] | ✅ Accepted | [DATE] | |

## Top 5 Lessons Learned
1. [Lesson from lessons learned register]
2. 
3. 
4. 
5. 

## Recommendations for Future Projects
- [Recommendation 1]
- [Recommendation 2]

## Formal Acceptance
By signing below, stakeholders confirm project objectives have been met.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Sponsor | | | |
| Customer | | | |
| PM | | | |
```
