import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  BREATH_SPEED,
  CLOUD_COUNT,
  SABORU_3D_CHEEK,
  SABORU_3D_CLOUD_COLOR,
  SABORU_3D_CLOUD_DARK,
  SABORU_3D_COLOR,
  SABORU_3D_INK,
  SABORU_3D_LIGHTNING,
  SABORU_3D_SUN_COLOR,
} from "@/lib/three/saboruColors";
/**
 * SaborouCharacter3D — Three.js キャラクター（Mid 仕上げ）
 *
 * U-06-ui-redesign Phase 3 完全リメイク版
 * 準拠: design-tokens.md 11 章 / character-design-sheet.md 全章 /
 *      2d-3d-coexistence-rules.md 憲法 1, 5
 *
 * Mid 仕上げ完了基準（migration-plan.md Phase 3）:
 *  ✅ squircle ボディ（球体ではない）— RoundedBox 採用
 *  ✅ 頭上の雲が verdict 連動で表示
 *  ✅ 呼吸アニメーション
 *  ✅ 表情が verdict 連動で変化
 *  ✅ 色が HTML パレットと一致
 *
 * 上記以外（接地影・環境マップ・3点ライト）は親 SaborouScene3D が担当。
 */
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Verdict } from "@saboru/shared";
import { useMemo, useRef } from "react";
import type * as THREE from "three";

export interface SaborouCharacter3DProps {
  verdict: Verdict | null;
  /** SSE ストリーミング中はアイドル動作のみ（呼吸+まばたき） */
  isStreaming?: boolean;
}

export function SaborouCharacter3D({
  verdict,
  isStreaming = false,
}: SaborouCharacter3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cloudGroupRef = useRef<THREE.Group>(null);
  const reducedMotion = useReducedMotion();

  // verdict が null のときは can_saboru 相当として扱う（憲法5: 同じ顔の維持）
  const v: Verdict = verdict ?? "can_saboru";

  // verdict 別マテリアル（再生成を避けるため useMemo）
  const bodyColor = useMemo(() => SABORU_3D_COLOR[v], [v]);
  const cheekColor = useMemo(() => SABORU_3D_CHEEK[v], [v]);
  const breathSpeed = BREATH_SPEED[v];
  const cloudCount = CLOUD_COUNT[v];

  // 呼吸アニメ + ボブ
  useFrame((state) => {
    if (!groupRef.current || reducedMotion) return;
    const t = state.clock.elapsedTime;

    // 呼吸（Y軸スケール、verdict 別速度）
    const breath = 1 + Math.sin(t * breathSpeed) * 0.02;
    groupRef.current.scale.set(1, breath, 1);

    // ボブ（HTML 2D saboruBob と合わせる）
    const bobY = Math.sin(t * (Math.PI / 2)) * 0.04;
    const bobRot = Math.sin(t * (Math.PI / 2)) * 0.035;
    groupRef.current.position.y = bobY;
    groupRef.current.rotation.z = bobRot;

    // 雲のゆるい揺れ
    if (cloudGroupRef.current) {
      cloudGroupRef.current.position.x = Math.sin(t * 0.4) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {/* ─── ボディ（squircle / character-design-sheet.md 2.2） ─── */}
      <RoundedBox
        args={[1.0, 1.05, 0.8]}
        radius={0.18}
        smoothness={4}
        creaseAngle={0.4}
      >
        <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0} />
      </RoundedBox>

      {/* ハイライト（艶） — 左上の小さい白楕円 */}
      <mesh position={[-0.2, 0.18, 0.41]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.25} />
      </mesh>

      {/* ─── 頬 ─── */}
      <Cheek position={[-0.27, -0.1, 0.41]} color={cheekColor} />
      <Cheek position={[0.27, -0.1, 0.41]} color={cheekColor} />

      {/* ─── 目（verdict 別） ─── */}
      <Eyes verdict={v} isStreaming={isStreaming} />

      {/* ─── 口（verdict 別） ─── */}
      <Mouth verdict={v} />

      {/* ─── 頭上の天気 ─── */}
      <group ref={cloudGroupRef} position={[0, 0.95, 0]}>
        {v === "can_saboru" && <CloudGroup count={cloudCount} dark={false} />}
        {v === "borderline" && (
          <>
            <Sun />
            <CloudGroup count={cloudCount} dark={false} offsetX={0.25} />
          </>
        )}
        {v === "must_do" && (
          <>
            <CloudGroup count={cloudCount} dark={true} />
            <Lightning />
          </>
        )}
      </group>
    </group>
  );
}

/* ─── 補助コンポーネント ────────────────────────────── */

function Cheek({
  position,
  color,
}: {
  position: [number, number, number];
  color: THREE.Color;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </mesh>
  );
}

function Eyes({
  verdict,
  isStreaming,
}: { verdict: Verdict; isStreaming: boolean }) {
  // ストリーミング中は can_saboru 相当の眠そう目に固定（character-design-sheet.md）
  const shape = isStreaming ? "sleepy" : verdictToEye(verdict);

  if (shape === "sleepy") {
    // 眠そう（弧）— Torus の半周で表現
    return (
      <>
        <SleepyEye position={[-0.108, 0.05, 0.42]} />
        <SleepyEye position={[0.108, 0.05, 0.42]} />
      </>
    );
  }

  if (shape === "thinking") {
    // 点目 + 上に眉
    return (
      <>
        <DotEye position={[-0.108, 0.05, 0.42]} />
        <DotEye position={[0.108, 0.05, 0.42]} />
        <SleepyEye position={[-0.108, 0.13, 0.42]} small />
        <SleepyEye position={[0.108, 0.13, 0.42]} small />
      </>
    );
  }

  // shocked — 大きな黒丸 + 白ハイライト
  return (
    <>
      <ShockedEye position={[-0.108, 0.05, 0.42]} />
      <ShockedEye position={[0.108, 0.05, 0.42]} />
    </>
  );
}

function SleepyEye({
  position,
  small = false,
}: {
  position: [number, number, number];
  small?: boolean;
}) {
  const radius = small ? 0.025 : 0.04;
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.008, 8, 16, Math.PI]} />
      <meshBasicMaterial color={SABORU_3D_INK} />
    </mesh>
  );
}

function DotEye({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.025, 10, 10]} />
      <meshBasicMaterial color={SABORU_3D_INK} />
    </mesh>
  );
}

function ShockedEye({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color={SABORU_3D_INK} />
      </mesh>
      <mesh position={[0.01, 0.005, 0.035]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

function Mouth({ verdict }: { verdict: Verdict }) {
  if (verdict === "can_saboru") {
    // smile — 弧
    return (
      <mesh position={[0, -0.25, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.008, 8, 16, Math.PI]} />
        <meshBasicMaterial color={SABORU_3D_INK} />
      </mesh>
    );
  }
  if (verdict === "borderline") {
    // neutral — 一文字
    return (
      <mesh position={[0, -0.27, 0.42]}>
        <boxGeometry args={[0.1, 0.012, 0.01]} />
        <meshBasicMaterial color={SABORU_3D_INK} />
      </mesh>
    );
  }
  // ohno — 縦長楕円
  return (
    <mesh position={[0, -0.27, 0.42]} scale={[1, 1.3, 1]}>
      <sphereGeometry args={[0.04, 12, 12]} />
      <meshBasicMaterial color={SABORU_3D_INK} />
    </mesh>
  );
}

function CloudGroup({
  count,
  dark,
  offsetX = 0,
}: {
  count: number;
  dark: boolean;
  offsetX?: number;
}) {
  const color = dark ? SABORU_3D_CLOUD_DARK : SABORU_3D_CLOUD_COLOR;
  // viewBox 120 系の (42,18) (58,14) (74,18) を 3D 座標換算
  // squircle 上端 +0.525 から +0.5 上方 = y ≈ 1.0 に配置（親 group が y=0.95）
  const positions: Array<[number, number, number]> = [
    [-0.3 + offsetX, 0, 0],
    [0 + offsetX, 0.06, 0.05],
    [0.3 + offsetX, 0, 0],
  ];
  return (
    <>
      {positions.slice(0, count).map((pos, i) => (
        <mesh key={i} position={pos} scale={[1, 0.55, 0.8]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0}
            transparent
            opacity={dark ? 0.95 : 0.85}
          />
        </mesh>
      ))}
    </>
  );
}

function Sun() {
  return (
    <mesh position={[-0.35, 0, 0]}>
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial
        color={SABORU_3D_SUN_COLOR}
        emissive={SABORU_3D_SUN_COLOR}
        emissiveIntensity={0.6}
        roughness={0.4}
      />
    </mesh>
  );
}

function Lightning() {
  // 雲の下に伸びる稲妻（簡易ジオメトリ）
  // HTML の path d="M 58 22 L 54 32 L 60 30 L 56 40 L 66 28 L 60 30 L 64 22 Z" を立体化
  return (
    <group position={[0, -0.15, 0.05]}>
      <mesh rotation={[0, 0, -0.2]} scale={[0.5, 1, 0.3]}>
        <coneGeometry args={[0.05, 0.25, 4]} />
        <meshStandardMaterial
          color={SABORU_3D_LIGHTNING}
          emissive={SABORU_3D_LIGHTNING}
          emissiveIntensity={0.8}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function verdictToEye(v: Verdict): "sleepy" | "thinking" | "shocked" {
  if (v === "can_saboru") return "sleepy";
  if (v === "borderline") return "thinking";
  return "shocked";
}
