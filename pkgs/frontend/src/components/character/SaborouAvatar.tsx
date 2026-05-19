/**
 * SaborouAvatar — チャット用ミニアバター
 *
 * U-06-ui-redesign Phase 2 / character-design-sheet.md 5 章準拠
 *
 * 用途: チャットバブル発話者識別 / コメント欄 /
 *       設定画面のキャラタブなど 28〜48px の小サイズ箇所。
 * verdict 非依存（常に「おっとり笑顔」固定）。
 */

export interface SaborouAvatarProps {
  /** ピクセルサイズ（推奨: 28 / 36 / 48） */
  size?: number;
  /** className 追加用 */
  className?: string;
}

export function SaborouAvatar({ size = 36, className }: SaborouAvatarProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "30%",
        background: "linear-gradient(135deg, #F97316, #EA580C)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(249,115,22,0.3)",
      }}
      role="img"
      aria-label="サボロー"
    >
      <svg
        viewBox="0 0 40 40"
        width={size * 0.75}
        height={size * 0.75}
        style={{ overflow: "visible" }}
      >
        {/* 頬 */}
        <ellipse cx="14" cy="22" rx="2" ry="1.2" fill="#FED7AA" opacity="0.7" />
        <ellipse cx="26" cy="22" rx="2" ry="1.2" fill="#FED7AA" opacity="0.7" />
        {/* 眠そうな目 */}
        <path
          d="M 12 19 Q 14 21 16 19"
          stroke="#1F2937"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 24 19 Q 26 21 28 19"
          stroke="#1F2937"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* 笑顔 */}
        <path
          d="M 17 26 Q 20 28 23 26"
          stroke="#1F2937"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
