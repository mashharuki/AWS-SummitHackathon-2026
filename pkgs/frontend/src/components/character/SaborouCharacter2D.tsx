import { VERDICT_SVG_CONFIG } from "@/lib/verdictMeta";
/**
 * SaborouCharacter2D — 2D SVG キャラクター
 *
 * U-06-ui-redesign Phase 2 / character-design-sheet.md 完全準拠
 *
 * 用途: 240px 未満の全箇所（一覧アバター 36px / 今日バナー 56px /
 *       チャット 28px / ログインヒーロー fallback 100px / 取説等）
 *
 * 共有 HTML `SaborouCharacter`（/tmp/saborou_src/04_a148c0b6.js）の
 * SVG 実装を TypeScript/React に完全移植。
 */
import type { Verdict } from "@saboru/shared";

/**
 * ペルソナ別の体色オーバーライド。
 * verdict は天気・表情で表現し続け、体の色だけ人格カラーにする
 * （判定＝天気/表情、人格＝体色、と役割分担して両方を視認可能にする）。
 */
const PERSONA_BODY: Record<string, { bodyColor: string; bodyShadow: string }> =
  {
    saboru_ottori: { bodyColor: "#F97316", bodyShadow: "#EA580C" },
    saboru_strict: { bodyColor: "#6B7280", bodyShadow: "#374151" },
    saboru_psy: { bodyColor: "#6366F1", bodyShadow: "#4F46E5" },
    saboru_hacker: { bodyColor: "#10B981", bodyShadow: "#065F46" },
  };

export interface SaborouCharacter2DProps {
  /** Sabori verdict（デフォルト: "can_saboru"） */
  verdict?: Verdict;
  /** ピクセルサイズ（推奨: 28 / 36 / 56 / 100 / 120） */
  size?: number;
  /** ボブアニメーションの有無（デフォルト true） */
  animated?: boolean;
  /** 目を閉じた状態にオーバーライド（デフォルト false） */
  sleeping?: boolean;
  /** className 追加用 */
  className?: string;
  /** ペルソナ ID。指定時は体色を人格カラーで上書きする（天気・表情は verdict 由来のまま） */
  personaId?: string;
}

export function SaborouCharacter2D({
  verdict = "can_saboru",
  size = 120,
  animated = true,
  sleeping = false,
  className,
  personaId,
}: SaborouCharacter2DProps) {
  const baseConfig = VERDICT_SVG_CONFIG[verdict];
  const personaBody = personaId ? PERSONA_BODY[personaId] : undefined;
  // 体色のみペルソナで上書き（その他は verdict 由来を維持）
  const config = personaBody ? { ...baseConfig, ...personaBody } : baseConfig;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        position: "relative",
        animation: animated ? "saboruBob 4s ease-in-out infinite" : "none",
        flexShrink: 0,
      }}
      role="img"
      aria-label={`サボロー（${verdict}）`}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        {/* 接地影 */}
        <ellipse cx="60" cy="108" rx="32" ry="4" fill="#00000018" />

        {/* 頭上の天気: 雲 / 太陽+雲 / 稲妻 */}
        {config.weather === "cloud" && (
          <g>
            <ellipse cx="42" cy="18" rx="12" ry="8" fill="#F3F4F6" />
            <ellipse cx="58" cy="14" rx="14" ry="9" fill="#F3F4F6" />
            <ellipse cx="74" cy="18" rx="11" ry="7" fill="#F3F4F6" />
          </g>
        )}
        {config.weather === "sun_cloud" && (
          <g>
            <circle cx="42" cy="14" r="8" fill="#FCD34D" />
            <ellipse cx="62" cy="18" rx="14" ry="8" fill="#F3F4F6" />
            <ellipse cx="76" cy="20" rx="9" ry="6" fill="#F3F4F6" />
          </g>
        )}
        {config.weather === "lightning" && (
          <g
            style={{
              animation: animated ? "saboruLightning 1.5s infinite" : "none",
            }}
          >
            <ellipse cx="50" cy="16" rx="14" ry="8" fill="#9CA3AF" />
            <ellipse cx="68" cy="14" rx="12" ry="8" fill="#6B7280" />
            <path
              d="M 58 22 L 54 32 L 60 30 L 56 40 L 66 28 L 60 30 L 64 22 Z"
              fill="#FBBF24"
              stroke="#F59E0B"
              strokeWidth="0.5"
            />
          </g>
        )}

        {/* Zzz エフェクト（can_saboru の眠そう時のみ） */}
        {config.zzz && animated && (
          <g style={{ animation: "saboruZzz 2.5s infinite" }}>
            <text x="80" y="24" fontSize="10" fill="#9CA3AF" fontWeight="700">
              z
            </text>
          </g>
        )}

        {/* ボディ (squircle) */}
        <path
          d="M 30 50 Q 30 30 50 30 L 70 30 Q 90 30 90 50 L 90 80 Q 90 100 70 100 L 50 100 Q 30 100 30 80 Z"
          fill={config.bodyColor}
          stroke={config.bodyShadow}
          strokeWidth="0"
        />

        {/* ハイライト（艶） */}
        <ellipse cx="48" cy="48" rx="10" ry="6" fill="#FFFFFF" opacity="0.25" />

        {/* 頬 */}
        <ellipse
          cx="42"
          cy="72"
          rx="6"
          ry="4"
          fill={config.cheek}
          opacity="0.7"
        />
        <ellipse
          cx="78"
          cy="72"
          rx="6"
          ry="4"
          fill={config.cheek}
          opacity="0.7"
        />

        {/* 目（sleeping override が優先） */}
        {!sleeping && config.eyeShape === "sleepy" && (
          <g>
            <path
              d="M 42 64 Q 47 67 52 64"
              stroke="#1F2937"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 68 64 Q 73 67 78 64"
              stroke="#1F2937"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
        {!sleeping && config.eyeShape === "thinking" && (
          <g>
            <circle cx="47" cy="64" r="2.5" fill="#1F2937" />
            <circle cx="73" cy="64" r="2.5" fill="#1F2937" />
            <path
              d="M 43 60 Q 47 58 51 60"
              stroke="#1F2937"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 69 60 Q 73 58 77 60"
              stroke="#1F2937"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
        {!sleeping && config.eyeShape === "shocked" && (
          <g>
            <circle cx="47" cy="64" r="3.5" fill="#1F2937" />
            <circle cx="48" cy="63" r="1.2" fill="#FFFFFF" />
            <circle cx="73" cy="64" r="3.5" fill="#1F2937" />
            <circle cx="74" cy="63" r="1.2" fill="#FFFFFF" />
          </g>
        )}

        {/* 口 */}
        {config.mouthShape === "smile" && (
          <path
            d="M 54 80 Q 60 85 66 80"
            stroke="#1F2937"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {config.mouthShape === "neutral" && (
          <path
            d="M 55 82 L 65 82"
            stroke="#1F2937"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {config.mouthShape === "ohno" && (
          <ellipse cx="60" cy="83" rx="4" ry="5" fill="#1F2937" />
        )}

        {/* 目を閉じた状態（sleeping override） */}
        {sleeping && (
          <g>
            <rect
              x="40"
              y="63"
              width="14"
              height="2.5"
              rx="1.5"
              fill="#1F2937"
            />
            <rect
              x="66"
              y="63"
              width="14"
              height="2.5"
              rx="1.5"
              fill="#1F2937"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
