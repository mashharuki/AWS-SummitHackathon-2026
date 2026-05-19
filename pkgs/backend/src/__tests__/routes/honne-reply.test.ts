/**
 * honne-reply サービスのテスト
 */

import { describe, expect, it } from "vitest";
import {
  getFreeTextReply,
  getQuickReplyMessage,
} from "../../services/honne-reply.js";

describe("getQuickReplyMessage", () => {
  it("returns message for truly_tired", () => {
    const msg = getQuickReplyMessage("truly_tired");
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(5);
  });

  it("returns message for actually_important", () => {
    const msg = getQuickReplyMessage("actually_important");
    expect(msg).toBeTruthy();
  });

  it("returns message for agree_with_ai", () => {
    const msg = getQuickReplyMessage("agree_with_ai");
    expect(msg).toBeTruthy();
  });

  it("returns message for disagree_with_ai", () => {
    const msg = getQuickReplyMessage("disagree_with_ai");
    expect(msg).toBeTruthy();
  });

  it("returns fallback message for unknown type (type coercion via cast)", () => {
    // The ?? fallback branch in getQuickReplyMessage is reached when the key
    // is not in QUICK_REPLY_MESSAGES. In practice this cannot happen with the
    // QuickReplyType union, but we test it by casting to force the branch.
    const msg = getQuickReplyMessage(
      "unknown_type" as Parameters<typeof getQuickReplyMessage>[0],
    );
    expect(msg).toBe("うんうん、気持ちわかるよ。ゆっくりしてね。");
  });
});

describe("getFreeTextReply", () => {
  it("returns short reply for short text (<20 chars)", () => {
    const reply = getFreeTextReply("疲れた");
    expect(reply).toBeTruthy();
    expect(reply).toContain("十分");
  });

  it("returns longer reply for longer text (>=20 chars)", () => {
    const reply = getFreeTextReply(
      "今日はとにかく疲れて何もしたくない気持ちが続いています",
    );
    expect(reply).toBeTruthy();
    expect(reply).toContain("サボっていい");
  });

  it("boundary: exactly 20 chars returns long reply", () => {
    const text = "あ".repeat(20);
    const reply = getFreeTextReply(text);
    expect(reply).toContain("サボっていい");
  });

  it("empty string returns short reply", () => {
    const reply = getFreeTextReply("");
    expect(reply).toContain("十分");
  });

  it("19-char text returns short reply", () => {
    const text = "a".repeat(19);
    const reply = getFreeTextReply(text);
    expect(reply).toContain("十分");
  });
});
