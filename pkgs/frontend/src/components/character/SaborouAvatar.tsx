/**
 * SaborouAvatar — チャット用ミニアバター
 *
 * U-06-ui-redesign Phase 2 / character-design-sheet.md 5 章準拠
 *
 * 用途: チャットバブル発話者識別 / コメント欄 /
 *       設定画面のキャラタブなど 28〜48px の小サイズ箇所。
 *
 * personaId に応じて背景色と表情を変える（D: ペルソナを一目で識別）。
 * 未指定時は「おっとり」のオレンジ笑顔。
 */

/** ペルソナ別の見た目（背景グラデーション・影色・表情タイプ） */
type FaceType = "gentle" | "stern" | "calm" | "logical";

interface PersonaLook {
  gradient: string;
  shadow: string;
  face: FaceType;
}

const PERSONA_LOOKS: Record<string, PersonaLook> = {
  saboru_ottori: {
    gradient: "linear-gradient(135deg, #F97316, #EA580C)",
    shadow: "rgba(249,115,22,0.3)",
    face: "gentle",
  },
  saboru_strict: {
    gradient: "linear-gradient(135deg, #4B5563, #1F2937)",
    shadow: "rgba(31,41,55,0.35)",
    face: "stern",
  },
  saboru_psy: {
    gradient: "linear-gradient(135deg, #6366F1, #4F46E5)",
    shadow: "rgba(99,102,241,0.3)",
    face: "calm",
  },
  saboru_hacker: {
    gradient: "linear-gradient(135deg, #10B981, #065F46)",
    shadow: "rgba(16,185,129,0.3)",
    face: "logical",
  },
};

const DEFAULT_LOOK = PERSONA_LOOKS.saboru_ottori;

/** 表情タイプごとの目・口の SVG パス */
function FacePaths({ face }: { face: FaceType }) {
  // 口は表情で変える
  const mouth =
    face === "gentle"
      ? "M 17 26 Q 20 28 23 26" // 笑顔
      : face === "stern"
        ? "M 17 27 L 23 27" // 真一文字
        : face === "calm"
          ? "M 17 26 Q 20 27 23 26" // 穏やかな微笑
          : "M 17 26 L 20 27 L 23 26"; // クール（やや尖り）

  // 目は stern/logical はキリッと直線、gentle/calm は眠そうカーブ
  const eyesSharp = face === "stern" || face === "logical";

  return (
    <>
      {/* 頬（gentle/calm のみ） */}
      {(face === "gentle" || face === "calm") && (
        <>
          <ellipse
            cx="14"
            cy="22"
            rx="2"
            ry="1.2"
            fill="#FED7AA"
            opacity="0.6"
          />
          <ellipse
            cx="26"
            cy="22"
            rx="2"
            ry="1.2"
            fill="#FED7AA"
            opacity="0.6"
          />
        </>
      )}
      {eyesSharp ? (
        <>
          <path
            d="M 12 19 L 16 19"
            stroke="#1F2937"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M 24 19 L 28 19"
            stroke="#1F2937"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
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
        </>
      )}
      <path
        d={mouth}
        stroke="#1F2937"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

export interface SaborouAvatarProps {
  /** ピクセルサイズ（推奨: 28 / 36 / 48） */
  size?: number;
  /** className 追加用 */
  className?: string;
  /** ペルソナ ID（saboru_ottori 等）。見た目を切り替える。未指定はおっとり */
  personaId?: string;
}

export function SaborouAvatar({
  size = 36,
  className,
  personaId,
}: SaborouAvatarProps) {
  const look = (personaId && PERSONA_LOOKS[personaId]) || DEFAULT_LOOK;
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "30%",
        background: look.gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: `0 2px 6px ${look.shadow}`,
      }}
      role="img"
      aria-label="サボロー"
    >
      <svg
        viewBox="0 0 40 40"
        width={size * 0.75}
        height={size * 0.75}
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        <FacePaths face={look.face} />
      </svg>
    </div>
  );
}
