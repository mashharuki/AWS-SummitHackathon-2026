import type { Verdict } from "@saboru/shared";
/**
 * 3D マテリアルカラー定数
 * U-06-ui-redesign / design-tokens.md 11.2 準拠
 *
 * 憲法1（パレット完全共有）に基づき、HTML SABORU_THEME と同じ色のみ使用。
 * 新色を独自に定義することは禁止。
 */
import * as THREE from "three";

/** verdict 別のボディマテリアル色 */
export const SABORU_3D_COLOR: Record<Verdict, THREE.Color> = {
  can_saboru: new THREE.Color("#F97316"), // = --color-saboru-orange
  borderline: new THREE.Color("#F59E0B"), // = --color-verdict-borderline
  must_do: new THREE.Color("#EF4444"), // = --color-verdict-must
};

/** verdict 別の頬（チーク）色 */
export const SABORU_3D_CHEEK: Record<Verdict, THREE.Color> = {
  can_saboru: new THREE.Color("#FED7AA"),
  borderline: new THREE.Color("#FDE68A"),
  must_do: new THREE.Color("#FECACA"),
};

/** 雲・天気の色 */
export const SABORU_3D_CLOUD_COLOR = new THREE.Color("#F3F4F6"); // = --color-saboru-line
export const SABORU_3D_CLOUD_DARK = new THREE.Color("#9CA3AF"); // 稲妻雲（must_do）
export const SABORU_3D_SUN_COLOR = new THREE.Color("#FCD34D"); // 太陽（borderline）
export const SABORU_3D_LIGHTNING = new THREE.Color("#FBBF24"); // 稲妻

/** 表情色（目・口の暗色） */
export const SABORU_3D_INK = new THREE.Color("#1F2937");

/** 接地影の色（HTML border-heavy と同じ） */
export const SABORU_3D_SHADOW = "#2B1E16";

/**
 * ペルソナ別3Dボディカラー（SaborouCharacter2D の PERSONA_BODY と色を同期）
 * 体色のみペルソナで上書きし、表情・天気は verdict 由来を維持する
 */
export const PERSONA_3D_BODY: Record<string, THREE.Color> = {
  saboru_ottori: new THREE.Color("#F97316"),
  saboru_strict: new THREE.Color("#6B7280"),
  saboru_psy: new THREE.Color("#6366F1"),
  saboru_hacker: new THREE.Color("#10B981"),
};

/** 3Dコンテナの背景色（憲法3: cream で HTML 世界観に溶け込ませる） */
export const SABORU_3D_BG_CLEAR = "#FFFAF5";

/** verdict 別の呼吸アニメーション速度倍率（design-tokens.md 11.7） */
export const BREATH_SPEED: Record<Verdict, number> = {
  can_saboru: 1.0,
  borderline: 1.5,
  must_do: 2.5,
};

/** verdict 別の雲の数（character-design-sheet.md 3.4） */
export const CLOUD_COUNT: Record<Verdict, number> = {
  can_saboru: 3, // 雲3個
  borderline: 2, // 太陽+雲2個（太陽は別レンダリング）
  must_do: 2, // 暗雲2個（稲妻は別レンダリング）
};
