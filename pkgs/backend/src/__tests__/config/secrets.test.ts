/**
 * Secrets Manager モジュールスコープキャッシュ (config/secrets.ts) のテスト
 *
 * テスト内容:
 * - Cache MISS: 初回呼び出しは Secrets Manager から取得しキャッシュする
 * - Cache HIT: 2 回目はキャッシュ値を返す（再取得なし）
 * - fetchSecret エラー: SecretString がない場合は例外をスロー
 * - _resetSecretsCache: キャッシュをクリアし次回呼び出しで再取得する
 *
 * 実装メモ:
 * vi.mock() はテストコードより前に Vitest によってホイストされるため、ファクトリ内で
 * テストローカル変数を参照できない。そのため vi.hoisted() でファクトリとテスト両方が
 * 共有できる可変モックを作成し、vi.resetModules() でテスト間にモジュールを再ロードし
 * モジュールレベルキャッシュを毎回リセットする。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ファクトリとテスト本体が同じ参照を共有するためホイストされた可変モックを作成
const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  // `new SecretsManagerClient()` が動作するようクラス (関数コンストラクタ) にする必要あり
  SecretsManagerClient: class {
    send = sendMock;
  },
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
  CreateSecretCommand: class {
    constructor(public input: unknown) {}
  },
  UpdateSecretCommand: class {
    constructor(public input: unknown) {}
  },
}));

const SIGNING_SECRET = "my-signing-secret";
const CLIENT_SECRET = "my-client-secret";

describe("getSlackSigningSecret", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("fetches from Secrets Manager on cache MISS", async () => {
    sendMock.mockResolvedValue({ SecretString: SIGNING_SECRET });

    const { getSlackSigningSecret } = await import("../../config/secrets.js");
    const result = await getSlackSigningSecret("arn:test:signing");
    expect(result).toBe(SIGNING_SECRET);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("returns cached value on cache HIT (no second Secrets Manager call)", async () => {
    sendMock.mockResolvedValue({ SecretString: SIGNING_SECRET });

    const { getSlackSigningSecret } = await import("../../config/secrets.js");
    await getSlackSigningSecret("arn:test:signing");
    await getSlackSigningSecret("arn:test:signing");
    // 2 回呼んでも 1 回しかフェッチされない (2 回目はキャッシュ HIT)
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("throws when SecretString is missing from Secrets Manager response", async () => {
    sendMock.mockResolvedValue({}); // no SecretString

    const { getSlackSigningSecret } = await import("../../config/secrets.js");
    await expect(getSlackSigningSecret("arn:test:signing")).rejects.toThrow(
      "has no SecretString",
    );
  });
});

describe("getSlackClientSecret", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("fetches and caches client secret", async () => {
    sendMock.mockResolvedValue({ SecretString: CLIENT_SECRET });

    const { getSlackClientSecret } = await import("../../config/secrets.js");
    const result = await getSlackClientSecret("arn:test:client");
    expect(result).toBe(CLIENT_SECRET);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("returns cached value on cache HIT for client secret", async () => {
    sendMock.mockResolvedValue({ SecretString: CLIENT_SECRET });

    const { getSlackClientSecret } = await import("../../config/secrets.js");
    await getSlackClientSecret("arn:test:client");
    await getSlackClientSecret("arn:test:client");
    expect(sendMock).toHaveBeenCalledOnce();
  });
});

describe("_resetSecretsCache", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("clears the signing secret cache so next call fetches again", async () => {
    sendMock.mockResolvedValue({ SecretString: SIGNING_SECRET });

    const { getSlackSigningSecret, _resetSecretsCache } = await import(
      "../../config/secrets.js"
    );
    await getSlackSigningSecret("arn:test:signing"); // fetch #1
    _resetSecretsCache(); // clear cache
    await getSlackSigningSecret("arn:test:signing"); // fetch #2
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});

// ─── Google 関連テスト ───────────────────────────────────────────────────────

const GOOGLE_CLIENT_SECRET = JSON.stringify({
  clientId: "google-client-id",
  clientSecret: "google-client-secret-value",
});

const GOOGLE_TOKEN_SECRET = JSON.stringify({
  refreshToken: "refresh-token-value",
  accessToken: "access-token-value",
  expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  scope: "https://www.googleapis.com/auth/gmail.readonly",
});

describe("getGoogleClientSecret", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("初回呼び出しは Secrets Manager から取得してキャッシュする", async () => {
    sendMock.mockResolvedValue({ SecretString: GOOGLE_CLIENT_SECRET });

    const { getGoogleClientSecret } = await import("../../config/secrets.js");
    const result = await getGoogleClientSecret("arn:test:google:client");
    expect(result).toBe(GOOGLE_CLIENT_SECRET);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("2回目はキャッシュ値を返す（Secrets Manager 呼び出しなし）", async () => {
    sendMock.mockResolvedValue({ SecretString: GOOGLE_CLIENT_SECRET });

    const { getGoogleClientSecret } = await import("../../config/secrets.js");
    await getGoogleClientSecret("arn:test:google:client");
    await getGoogleClientSecret("arn:test:google:client");
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("SecretString がない場合は例外をスローする", async () => {
    sendMock.mockResolvedValue({}); // SecretString なし

    const { getGoogleClientSecret } = await import("../../config/secrets.js");
    await expect(
      getGoogleClientSecret("arn:test:google:client"),
    ).rejects.toThrow("has no SecretString");
  });
});

describe("getGoogleToken / getCachedGoogleAccessToken", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("getGoogleToken で Secrets Manager からトークンを取得してパースする", async () => {
    sendMock.mockResolvedValue({ SecretString: GOOGLE_TOKEN_SECRET });

    const { getGoogleToken } = await import("../../config/secrets.js");
    const result = await getGoogleToken("user1", "saborou/google-token/user1");
    expect(result.refreshToken).toBe("refresh-token-value");
    expect(result.accessToken).toBe("access-token-value");
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("getGoogleToken 後に getCachedGoogleAccessToken でキャッシュ値を取得できる", async () => {
    sendMock.mockResolvedValue({ SecretString: GOOGLE_TOKEN_SECRET });

    const { getGoogleToken, getCachedGoogleAccessToken } = await import(
      "../../config/secrets.js"
    );
    await getGoogleToken("user1", "saborou/google-token/user1");
    const cached = getCachedGoogleAccessToken("user1");
    expect(cached).not.toBeNull();
    expect(cached?.accessToken).toBe("access-token-value");
  });

  it("未取得のユーザーは getCachedGoogleAccessToken で null を返す", async () => {
    const { getCachedGoogleAccessToken } = await import(
      "../../config/secrets.js"
    );
    const cached = getCachedGoogleAccessToken("unknown-user");
    expect(cached).toBeNull();
  });
});

describe("saveGoogleToken", () => {
  // saveGoogleToken は SecretsManagerClient を内部で直接 new するため
  // vi.mock で @aws-sdk/client-secrets-manager 全体をモックする
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("新規シークレット作成が成功する場合（CreateSecret）ARN を返す", async () => {
    // CreateSecret 成功: ARN を返す
    sendMock.mockResolvedValue({ ARN: "arn:aws:secretsmanager:test:secret" });

    // saveGoogleToken が呼ぶ SecretsManagerClient もモック済み（vi.mock ホイストにより）
    // ただし saveGoogleToken は新しい SecretsManagerClient を内部で生成するため
    // クラスコンストラクタモックが send を共有していれば OK
    const { saveGoogleToken, getCachedGoogleAccessToken } = await import(
      "../../config/secrets.js"
    );
    const tokenData = {
      refreshToken: "rt",
      accessToken: "at",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: "gmail.readonly",
    };

    const arn = await saveGoogleToken(
      "user1",
      "saborou/google-token/user1",
      tokenData,
    );
    expect(arn).toBe("arn:aws:secretsmanager:test:secret");

    // in-memory キャッシュも更新される
    const cached = getCachedGoogleAccessToken("user1");
    expect(cached?.accessToken).toBe("at");
  });

  it("ResourceExistsException の場合は UpdateSecret にフォールバックして ARN を返す", async () => {
    // 1回目（CreateSecret）: ResourceExistsException をスロー
    // 2回目（UpdateSecret）: 成功
    sendMock
      .mockRejectedValueOnce(
        Object.assign(new Error("Already exists"), {
          name: "ResourceExistsException",
        }),
      )
      .mockResolvedValueOnce({ ARN: "arn:aws:secretsmanager:test:updated" });

    const { saveGoogleToken } = await import("../../config/secrets.js");
    const tokenData = {
      refreshToken: "rt",
      accessToken: "at2",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: "gmail.readonly",
    };

    const arn = await saveGoogleToken(
      "user2",
      "saborou/google-token/user2",
      tokenData,
    );
    expect(arn).toBe("arn:aws:secretsmanager:test:updated");
    // CreateSecret + UpdateSecret の 2 回呼ばれる
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("CreateSecret 成功時に ARN が undefined の場合は secretName をフォールバックとして返す", async () => {
    // ARN を含まないレスポンス
    sendMock.mockResolvedValue({});

    const { saveGoogleToken } = await import("../../config/secrets.js");
    const tokenData = {
      refreshToken: "rt",
      accessToken: "at",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: "gmail.readonly",
    };

    const result = await saveGoogleToken(
      "user-no-arn",
      "saborou/google-token/user-no-arn",
      tokenData,
    );
    // ARN がないので secretName を返す
    expect(result).toBe("saborou/google-token/user-no-arn");
  });

  it("UpdateSecret 時に ARN が undefined の場合は secretName をフォールバックとして返す", async () => {
    sendMock
      .mockRejectedValueOnce(
        Object.assign(new Error("Already exists"), {
          name: "ResourceExistsException",
        }),
      )
      .mockResolvedValueOnce({}); // ARN なし

    const { saveGoogleToken } = await import("../../config/secrets.js");
    const tokenData = {
      refreshToken: "rt",
      accessToken: "at",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: "gmail.readonly",
    };

    const result = await saveGoogleToken(
      "user-update-no-arn",
      "saborou/google-token/user-update-no-arn",
      tokenData,
    );
    expect(result).toBe("saborou/google-token/user-update-no-arn");
  });

  it("ResourceExistsException 以外のエラーは再スローする", async () => {
    sendMock.mockRejectedValue(
      Object.assign(new Error("Access denied"), {
        name: "AccessDeniedException",
      }),
    );

    const { saveGoogleToken } = await import("../../config/secrets.js");
    const tokenData = {
      refreshToken: "rt",
      accessToken: "at3",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: "gmail.readonly",
    };

    await expect(
      saveGoogleToken("user3", "saborou/google-token/user3", tokenData),
    ).rejects.toThrow("Access denied");
  });
});

describe("_resetSecretsCache — Google キャッシュクリア", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMock.mockReset();
  });

  it("_resetSecretsCache でキャッシュをクリアすると次回再取得する", async () => {
    sendMock.mockResolvedValue({ SecretString: GOOGLE_CLIENT_SECRET });

    const { getGoogleClientSecret, _resetSecretsCache } = await import(
      "../../config/secrets.js"
    );
    await getGoogleClientSecret("arn:test:google:client"); // fetch #1
    _resetSecretsCache(); // キャッシュクリア
    await getGoogleClientSecret("arn:test:google:client"); // fetch #2
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("_resetSecretsCache で googleTokenCache もクリアされる", async () => {
    sendMock.mockResolvedValue({ SecretString: GOOGLE_TOKEN_SECRET });

    const { getGoogleToken, getCachedGoogleAccessToken, _resetSecretsCache } =
      await import("../../config/secrets.js");
    await getGoogleToken("user1", "saborou/google-token/user1");
    expect(getCachedGoogleAccessToken("user1")).not.toBeNull();

    _resetSecretsCache();
    expect(getCachedGoogleAccessToken("user1")).toBeNull();
  });
});
