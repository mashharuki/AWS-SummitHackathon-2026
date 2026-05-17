import { useReducedMotion } from "@/hooks/useReducedMotion";
/**
 * サボローキャラクター 3D コンポーネント
 * NFR-DESIGN-7: prefers-reduced-motion 対応
 * Three.js オブジェクトを命令型で生成（型エラー回避）
 */
import { useFrame, useThree } from "@react-three/fiber";
import type { Verdict } from "@saboru/shared";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface SaborouCharacterProps {
  verdict: Verdict | null;
  isStreaming?: boolean;
}

function getBodyColor(verdict: Verdict | null): string {
  if (!verdict) return "#FF6B2B";
  switch (verdict) {
    case "can_saboru":
      return "#4CAF50";
    case "borderline":
      return "#FF9800";
    case "must_do":
      return "#F44336";
  }
}

export function SaborouCharacter({
  verdict,
  isStreaming = false,
}: SaborouCharacterProps) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group | null>(null);
  const reducedMotion = useReducedMotion();
  const bodyColor = getBodyColor(verdict);

  useEffect(() => {
    const group = new THREE.Group();
    groupRef.current = group;

    const color = new THREE.Color(bodyColor);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.1,
    });

    // ボディ
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), mat);
    group.add(body);

    // 頭
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 32, 32),
      mat.clone(),
    );
    head.position.set(0, 0.8, 0);
    group.add(head);

    // 目
    const whiteMat = new THREE.MeshStandardMaterial({ color: "#FFFFFF" });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#1A1A1A" });

    const eyePositions: [number, number, number][] = [
      [-0.12, 0.85, 0.3],
      [0.12, 0.85, 0.3],
    ];
    const pupilPositions: [number, number, number][] = [
      [-0.12, 0.85, 0.36],
      [0.12, 0.85, 0.36],
    ];

    for (const pos of eyePositions) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        whiteMat,
      );
      eye.position.set(...pos);
      group.add(eye);
    }
    for (const pos of pupilPositions) {
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 16, 16),
        darkMat,
      );
      pupil.position.set(...pos);
      group.add(pupil);
    }

    // 口 (笑顔)
    const mouthGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI);
    const mouthMesh = new THREE.Mesh(mouthGeo, darkMat.clone());
    mouthMesh.position.set(0, 0.72, 0.33);
    group.add(mouthMesh);

    // ライト
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    group.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(2, 3, 2);
    group.add(dirLight);
    const ptLight = new THREE.PointLight(0xff6b2b, 0.5);
    ptLight.position.set(-2, 1, 1);
    group.add(ptLight);

    scene.add(group);
    return () => {
      scene.remove(group);
      mat.dispose();
      whiteMat.dispose();
      darkMat.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyColor, scene]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || reducedMotion) return;

    const t = clock.getElapsedTime();
    const bodyMesh = group.children[0] as THREE.Mesh | undefined;
    const headMesh = group.children[1] as THREE.Mesh | undefined;

    if (bodyMesh) {
      bodyMesh.position.y = Math.sin(t * 1.5) * 0.1;
      bodyMesh.rotation.z = isStreaming
        ? Math.sin(t * 6) * 0.15
        : Math.sin(t * 1.2) * 0.05;
    }
    if (headMesh) {
      headMesh.position.y = 0.8 + Math.sin(t * 1.5) * 0.1;
      headMesh.rotation.z = isStreaming
        ? Math.sin(t * 6 + 0.5) * 0.1
        : Math.sin(t * 1.2) * 0.03;
    }
  });

  return null;
}
