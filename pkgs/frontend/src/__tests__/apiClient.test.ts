import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import apiClient, {
  ApiError,
  getMe,
  getCandidates,
  approveCandidate,
  rejectCandidate,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  createTask,
  getProposal,
  submitHonne,
  getConnections,
  disconnectService,
  buildProposalStreamUrl,
} from "@/lib/apiClient";
import { clearTokens, setAccessToken, setRefreshToken } from "@/lib/cognito";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";

vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");

describe("apiClient — 正常系エンドポイント", () => {
  beforeEach(() => {
    setAccessToken("test-access-token", 3600);
  });

  afterEach(() => {
    clearTokens();
  });

  it("GET /api/users/me でユーザーを取得できる", async () => {
    const user = await apiClient.getMe();
    expect(user.cognitoSub).toBe("test-sub");
    expect(user.email).toBe("test@example.com");
  });

  it("getMe 名前付きエクスポートでも動作する", async () => {
    const user = await getMe();
    expect(user.cognitoSub).toBe("test-sub");
  });

  it("GET /api/tasks で一覧を取得できる", async () => {
    const tasks = await apiClient.getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("全員向けミーティング資料");
  });

  it("getTasks 名前付きエクスポートでも動作する", async () => {
    const tasks = await getTasks();
    expect(tasks).toHaveLength(1);
  });

  it("GET /api/tasks/:id で単一タスクを取得できる", async () => {
    const task = await apiClient.getTask("01JDBT001");
    expect(task.taskId).toBe("01JDBT001");
    expect(task.status).toBe("approved");
  });

  it("getTask 名前付きエクスポートでも動作する", async () => {
    const task = await getTask("01JDBT001");
    expect(task.taskId).toBe("01JDBT001");
  });

  it("GET /api/tasks/candidates で候補一覧を取得できる", async () => {
    const candidates = await apiClient.getCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe("pending");
  });

  it("getCandidates 名前付きエクスポートでも動作する", async () => {
    const candidates = await getCandidates();
    expect(candidates).toHaveLength(1);
  });

  it("POST /api/tasks/candidates/:id/approve で承認できる", async () => {
    const task = await apiClient.approveCandidate("01JDBC001");
    expect(task.taskId).toBeTruthy();
  });

  it("approveCandidate 名前付きエクスポートでも動作する", async () => {
    const task = await approveCandidate("01JDBC001");
    expect(task.taskId).toBeTruthy();
  });

  it("DELETE /api/tasks/candidates/:id で候補を削除できる（204 No Content）", async () => {
    const result = await apiClient.rejectCandidate("01JDBC001");
    expect(result).toBeUndefined();
  });

  it("rejectCandidate 名前付きエクスポートでも動作する", async () => {
    const result = await rejectCandidate("01JDBC001");
    expect(result).toBeUndefined();
  });

  it("PATCH /api/tasks/:id でタスクを更新できる", async () => {
    const updated = await apiClient.updateTask("01JDBT001", {
      title: "更新タスク",
    });
    expect(updated.taskId).toBe("01JDBT001");
  });

  it("updateTask 名前付きエクスポートでも動作する", async () => {
    const updated = await updateTask("01JDBT001", { title: "更新タスク2" });
    expect(updated.taskId).toBe("01JDBT001");
  });

  it("DELETE /api/tasks/:id でタスクを削除できる（204 No Content）", async () => {
    const result = await apiClient.deleteTask("01JDBT001");
    expect(result).toBeUndefined();
  });

  it("deleteTask 名前付きエクスポートでも動作する", async () => {
    const result = await deleteTask("01JDBT001");
    expect(result).toBeUndefined();
  });

  it("POST /api/tasks で手動タスクを作成できる", async () => {
    const task = await apiClient.createTask({
      title: "新タスク",
      deadline: "2026-06-01T09:00:00Z",
      description: "説明",
    });
    expect(task.title).toBe("新タスク");
    expect(task.taskId).toBeTruthy();
  });

  it("createTask 名前付きエクスポートでも動作する（任意フィールドなし）", async () => {
    const task = await createTask({ title: "必須のみ" });
    expect(task.title).toBe("必須のみ");
  });

  it("GET /api/tasks/:id/proposal で提案を取得できる", async () => {
    const proposal = await apiClient.getProposal("01JDBT001");
    expect(proposal?.verdict).toBe("can_saboru");
  });

  it("getProposal 名前付きエクスポートでも動作する", async () => {
    const proposal = await getProposal("01JDBT001");
    expect(proposal?.verdict).toBe("can_saboru");
  });

  it("404 のとき getProposal は null を返す", async () => {
    server.use(
      http.get("*/api/tasks/no-proposal/proposal", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const proposal = await apiClient.getProposal("no-proposal");
    expect(proposal).toBeNull();
  });

  it("POST /api/tasks/:id/honne でフィードバックを送信できる（204）", async () => {
    const result = await apiClient.submitHonne("01JDBT001", {
      type: "quick_reply",
      content: "了解",
    });
    expect(result).toBeUndefined();
  });

  it("submitHonne 名前付きエクスポートでも動作する（free_text）", async () => {
    const result = await submitHonne("01JDBT001", {
      type: "free_text",
      content: "詳細なフィードバック",
    });
    expect(result).toBeUndefined();
  });

  it("GET /api/connections で連携情報を取得できる", async () => {
    const connections = await apiClient.getConnections();
    expect(connections).toHaveLength(1);
    expect(connections[0].service).toBe("slack");
  });

  it("getConnections 名前付きエクスポートでも動作する", async () => {
    const connections = await getConnections();
    expect(connections[0].status).toBe("connected");
  });

  it("DELETE /api/connections/:service でサービス連携を解除できる（204）", async () => {
    const result = await apiClient.disconnectService("slack");
    expect(result).toBeUndefined();
  });

  it("disconnectService 名前付きエクスポートでも動作する", async () => {
    const result = await disconnectService("slack");
    expect(result).toBeUndefined();
  });
});

describe("apiClient — エラー系", () => {
  beforeEach(() => {
    setAccessToken("test-access-token", 3600);
  });

  afterEach(() => {
    clearTokens();
  });

  it("404 エラーで ApiError がスローされる", async () => {
    server.use(
      http.get("*/api/tasks/nonexistent", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );
    await expect(apiClient.getTask("nonexistent")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("500 エラーで ApiError がスローされる（JSONボディあり）", async () => {
    server.use(
      http.get("*/api/users/me", () => {
        return HttpResponse.json(
          { message: "Internal Server Error" },
          { status: 500 },
        );
      }),
    );
    const err = (await getMe().catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.isServerError()).toBe(true);
    expect(err.body).toEqual({ message: "Internal Server Error" });
  });

  it("500 エラーで ApiError がスローされる（非JSONボディ）", async () => {
    server.use(
      http.get("*/api/users/me", () => {
        return new HttpResponse("Internal Server Error text", { status: 500 });
      }),
    );
    const err = (await getMe().catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    // 非JSONパース失敗時はbody=null
    expect(err.body).toBeNull();
  });

  it("400 エラーで ApiError がスローされる", async () => {
    server.use(
      http.post("*/api/tasks", () => {
        return HttpResponse.json({ error: "Bad Request" }, { status: 400 });
      }),
    );
    const err = (await createTask({ title: "test" }).catch(
      (e) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.isUnauthorized()).toBe(false);
    expect(err.isNotFound()).toBe(false);
    expect(err.isServerError()).toBe(false);
  });

  it("getProposal で404以外のエラーはそのまま再スローされる", async () => {
    server.use(
      http.get("*/api/tasks/server-error/proposal", () => {
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await expect(getProposal("server-error")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("apiClient — 401 自動トークンリフレッシュ", () => {
  afterEach(() => {
    clearTokens();
  });

  it("401時にリフレッシュトークンがあれば再リクエストを行う", async () => {
    // リフレッシュトークンをセット
    setRefreshToken("valid-refresh-token");

    // アクセストークンはない状態（401が返る）にするため期限切れに設定
    setAccessToken("expired-token", 0);

    let callCount = 0;
    server.use(
      http.get("*/api/users/me", () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
          PK: "USER#test-sub",
          SK: "PROFILE",
          cognitoSub: "test-sub",
          email: "test@example.com",
          name: "田中 ユカ",
          createdAt: "2026-05-17T00:00:00Z",
          updatedAt: "2026-05-17T00:00:00Z",
        });
      }),
      http.post("*/oauth2/token", () => {
        return HttpResponse.json({
          access_token: "new-access-token",
          expires_in: 3600,
        });
      }),
    );

    // リフレッシュ成功 → 2回目のリクエストで成功
    const user = await getMe();
    expect(user.cognitoSub).toBe("test-sub");
  });

  it("401時にリフレッシュ失敗ならclearTokensしてApiErrorをスロー", async () => {
    clearTokens();
    setRefreshToken("invalid-refresh-token");
    setAccessToken("token", 3600);

    // window.location.hrefへの代入をモック
    const originalLocation = window.location;
    const locationMock = { href: "" } as Location;
    vi.stubGlobal("location", locationMock);

    server.use(
      http.get("*/api/users/me", () => {
        return new HttpResponse(null, { status: 401 });
      }),
      http.post("*/oauth2/token", () => {
        return new HttpResponse(null, { status: 400 });
      }),
    );

    await expect(getMe()).rejects.toBeInstanceOf(ApiError);

    // location.hrefが/loginに設定されているか
    expect(locationMock.href).toBe("/login");

    vi.stubGlobal("location", originalLocation);
  });

  it("トークンなし状態でリクエストするとAuthorizationヘッダーなしで送信される", async () => {
    clearTokens();
    let receivedAuthHeader: string | null = null;

    server.use(
      http.get("*/api/users/me", ({ request }) => {
        receivedAuthHeader = request.headers.get("authorization");
        return HttpResponse.json({
          PK: "USER#test-sub",
          SK: "PROFILE",
          cognitoSub: "test-sub",
          email: "test@example.com",
          name: "田中 ユカ",
          createdAt: "2026-05-17T00:00:00Z",
          updatedAt: "2026-05-17T00:00:00Z",
        });
      }),
    );

    await getMe();
    expect(receivedAuthHeader).toBeNull();
  });

  it("有効なトークンがあればAuthorizationヘッダーを付与する", async () => {
    setAccessToken("valid-token-123", 3600);
    let receivedAuthHeader: string | null = null;

    server.use(
      http.get("*/api/users/me", ({ request }) => {
        receivedAuthHeader = request.headers.get("authorization");
        return HttpResponse.json({
          PK: "USER#test-sub",
          SK: "PROFILE",
          cognitoSub: "test-sub",
          email: "test@example.com",
          name: "田中 ユカ",
          createdAt: "2026-05-17T00:00:00Z",
          updatedAt: "2026-05-17T00:00:00Z",
        });
      }),
    );

    await getMe();
    expect(receivedAuthHeader).toBe("Bearer valid-token-123");
  });
});

describe("ApiError クラス", () => {
  it("isUnauthorized が 401 で true を返す", () => {
    const err = new ApiError(401, null);
    expect(err.isUnauthorized()).toBe(true);
    expect(err.isNotFound()).toBe(false);
    expect(err.isServerError()).toBe(false);
  });

  it("isNotFound が 404 で true を返す", () => {
    const err = new ApiError(404, null);
    expect(err.isNotFound()).toBe(true);
    expect(err.isUnauthorized()).toBe(false);
    expect(err.isServerError()).toBe(false);
  });

  it("isServerError が 500 で true を返す", () => {
    const err = new ApiError(500, { message: "Internal Server Error" });
    expect(err.isServerError()).toBe(true);
    expect(err.isUnauthorized()).toBe(false);
    expect(err.isNotFound()).toBe(false);
  });

  it("isServerError が 503 で true を返す", () => {
    const err = new ApiError(503, null);
    expect(err.isServerError()).toBe(true);
  });

  it("nameが ApiError に設定される", () => {
    const err = new ApiError(400, "Bad Request");
    expect(err.name).toBe("ApiError");
  });

  it("status と body が正しく設定される", () => {
    const body = { detail: "validation error" };
    const err = new ApiError(422, body);
    expect(err.status).toBe(422);
    expect(err.body).toEqual(body);
  });

  it("Error を継承している", () => {
    const err = new ApiError(400, null);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("API Error: 400");
  });
});

describe("buildProposalStreamUrl", () => {
  it("stream=trueパラメータとタスクIDを含むURLを構築する", () => {
    setAccessToken("stream-token", 3600);
    const url = buildProposalStreamUrl("task-123");
    expect(url).toContain("stream=true");
    expect(url).toContain("/api/tasks/task-123/proposal");
    // access_token はURLではなくAuthorizationヘッダーで渡す（FE-C-1修正）
    expect(url).not.toContain("access_token=");
  });

  it("トークンなしでもURLは正しく構築される", () => {
    clearTokens();
    const url = buildProposalStreamUrl("task-456");
    expect(url).toContain("stream=true");
    expect(url).toContain("/api/tasks/task-456/proposal");
    expect(url).not.toContain("access_token=");
  });
});
