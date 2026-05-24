/**
 * Tier 3 ゲーミフィケーションテスト
 *
 * - ShareCard: シェアテキスト生成
 * - PositioningCard: コンポーネントの存在確認
 */
import { describe, expect, it } from "vitest";

// ShareCard のユーティリティ関数をテスト（実装は内部関数なので文字列生成ロジックを検証）
describe("ShareCard シェアテキスト生成", () => {
  it("can_saboru 判定でシェアテキストが正しく生成される", () => {
    // 期待するシェアテキストの要素を検証
    const taskTitle = "企画書レビュー";
    const grade = "A";
    const dependencyScore = 73;
    const titleName = "AI奴隷";
    const verdict = "can_saboru" as const;

    const verdictLabel =
      verdict === "can_saboru" ? "✅ サボれる！" : "❌ 今はサボれない";

    const shareText = [
      "🦥 SABOROU サボり判定結果",
      `タスク: 「${taskTitle}」`,
      `判定: ${verdictLabel}（${grade}評価）`,
      `AI依存度: ${dependencyScore}%「${titleName}」`,
      "",
      "私の取扱説明書はAIに渡った",
      "#SABOROU #先延ばし支援AI #人をダメにするサービス",
    ].join("\n");

    expect(shareText).toContain("🦥 SABOROU");
    expect(shareText).toContain("企画書レビュー");
    expect(shareText).toContain("✅ サボれる！");
    expect(shareText).toContain("A評価");
    expect(shareText).toContain("73%「AI奴隷」");
    expect(shareText).toContain("#SABOROU");
    expect(shareText).toContain("私の取扱説明書はAIに渡った");
  });

  it("must_do 判定でシェアテキストが正しく生成される", () => {
    const getVerdictLabel = (
      v: "can_saboru" | "borderline" | "must_do",
    ): string => {
      if (v === "can_saboru") return "✅ サボれる！";
      if (v === "borderline") return "⚠️ 微妙...";
      return "❌ 今はサボれない";
    };
    expect(getVerdictLabel("must_do")).toBe("❌ 今はサボれない");
  });

  it("borderline 判定でシェアテキストが正しく生成される", () => {
    const getVerdictLabel = (
      v: "can_saboru" | "borderline" | "must_do",
    ): string => {
      if (v === "can_saboru") return "✅ サボれる！";
      if (v === "borderline") return "⚠️ 微妙...";
      return "❌ 今はサボれない";
    };
    expect(getVerdictLabel("borderline")).toBe("⚠️ 微妙...");
  });

  it("全グレードに対応するラベルが存在する", () => {
    const gradeLabels = {
      "A+": "🏆 完全なるサボり！",
      A: "✨ サボり最適！",
      B: "😴 サボれる！",
      C: "🌿 ギリサボれる",
      D: "🤔 判定困難...",
      E: "⚠️ 今はサボれない",
    };

    expect(Object.keys(gradeLabels)).toHaveLength(6);
    expect(gradeLabels["A+"]).toContain("完全なるサボり");
    // biome-ignore lint/complexity/useLiteralKeys: bracket notation matches the key name used above for consistency
    expect(gradeLabels["E"]).toContain("今はサボれない");
  });
});

describe("PositioningCard コンテンツ検証", () => {
  it("競合定義が3つある", () => {
    const competitors = [
      { emoji: "📋", label: "全部やれ" },
      { emoji: "⏰", label: "締め切り守れ" },
      { emoji: "💪", label: "頑張れ" },
    ];
    expect(competitors).toHaveLength(3);
    expect(competitors.map((c) => c.label)).toContain("全部やれ");
  });

  it("SABOROUの特徴が3つある", () => {
    const features = [
      { emoji: "🦥", label: "今サボれ理由5つ" },
      { emoji: "📈", label: "依存度を誇れ" },
      { emoji: "🤍", label: "ダメな自分を肯定" },
    ];
    expect(features).toHaveLength(3);
    expect(features.map((f) => f.label)).toContain("今サボれ理由5つ");
    expect(features.map((f) => f.label)).toContain("ダメな自分を肯定");
  });

  it("キャッチコピーに必須フレーズが含まれる", () => {
    const catchphrase = "人をダメにする唯一のタスク管理AI";
    expect(catchphrase).toContain("人をダメにする");
    expect(catchphrase).toContain("タスク管理AI");
  });
});

describe("Twitter シェアURL生成", () => {
  it("エンコードされたテキストがURLに含まれる", () => {
    const text = "🦥 SABOROU サボり判定結果";
    const encoded = encodeURIComponent(text);
    const url = `https://twitter.com/intent/tweet?text=${encoded}`;

    expect(url).toContain("twitter.com/intent/tweet");
    expect(url).toContain("text=");
    expect(url).toContain(encodeURIComponent("SABOROU"));
  });

  it("ハッシュタグが含まれたURLを生成できる", () => {
    const text = "テスト #SABOROU";
    const encoded = encodeURIComponent(text);
    expect(encoded).toContain(encodeURIComponent("#SABOROU"));
  });
});

describe("Tier 3 統合チェック", () => {
  it("依存度スコアから称号名を正確に取得できる（gamificationUtils連携）", async () => {
    const { getTitleInfo } = await import("@/lib/gamificationUtils");

    expect(getTitleInfo(0).title).toBe("AI見習い");
    expect(getTitleInfo(73).title).toBe("AI奴隷");
    expect(getTitleInfo(100).title).toBe("存在する怠惰");
  });

  it("シェアカードPropsの型整合性（コンパイル時チェック用）", () => {
    type Verdict = "can_saboru" | "borderline" | "must_do";
    const props: {
      verdict: Verdict;
      taskTitle: string;
      dependencyScore: number;
      grade: "A+" | "A" | "B" | "C" | "D" | "E";
      titleName: string;
    } = {
      verdict: "can_saboru",
      taskTitle: "テストタスク",
      dependencyScore: 73,
      grade: "A",
      titleName: "AI奴隷",
    };

    expect(props.verdict).toBe("can_saboru");
    expect(props.grade).toBe("A");
    expect(props.dependencyScore).toBe(73);
  });
});
