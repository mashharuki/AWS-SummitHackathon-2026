import { describe, expect, it } from "vitest";
import {
  CreateHonneSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
} from "../index";

describe("CreateTaskSchema", () => {
  it("should pass with valid minimal input (title only)", () => {
    const result = CreateTaskSchema.safeParse({ title: "Test task" });
    expect(result.success).toBe(true);
  });

  it("should pass with all fields valid", () => {
    const result = CreateTaskSchema.safeParse({
      title: "Test task",
      deadline: "2026-06-01T09:00:00Z",
      description: "This is a test task description",
    });
    expect(result.success).toBe(true);
  });

  it("should pass with null deadline", () => {
    const result = CreateTaskSchema.safeParse({
      title: "Test task",
      deadline: null,
    });
    expect(result.success).toBe(true);
  });

  it("should fail when title is empty", () => {
    const result = CreateTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("タスク名は必須です");
    }
  });

  it("should fail when title exceeds 200 characters", () => {
    const result = CreateTaskSchema.safeParse({ title: "a".repeat(201) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("200文字以内");
    }
  });

  it("should fail when title is missing", () => {
    const result = CreateTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should fail when deadline is invalid format", () => {
    const result = CreateTaskSchema.safeParse({
      title: "Test",
      deadline: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("should fail when description exceeds 1000 characters", () => {
    const result = CreateTaskSchema.safeParse({
      title: "Test",
      description: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("1000文字以内");
    }
  });
});

describe("UpdateTaskSchema", () => {
  it("should pass with empty object (all fields optional)", () => {
    const result = UpdateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should pass with partial update (title only)", () => {
    const result = UpdateTaskSchema.safeParse({ title: "Updated title" });
    expect(result.success).toBe(true);
  });

  it("should pass with partial update (deadline only)", () => {
    const result = UpdateTaskSchema.safeParse({
      deadline: "2026-06-15T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("should still validate constraints when fields provided", () => {
    const result = UpdateTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });
});

describe("CreateHonneSchema", () => {
  describe("quick_reply type", () => {
    const validQuickReplies = [
      "truly_tired",
      "actually_important",
      "agree_with_ai",
      "disagree_with_ai",
    ] as const;

    for (const content of validQuickReplies) {
      it(`should pass with valid quick_reply: ${content}`, () => {
        const result = CreateHonneSchema.safeParse({
          type: "quick_reply",
          content,
        });
        expect(result.success).toBe(true);
      });
    }

    it("should fail with invalid quick_reply value", () => {
      const result = CreateHonneSchema.safeParse({
        type: "quick_reply",
        content: "invalid_value",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("free_text type", () => {
    it("should pass with valid free text", () => {
      const result = CreateHonneSchema.safeParse({
        type: "free_text",
        content: "このタスクは本当に重要です",
      });
      expect(result.success).toBe(true);
    });

    it("should fail when free text is empty", () => {
      const result = CreateHonneSchema.safeParse({
        type: "free_text",
        content: "",
      });
      expect(result.success).toBe(false);
    });

    it("should fail when free text exceeds 500 characters", () => {
      const result = CreateHonneSchema.safeParse({
        type: "free_text",
        content: "あ".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  it("should fail with invalid type", () => {
    const result = CreateHonneSchema.safeParse({
      type: "invalid_type",
      content: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should fail when type is missing", () => {
    const result = CreateHonneSchema.safeParse({ content: "test" });
    expect(result.success).toBe(false);
  });
});
