/**
 * oauthState ユーティリティのテスト
 *
 * テスト内容:
 * - encodeState / verifyState: 正常系・改ざん検知・有効期限切れ・型不正
 * - STATE_MAX_AGE_MS: 有効期限定数の確認
 */

import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  STATE_MAX_AGE_MS,
  encodeState,
  verifyState,
} from "../../utils/oauthState.js";

const SECRET = "test-secret-key-for-hmac-sha256";
const USER_ID = "user-oauth-test-001";

describe("oauthState.encodeState / verifyState — 正常系", () => {
  it("正しい secret で encode した state を verify できる", () => {
    const state = encodeState(USER_ID, SECRET);
    const result = verifyState(state, SECRET);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(USER_ID);
  });

  it("毎回異なる nonce で異なる state を生成する（一意性）", () => {
    const state1 = encodeState(USER_ID, SECRET);
    const state2 = encodeState(USER_ID, SECRET);
    expect(state1).not.toBe(state2);
  });
});

describe("oauthState.verifyState — 改ざん検知", () => {
  it("別の secret で生成した state は検証失敗する", () => {
    const state = encodeState(USER_ID, "wrong-secret");
    const result = verifyState(state, SECRET);
    expect(result).toBeNull();
  });

  it("state 文字列を改ざんした場合は null を返す", () => {
    const state = encodeState(USER_ID, SECRET);
    const tampered = `${state.slice(0, -5)}XXXXX`;
    const result = verifyState(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("不正な base64url 文字列は null を返す", () => {
    const result = verifyState("not-valid-base64url!!!", SECRET);
    expect(result).toBeNull();
  });

  it("payload に userId が含まれない（型不正）場合は null を返す", () => {
    // issuedAt はあるが userId がない payload を手動で作成
    const payload = JSON.stringify({ nonce: "x", issuedAt: Date.now() });
    const mac = createHmac("sha256", SECRET).update(payload).digest("hex");
    const state = Buffer.from(JSON.stringify({ payload, mac })).toString(
      "base64url",
    );
    const result = verifyState(state, SECRET);
    expect(result).toBeNull();
  });

  it("payload に issuedAt が含まれない（型不正）場合は null を返す", () => {
    // userId はあるが issuedAt がない payload（古い形式）を手動で作成
    const payload = JSON.stringify({ userId: USER_ID, nonce: "x" });
    const mac = createHmac("sha256", SECRET).update(payload).digest("hex");
    const state = Buffer.from(JSON.stringify({ payload, mac })).toString(
      "base64url",
    );
    const result = verifyState(state, SECRET);
    expect(result).toBeNull();
  });
});

describe("oauthState.verifyState — 有効期限チェック", () => {
  it("有効期限内（9分後生成）の state は検証成功する", () => {
    // 9分前に発行されたとして issuedAt を偽装
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValueOnce(now - 9 * 60 * 1000); // encode 時
    const state = encodeState(USER_ID, SECRET);
    vi.restoreAllMocks();

    const result = verifyState(state, SECRET);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(USER_ID);
  });

  it("有効期限切れ（11分前発行）の state は null を返す", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValueOnce(now - 11 * 60 * 1000); // encode 時
    const state = encodeState(USER_ID, SECRET);
    vi.restoreAllMocks();

    const result = verifyState(state, SECRET);
    expect(result).toBeNull();
  });
});

describe("oauthState.STATE_MAX_AGE_MS", () => {
  it("STATE_MAX_AGE_MS は 10分（600000ms）である", () => {
    expect(STATE_MAX_AGE_MS).toBe(10 * 60 * 1000);
  });
});
