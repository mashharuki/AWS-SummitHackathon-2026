import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { SABORU_3D_SHADOW } from "@/lib/three/saboruColors";
/**
 * SaborouScene3D — Three.js シーン（Canvas ラッパー、Mid 仕上げ版）
 *
 * U-06-ui-redesign Phase 3 完全リメイク版（旧 SaborouCanvas.tsx 後継）
 * 準拠: design-tokens.md 11 章 / 2d-3d-coexistence-rules.md 全憲法
 *
 * 責務:
 *  - <Canvas> 設定（fov 35, position [0, 0.5, 3]）
 *  - 3点ライト + Environment sunset + ContactShadows
 *  - SaborouCharacter3D をマウント
 *  - ErrorBoundary / Suspense fallback に SaborouCharacter2D を表示（憲法5）
 *  - HTML コンテナの cream 背景に溶け込ませる（憲法3）
 *
 * 配置（憲法2, 6）:
 *  - ログインヒーロー（280px）
 *  - タスク詳細判定ヒーロー（320px）
 *  - **240px 未満では使用禁止**
 */
import { ContactShadows, Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { Verdict } from "@saboru/shared";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SaborouCharacter3D } from "./SaborouCharacter3D";

export interface SaborouScene3DProps {
  verdict: Verdict | null;
  /** SSE ストリーミング中フラグ */
  isStreaming?: boolean;
  /** コンテナ全体のピクセルサイズ（240 以上推奨。憲法2） */
  size?: number;
  className?: string;
}

export function SaborouScene3D({
  verdict,
  isStreaming = false,
  size = 320,
  className,
}: SaborouScene3DProps) {
  // 憲法2 ガード（開発時のみ警告）
  if (size < 240 && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      `[SaborouScene3D] size=${size} は憲法2（240px最小）に違反します。SaborouCharacter2D の使用を検討してください。`,
    );
  }

  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: size,
        height: size,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <ErrorBoundary fallback={<Fallback2D verdict={verdict} size={size} />}>
        <Suspense fallback={<Fallback2D verdict={verdict} size={size} />}>
          <Canvas
            camera={{ position: [0, 0.5, 3], fov: 35 }}
            style={{ background: "transparent" }}
            gl={{ antialias: true, alpha: true }}
            aria-label="サボロー 3D キャラクター"
          >
            {/* 3点ライト（design-tokens.md 11.4） */}
            <directionalLight
              position={[3, 4, 5]}
              intensity={1.2}
              color="#FFF7ED"
              castShadow
            />
            <directionalLight
              position={[-3, 2, 3]}
              intensity={0.4}
              color="#FFEDD5"
            />
            <directionalLight
              position={[0, 2, -4]}
              intensity={0.6}
              color="#F97316"
            />
            <ambientLight intensity={0.3} color="#FFFAF5" />

            {/* 環境マップ — sunset プリセット（暖色） */}
            <Environment preset="sunset" background={false} />

            {/* 接地影（design-tokens.md 11.6） */}
            <ContactShadows
              position={[0, -0.55, 0]}
              opacity={0.4}
              scale={3}
              blur={2.5}
              far={1.5}
              color={SABORU_3D_SHADOW}
            />

            <SaborouCharacter3D verdict={verdict} isStreaming={isStreaming} />
          </Canvas>

          {/* must_do 時の稲妻オーバーレイ（憲法11.8: HTML側で実装） */}
          {verdict === "must_do" && <LightningOverlay />}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/** 2D フォールバック（Suspense / ErrorBoundary 共通、憲法5） */
function Fallback2D({
  verdict,
  size,
}: {
  verdict: Verdict | null;
  size: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SaborouCharacter2D
        verdict={verdict ?? "can_saboru"}
        size={Math.min(size * 0.5, 160)}
      />
    </div>
  );
}

/** must_do 時の稲妻オーバーレイ（HTML側で点滅させる） */
function LightningOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        animation: "saboruLightning 1.5s infinite",
        boxShadow: "inset 0 0 60px rgba(251, 191, 36, 0.25)",
        borderRadius: "inherit",
      }}
    />
  );
}
