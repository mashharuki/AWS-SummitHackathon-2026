/**
 * タスクルート
 *
 * GET    /tasks                               — 承認済みタスク一覧 (US-07)
 * POST   /tasks                               — タスク手動作成 (US-08)
 * GET    /tasks/candidates                    — 保留中の候補一覧 (US-07)
 * POST   /tasks/candidates/:id/approve        — 候補を承認 (US-07)
 * DELETE /tasks/candidates/:id               — 候補を却下
 * GET    /tasks/:id                           — 単一タスク取得
 * PATCH  /tasks/:id                           — タスクインライン編集 (US-08)
 * DELETE /tasks/:id                           — タスク論理削除 (US-08)
 * PATCH  /tasks/:taskId/planned-steps         — plannedSteps 更新（ガント編集永続化）
 */

import { zValidator } from "@hono/zod-validator";
import type {
  GoalDecomposerAgent,
  SaboriProposerAgentV2,
  SchedulePlannerAgent,
} from "@saboru/agent";
import {
  ApproveOverridesSchema,
  CreateTaskSchema,
  SOURCE_TYPE,
  UpdatePlannedStepsSchema,
  UpdateTaskSchema,
} from "@saboru/shared";
import { Hono } from "hono";
import { NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { AppEnv } from "../types.js";

export function createTasksRoute(
  taskRepository: DynamoTaskRepository,
  candidateRepository: DynamoTaskCandidateRepository,
  schedulePlannerAgent: SchedulePlannerAgent,
  /**
   * 進捗報告文生成エージェント (U-V2-07)。POST /:id/report で使用する。
   * v1 後方互換のため任意とし、未指定時は /report が 503 を返す。
   */
  saboriProposerAgentV2?: SaboriProposerAgentV2,
  /** PM WBS分解エージェント。POST /:id/decompose で使用する。 */
  goalDecomposerAgent?: GoalDecomposerAgent,
): Hono<AppEnv> {
  const tasks = new Hono<AppEnv>();

  // 全タスクルートに認証を適用
  tasks.use("*", authMiddleware);

  /** GET /tasks — 承認済みタスク一覧 */
  tasks.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await taskRepository.findApprovedByUserId(userId);
    return c.json({ tasks: items });
  });

  /** POST /tasks — タスク手動作成 */
  tasks.post(
    "/",
    zValidator("json", CreateTaskSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const task = await taskRepository.create({
        userId,
        title: body.title,
        deadline: body.deadline ?? null,
        description: body.description ?? "",
        requester: "",
        sourceType: SOURCE_TYPE.MANUAL,
      });
      return c.json(task, 201);
    },
  );

  /** GET /tasks/candidates — Pending candidate list */
  tasks.get("/candidates", async (c) => {
    const userId = c.get("userId");
    const items = await candidateRepository.findAllByUserId(userId);
    return c.json({ candidates: items });
  });

  /**
   * POST /tasks/candidates/:id/plan-steps — 承認モーダル用のステップ下書き生成
   *
   * 承認確認モーダルを開いたタイミングで呼ばれ、Bedrock で作業ステップ案を生成して返す。
   * ユーザーはこの下書きを編集して「確定して承認」する。確定後のガント生成では
   * このステップ（の編集結果）が Task.plannedSteps として使われ、Bedrock 再呼び出しは
   * 行われない（精度最大化）。
   *
   * - 候補が無ければ 404
   * - Bedrock 呼び出し失敗時は 503（フロントは手動入力へフォールバック可能）
   */
  tasks.post("/candidates/:id/plan-steps", async (c) => {
    const userId = c.get("userId");
    const candidateId = c.req.param("id");

    const candidate = await candidateRepository.findById(userId, candidateId);
    if (!candidate) {
      throw new NotFoundError(`Task candidate ${candidateId} not found`);
    }

    try {
      const steps = await schedulePlannerAgent.generateStepDraft({
        title: candidate.title,
        deadline: candidate.deadline,
        description: candidate.description,
        refId: candidateId,
      });
      return c.json({ steps });
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "ERROR",
          action: "plan_steps_generation_failed",
          candidateId,
          error: String(err),
        }),
      );
      return c.json(
        {
          error: {
            code: "STEP_DRAFT_FAILED",
            message: "ステップ案の生成に失敗しました",
          },
        },
        503,
      );
    }
  });

  /** POST /tasks/candidates/:id/approve — Approve candidate */
  tasks.post("/candidates/:id/approve", async (c) => {
    const userId = c.get("userId");
    const candidateId = c.req.param("id");

    const candidate = await candidateRepository.findById(userId, candidateId);
    if (!candidate) {
      throw new NotFoundError(`Task candidate ${candidateId} not found`);
    }

    // 承認モーダルで編集された内容（overrides）を任意で受け取る。
    // ボディ無し／overrides 無しは後方互換（候補の元値で承認）。
    let overrides: ReturnType<typeof ApproveOverridesSchema.parse> | undefined;
    const raw = await c.req.json().catch(() => null);
    if (raw && typeof raw === "object" && "overrides" in raw) {
      const parsed = ApproveOverridesSchema.safeParse(
        (raw as { overrides: unknown }).overrides,
      );
      if (!parsed.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid overrides",
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      overrides = parsed.data;
    }

    const approvedTask = await candidateRepository.approve(
      userId,
      candidateId,
      overrides,
    );
    return c.json(approvedTask, 201);
  });

  /** DELETE /tasks/candidates/:id — Reject candidate */
  tasks.delete("/candidates/:id", async (c) => {
    const userId = c.get("userId");
    const candidateId = c.req.param("id");

    const candidate = await candidateRepository.findById(userId, candidateId);
    if (!candidate) {
      throw new NotFoundError(`Task candidate ${candidateId} not found`);
    }

    await candidateRepository.delete(userId, candidateId);
    return c.body(null, 204);
  });

  /**
   * GET /tasks/search?keyword=xxx — キーワードでタスクを検索する (MCP: saborou_find_task)
   *
   * タイトル・説明文・依頼者名を対象に部分一致検索する。
   * レスポンスの message フィールドは音声で読み上げられることを想定した日本語文章。
   */
  tasks.get("/search", async (c) => {
    const userId = c.get("userId");
    const keyword = (c.req.query("keyword") ?? "").trim();

    if (!keyword) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "keyword is required" } },
        400,
      );
    }

    const all = await taskRepository.findApprovedByUserId(userId);
    const lower = keyword.toLowerCase();
    const matched = all.filter((t) => {
      const haystack = [t.title, t.description ?? "", t.requester ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });

    const matches = matched.map((t, i) => ({
      index: i + 1,
      taskId: t.taskId,
      title: t.title,
      deadline: t.deadline ?? null,
      requester: t.requester ?? "",
    }));

    let message: string;
    if (matches.length === 0) {
      message = `「${keyword}」に一致するタスクが見つかりませんでした。別のキーワードで検索するか、タスク一覧を確認してください。`;
    } else if (matches.length === 1) {
      const t = matches[0];
      message = `「${t.title}」が見つかりました。このタスクでよろしいですか？`;
    } else {
      const items = matches
        .map((t) => `${t.index}番目は「${t.title}」`)
        .join("、");
      message = `${matches.length}件見つかりました。${items}。どのタスクですか？`;
    }

    return c.json({ count: matches.length, matches, message });
  });

  /** GET /tasks/:id — Single task */
  tasks.get("/:id", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("id");
    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);
    return c.json(task);
  });

  /**
   * POST /tasks/:id/report — タスクの進捗報告文を生成する (API-V2-02 / U-V2-07)
   *
   * operationId: scheduleProgressReport（MCP ツール `saborou_schedule_report`）。
   * UC-03「進捗報告 → 音声承認 → 送信」で使う。タスクの締切・説明から
   * SaboriProposerAgentV2.draftReply で「現在確認・調整中です」系の丁寧な報告文を生成し、
   * 文面のみを返す（Slack への送信は拡張側の承認後に POST /api/slack/reply で行う）。
   *
   * 設計判断（デモ堅牢性）: EventBridge による完全自動の定期送信は副作用が大きく
   * デモで制御しづらい。MVP では「手動トリガー可能な報告文生成エンドポイント」を主軸とし、
   * 17:00 JST のスケジュールルールは CDK に定義（DISABLED フラグ）して将来拡張に備える。
   * これにより拡張側 Side Panel は任意タイミングでこの endpoint を叩いて報告文を取得できる。
   *
   * Errors:
   * - 404 NOT_FOUND: タスクが存在しない / 所有者でない
   * - 503 REPORT_GENERATION_FAILED: Bedrock 呼び出し失敗、または agent 未注入
   */
  tasks.post("/:id/report", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("id");

    // 所有者確認（他人のタスクは 404）
    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    if (!saboriProposerAgentV2) {
      return c.json(
        {
          error: {
            code: "REPORT_GENERATION_FAILED",
            message: "進捗報告の生成機能が利用できません",
          },
        },
        503,
      );
    }

    // タスク状況を自然言語で組み立てる（draftReply の taskStatus に渡す）
    const statusLines = [`タスク名: ${task.title}`];
    if (task.deadline) statusLines.push(`締切: ${task.deadline}`);
    if (task.description) statusLines.push(`内容: ${task.description}`);
    if (task.requester) statusLines.push(`依頼者: ${task.requester}`);

    try {
      const draft = await saboriProposerAgentV2.draftReply({
        // 「進捗を教えてほしい」という想定受信メッセージに対する返信として生成する
        incomingMessage: `「${task.title}」の進捗状況を教えてください。`,
        taskStatus: statusLines.join("\n"),
        contextHint:
          "働いてるフリとして自然に見える進捗報告。過去のユーザー本人のSlack発言や文体サンプルがある場合は、その言い回し・敬語の強さ・絵文字量に寄せ、あたかも本人が言っているような自然な文章にする。実際以上に完了を装わず、現在確認・調整中、進め方を整理中であることを丁寧に伝える。具体的な期日を断定せず、相手の不安を減らしつつ、ユーザーの余白を守る。",
      });
      return c.json({
        taskId,
        reportText: draft.replyText,
        ...(draft.tone ? { tone: draft.tone } : {}),
        reasoning: draft.reasoning,
      });
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "ERROR",
          action: "progress_report_generation_failed",
          taskId,
          error: String(err),
        }),
      );
      return c.json(
        {
          error: {
            code: "REPORT_GENERATION_FAILED",
            message: "進捗報告文の生成に失敗しました",
          },
        },
        503,
      );
    }
  });

  /** PATCH /tasks/:id — Inline edit */
  tasks.patch(
    "/:id",
    zValidator("json", UpdateTaskSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const taskId = c.req.param("id");
      const body = c.req.valid("json");

      const existing = await taskRepository.findById(userId, taskId);
      if (!existing) throw new NotFoundError(`Task ${taskId} not found`);

      const updated = await taskRepository.update(userId, taskId, body);
      return c.json(updated);
    },
  );

  /** DELETE /tasks/:id — Soft delete */
  tasks.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("id");

    const existing = await taskRepository.findById(userId, taskId);
    if (!existing) throw new NotFoundError(`Task ${taskId} not found`);

    await taskRepository.softDelete(userId, taskId);
    return c.body(null, 204);
  });

  /**
   * PATCH /tasks/:taskId/planned-steps — ガントUI ドラッグ/リサイズ編集結果を永続化
   *
   * リクエストボディ: { plannedSteps: ScheduleStep[] }
   * - 1〜8件の制約（ApproveOverridesSchema と同一）
   * - decision ステップは decisionAt 必須（欠けていれば 400）
   * - 所有者以外のタスクは 404（findById で所有者確認）
   * - 正常時は更新後の Task を返す
   */
  tasks.patch(
    "/:taskId/planned-steps",
    zValidator("json", UpdatePlannedStepsSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const taskId = c.req.param("taskId");
      const { plannedSteps } = c.req.valid("json");

      // decision ステップの decisionAt 必須チェック
      const missingDecisionAt = plannedSteps.filter(
        (s) => s.bandType === "decision" && !s.decisionAt,
      );
      if (missingDecisionAt.length > 0) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "decision ステップには decisionAt が必須です",
              details: {
                stepIds: missingDecisionAt.map((s) => s.stepId),
              },
            },
          },
          400,
        );
      }

      // 所有者確認（他人のタスクは 404）
      const existing = await taskRepository.findById(userId, taskId);
      if (!existing) throw new NotFoundError(`Task ${taskId} not found`);

      const updated = await taskRepository.updatePlannedSteps(
        userId,
        taskId,
        plannedSteps,
      );
      return c.json(updated);
    },
  );

  /**
   * POST /tasks/:taskId/decompose — PM WBS分解を実行する
   *
   * PMBOK 8th Edition WBS手法でタスクをサブタスクに分解し、
   * GoalAnalysisをDynamoDBに保存して返す。
   * slackContext クエリパラメータでSlack文脈を渡せる（任意）。
   *
   * Errors:
   * - 404 NOT_FOUND: タスクが存在しない / 所有者でない
   * - 503 DECOMPOSE_FAILED: Bedrock呼び出し失敗 / エージェント未注入
   */
  tasks.post("/:taskId/decompose", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("taskId");

    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    if (!goalDecomposerAgent) {
      return c.json(
        {
          error: {
            code: "DECOMPOSE_FAILED",
            message: "PM分解機能が利用できません",
          },
        },
        503,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const slackContext = typeof body.slackContext === "string"
      ? (body.slackContext as string)
      : undefined;

    try {
      const goalAnalysis = await goalDecomposerAgent.decompose({
        taskId: task.taskId,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        slackContext,
      });

      await taskRepository.updateGoalAnalysis(userId, taskId, goalAnalysis);

      return c.json({ taskId, goalAnalysis });
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "ERROR",
          action: "goal_decompose_failed",
          taskId,
          error: String(err),
        }),
      );
      return c.json(
        {
          error: {
            code: "DECOMPOSE_FAILED",
            message: "PM分解に失敗しました",
          },
        },
        503,
      );
    }
  });

  /**
   * GET /tasks/:taskId/decompose — GoalAnalysisを取得する
   *
   * 既存のGoalAnalysis（WBS分解結果）をDynamoDBから返す。
   * まだ分解されていない場合は404を返す。
   */
  tasks.get("/:taskId/decompose", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("taskId");

    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    const goalAnalysis = (task as typeof task & { goalAnalysis?: unknown }).goalAnalysis;
    if (!goalAnalysis) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "このタスクはまだPM分解されていません",
          },
        },
        404,
      );
    }

    return c.json({ taskId, goalAnalysis });
  });

  /**
   * PATCH /tasks/:taskId/subtasks/:subtaskId — サブタスクのステータスを更新する
   *
   * body: { status: "approved" | "executing" | "done" | "skipped" }
   *
   * Errors:
   * - 404 NOT_FOUND: タスクまたはサブタスクが存在しない
   */
  tasks.patch("/:taskId/subtasks/:subtaskId", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("taskId");
    const subtaskId = c.req.param("subtaskId");

    const body = await c.req.json();
    const { status } = body as { status: string };

    const validStatuses = ["pending", "approved", "executing", "done", "skipped"];
    if (!validStatuses.includes(status)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `status は ${validStatuses.join(" / ")} のいずれかです`,
          },
        },
        400,
      );
    }

    try {
      await taskRepository.updateSubtaskStatus(userId, taskId, subtaskId, status);
      return c.json({ taskId, subtaskId, status });
    } catch (err) {
      if (String(err).includes("not found")) {
        throw new NotFoundError(String(err));
      }
      throw err;
    }
  });

  return tasks;
}
