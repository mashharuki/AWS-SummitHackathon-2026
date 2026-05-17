/**
 * MSW ハンドラー — テスト用APIモック
 * NFR-DESIGN-9: MSW モックパターン
 */
import { http, HttpResponse } from "msw";
import type {
  Task,
  TaskCandidate,
  ServiceConnection,
  Proposal,
  User,
} from "@saboru/shared";

const mockUser: User = {
  PK: "USER#test-sub",
  SK: "PROFILE",
  cognitoSub: "test-sub",
  email: "test@example.com",
  name: "田中 ユカ",
  createdAt: "2026-05-17T00:00:00Z",
  updatedAt: "2026-05-17T00:00:00Z",
};

const mockCandidates: TaskCandidate[] = [
  {
    PK: "USER#test-sub",
    SK: "TASK_CAND#01JDBC001",
    candidateId: "01JDBC001",
    title: "クライアント向けレポート作成",
    deadline: "2026-05-20T09:00:00Z",
    requester: "松本部長",
    description: "Q1の売上データをまとめてレポートにする",
    sourceType: "slack",
    sourceRef: "slack-msg-001",
    status: "pending",
    createdAt: "2026-05-17T08:00:00Z",
    ttl: 1718582400,
  },
];

const mockTasks: Task[] = [
  {
    PK: "USER#test-sub",
    SK: "TASK#01JDBT001",
    taskId: "01JDBT001",
    userId: "test-sub",
    status: "approved",
    title: "全員向けミーティング資料",
    deadline: "2026-05-19T12:00:00Z",
    requester: "山田さん",
    description: "5月の全体MTG資料を作成する",
    sourceType: "slack",
    approvedAt: "2026-05-17T09:00:00Z",
    updatedAt: "2026-05-17T09:00:00Z",
  },
];

const mockProposal: Proposal = {
  PK: "TASK#01JDBT001",
  SK: "PROPOSAL#2026-05-17T10:00:00Z",
  taskId: "01JDBT001",
  userId: "test-sub",
  verdict: "can_saboru",
  summaryText: "今日は安全にサボれます！",
  reasoning: [
    "Slackの未読メッセージ: 2件程度",
    "明日は会議なし",
    "期限まであと3日",
  ],
  chatMessage: "おっとり評価したところ、今日は安全にサボれますよ〜",
  personaId: "saboru_ottori",
  evaluatedAt: "2026-05-17T10:00:00Z",
  nextCheckAt: "2026-05-17T22:00:00Z",
  tokenCount: 1500,
};

const mockConnections: ServiceConnection[] = [
  {
    PK: "USER#test-sub",
    SK: "CONN#slack",
    service: "slack",
    status: "connected",
    secretArn:
      "arn:aws:secretsmanager:ap-northeast-1:123456789:secret/slack-token",
    connectedAt: "2026-05-17T00:00:00Z",
    expiresAt: null,
  },
];

export const handlers = [
  // Users
  http.get("*/api/users/me", () => {
    return HttpResponse.json(mockUser);
  }),

  // Task Candidates
  http.get("*/api/tasks/candidates", () => {
    return HttpResponse.json(mockCandidates);
  }),

  http.post("*/api/tasks/candidates/:id/approve", ({ params }) => {
    const newTask: Task = {
      PK: "USER#test-sub",
      SK: `TASK#${String(params["id"])}`,
      taskId: String(params["id"]),
      userId: "test-sub",
      status: "approved",
      title: "承認されたタスク",
      deadline: "2026-05-25T09:00:00Z",
      requester: "テスト",
      description: "テストタスク",
      sourceType: "slack",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(newTask);
  }),

  http.delete("*/api/tasks/candidates/:id", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Tasks
  http.get("*/api/tasks", () => {
    return HttpResponse.json(mockTasks);
  }),

  http.get("*/api/tasks/:id", ({ params }) => {
    const task = mockTasks.find((t) => t.taskId === params["id"]);
    if (!task) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(task);
  }),

  http.post("*/api/tasks", async ({ request }) => {
    const body = (await request.json()) as {
      title: string;
      deadline?: string | null;
      description?: string;
    };
    const newTask: Task = {
      PK: "USER#test-sub",
      SK: "TASK#01JDBT999",
      taskId: "01JDBT999",
      userId: "test-sub",
      status: "approved",
      title: body.title,
      deadline: body.deadline ?? null,
      requester: "manual",
      description: body.description ?? "",
      sourceType: "manual",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(newTask, { status: 201 });
  }),

  http.patch("*/api/tasks/:id", async ({ params, request }) => {
    const body = (await request.json()) as Partial<Task>;
    const task = mockTasks.find((t) => t.taskId === params["id"]);
    if (!task) return new HttpResponse(null, { status: 404 });
    const updated = { ...task, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json(updated);
  }),

  http.delete("*/api/tasks/:id", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Proposals
  http.get("*/api/tasks/:id/proposal", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get("stream") === "true") {
      // SSE モック
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"role":"assistant","content":"おっとり"}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"role":"assistant","content":"評価しました。今日はサボれます！"}\n\n',
            ),
          );
          controller.close();
        },
      });
      return new HttpResponse(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }
    return HttpResponse.json(mockProposal);
  }),

  http.post("*/api/tasks/:id/honne", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Connections
  http.get("*/api/connections", () => {
    return HttpResponse.json(mockConnections);
  }),

  http.delete("*/api/connections/:service", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
