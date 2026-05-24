/**
 * gamificationUtils — ゲーミフィケーション計算ユーティリティ
 *
 * AI依存度スコア（0〜100）を元に称号・フェーズ・色・サボりグレードを算出する。
 * 「人をダメにするサービス」のコアループを支える数値設計。
 *
 * スコア設計（0から上がる / 育成ゲーム的）:
 *   [0〜20]  "AI見習い"     → 水色テーマ
 *   [21〜40] "サボり常習者"  → 黄色テーマ
 *   [41〜60] "依存気味"     → オレンジテーマ
 *   [61〜80] "AI奴隷"       → 赤紫テーマ
 *   [81〜100] "存在する怠惰" → 金色テーマ（カオス演出）
 */

// ===== 称号・フェーズ定義 =====

export type DependencyPhase = 1 | 2 | 3 | 4;

export interface TitleInfo {
  /** 表示称号名 */
  title: string;
  /** 称号英語名（内部識別） */
  titleKey: string;
  /** フェーズ番号（1〜4 → strategy doc の Phase 1〜4 対応） */
  phase: DependencyPhase;
  /** テーマカラー（アクセント） */
  color: string;
  /** 背景色 */
  bg: string;
  /** グラデーション（CSS gradient 文字列） */
  gradient: string;
  /** 説明テキスト */
  description: string;
  /** キャラクター表情指示 */
  characterMood: "calm" | "sleepy" | "melting" | "chaos";
  /** スコア範囲 */
  range: [number, number];
}

export const DEPENDENCY_TITLES: TitleInfo[] = [
  {
    title: "AI見習い",
    titleKey: "beginner",
    phase: 1,
    color: "#38BDF8",
    bg: "#F0F9FF",
    gradient: "linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)",
    description: "AIの提案に驚く・信じていいか迷う段階",
    characterMood: "calm",
    range: [0, 20],
  },
  {
    title: "サボり常習者",
    titleKey: "habitual",
    phase: 2,
    color: "#FBBF24",
    bg: "#FFFBEB",
    gradient: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
    description: "AIの提案パターンを学習・予測できるようになる段階",
    characterMood: "sleepy",
    range: [21, 40],
  },
  {
    title: "依存気味",
    titleKey: "dependent",
    phase: 3,
    color: "#F97316",
    bg: "#FFF7ED",
    gradient: "linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)",
    description: "AIがユーザーのパターンを学習・より精度の高い提案へ",
    characterMood: "sleepy",
    range: [41, 60],
  },
  {
    title: "AI奴隷",
    titleKey: "slave",
    phase: 4,
    color: "#A855F7",
    bg: "#FAF5FF",
    gradient: "linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)",
    description: "AIが先回りして行動する・完全依存への道",
    characterMood: "melting",
    range: [61, 80],
  },
  {
    title: "存在する怠惰",
    titleKey: "ultimate",
    phase: 4,
    color: "#F59E0B",
    bg: "#FFFBEB",
    gradient: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)",
    description: "完全なるAI依存完成。おめでとう！",
    characterMood: "chaos",
    range: [81, 100],
  },
];

/**
 * スコアから称号情報を取得する
 */
export function getTitleInfo(score: number): TitleInfo {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const found = DEPENDENCY_TITLES.find(
    (t) => clamped >= t.range[0] && clamped <= t.range[1],
  );
  return found ?? DEPENDENCY_TITLES[0];
}

/**
 * スコアから次の称号までの進捗（0〜1）を計算する
 */
export function getTitleProgress(score: number): number {
  const info = getTitleInfo(score);
  const [min, max] = info.range;
  if (max === min) return 1;
  return (score - min) / (max - min);
}

/**
 * スコアの段階が変わったか（称号解除イベント）を検出する
 */
export function isTitleChanged(prev: number, next: number): boolean {
  return getTitleInfo(prev).titleKey !== getTitleInfo(next).titleKey;
}

// ===== サボりグレード定義（A〜E + A+） =====

export type SaboriGrade = "A+" | "A" | "B" | "C" | "D" | "E";

export interface GradeInfo {
  grade: SaboriGrade;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  borderColor: string;
  emoji: string;
  /** アニメーション強度 */
  intensity: "jackpot" | "high" | "medium" | "low" | "none";
}

export const SABORI_GRADES: Record<SaboriGrade, GradeInfo> = {
  "A+": {
    grade: "A+",
    label: "完全なるサボり！",
    sublabel: "最高のサボり条件が揃いました",
    color: "#F59E0B",
    bg: "#FEF3C7",
    borderColor: "#D97706",
    emoji: "🏆",
    intensity: "jackpot",
  },
  A: {
    grade: "A",
    label: "サボり最適！",
    sublabel: "根拠3つ以上揃い",
    color: "#10B981",
    bg: "#ECFDF5",
    borderColor: "#059669",
    emoji: "✨",
    intensity: "high",
  },
  B: {
    grade: "B",
    label: "サボれる！",
    sublabel: "根拠2つ揃い",
    color: "#3B82F6",
    bg: "#EFF6FF",
    borderColor: "#2563EB",
    emoji: "😴",
    intensity: "medium",
  },
  C: {
    grade: "C",
    label: "ギリサボれる",
    sublabel: "根拠1つあり",
    color: "#84CC16",
    bg: "#F7FEE7",
    borderColor: "#65A30D",
    emoji: "🌿",
    intensity: "low",
  },
  D: {
    grade: "D",
    label: "判定困難...",
    sublabel: "根拠が弱い",
    color: "#F59E0B",
    bg: "#FFFBEB",
    borderColor: "#D97706",
    emoji: "🤔",
    intensity: "none",
  },
  E: {
    grade: "E",
    label: "今はサボれない",
    sublabel: "要注意タスク",
    color: "#6B7280",
    bg: "#F9FAFB",
    borderColor: "#9CA3AF",
    emoji: "⚠️",
    intensity: "none",
  },
};

/**
 * 心理学シグナル強度からサボりグレードを算出する
 */
export function calcSaboriGrade(params: {
  verdict: "can_saboru" | "borderline" | "must_do";
  signalCount?: number; // 高強度シグナル数（0〜5）
  dependencyScore?: number; // AI依存度スコア（0〜100）
  isComboActive?: boolean; // コンボ中か
}): SaboriGrade {
  const {
    verdict,
    signalCount = 0,
    dependencyScore = 0,
    isComboActive = false,
  } = params;

  // must_do は常にE
  if (verdict === "must_do") return "E";

  // borderline はD
  if (verdict === "borderline") return "D";

  // can_saboru の場合、シグナル数で判定
  if (signalCount >= 4 && dependencyScore >= 60 && isComboActive) {
    // A+ 条件: シグナル4以上 + 高依存度 + コンボ中（約5%確率で発生させる）
    const rand = Math.random();
    if (rand < 0.05) return "A+";
  }

  if (signalCount >= 3) return "A";
  if (signalCount >= 2) return "B";
  if (signalCount >= 1) return "C";
  return "B"; // can_saboru で signalCount 不明なら B
}

// ===== コンボシステム =====

export interface ComboState {
  count: number;
  isActive: boolean;
  /** コンボ継続中の乗数 */
  multiplier: number;
}

/**
 * コンボ数から乗数を計算する
 */
export function getComboMultiplier(count: number): number {
  if (count >= 5) return 2.0;
  if (count >= 3) return 1.5;
  if (count >= 2) return 1.2;
  return 1.0;
}

/**
 * コンボ数に応じた表示テキストを返す
 */
export function getComboLabel(count: number): string | null {
  if (count >= 5) return "先延ばし無敵モード！";
  if (count >= 3) return "サボり三冠王！";
  if (count >= 2) return "コンボ継続中！";
  if (count >= 1) return null;
  return null;
}
