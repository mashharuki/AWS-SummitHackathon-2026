import { describe, expect, it } from "vitest";
import { normalizeForTts } from "../../utils/ttsNormalizer.js";

describe("normalizeForTts", () => {
  it("keeps existing abbreviation conversions", () => {
    expect(normalizeForTts("AWS MCP API URL AI-DLC")).toBe(
      "エーダブリューエス エムシーピー エーピーアイ ユーアールエル エーアイ・ディーエルシー",
    );
  });

  it("preserves camelCase JSON keys while normalizing string values", () => {
    const input = JSON.stringify(
      {
        taskId: "task-0123456789abcdef",
        channelId: "C012345678",
        threadTs: "1234567890.123456",
        message: "AWS API URL",
      },
      null,
      2,
    );

    const normalized = JSON.parse(normalizeForTts(input));

    expect(normalized).toEqual({
      taskId: "アイディー",
      channelId: "チャンネルアイディー",
      threadTs: "スレッドのタイムスタンプ",
      message: "エーダブリューエス エーピーアイ ユーアールエル",
    });
    expect(normalizeForTts(input)).toContain('"taskId"');
    expect(normalizeForTts(input)).toContain('"channelId"');
    expect(normalizeForTts(input)).toContain('"threadTs"');
  });

  it("normalizes confirmed item counters", () => {
    expect(normalizeForTts("1個 2個 3個 10個 100個")).toBe(
      "いっこ にこ さんこ じゅっこ ひゃっこ",
    );
  });

  it("normalizes cases, people, minutes, and hours", () => {
    expect(normalizeForTts("1件 3人 15分 2時間")).toBe(
      "いっけん さんにん じゅうごふん にじかん",
    );
  });

  it("normalizes dates and times", () => {
    expect(normalizeForTts("2026-06-21 13:30")).toBe(
      "2026年6月21日 13時30分",
    );
  });

  it("shortens URLs instead of leaving long readout text", () => {
    const normalized = normalizeForTts(
      "詳細は https://example.com/path/to/page?token=secret を確認してください",
    );

    expect(normalized).toContain("リンク");
    expect(normalized).not.toContain("https://");
    expect(normalized).not.toContain("example.com");
  });

  it("normalizes common project and technical terms", () => {
    expect(
      normalizeForTts("S3 CloudFront ElevenLabs Slack TypeScript SABOROU"),
    ).toBe(
      "エススリー クラウドフロント イレブンラボ スラック タイプスクリプト サボロー",
    );
  });

  it("normalizes priority and status labels", () => {
    expect(normalizeForTts("P0 active completed pending high")).toBe(
      "ピーゼロ 進行中 完了 保留中 高",
    );
  });
});
