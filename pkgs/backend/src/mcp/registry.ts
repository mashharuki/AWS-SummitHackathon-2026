import type { McpToolDefinition, McpToolName } from "./types.js";

export const EXCLUDED_MCP_ROUTE_PATTERNS = [
  "/api/auth/*",
  "/api/webhooks/*",
  "/api/docs",
  "/api/openapi.json",
  "/api/health",
  "/api/mcp/*",
  "/api/internal/*",
] as const;

export const MCP_TOOL_REGISTRY = [
  {
    name: "saborou_list_tasks",
    effect: "read",
    description:
      "ユーザーのSABOROUタスク一覧を取得します。「タスクを見せて」「やることリストを教えて」「今のタスクは？」「何の仕事が残ってる？」などと言われたときに呼び出してください。status引数で絞り込み可能（active=進行中、completed=完了済み、pending=保留中）。省略すると全タスクを返します。",
    http: { method: "GET", path: "/api/tasks" },
    schema: { input: "saborou_list_tasks", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_get_task",
    effect: "read",
    description:
      "特定のタスクIDでSABOROUタスクの詳細を1件取得します。「タスクIDがXXXの詳細を教えて」「このタスクの内容を確認して」などと言われたときに使用してください。taskIdは必須です。",
    http: { method: "GET", path: "/api/tasks/{taskId}" },
    schema: { input: "saborou_get_task", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_list_candidates",
    effect: "read",
    description:
      "Slackメッセージから自動抽出された承認待ちタスク候補の一覧を取得します。「候補タスクを見せて」「確認待ちのタスクは？」「Slackから来た候補は？」「まだ承認していないタスクは？」などと言われたときに使用してください。",
    http: { method: "GET", path: "/api/tasks/candidates" },
    schema: { input: "saborou_list_candidates", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_generate_reply_draft",
    effect: "read",
    description:
      "特定タスクに対するSlack返信案をAIで自動生成します。「このタスクへの返信を考えて」「断る文章を作って」「承諾の返信案を出して」などと言われたときに使用してください。mode引数で生成タイプを選択：sabori_judgment=サボれるか判定＋最適な返信案、reply_draft=引き受ける前提の承諾返信案、decline_draft=丁寧にお断りする返信案。taskIdは必須。",
    http: { method: "POST", path: "/api/tasks/{taskId}/proposal" },
    schema: { input: "saborou_generate_reply_draft", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_judge_sabori",
    effect: "read",
    description:
      "Slackで受け取ったメッセージを分析し「うまくサボれるか（断れるか）」を判定して最適な返信案を生成します。「このメッセージはサボれる？」「断れるか判断して」「このSlackへの返し方を教えて」「このメッセージどう返せばいい？」などと言われたときに使用してください。messageにユーザーが読み上げたSlackメッセージの内容をそのまま渡してください。senderNameは送信者の名前（省略可）。",
    http: { method: "POST", path: "/api/proposals/judge" },
    schema: { input: "saborou_judge_sabori", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_fetch_google_calendar",
    effect: "side_effect",
    description:
      "Googleカレンダーの予定をSABOROUに同期し、スケジュールの混み具合をコンテキストとして取り込みます。「カレンダーを更新して」「スケジュールを同期して」「今週の予定をSABOROUに反映して」などと言われたときに使用してください。引数は不要です。実行前に必ずユーザーの確認を取ってください。",
    http: { method: "POST", path: "/api/google/calendar/fetch" },
    schema: {
      input: "saborou_fetch_google_calendar",
      output: "safe_action_result",
    },
    approval: {
      required: true,
      reason: "Imports external calendar context into SABOROU.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_fetch_gmail",
    effect: "side_effect",
    description:
      "Gmailの受信メールからタスク候補を自動抽出してSABOROUに取り込みます。「メールからタスクを作って」「Gmailを確認して候補を作って」「メールのタスクを同期して」などと言われたときに使用してください。maxResults引数で取得するメール数を制限可能（1〜20件、省略時は10件）。実行前に必ずユーザーの確認を取ってください。",
    http: { method: "POST", path: "/api/google/gmail/fetch" },
    schema: { input: "saborou_fetch_gmail", output: "safe_action_result" },
    approval: {
      required: true,
      reason: "Imports external Gmail context into SABOROU.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_send_slack_reply",
    effect: "side_effect",
    description:
      "ユーザーが明示的に承認したSlack返信を実際に送信します。「この返信を送って」「OKなので送信して」「Slackに投稿して」などと言われたときに使用してください。replyTextに送信するメッセージ本文（必須）、channelIdにSlackチャンネルID（必須、例:C01234567）を指定してください。threadTsを指定するとスレッドへの返信になります。送信後は取り消し不可のため、必ずユーザーに内容を読み上げて確認を取ってから呼び出してください。",
    http: { method: "POST", path: "/api/slack/reply" },
    schema: { input: "saborou_send_slack_reply", output: "safe_action_result" },
    approval: {
      required: true,
      reason: "Posts a Slack message externally and cannot be silently undone.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_schedule_report",
    effect: "side_effect",
    description:
      "特定タスクの進捗報告文を生成します。「報告書を作って」「進捗報告の文章を書いて」「上司への経過報告を作って」「ステータス更新の文を作って」などと言われたときに使用してください。taskIdは必須。tone引数で文体を選択：formal=硬いビジネス文体、polite=丁寧語（デフォルト）、casual=カジュアル。",
    http: { method: "POST", path: "/api/tasks/{taskId}/report" },
    schema: { input: "saborou_schedule_report", output: "safe_action_result" },
    approval: {
      required: true,
      reason: "Creates a progress report action for a task.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_find_task",
    effect: "read",
    description:
      "キーワードでタスクを検索してタスクIDを特定します。「資料作成のタスク」「田中さんから来たタスク」「先週のやつ」など、ユーザーがタスク名・内容・依頼者名の一部を言ったときに使用してください。返答の message フィールドを読み上げて、ユーザーにどのタスクか確認してください。タスクIDが不明なまま他のツールを呼び出す前に必ずこのツールで特定してください。",
    http: { method: "GET", path: "/api/tasks/search" },
    schema: { input: "saborou_find_task", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_delegate_to_claude",
    effect: "side_effect",
    description:
      "承認済みのSABOROUタスクをSlack上のClaudeアシスタントに委譲し、Slackスレッドに返信させます。「Claudeに任せて」「Claudeに依頼して」「このタスクをClaudeに委任して」「Claudeに対応してもらって」などと言われたときに使用してください。taskIdとinstructionは必須です。Slackから作成されたタスクはchannelIdが自動設定されるため省略可能です。instructionにはClaudeへの具体的な指示を日本語で記述してください（例:「このメールへの返信案を丁寧語で作成してください」）。",
    http: { method: "POST", path: "/api/slack/delegations" },
    schema: {
      input: "saborou_delegate_to_claude",
      output: "safe_action_result",
    },
    approval: {
      required: true,
      reason: "Delegates task execution to an external assistant.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "implemented",
    published: true,
  },
] as const satisfies ReadonlyArray<McpToolDefinition>;

export const MCP_TOOL_NAMES = MCP_TOOL_REGISTRY.map((tool) => tool.name);

export const MCP_TOOL_MAP = new Map<McpToolName, McpToolDefinition>(
  MCP_TOOL_REGISTRY.map((tool) => [tool.name, tool]),
);

export function isMcpToolName(value: string): value is McpToolName {
  return MCP_TOOL_MAP.has(value as McpToolName);
}

export function getMcpToolDefinition(
  name: string,
): McpToolDefinition | undefined {
  return isMcpToolName(name) ? MCP_TOOL_MAP.get(name) : undefined;
}

export function getPublishedMcpTools(): ReadonlyArray<McpToolDefinition> {
  return MCP_TOOL_REGISTRY.filter((tool) => tool.published);
}
