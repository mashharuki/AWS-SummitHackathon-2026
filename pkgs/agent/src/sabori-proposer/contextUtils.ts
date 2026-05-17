import { minutesUntil } from "@saboru/shared";
import type { ContextSignals, SlackContext, TaskContext } from "./types.js";

/**
 * contextUtils — Phase 1 context assembly utilities
 *
 * Implements the 5 psychological framework signal derivation:
 * - CEM (Karau & Williams, 1993): contextCoverage / deadline presence
 * - Identifiability (Williams et al., 1981): requesterStatus → taskIdentifiability
 * - Sucker Effect (Kerr, 1983): requesterStatus → perceivedPeerEffort
 * - SDT (Ryan & Deci, 2000): reminderCount + urgencyKeywords → externalPressureLevel
 * - Expectancy Theory (Vroom, 1964): deadline proximity → effortOutcomeExpectancy
 */

/**
 * Assemble natural language narrative from TaskContext for Bedrock prompt.
 * The narrative is passed as the user message in Phase 2.
 */
export function assembleContextNarrative(context: TaskContext): string {
  const lines: string[] = [];

  lines.push("## タスク情報");
  lines.push(`- タイトル: ${context.task.title}`);
  lines.push(
    `- 締切: ${context.task.deadline ? formatDeadlineLocal(context.task.deadline) : "未設定"}`,
  );

  if (context.task.deadline) {
    const minutes = minutesUntil(context.task.deadline);
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    if (minutes < 0) {
      lines.push(
        `- 締切: ${h > 0 ? `${h}時間` : ""}${m}分 過ぎています（期限切れ）`,
      );
    } else {
      lines.push(`- 締切まで: ${h > 0 ? `${h}時間` : ""}${m}分`);
    }
  }

  if (context.task.description) {
    lines.push(`- 説明: ${context.task.description}`);
  }

  if (context.slackContext) {
    const s = context.slackContext;
    lines.push("\n## Slack の状況");
    lines.push(`- 依頼者のステータス: ${s.requesterStatus}`);
    lines.push(`- リマインドが来た回数: ${s.reminderCount}回`);
    lines.push(
      `- 緊急キーワード: ${s.urgencyKeywords.length > 0 ? s.urgencyKeywords.join(", ") : "なし"}`,
    );
    lines.push(
      `- スレッドアクティブ（直近1時間）: ${s.threadActive ? "あり" : "なし"}`,
    );
    if (s.reminderCount === 0) {
      lines.push("  → リマインドなし。依頼者はまだ焦っていない可能性が高い");
    }
    if (s.requesterStatus === "away" || s.requesterStatus === "offline") {
      lines.push(
        `  → 依頼者が${s.requesterStatus}のため、すぐに確認されにくい状況`,
      );
    }
  } else {
    lines.push("\n## Slack の状況");
    lines.push("- Slack コンテキストなし（手動タスク）");
  }

  return lines.join("\n");
}

/**
 * Determine context coverage quality for CEM signal
 *
 * CEM (Karau & Williams, 1993):
 * - full: Slack + deadline both available → high context
 * - partial: one of them available
 * - minimal: no Slack, no deadline
 */
export function determineContextCoverage(
  context: TaskContext,
): ContextSignals["contextCoverage"] {
  const hasSlack = context.slackContext != null;
  const hasDeadline = context.task.deadline != null;

  if (hasSlack && hasDeadline) return "full";
  if (hasSlack || hasDeadline) return "partial";
  return "minimal";
}

/**
 * Derive psychological signals from TaskContext
 *
 * Maps 5 frameworks to discrete signal values:
 *
 * | Framework | Source | Signal |
 * |-----------|--------|--------|
 * | Identifiability (Williams 1981) | requesterStatus | taskIdentifiability |
 * | Sucker Effect (Kerr 1983) | requesterStatus | perceivedPeerEffort |
 * | SDT (Ryan & Deci 2000) | reminderCount + urgencyKeywords | externalPressureLevel |
 * | Expectancy Theory (Vroom 1964) | deadline proximity | effortOutcomeExpectancy |
 */
export function derivePsychSignals(
  context: TaskContext,
): ContextSignals["psychSignals"] {
  const slack: SlackContext | undefined = context.slackContext;

  // --- Identifiability (Williams et al., 1981) ---
  // online = high identifiability (requester can notice you're slacking)
  // away/offline = low identifiability (requester is not watching)
  let taskIdentifiability: "high" | "low" | "unknown" = "unknown";
  if (slack) {
    if (slack.requesterStatus === "online") {
      taskIdentifiability = "high";
    } else if (
      slack.requesterStatus === "away" ||
      slack.requesterStatus === "offline"
    ) {
      taskIdentifiability = "low";
    }
  }

  // --- Sucker Effect (Kerr, 1983) ---
  // If requester is away/offline, perceived peer effort is low
  // → Sucker effect kicks in: "why should I work if they're not?"
  let perceivedPeerEffort: "high" | "low" | "unknown" = "unknown";
  if (slack) {
    if (slack.requesterStatus === "online") {
      perceivedPeerEffort = "high";
    } else if (
      slack.requesterStatus === "away" ||
      slack.requesterStatus === "offline"
    ) {
      perceivedPeerEffort = "low";
    }
  }

  // --- SDT (Ryan & Deci, 2000) ---
  // External pressure: reminders + urgency keywords
  // high: reminderCount >= 2 OR (urgency keywords present)
  // low: reminderCount === 0 AND no urgency keywords
  let externalPressureLevel: "high" | "low" | "unknown" = "unknown";
  if (slack) {
    const hasUrgency = slack.urgencyKeywords.length > 0;
    if (slack.reminderCount >= 2 || hasUrgency) {
      externalPressureLevel = "high";
    } else if (slack.reminderCount === 0 && !hasUrgency) {
      externalPressureLevel = "low";
    } else {
      // reminderCount === 1 and no urgency → low-medium
      externalPressureLevel = "low";
    }
  }

  // --- Expectancy Theory (Vroom, 1964) ---
  // Effort-outcome expectancy based on deadline proximity:
  // deadline > 24h → high (effort will pay off, plenty of time)
  // deadline < 4h → low (effort too late to matter)
  // null → unknown
  let effortOutcomeExpectancy: "high" | "low" | "unknown" = "unknown";
  if (context.task.deadline) {
    const minutes = minutesUntil(context.task.deadline);
    if (minutes > 24 * 60) {
      effortOutcomeExpectancy = "high";
    } else if (minutes < 4 * 60) {
      effortOutcomeExpectancy = "low";
    } else {
      // 4h–24h: borderline
      effortOutcomeExpectancy = "low";
    }
  }

  return {
    taskIdentifiability,
    effortOutcomeExpectancy,
    perceivedPeerEffort,
    externalPressureLevel,
  };
}

/**
 * Derive full ContextSignals from TaskContext
 * Combines all signal derivation functions
 */
export function deriveContextSignals(context: TaskContext): ContextSignals {
  const slack = context.slackContext;
  const deadlineMinutes = context.task.deadline
    ? minutesUntil(context.task.deadline)
    : undefined;

  return {
    hasReminder: slack ? slack.reminderCount > 0 : false,
    reminderCount: slack?.reminderCount ?? 0,
    requesterActiveStatus: slack?.requesterStatus ?? "unknown",
    hasUrgentKeyword: slack ? slack.urgencyKeywords.length > 0 : false,
    deadlineMinutes: deadlineMinutes ?? undefined,
    contextCoverage: determineContextCoverage(context),
    psychSignals: derivePsychSignals(context),
  };
}

/**
 * Calculate next re-evaluation timestamp
 *
 * @param offsetMinutes - Minutes until next check (from LLM judgment)
 * @param now - Current date (injectable for testing)
 * @returns ISO 8601 string
 */
export function calcNextCheckAt(
  offsetMinutes: number,
  now: Date = new Date(),
): string {
  return new Date(now.getTime() + offsetMinutes * 60 * 1000).toISOString();
}

/**
 * Format deadline date for human-readable narrative
 */
function formatDeadlineLocal(deadline: string): string {
  try {
    const d = new Date(deadline);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });
  } catch {
    return deadline;
  }
}
