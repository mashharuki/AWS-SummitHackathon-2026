---
name: swot-analysis
description: >
  Performs a thorough, repo-aware SWOT analysis of a software project by systematically 
  reading all documentation, source code, architecture, dependencies, and git history before 
  producing a structured strategic report. Invoke this skill whenever the user mentions 
  "SWOT", "SWOT分析", "強み弱み", "強み・弱み・機会・脅威", "戦略分析", "ビジネス分析", 
  "プロジェクト分析", "競合分析", "project analysis", "strategic analysis", or asks to 
  understand the competitive positioning, health, or strategic direction of a project. 
  Always invoke even if SWOT is mentioned briefly — this skill transforms a casual request 
  into a deep, evidence-based strategic assessment grounded in the actual codebase.
---

# SWOT Analysis Skill

This skill guides you through a rigorous, repo-grounded SWOT analysis. The goal is not a 
surface-level four-box grid — it's a *strategic intelligence report* built from evidence 
found in the repository itself, combined with contextual factors the user provides.

The output is always in **Japanese** (per project conventions), with actionable cross-SWOT 
strategies that a product owner or engineering lead can act on immediately.

Read `references/swot-framework.md` for the theoretical underpinning if you need to refresh 
on the SWOT methodology. Read `references/software-dimensions.md` for the full list of 
analysis dimensions specific to software projects. Read `references/report-template.md` for 
the exact output structure to produce.

---

## Phase 1: Reconnaissance — Know the Project Before You Analyze It

Before touching the SWOT framework, you need enough context to make the analysis meaningful. 
A SWOT built on incomplete information will produce generic, unhelpful output.

### 1-1. Clarify the Analysis Scope (ask if unclear)

If the user's request doesn't specify a scope, ask one focused question before starting:

> **分析対象と目的を確認させてください：**
> - 対象: リポジトリ全体 / 特定のサービス・モジュール / プロダクトのビジネス面
> - 目的: 新機能開発の意思決定 / 投資家へのピッチ / 技術的負債の棚卸し / その他
> - 比較対象: 競合プロダクトや代替技術はありますか？

If the user has already provided context, skip directly to 1-2.

### 1-2. Repository Reconnaissance Checklist

Work through these systematically. Read every file listed — don't skim:

**Project Identity**
- [ ] README.md (top-level) — mission, audience, features, differentiators
- [ ] Any docs/ or documentation/ directories — architecture docs, ADRs, runbooks
- [ ] CHANGELOG.md or HISTORY.md — release cadence, recent changes
- [ ] LICENSE — licensing constraints and opportunities

**Architecture & Code Quality**
- [ ] Top-level directory structure (`find . -maxdepth 2 -type f -name "*.md"` and `ls`)
- [ ] Key source directories (src/, lib/, app/, packages/, etc.)
- [ ] Configuration files (tsconfig.json, pyproject.toml, Cargo.toml, pom.xml, etc.)
- [ ] Infrastructure as code (CDK, Terraform, CloudFormation, serverless.yml)
- [ ] CI/CD configuration (.github/workflows/, .gitlab-ci.yml, buildspec.yml)

**Dependencies & Tech Stack**
- [ ] Package manifests (package.json, requirements.txt, go.mod, etc.)
- [ ] Lock files for version pinning evidence
- [ ] Dockerfile / docker-compose.yml — runtime environment

**Quality & Testing**
- [ ] Test directories (test/, tests/, __tests__/, spec/)
- [ ] Test configuration (jest.config.js, pytest.ini, etc.)
- [ ] Code coverage reports if present

**Process & Team**
- [ ] `git log --oneline -30` — recent activity and commit patterns
- [ ] `git log --format="%an" | sort | uniq -c | sort -rn` — contributor distribution
- [ ] Open issues count (if GitHub CLI available: `gh issue list --limit 5`)
- [ ] Pull request patterns (if available)

**Business / Domain Context**
- [ ] Any business documentation, pitch decks, or product specs in the repo
- [ ] API documentation (OpenAPI specs, GraphQL schemas)
- [ ] User-facing documentation

Capture your findings as a structured mental model before moving to Phase 2. Note evidence 
for each finding — vague claims weaken the analysis.

---

## Phase 2: Internal Analysis (Strengths & Weaknesses)

Internal factors are things the project team controls. Evaluate each dimension honestly — 
pretending weaknesses don't exist produces a useless analysis.

For each strength and weakness, note **specific evidence** from the codebase 
(file name, pattern observed, metric).

### Strength Dimensions to Evaluate

- **Architecture quality**: Is the codebase well-structured? Clear separation of concerns? 
  Patterns that suggest deliberate design decisions?
- **Technology choices**: Is the tech stack modern, well-supported, and well-matched to the 
  problem? Is it a competitive advantage?
- **Test coverage**: Are there meaningful tests? Do they cover critical paths?
- **Documentation**: Is the system well-documented? Can a new contributor onboard quickly?
- **Performance design**: Evidence of performance-conscious design (caching, async, efficient 
  data structures)?
- **Security posture**: Evidence of security thinking (input validation, auth patterns, 
  secrets management)?
- **Developer experience**: Tooling, scripts, automation that accelerates development?
- **Modularity / extensibility**: Can new features be added without major rewrites?
- **Community / ecosystem**: Is the project built on widely-adopted standards?
- **Unique capabilities**: What does this project do that others don't?

### Weakness Dimensions to Evaluate

- **Technical debt**: Complex, poorly-structured, or duplicated code?
- **Dependency risk**: Outdated, abandoned, or insecure dependencies?
- **Test gaps**: Missing tests in critical areas? No tests at all?
- **Documentation gaps**: Missing, stale, or incorrect documentation?
- **Scalability constraints**: Architectural bottlenecks that will bite under load?
- **Security gaps**: Missing input validation, hardcoded secrets, weak auth?
- **Operational immaturity**: No CI/CD? No monitoring? No deployment automation?
- **Contributor concentration**: Single contributor or uneven expertise distribution?
- **Technology mismatch**: Stack choices that create unnecessary complexity?
- **Performance issues**: Evidence of slow operations, inefficient patterns?

---

## Phase 3: External Analysis (Opportunities & Threats)

External factors are things outside the team's direct control. These come from the business 
context provided by the user, the docs, and your knowledge of the technology landscape.

### Opportunity Dimensions to Evaluate

- **Market trends**: Is the problem this project solves growing in importance?
- **Technology tailwinds**: Are the chosen technologies gaining adoption or ecosystem support?
- **Integration opportunities**: Can this project leverage new APIs, services, or standards?
- **Community growth**: Opportunity to grow contributors or users?
- **Regulatory / compliance advantages**: Does this project position well for new regulations?
- **Partnership potential**: Could strategic integrations amplify value?
- **Underserved needs**: Are there adjacent use cases the project could expand into?
- **AI/automation opportunities**: Can new AI capabilities enhance the project significantly?

### Threat Dimensions to Evaluate

- **Competitive threats**: Are there well-funded competitors or substitutes?
- **Technology obsolescence**: Are core dependencies nearing end-of-life? Framework churn?
- **Security vulnerabilities**: Known CVEs in dependencies? Architectural patterns that are 
  becoming security liabilities?
- **Talent/maintenance risk**: Is key knowledge concentrated in one person who might leave?
- **Regulatory threats**: Could new laws or regulations create compliance burdens?
- **Ecosystem abandonment**: Is the community around key dependencies shrinking?
- **Market shifts**: Could the problem this project solves become irrelevant?
- **Scalability walls**: Could the current architecture become a hard limit on growth?

---

## Phase 4: Cross-SWOT Strategic Analysis (クロスSWOT分析)

This is the most valuable phase — where evidence becomes strategy. 

Create a 2×2 matrix and derive concrete strategies from each quadrant:

| | 機会 (Opportunities) | 脅威 (Threats) |
|---|---|---|
| **強み (Strengths)** | **積極戦略** (S×O): 強みを活かして機会を最大化 | **差別化・防守戦略** (S×T): 強みで脅威を回避・無効化 |
| **弱み (Weaknesses)** | **改善・成長戦略** (W×O): 弱みを克服して機会を獲得 | **撤退・縮小・リスク最小化戦略** (W×T): 最優先で対処すべき危険地帯 |

For each quadrant, produce **2-4 specific, actionable strategies** — not general principles. 
Each strategy should reference specific evidence from Phase 2 and 3.

Bad: 「テストを充実させる」  
Good: 「現在テストが存在しない認証モジュール（src/auth/）に統合テストを追加し、Cognito連携の 
regression riskを排除することで、エンタープライズ向けSSOオポチュニティへの対応準備を整える」

---

## Phase 5: Output — Strategic Intelligence Report

Generate the full report using the template in `references/report-template.md`.

Key principles for the output:
- **Evidence over assertion**: Every S/W/O/T item cites specific evidence from the repo
- **Specific over vague**: Strategies name files, modules, timeframes, and metrics where possible  
- **Prioritized**: Mark the top 3 most important findings and the top 3 most actionable strategies
- **Honest**: Don't soften weaknesses — the analysis is only useful if it's accurate
- **Concise**: Each item is 1-3 sentences with evidence. Avoid filler text.

The report sections are:
1. **エグゼクティブサマリー** (3-5 bullet points: what matters most)
2. **分析前提** (scope, constraints, data sources)
3. **SWOT分析** (4 quadrants with evidence)
4. **クロスSWOT戦略マトリクス** (the 4-quadrant strategy table)
5. **優先戦略トップ3** (the 3 highest-impact strategies with rationale)
6. **リスク・注意事項** (things that could make this analysis wrong)
7. **次のアクション提案** (concrete next steps)
