/**
 * SeasonBanner — シーズンテーマ表示バナー
 *
 * 月ごとのシーズンテーマを表示し、限定称号への期待感を煽る。
 *
 * Octalysis:
 *   6（希少性・焦り）: シーズン限定要素への希少性
 *   1（意味・使命感）: 「五月病」など時期的な意味付け
 */

export interface Season {
  month: number; // 1-12
  name: string;
  emoji: string;
  tagline: string;
  limitedTitle: string;
  color: string;
  bg: string;
}

export const SEASONS: Season[] = [
  {
    month: 1,
    name: "正月ボケシーズン",
    emoji: "🎍",
    tagline: "お正月明けのサボり最適期",
    limitedTitle: "正月ボケチャンピオン",
    color: "#EF4444",
    bg: "#FEF2F2",
  },
  {
    month: 2,
    name: "バレンタイン逃避シーズン",
    emoji: "🍫",
    tagline: "甘い言い訳の季節",
    limitedTitle: "バレンタイン逃避者",
    color: "#EC4899",
    bg: "#FDF2F8",
  },
  {
    month: 3,
    name: "年度末逃避シーズン",
    emoji: "🌸",
    tagline: "締め切りを桜と散らせ",
    limitedTitle: "年度末逃亡者",
    color: "#F97316",
    bg: "#FFF7ED",
  },
  {
    month: 4,
    name: "新年度サボりシーズン",
    emoji: "🌱",
    tagline: "新しいスタートはサボりから",
    limitedTitle: "新年度サボリスト",
    color: "#10B981",
    bg: "#ECFDF5",
  },
  {
    month: 5,
    name: "五月病シーズン",
    emoji: "🤒",
    tagline: "最もサボれる月",
    limitedTitle: "五月病チャンピオン",
    color: "#6366F1",
    bg: "#EEF2FF",
  },
  {
    month: 6,
    name: "梅雨のサボりシーズン",
    emoji: "☔",
    tagline: "雨音がサボりを誘う",
    limitedTitle: "梅雨サボり名人",
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  {
    month: 7,
    name: "夏のだらけシーズン",
    emoji: "🌊",
    tagline: "暑さにかまけてサボろう",
    limitedTitle: "夏のだらけ王",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    month: 8,
    name: "お盆サボりシーズン",
    emoji: "🏖️",
    tagline: "ご先祖様もサボり派",
    limitedTitle: "お盆の精霊",
    color: "#14B8A6",
    bg: "#F0FDFA",
  },
  {
    month: 9,
    name: "秋のまどろみシーズン",
    emoji: "🍂",
    tagline: "実りの秋は眠くなる",
    limitedTitle: "秋のまどろみ者",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  {
    month: 10,
    name: "ハロウィンサボりシーズン",
    emoji: "🎃",
    tagline: "トリックorサボり",
    limitedTitle: "ハロウィンサボリスト",
    color: "#F97316",
    bg: "#FFF7ED",
  },
  {
    month: 11,
    name: "勤労サボり感謝シーズン",
    emoji: "🍁",
    tagline: "サボりを感謝する日",
    limitedTitle: "勤労感謝サボリスト",
    color: "#EF4444",
    bg: "#FEF2F2",
  },
  {
    month: 12,
    name: "年末大脱出シーズン",
    emoji: "🎄",
    tagline: "今年こそサボり収め",
    limitedTitle: "年末逃亡者",
    color: "#10B981",
    bg: "#ECFDF5",
  },
];

export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1-12
  return SEASONS.find((s) => s.month === month) ?? SEASONS[0];
}

export function getSeasonLimitedTitle(season: Season): string {
  return `限定称号: ${season.limitedTitle}`;
}

// ===== コンポーネント =====

interface SeasonBannerProps {
  className?: string;
}

export function SeasonBanner({ className = "" }: SeasonBannerProps) {
  const season = getCurrentSeason();

  return (
    <div
      className={className}
      role="banner"
      aria-label={`現在のシーズン: ${season.name}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 10,
        border: `2.5px solid ${season.color}`,
        boxShadow: `0 2px 0 ${season.color}`,
        background: season.bg,
      }}
    >
      <span style={{ fontSize: 18 }} aria-hidden="true">
        {season.emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: season.color }}>
          {season.name}
        </div>
        <div style={{ fontSize: 9, color: "#6B7280" }}>{season.tagline}</div>
      </div>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: season.color,
          background: "#FFFFFF",
          border: `1.5px solid ${season.color}`,
          borderRadius: 4,
          padding: "2px 6px",
          whiteSpace: "nowrap",
        }}
      >
        限定称号チャレンジ中！
      </div>
    </div>
  );
}
