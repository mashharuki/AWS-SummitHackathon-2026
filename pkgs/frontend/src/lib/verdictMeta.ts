/**
 * Verdict メタ情報定義
 * U-06-ui-redesign / character-design-sheet.md カラーチャート準拠
 *
 * API 値 (Verdict: can_saboru | borderline | must_do) をキーとし、
 * HTML 共有モックの caution/danger 概念をフロント側で吸収する。
 */
import type { Verdict } from "@saboru/shared";

export interface VerdictMeta {
  /** verdict ラベル（日本語） */
  label: string;
  /** ラベルに添える絵文字 */
  emoji: string;
  /** アクセントカラー（バッジ・ボーダー） */
  color: string;
  /** 背景色（薄い verdict 色） */
  bg: string;
  /** SVG キャラ・3D マテリアルのボディ色 */
  bodyColor: string;
  /** ボディ色の暗いシャドウバリエーション */
  bodyShadow: string;
  /** 頬（チーク）色 */
  cheek: string;
  /** 一覧カード等の短いラベル */
  short: string;
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  can_saboru: {
    label: "サボれます",
    emoji: "☁️",
    color: "#10B981",
    bg: "#ECFDF5",
    bodyColor: "#F97316",
    bodyShadow: "#EA580C",
    cheek: "#FED7AA",
    short: "寝かせOK",
  },
  borderline: {
    label: "要検討",
    emoji: "🌤️",
    color: "#F59E0B",
    bg: "#FFFBEB",
    bodyColor: "#F59E0B",
    bodyShadow: "#D97706",
    cheek: "#FDE68A",
    short: "そろそろ",
  },
  must_do: {
    label: "やるしかない",
    emoji: "⚡",
    color: "#EF4444",
    bg: "#FEF2F2",
    bodyColor: "#EF4444",
    bodyShadow: "#DC2626",
    cheek: "#FECACA",
    short: "今すぐ",
  },
};

/** SaborouCharacter2D 内部用：表情・天気の verdict 別設定 */
export type SaboruEyeShape = "sleepy" | "thinking" | "shocked";
export type SaboruMouthShape = "smile" | "neutral" | "ohno";
export type SaboruWeather = "cloud" | "sun_cloud" | "lightning";

export interface VerdictSvgConfig {
  bodyColor: string;
  bodyShadow: string;
  cheek: string;
  weather: SaboruWeather;
  eyeShape: SaboruEyeShape;
  mouthShape: SaboruMouthShape;
  /** Zzz エフェクトを表示するか */
  zzz: boolean;
}

export const VERDICT_SVG_CONFIG: Record<Verdict, VerdictSvgConfig> = {
  can_saboru: {
    bodyColor: "#F97316",
    bodyShadow: "#EA580C",
    cheek: "#FED7AA",
    weather: "cloud",
    eyeShape: "sleepy",
    mouthShape: "smile",
    zzz: true,
  },
  borderline: {
    bodyColor: "#F59E0B",
    bodyShadow: "#D97706",
    cheek: "#FDE68A",
    weather: "sun_cloud",
    eyeShape: "thinking",
    mouthShape: "neutral",
    zzz: false,
  },
  must_do: {
    bodyColor: "#EF4444",
    bodyShadow: "#DC2626",
    cheek: "#FECACA",
    weather: "lightning",
    eyeShape: "shocked",
    mouthShape: "ohno",
    zzz: false,
  },
};

/** QuickReply ラベル定義（API 固定 4 値の UI 表示文言） */
export const QUICK_REPLY_LABELS: Record<
  "truly_tired" | "actually_important" | "agree_with_ai" | "disagree_with_ai",
  string
> = {
  truly_tired: "確かに、もう少し寝かせよう",
  actually_important: "でもこのタスク急ぎかも...",
  agree_with_ai: "15分だけやってみる",
  disagree_with_ai: "完全に無視したい",
};
