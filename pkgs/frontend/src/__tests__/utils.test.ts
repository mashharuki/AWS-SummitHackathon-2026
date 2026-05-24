import i18n from "@/i18n";
import {
  cn,
  formatDateJa,
  formatDeadlineDisplay,
  getDisplayName,
  isOverdue,
  toUserMessage,
} from "@/lib/utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("cn", () => {
  it("クラス名をマージする", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("条件付きクラスを処理する", () => {
    expect(cn("base", { active: true, inactive: false })).toBe("base active");
  });

  it("Tailwindの重複クラスを解決する", () => {
    expect(cn("px-4 px-6")).toBe("px-6");
  });
});

describe("formatDateJa", () => {
  it("nullを「未定」と表示する", () => {
    expect(formatDateJa(null)).toBe("未定");
  });

  it("今日の日付を「今日」と表示する", () => {
    const today = new Date();
    // 今日の15:00に設定（UTCずれを考慮）
    today.setHours(15, 0, 0, 0);
    const result = formatDateJa(today.toISOString());
    // 「今日」または「明日」（時差により変わる場合がある）
    expect(["今日", "明日"]).toContain(result);
  });

  it("明日の日付を「明日」と表示する", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);
    const result = formatDateJa(tomorrow.toISOString());
    expect(["明日", "2日後"]).toContain(result);
  });

  it("5日後を「N日後」と表示する", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    future.setHours(12, 0, 0, 0);
    const result = formatDateJa(future.toISOString());
    expect(result).toMatch(/日後/);
  });

  it("過去の日付を「N日超過」と表示する", () => {
    const past = new Date();
    past.setDate(past.getDate() - 2);
    const result = formatDateJa(past.toISOString());
    expect(result).toMatch(/日超過/);
  });
});

describe("formatDeadlineDisplay", () => {
  it("nullを「期限未定」と表示する", () => {
    expect(formatDeadlineDisplay(null)).toBe("期限未定");
  });

  it("ISO文字列をYYYY/M/D形式に変換する", () => {
    expect(formatDeadlineDisplay("2026-05-20T09:00:00Z")).toMatch(
      /2026\/5\/\d+/,
    );
  });
});

describe("isOverdue", () => {
  it("nullはfalseを返す", () => {
    expect(isOverdue(null)).toBe(false);
  });

  it("過去の日付はtrueを返す", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    expect(isOverdue(past)).toBe(true);
  });

  it("未来の日付はfalseを返す", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    expect(isOverdue(future)).toBe(false);
  });
});

describe("toUserMessage", () => {
  it("一般エラーのデフォルトメッセージ", () => {
    const msg = toUserMessage(new Error("unknown"));
    expect(msg).toBeTruthy();
  });

  it("401エラーのメッセージ", () => {
    const err = new Error("401 Unauthorized");
    expect(toUserMessage(err)).toContain("セッション");
  });

  it("404エラーのメッセージ", () => {
    const err = new Error("404 Not Found");
    expect(toUserMessage(err)).toContain("見つかりませんでした");
  });

  it("typeErrorのメッセージ", () => {
    const msg = toUserMessage(new TypeError("network"));
    expect(msg).toContain("接続");
  });

  it("非Errorオブジェクト", () => {
    const msg = toUserMessage({ code: 500 });
    expect(msg).toBeTruthy();
  });

  it("500エラーのメッセージ", () => {
    const err = new Error("500 Internal Server Error");
    expect(toUserMessage(err)).toContain("サーバーエラー");
  });
});

describe("toUserMessage — 英語ブランチ", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    await i18n.changeLanguage("ja");
  });

  it("401エラー（英語）", () => {
    expect(toUserMessage(new Error("401 Unauthorized"))).toContain(
      "Session expired",
    );
  });

  it("404エラー（英語）", () => {
    expect(toUserMessage(new Error("404 Not Found"))).toContain("not found");
  });

  it("500エラー（英語）", () => {
    expect(toUserMessage(new Error("500 Internal Server Error"))).toContain(
      "Server error",
    );
  });

  it("TypeError（英語）", () => {
    expect(toUserMessage(new TypeError("network"))).toContain(
      "Connection failed",
    );
  });

  it("一般エラー（英語）", () => {
    expect(toUserMessage({ code: 500 })).toContain("unexpected error");
  });
});

describe("getDisplayName", () => {
  it("UUID形式のnameはメールアドレスのプレフィックスを返す", () => {
    const result = getDisplayName({
      name: "123e4567-e89b-12d3-a456-426614174000",
      email: "user@example.com",
    });
    expect(result).toBe("user");
  });

  it("UUID形式でemailが空の場合「ユーザー」を返す", () => {
    const result = getDisplayName({
      name: "123e4567-e89b-12d3-a456-426614174000",
      email: "",
    });
    expect(result).toBe("ユーザー");
  });

  it("UUID形式でないnameはそのまま返す", () => {
    const result = getDisplayName({
      name: "田中 ユカ",
      email: "user@example.com",
    });
    expect(result).toBe("田中 ユカ");
  });
});
