/**
 * PvPMockCard — サボりPvP対決モックUI
 *
 * 「同じタスクカテゴリを持つ2人がサボり根拠を競い合う」機能のモック。
 * 実機能なし（UIプレビューのみ）。
 *
 * Octalysis:
 *   5（ソーシャル）: 競争・対決感
 *   7（予測不能）: どちらが強いサボり根拠を出せるか
 */
import { useState } from "react";

interface PvPMockCardProps {
  className?: string;
}

export function PvPMockCard({ className = "" }: PvPMockCardProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  const handleAccept = () => setAccepted(true);
  const handleDecline = () => setAccepted(false);

  return (
    <div
      className={className}
      style={{
        borderRadius: 14,
        border: "3px solid #EF4444",
        boxShadow: "0 3px 0 #EF4444",
        background: "#FEF2F2",
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
          background: "#EF4444",
          padding: "2px 6px",
          borderRadius: 4,
          border: "1.5px solid #DC2626",
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
          color: "#991B1B",
          marginBottom: 6,
          fontFamily: "Nunito, 'Noto Sans JP', system-ui, sans-serif",
        }}
      >
        ⚔️ サボりPvP
      </div>

      {/* チャレンジ通知 */}
      {accepted === null && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
              padding: "7px 10px",
              background: "#FFFFFF",
              borderRadius: 8,
              border: "1.5px solid #EF4444",
            }}
          >
            🔔 田中さんからPvPチャレンジが来ています！
          </div>

          {/* 対決内容 */}
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              対決内容
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              {/* 自分のタスク */}
              <div
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: "#FFFFFF",
                  border: "1.5px solid #EF4444",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}>
                  あなた
                </div>
                <div
                  style={{ fontSize: 10, fontWeight: 700, color: "#1F2937" }}
                >
                  企画書レビュー
                </div>
              </div>

              {/* VS */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#EF4444",
                  flexShrink: 0,
                }}
              >
                VS
              </div>

              {/* 相手のタスク */}
              <div
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: "#FFFFFF",
                  border: "1.5px solid #D1D5DB",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}>
                  田中さん
                </div>
                <div
                  style={{ fontSize: 10, fontWeight: 700, color: "#1F2937" }}
                >
                  月次レポート
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#6B7280",
                marginTop: 4,
                textAlign: "center",
              }}
            >
              どちらが強いサボり根拠を引き出せるか？
            </div>
          </div>

          {/* ボタン */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={handleAccept}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                border: "2px solid #EF4444",
                boxShadow: "0 3px 0 #DC2626",
                background: "#EF4444",
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ⚔️ 受ける！
            </button>
            <button
              type="button"
              onClick={handleDecline}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                border: "2px solid #D1D5DB",
                boxShadow: "0 3px 0 #9CA3AF",
                background: "#F9FAFB",
                color: "#6B7280",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              断る
            </button>
          </div>
        </>
      )}

      {/* 受諾後 */}
      {accepted === true && (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚔️</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#991B1B" }}>
            対決開始！
          </div>
          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4 }}>
            AIがあなたのサボり根拠を生成中...
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 9,
              color: "#EF4444",
              fontWeight: 700,
              background: "#FFFFFF",
              border: "1.5px solid #EF4444",
              borderRadius: 6,
              padding: "4px 8px",
            }}
          >
            🚧 決勝で実装予定！
          </div>
        </div>
      )}

      {/* 断った後 */}
      {accepted === false && (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>💭</div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>
            チャレンジを断りました。
          </div>
          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 4 }}>
            次のPvPチャレンジをお待ちください
          </div>
        </div>
      )}
    </div>
  );
}
