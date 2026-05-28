#!/usr/bin/env tsx
/**
 * backfill-decision-at — 既存承認済みタスクの decisionAt 一括補完スクリプト
 *
 * ## 概要
 * saborou-tasks-dev の status=approved なタスクを全スキャンし、plannedSteps の
 * decision ステップに decisionAt が欠けているものを calcSchedule の後ろ詰め配置時刻で
 * 補完して書き戻す。
 *
 * ## 実行方法
 *
 * ### ドライラン（デフォルト・書き込みなし）
 * ```
 * pnpm tsx pkgs/backend/scripts/backfill-decision-at.ts
 * ```
 *
 * ### 本番適用（実際に DynamoDB を更新）
 * ```
 * pnpm tsx pkgs/backend/scripts/backfill-decision-at.ts --apply
 * ```
 *
 * ### オプション
 * - `--apply`    ドライランを解除して実際に書き込む
 * - `--table`    DynamoDB テーブル名（デフォルト: saborou-tasks-dev）
 * - `--region`   AWSリージョン（デフォルト: ap-northeast-1）
 * - `--limit`    Scan の最大件数（0=全件。デフォルト: 0）
 *
 * ## 冪等性
 * 既に decisionAt がある decision ステップは変更しない。
 * 同じタスクに対して複数回実行しても安全。
 *
 * ## エラー処理
 * タスク単位でエラーをログして継続する（1件失敗しても残りを処理する）。
 */

import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { Task } from "@saboru/shared";
import { backfillDecisionAt } from "../src/utils/decisionAtBackfill.js";

// ─────────────────────────────────────────────
// CLI 引数解析
// ─────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--apply");
const TABLE_NAME =
  args.find((a) => a.startsWith("--table="))?.split("=")[1] ??
  "saborou-tasks-dev";
const REGION =
  args.find((a) => a.startsWith("--region="))?.split("=")[1] ??
  "ap-northeast-1";
const LIMIT = Number(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0",
);

// ─────────────────────────────────────────────
// ロガー
// ─────────────────────────────────────────────

function log(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...data }));
}

// ─────────────────────────────────────────────
// DynamoDB ヘルパー
// ─────────────────────────────────────────────

/**
 * Scan で全 approved タスクを取得する（PaginationToken でページネーション）。
 * GSI-UserStatus（userId, status）を活用できないため全件 Scan する。
 * status=approved の絞り込みは FilterExpression で行う。
 */
async function scanApprovedTasks(
  client: DynamoDBClient,
  tableName: string,
  limit: number,
): Promise<Task[]> {
  const tasks: Task[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "#status = :approved AND begins_with(SK, :prefix)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":approved": "approved",
          ":prefix": "TASK#",
        }),
        ExclusiveStartKey: lastKey
          ? marshall(lastKey as Parameters<typeof marshall>[0])
          : undefined,
      }),
    );

    for (const item of result.Items ?? []) {
      tasks.push(unmarshall(item) as Task);
    }

    lastKey = result.LastEvaluatedKey
      ? (unmarshall(result.LastEvaluatedKey) as Record<string, unknown>)
      : undefined;

    if (limit > 0 && tasks.length >= limit) {
      tasks.splice(limit);
      break;
    }
  } while (lastKey);

  return tasks;
}

/**
 * plannedSteps を DynamoDB に書き戻す。
 * UpdateExpression で plannedSteps のみを更新し、他フィールドは変更しない。
 */
async function updatePlannedSteps(
  client: DynamoDBClient,
  tableName: string,
  task: Task,
  newSteps: unknown[],
): Promise<void> {
  await client.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ PK: task.PK, SK: task.SK }),
      UpdateExpression: "SET plannedSteps = :steps, updatedAt = :updatedAt",
      ExpressionAttributeValues: marshall(
        {
          ":steps": newSteps,
          ":updatedAt": new Date().toISOString(),
        },
        { removeUndefinedValues: true },
      ),
    }),
  );
}

// ─────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  log({
    action: "backfill_start",
    dryRun: DRY_RUN,
    table: TABLE_NAME,
    region: REGION,
    limit: LIMIT === 0 ? "all" : LIMIT,
  });

  if (DRY_RUN) {
    console.log(
      "=== DRY RUN モード: 変更内容をログ出力するのみで書き込みは行いません ===",
    );
    console.log(
      "=== 実際に書き込むには --apply オプションを付けてください ===",
    );
    console.log("");
  }

  const client = new DynamoDBClient({ region: REGION });

  // 全 approved タスクを取得
  log({ action: "scan_start", table: TABLE_NAME });
  const allTasks = await scanApprovedTasks(client, TABLE_NAME, LIMIT);
  log({ action: "scan_complete", totalTasks: allTasks.length });

  let processed = 0;
  let skipped = 0;
  let backfilled = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (const task of allTasks) {
    try {
      // plannedSteps が無いタスクはスキップ
      if (!Array.isArray(task.plannedSteps) || task.plannedSteps.length === 0) {
        skipped++;
        continue;
      }

      // decision ステップに decisionAt 欠落がないか確認
      const hasGap = task.plannedSteps.some(
        (s) => s.bandType === "decision" && !s.decisionAt,
      );
      if (!hasGap) {
        skipped++;
        continue;
      }

      // calcSchedule で後ろ詰め配置時刻を計算し補完
      const { steps: backfilledSteps, backfilledCount } = backfillDecisionAt(
        task.plannedSteps,
        now,
        task.deadline,
      );

      if (backfilledCount === 0) {
        // 補完対象が見つからなかった（hasGap は true なのに 0 = 稀なエッジケース）
        skipped++;
        continue;
      }

      // 補完内容をログ
      const diffLog = backfilledSteps
        .filter((s) => s.bandType === "decision")
        .map((s) => ({
          stepId: s.stepId,
          stepLabel: s.stepLabel,
          decisionAt: s.decisionAt,
        }));

      log({
        action: "task_will_be_updated",
        taskId: task.taskId,
        userId: task.userId,
        backfilledCount,
        diff: diffLog,
        dryRun: DRY_RUN,
      });

      if (!DRY_RUN) {
        await updatePlannedSteps(client, TABLE_NAME, task, backfilledSteps);
        log({
          action: "task_updated",
          taskId: task.taskId,
          userId: task.userId,
        });
      }

      backfilled++;
      processed++;
    } catch (err) {
      errors++;
      log({
        action: "task_error",
        taskId: task.taskId,
        userId: task.userId,
        error: String(err),
      });
      // エラーは握りつぶさずログして継続
    }
  }

  // サマリー
  console.log("");
  log({
    action: "backfill_complete",
    dryRun: DRY_RUN,
    totalTasks: allTasks.length,
    processed,
    backfilled,
    skipped,
    errors,
  });

  if (DRY_RUN && backfilled > 0) {
    console.log(`\n${backfilled} 件のタスクに補完が必要です。`);
    console.log(
      "実際に書き込むには --apply オプションを付けて再実行してください。",
    );
  } else if (!DRY_RUN) {
    console.log(`\n${backfilled} 件のタスクを更新しました。`);
  } else {
    console.log("\n補完が必要なタスクはありませんでした。");
  }

  if (errors > 0) {
    console.error(
      `\n警告: ${errors} 件のタスクでエラーが発生しました。ログを確認してください。`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
