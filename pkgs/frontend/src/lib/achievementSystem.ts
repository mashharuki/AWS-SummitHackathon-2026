/**
 * achievementSystem — サボり実績・称号システム
 *
 * 特定のトリガー条件を満たすと実績がアンロックされる。
 * 「初めて何かをした瞬間」に特別なご褒美感を与えることで
 * 行動の記念碑化（記憶への定着）を促す。
 *
 * Octalysis:
 *   2（達成・進歩）: 実績解除の達成感
 *   3（創造・フィードバック）: 予期しない実績への驚き
 *   4（所有権）: 自分だけのコレクション感
 */

export type AchievementId =
  | "first_sabori"
  | "ai_trusted"
  | "streak_3days"
  | "midnight_sabori"
  | "ai_slave"
  | "honne_master"
  | "combo_king"
  | "jackpot"
  | "manual_complete";

export interface Achievement {
  id: AchievementId;
  /** 実績名 */
  title: string;
  /** 説明テキスト */
  description: string;
  /** 解除条件（表示用テキスト） */
  condition: string;
  /** アイコン絵文字 */
  emoji: string;
  /** レアリティ（rare ほど演出が派手） */
  rarity: "common" | "uncommon" | "rare" | "legendary";
  /** カテゴリ */
  category: "first" | "streak" | "time" | "dependency" | "combo" | "manual";
}

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  first_sabori: {
    id: "first_sabori",
    title: "初めてのサボり",
    description: "人生初のサボり判定を完了させた記念すべき瞬間",
    condition: "最初のサボり判定完了時",
    emoji: "🎉",
    rarity: "common",
    category: "first",
  },
  ai_trusted: {
    id: "ai_trusted",
    title: "AIを信じた",
    description: "AIの提案を受け入れて初めてサボりを実行した",
    condition: "初めてサボりを実行（AI判定をそのまま承認）",
    emoji: "🤝",
    rarity: "common",
    category: "first",
  },
  streak_3days: {
    id: "streak_3days",
    title: "連続3日サボり",
    description: "3日間連続してサボり続けるという偉業",
    condition: "3日ストリーク達成",
    emoji: "🔥",
    rarity: "uncommon",
    category: "streak",
  },
  midnight_sabori: {
    id: "midnight_sabori",
    title: "深夜のサボり屋",
    description: "誰も起きていない時間帯にサボり判定を受けた",
    condition: "深夜0〜5時に利用",
    emoji: "🌙",
    rarity: "uncommon",
    category: "time",
  },
  ai_slave: {
    id: "ai_slave",
    title: "AI奴隷認定",
    description: "AI依存度が80%を超えた。もう後戻りはできない",
    condition: "AI依存度80%以上",
    emoji: "🤖",
    rarity: "rare",
    category: "dependency",
  },
  honne_master: {
    id: "honne_master",
    title: "本音マスター",
    description: "取扱説明書の完成度を100%にした。AIはあなたの全てを知っている",
    condition: "取扱説明書完成度100%",
    emoji: "📖",
    rarity: "rare",
    category: "manual",
  },
  combo_king: {
    id: "combo_king",
    title: "コンボキング",
    description: "5連続サボりコンボを達成した先延ばしの王",
    condition: "5連続コンボ達成",
    emoji: "👑",
    rarity: "rare",
    category: "combo",
  },
  jackpot: {
    id: "jackpot",
    title: "ジャックポット",
    description: "A+評価を獲得した。サボりの頂点に立つ者",
    condition: "A+ジャックポット発生",
    emoji: "🏆",
    rarity: "legendary",
    category: "combo",
  },
  manual_complete: {
    id: "manual_complete",
    title: "完全なるAI依存",
    description:
      "AI依存度100%。おめでとうございます。あなたは完全にダメになりました",
    condition: "AI依存度スコア100%",
    emoji: "💀",
    rarity: "legendary",
    category: "dependency",
  },
} as const;

export interface UnlockedAchievement {
  id: AchievementId;
  unlockedAt: string; // ISO 8601
}

const STORAGE_KEY_ACHIEVEMENTS = "saborou_achievements";

/** アンロック済み実績を localStorage から読み込む */
export function loadUnlockedAchievements(): UnlockedAchievement[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
    if (stored) return JSON.parse(stored) as UnlockedAchievement[];
  } catch {
    // ignore
  }
  return [];
}

/** アンロック済み実績を localStorage に保存する */
function saveUnlockedAchievements(achievements: UnlockedAchievement[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_ACHIEVEMENTS,
      JSON.stringify(achievements),
    );
  } catch {
    // ignore
  }
}

/** 特定の実績をアンロックする（既存の場合はスキップ） */
export function unlockAchievement(
  id: AchievementId,
  current: UnlockedAchievement[],
): { next: UnlockedAchievement[]; isNew: boolean } {
  if (current.some((a) => a.id === id)) {
    return { next: current, isNew: false };
  }
  const next = [...current, { id, unlockedAt: new Date().toISOString() }];
  saveUnlockedAchievements(next);
  return { next, isNew: true };
}

/** 実績チェック関数 */
export interface AchievementCheckParams {
  /** サボり判定結果 */
  verdict?: "can_saboru" | "borderline" | "must_do";
  /** AI依存度スコア（0〜100） */
  dependencyScore?: number;
  /** コンボ数 */
  comboCount?: number;
  /** ストリーク日数 */
  streakDays?: number;
  /** 取扱説明書完成度 */
  manualProgress?: number;
  /** A+ジャックポットか */
  isJackpot?: boolean;
  /** 現在時刻（テスト用に上書き可能） */
  nowHour?: number;
}

/**
 * 解除すべき実績のIDリストを返す
 * （既存のアンロック済みリストとの差分は呼び出し元でチェック）
 */
export function checkNewAchievements(
  params: AchievementCheckParams,
): AchievementId[] {
  const {
    verdict,
    dependencyScore = 0,
    comboCount = 0,
    streakDays = 0,
    manualProgress = 0,
    isJackpot = false,
    nowHour = new Date().getHours(),
  } = params;

  const triggered: AchievementId[] = [];

  // first_sabori: 最初のサボり判定
  if (verdict !== undefined) {
    triggered.push("first_sabori");
  }

  // ai_trusted: can_saboru で判定を受けたとき
  if (verdict === "can_saboru") {
    triggered.push("ai_trusted");
  }

  // streak_3days
  if (streakDays >= 3) {
    triggered.push("streak_3days");
  }

  // midnight_sabori: 深夜0〜5時
  if (verdict !== undefined && nowHour >= 0 && nowHour < 5) {
    triggered.push("midnight_sabori");
  }

  // ai_slave: 依存度80%以上
  if (dependencyScore >= 80) {
    triggered.push("ai_slave");
  }

  // manual_complete: 依存度100%
  if (dependencyScore >= 100) {
    triggered.push("manual_complete");
  }

  // honne_master: 取扱説明書100%
  if (manualProgress >= 100) {
    triggered.push("honne_master");
  }

  // combo_king: 5連続コンボ
  if (comboCount >= 5) {
    triggered.push("combo_king");
  }

  // jackpot: A+発生
  if (isJackpot) {
    triggered.push("jackpot");
  }

  return triggered;
}

/** レアリティに応じた色設定 */
export const RARITY_STYLES: Record<
  Achievement["rarity"],
  { color: string; bg: string; border: string; label: string }
> = {
  common: {
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#D1D5DB",
    label: "COMMON",
  },
  uncommon: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    border: "#3B82F6",
    label: "UNCOMMON",
  },
  rare: {
    color: "#A855F7",
    bg: "#FAF5FF",
    border: "#A855F7",
    label: "RARE",
  },
  legendary: {
    color: "#F59E0B",
    bg: "#FEF3C7",
    border: "#D97706",
    label: "LEGENDARY",
  },
};
