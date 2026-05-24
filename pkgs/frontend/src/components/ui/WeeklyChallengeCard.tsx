/**
 * WeeklyChallengeCard — 週次チャレンジUI
 *
 * 毎週更新されるチャレンジを表示し、達成進捗をゲージで可視化する。
 * 週次サイクルでリテンションを維持する。
 *
 * Octalysis:
 *   2（達成・進歩）: 週間チャレンジの完了感
 *   6（希少性・焦り）: 週次リセットによる緊急感
 *   8（損失回避）: 「今週中に達成しないと」プレッシャー
 */

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: string;
  emoji: string;
  weekStartDate: string; // YYYY-MM-DD
}

export interface WeeklyChallengeProgress {
  challengeId: string;
  current: number;
  completed: boolean;
}

export const WEEKLY_CHALLENGES: Omit<WeeklyChallenge, "weekStartDate">[] = [
  {
    id: "sucker_effect",
    title: "Sucker Effect サボり",
    description: "Sucker Effectを使ったサボりを5回達成",
    target: 5,
    reward: "週間チャレンジャー",
    emoji: "🧠",
  },
  {
    id: "midnight_challenge",
    title: "深夜のサボり",
    description: "深夜0〜5時にサボり判定を受ける",
    target: 1,
    reward: "深夜のサボり屋",
    emoji: "🌙",
  },
  {
    id: "combo_master",
    title: "コンボマスター",
    description: "3連続サボりコンボを達成",
    target: 3,
    reward: "コンボマスター",
    emoji: "🔥",
  },
  {
    id: "honne_send",
    title: "本音連打",
    description: "本音を10回送信する",
    target: 10,
    reward: "本音マスター見習い",
    emoji: "📖",
  },
  {
    id: "weekly_sabori",
    title: "ランダムサボリスト",
    description: "今週7回サボり判定を受ける",
    target: 7,
    reward: "週間サボリスト",
    emoji: "🦥",
  },
];

const CHALLENGE_STORAGE_KEY = "saborou_weekly_challenge_progress";

/** ISO週番号を取得する */
function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** 今週のチャレンジを取得する（週番号でローテーション） */
export function getCurrentWeekChallenge(): WeeklyChallenge {
  const now = new Date();
  const weekNum = getWeekNumber(now);
  const idx = weekNum % WEEKLY_CHALLENGES.length;
  const base = WEEKLY_CHALLENGES[idx];

  // 週の月曜日の日付を計算
  const copy = new Date(now);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  const weekStartDate = copy.toISOString().slice(0, 10);

  return { ...base, weekStartDate };
}

export function loadChallengeProgress(): WeeklyChallengeProgress {
  try {
    const stored = localStorage.getItem(CHALLENGE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WeeklyChallengeProgress;
      const current = getCurrentWeekChallenge();
      // 週が変わっていなければそのまま返す
      if (parsed.challengeId === current.id) return parsed;
    }
  } catch {
    // ignore
  }
  const challenge = getCurrentWeekChallenge();
  return { challengeId: challenge.id, current: 0, completed: false };
}

export function saveChallengeProgress(progress: WeeklyChallengeProgress): void {
  try {
    localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function incrementChallengeProgress(): WeeklyChallengeProgress {
  const prev = loadChallengeProgress();
  if (prev.completed) return prev;
  const challenge = getCurrentWeekChallenge();
  const next: WeeklyChallengeProgress = {
    challengeId: prev.challengeId,
    current: prev.current + 1,
    completed: prev.current + 1 >= challenge.target,
  };
  saveChallengeProgress(next);
  return next;
}

export function getTimeRemainingText(challenge: WeeklyChallenge): string {
  const now = new Date();
  const weekStart = new Date(challenge.weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const diffMs = weekEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "本日まで";
  if (diffDays === 1) return "明日まで";
  return `日曜日まであと${diffDays}日`;
}

// ===== コンポーネント =====

interface WeeklyChallengeCardProps {
  className?: string;
}

export function WeeklyChallengeCard({
  className = "",
}: WeeklyChallengeCardProps) {
  const challenge = getCurrentWeekChallenge();
  const progress = loadChallengeProgress();
  const pct = Math.min(
    100,
    Math.round((progress.current / challenge.target) * 100),
  );
  const remaining = Math.max(0, challenge.target - progress.current);

  return (
    <div
      className={className}
      style={{
        borderRadius: 12,
        border: `3px solid ${progress.completed ? "#D97706" : "#2B1E16"}`,
        boxShadow: `0 3px 0 ${progress.completed ? "#D97706" : "#2B1E16"}`,
        background: progress.completed ? "#FFFBEB" : "#FFFAF5",
        padding: "10px 12px",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 14 }} aria-hidden="true">
            {challenge.emoji}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#6B7280",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            今週のチャレンジ
          </span>
        </div>
        <span style={{ fontSize: 9, color: "#9CA3AF" }}>
          {getTimeRemainingText(challenge)}
        </span>
      </div>

      {/* チャレンジ名 */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#1F2937",
          marginBottom: 2,
        }}
      >
        {challenge.title}
      </div>
      <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 8 }}>
        {challenge.description}
      </div>

      {/* 進捗バー */}
      <div
        style={{
          width: "100%",
          height: 6,
          background: "#E5E7EB",
          borderRadius: 9999,
          border: "1.5px solid #2B1E16",
          overflow: "hidden",
          marginBottom: 5,
        }}
        role="progressbar"
        tabIndex={0}
        aria-valuenow={progress.current}
        aria-valuemin={0}
        aria-valuemax={challenge.target}
        aria-label={`週次チャレンジ進捗: ${progress.current}/${challenge.target}`}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: progress.completed ? "#F59E0B" : "#F97316",
            borderRadius: 9999,
            transition: "width 0.5s ease-out",
          }}
        />
      </div>

      {/* ステータス */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: progress.completed ? "#D97706" : "#6B7280",
            fontWeight: progress.completed ? 700 : 400,
          }}
        >
          {progress.completed
            ? "✅ 今週のチャレンジ達成！"
            : `残り${remaining}回でコンプリート！`}
        </span>
        <span style={{ fontSize: 10, color: "#9CA3AF" }}>
          {progress.current}/{challenge.target}
        </span>
      </div>

      {/* 報酬 */}
      {!progress.completed && (
        <div style={{ marginTop: 4, fontSize: 9, color: "#A855F7" }}>
          🎁 達成報酬: 「{challenge.reward}」称号
        </div>
      )}
    </div>
  );
}
