/**
 * Three.js キャンバスコンテナ
 * NFR-DESIGN-4: ErrorBoundary 障害分離
 * NFR-DESIGN-6: コード分割（独立chunk）+ Suspense
 */
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { Verdict } from "@saboru/shared";
import { SaborouCharacter } from "./SaborouCharacter";

interface SaborouCanvasProps {
  verdict: Verdict | null;
  isStreaming?: boolean;
  className?: string;
}

function FallbackCloud() {
  return (
    <div
      className="flex items-center justify-center w-full h-full"
      role="img"
      aria-label="サボロー"
    >
      <span className="text-6xl select-none">☁️</span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        className="w-8 h-8 border-2 border-[#FF6B2B] border-t-transparent rounded-full animate-spin"
        aria-label="読み込み中"
        role="status"
      />
    </div>
  );
}

export function SaborouCanvas({
  verdict,
  isStreaming = false,
  className = "",
}: SaborouCanvasProps) {
  return (
    <div className={`${className} bg-[#F5F4F0] rounded-2xl overflow-hidden`}>
      <ErrorBoundary fallback={<FallbackCloud />}>
        <Suspense fallback={<LoadingSpinner />}>
          <Canvas
            camera={{ position: [0, 0.5, 3], fov: 45 }}
            aria-label="サボローキャラクター"
          >
            <SaborouCharacter verdict={verdict} isStreaming={isStreaming} />
          </Canvas>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
