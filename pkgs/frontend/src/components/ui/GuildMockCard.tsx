/**
 * GuildMockCard — サボりギルドUI（モック）
 *
 * ソーシャルギルド機能のモック表示。決勝実装に向けたUIプレビュー。
 * 実機能なし（UI表示のみ）。
 *
 * Octalysis:
 *   5（ソーシャル）: チーム内競争・協力感
 *   1（意味・使命感）: 「チームのために」サボる
 */
import { useState } from "react";

interface GuildMember {
  name: string;
  score: number;
  grade: string;
  emoji: string;
  status: string;
  isMe?: boolean;
}

interface FeedItem {
  member: string;
  action: string;
  emoji: string;
  time: string;
}

const MOCK_GUILD_MEMBERS: GuildMember[] = [
  { name: "田中 たろう", score: 78, grade: "A", emoji: "🤖", status: "AI奴隷" },
  {
    name: "あなた",
    score: 65,
    grade: "B",
    emoji: "😴",
    status: "依存気味",
    isMe: true,
  },
  {
    name: "鈴木 はなこ",
    score: 45,
    grade: "C",
    emoji: "🌿",
    status: "サボり常習者",
  },
  {
    name: "佐藤 じろう",
    score: 23,
    grade: "D",
    emoji: "🤔",
    status: "AI見習い",
  },
];

const MOCK_FEED: FeedItem[] = [
  {
    member: "田中 たろう",
    action: "A+判定を獲得！",
    emoji: "🏆",
    time: "2分前",
  },
  {
    member: "鈴木 はなこ",
    action: "3連続コンボ達成！",
    emoji: "🔥",
    time: "15分前",
  },
  {
    member: "あなた",
    action: "「AI奴隷」称号解除！",
    emoji: "🤖",
    time: "1時間前",
  },
];

interface GuildMockCardProps {
  className?: string;
}

export function GuildMockCard({ className = "" }: GuildMockCardProps) {
  const [reacted, setReacted] = useState<Set<number>>(new Set());

  const handleReact = (idx: number) => {
    setReacted((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  return (
    <div
      className={className}
      style={{
        borderRadius: 14,
        border: "3px solid #A855F7",
        boxShadow: "0 3px 0 #A855F7",
        background: "#FAF5FF",
        padding: "12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* COMING SOON バッジ */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          fontSize: 7,
          fontWeight: 900,
          color: "#FFFFFF",
          background: "#A855F7",
          padding: "2px 6px",
          borderRadius: 4,
          border: "1.5px solid #9333EA",
          letterSpacing: "0.05em",
        }}
      >
        COMING SOON
      </div>

      {/* タイトル */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: "#6B21A8",
          marginBottom: 10,
          fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
        }}
      >
        🏰 サボりギルド
      </div>

      {/* メンバーリスト */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: "#9CA3AF",
            letterSpacing: "0.05em",
            marginBottom: 5,
            textTransform: "uppercase",
          }}
        >
          メンバー
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {MOCK_GUILD_MEMBERS.map((member, idx) => (
            <div
              key={`guild-member-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                borderRadius: 8,
                background: member.isMe ? "#F3E8FF" : "#FFFFFF",
                border: `1.5px solid ${member.isMe ? "#A855F7" : "#E5E7EB"}`,
              }}
            >
              <span style={{ fontSize: 14 }}>{member.emoji}</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: member.isMe ? 800 : 600,
                    color: member.isMe ? "#6B21A8" : "#1F2937",
                  }}
                >
                  {member.name}
                  {member.isMe && (
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 8,
                        color: "#A855F7",
                        fontWeight: 700,
                      }}
                    >
                      (あなた)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: "#6B7280" }}>
                  {member.status}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#A855F7",
                    fontFamily: "Nunito, system-ui, sans-serif",
                  }}
                >
                  {member.score}%
                </div>
                <div style={{ fontSize: 9, color: "#9CA3AF" }}>
                  {member.grade}評価
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* アクティビティフィード */}
      <div>
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: "#9CA3AF",
            letterSpacing: "0.05em",
            marginBottom: 5,
            textTransform: "uppercase",
          }}
        >
          最近のアクティビティ
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MOCK_FEED.map((item, idx) => (
            <div
              key={`feed-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 8px",
                borderRadius: 6,
                background: "#FFFFFF",
                border: "1.5px solid #E5E7EB",
              }}
            >
              <span style={{ fontSize: 12 }}>{item.emoji}</span>
              <div style={{ flex: 1, fontSize: 10, color: "#374151" }}>
                <strong>{item.member}</strong>が{item.action}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 8, color: "#9CA3AF" }}>
                  {item.time}
                </span>
                <button
                  type="button"
                  onClick={() => handleReact(idx)}
                  style={{
                    fontSize: 9,
                    background: reacted.has(idx) ? "#F3E8FF" : "#F9FAFB",
                    border: `1px solid ${reacted.has(idx) ? "#A855F7" : "#D1D5DB"}`,
                    borderRadius: 4,
                    padding: "1px 4px",
                    cursor: "pointer",
                    color: reacted.has(idx) ? "#A855F7" : "#6B7280",
                    fontWeight: 700,
                  }}
                  aria-label="ナイスサボり！リアクション"
                >
                  👍{reacted.has(idx) ? "✓" : ""}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
