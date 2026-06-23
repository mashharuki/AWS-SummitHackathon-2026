import { describe, expect, it } from "vitest";
import {
  DECLINE_DRAFT_SYSTEM_PROMPT,
  DECLINE_DRAFT_TOOL,
  DECLINE_DRAFT_TOOL_NAME,
  DeclineDraftSchema,
} from "../declineDraftTool.js";
import {
  REPLY_DRAFT_SYSTEM_PROMPT,
  REPLY_DRAFT_TOOL,
  REPLY_DRAFT_TOOL_NAME,
  ReplyDraftSchema,
} from "../replyDraftTool.js";

// ─────────────────────────────────────────────
// reply_draft tool / schema
// ─────────────────────────────────────────────

describe("reply_draft tool", () => {
  it("exposes the correct tool name", () => {
    expect(REPLY_DRAFT_TOOL_NAME).toBe("reply_draft");
    expect(REPLY_DRAFT_TOOL.toolSpec?.name).toBe(REPLY_DRAFT_TOOL_NAME);
  });

  it("declares replyText and reasoning as required", () => {
    const required = (
      REPLY_DRAFT_TOOL.toolSpec?.inputSchema?.json as {
        required?: string[];
      }
    ).required;
    expect(required).toContain("replyText");
    expect(required).toContain("reasoning");
  });

  it("has a non-empty Japanese system prompt", () => {
    expect(REPLY_DRAFT_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    expect(REPLY_DRAFT_SYSTEM_PROMPT).toContain("ビジネス日本語");
  });

  it("uses Slack history as a user tone sample when available", () => {
    expect(REPLY_DRAFT_SYSTEM_PROMPT).toContain("過去のSlack会話");
    expect(REPLY_DRAFT_SYSTEM_PROMPT).toContain("ユーザー本人の普段の文体");
    expect(REPLY_DRAFT_SYSTEM_PROMPT).toContain("文体だけを参考");
  });
});

describe("ReplyDraftSchema — 正常系", () => {
  it("accepts a valid full payload", () => {
    const result = ReplyDraftSchema.safeParse({
      replyText:
        "お世話になっております。承知いたしました。明日中に対応いたします。",
      tone: "polite",
      reasoning: ["締切に余裕があり対応可能なため"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without optional tone", () => {
    const result = ReplyDraftSchema.safeParse({
      replyText: "承知しました。",
      reasoning: ["依頼内容が明確なため"],
    });
    expect(result.success).toBe(true);
  });
});

describe("ReplyDraftSchema — 異常系", () => {
  it("rejects empty replyText", () => {
    const result = ReplyDraftSchema.safeParse({
      replyText: "",
      reasoning: ["x"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing reasoning", () => {
    const result = ReplyDraftSchema.safeParse({ replyText: "ok" });
    expect(result.success).toBe(false);
  });

  it("rejects empty reasoning array", () => {
    const result = ReplyDraftSchema.safeParse({
      replyText: "ok",
      reasoning: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid tone enum value", () => {
    const result = ReplyDraftSchema.safeParse({
      replyText: "ok",
      tone: "angry",
      reasoning: ["x"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects replyText over max length", () => {
    const result = ReplyDraftSchema.safeParse({
      replyText: "あ".repeat(401),
      reasoning: ["x"],
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// decline_draft tool / schema
// ─────────────────────────────────────────────

describe("decline_draft tool", () => {
  it("exposes the correct tool name", () => {
    expect(DECLINE_DRAFT_TOOL_NAME).toBe("decline_draft");
    expect(DECLINE_DRAFT_TOOL.toolSpec?.name).toBe(DECLINE_DRAFT_TOOL_NAME);
  });

  it("declares declineText, declineReason and reasoning as required", () => {
    const required = (
      DECLINE_DRAFT_TOOL.toolSpec?.inputSchema?.json as {
        required?: string[];
      }
    ).required;
    expect(required).toContain("declineText");
    expect(required).toContain("declineReason");
    expect(required).toContain("reasoning");
  });

  it("has a non-empty Japanese system prompt", () => {
    expect(DECLINE_DRAFT_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    expect(DECLINE_DRAFT_SYSTEM_PROMPT).toContain("断る");
  });

  it("instructs concise user-like decline drafts with one apology emoji", () => {
    expect(DECLINE_DRAFT_SYSTEM_PROMPT).toContain(
      "ユーザー本人の普段の文体",
    );
    expect(DECLINE_DRAFT_SYSTEM_PROMPT).toContain("過去のSlack会話");
    expect(DECLINE_DRAFT_SYSTEM_PROMPT).toContain("180文字以内");
    expect(DECLINE_DRAFT_SYSTEM_PROMPT).toContain("絵文字を1つだけ");
  });
});

describe("DeclineDraftSchema — 正常系", () => {
  it("accepts a valid full payload", () => {
    const result = DeclineDraftSchema.safeParse({
      declineText:
        "せっかくのお声がけありがとうございます。あいにく現在他案件で手一杯のため、今回は見送らせてください。",
      declineReason: "現在進行中の案件で手一杯のため",
      alternative: "来週以降であれば対応可能です",
      reasoning: ["締切間近の案件を3件抱えているため"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without optional alternative", () => {
    const result = DeclineDraftSchema.safeParse({
      declineText: "申し訳ありませんが今回は見送らせてください。",
      declineReason: "負荷が高いため",
      reasoning: ["負荷が高いため"],
    });
    expect(result.success).toBe(true);
  });
});

describe("DeclineDraftSchema — 異常系", () => {
  it("rejects empty declineText", () => {
    const result = DeclineDraftSchema.safeParse({
      declineText: "",
      declineReason: "x",
      reasoning: ["x"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing declineReason", () => {
    const result = DeclineDraftSchema.safeParse({
      declineText: "ok",
      reasoning: ["x"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects declineReason over max length", () => {
    const result = DeclineDraftSchema.safeParse({
      declineText: "ok",
      declineReason: "あ".repeat(81),
      reasoning: ["x"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty reasoning array", () => {
    const result = DeclineDraftSchema.safeParse({
      declineText: "ok",
      declineReason: "x",
      reasoning: [],
    });
    expect(result.success).toBe(false);
  });
});
