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
