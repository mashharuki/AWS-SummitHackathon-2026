# SWOT Framework Reference

## What SWOT Is (and Isn't)

SWOT (Strengths, Weaknesses, Opportunities, Threats) is a structured framework for 
strategic situation assessment. It separates analysis into two axes:

**Internal vs. External**
- Internal: Factors the team/project controls (S, W)
- External: Factors in the environment outside direct control (O, T)

**Positive vs. Negative**
- Positive: Help achieve goals (S, O)
- Negative: Hinder goal achievement (W, T)

| | 内部要因 | 外部要因 |
|---|---|---|
| **プラス** | 強み (Strengths) | 機会 (Opportunities) |
| **マイナス** | 弱み (Weaknesses) | 脅威 (Threats) |

**SWOT is NOT a list of features.** It's a strategic assessment tool. The question for 
each factor is always: "compared to what?" — compared to competitors, alternatives, or 
the organization's goals.

## Defining Each Factor

### 強み (Strengths)
Internal capabilities or resources that give a competitive advantage. Ask:
- What do we do better than alternatives?
- What unique resources or knowledge do we have?
- What do users/stakeholders praise?
- What would be hard for others to replicate?

Common traps: listing neutral facts ("we use React") as strengths when they don't 
differentiate. A strength must advantage you *relative to alternatives*.

### 弱み (Weaknesses)
Internal limitations or gaps that put you at a disadvantage. Ask:
- What do alternatives do better?
- Where do we lack resources, skills, or coverage?
- What do users/stakeholders complain about?
- What has repeatedly caused failures or delays?

Common traps: omitting weaknesses to avoid uncomfortable truths. An unexamined weakness 
becomes a strategic blindspot.

### 機会 (Opportunities)
External trends, events, or changes that could benefit the project. Ask:
- What market trends favor our approach?
- What technology changes could amplify our strengths?
- What unmet needs could we address?
- What regulatory or ecosystem changes play to our advantage?

Common traps: listing things you *want* to do (that's a plan, not an opportunity). 
Opportunities are external circumstances — they exist independent of your intent.

### 脅威 (Threats)
External factors that could harm the project. Ask:
- What are competitors doing that could make us less relevant?
- What technology shifts could make our approach obsolete?
- What regulatory, security, or ecosystem risks exist?
- What could cause key contributors to leave?

Common traps: only listing obvious threats (known competitors) while missing structural 
threats (ecosystem abandonment, dependency end-of-life).

---

## クロスSWOT分析 (Cross-SWOT / TOWS Matrix)

The cross-SWOT (TOWS) matrix is where strategic value is generated. Each cell represents 
a strategic posture derived from the intersection of internal and external factors.

### SO戦略 (積極戦略 / Maxi-Maxi)
**強みを活かして機会を最大化する攻めの戦略**

These are your highest-upside strategies. When strong internal capabilities meet favorable 
external conditions, go aggressively.

Example: "Strong TypeScript codebase (S) + growing demand for type-safe APIs (O) → 
publish a typed SDK to capture developer adoption"

### ST戦略 (差別化・防守戦略 / Maxi-Mini)
**強みを使って脅威を回避・無効化する防守戦略**

Use existing advantages as shields. The goal is to neutralize or outlast threats.

Example: "Deep caching layer (S) + new competitor entering the market (T) → double down 
on performance marketing, making speed a differentiator competitors struggle to match"

### WO戦略 (改善・成長戦略 / Mini-Maxi)
**弱みを克服して機会を獲得する成長戦略**

These require investment — you must fix something to capture an opportunity. Prioritize 
by opportunity size vs. cost to fix the weakness.

Example: "No mobile support (W) + mobile-first market trend (O) → invest in responsive 
design to access new user segment"

### WT戦略 (撤退・縮小・リスク最小化戦略 / Mini-Mini)
**弱みと脅威が重なる最も危険な領域。防衛・縮小・撤退を検討**

This quadrant demands immediate attention. It's where the project is most exposed. 
Options: fix the weakness, mitigate the threat, or accept/exit the risk.

Example: "Outdated authentication library (W) + increasing security regulatory requirements (T) 
→ immediate dependency upgrade is blocking compliance certification"

---

## Analysis Quality Checklist

Before finalizing any SWOT, verify:

- [ ] Every item has specific evidence (not just an assertion)
- [ ] Strengths are actually differentiating (not just "we have users")
- [ ] Weaknesses include uncomfortable truths, not just minor issues
- [ ] Opportunities are external circumstances, not internal plans
- [ ] Threats include second-order risks (ecosystem, talent, regulatory)
- [ ] Cross-SWOT strategies are specific enough to act on
- [ ] Top 3 priorities are clearly identified
- [ ] Analysis reflects the stated scope and purpose
