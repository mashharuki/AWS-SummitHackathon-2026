/**
 * useDependencyScore — AI依存度スコアの取得・更新フック
 *
 * DynamoDB に保存された依存度スコア（0-100）をリアルタイムで管理する。
 * スコアはサボり判断を受け入れるたびに減少し、審査員に「人をダメにする体験」を即座に提供する。
 */
import apiClient from "@/lib/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_SCORE = 100;

export function useDependencyScore() {
  const [score, setScore] = useState<number>(INITIAL_SCORE);
  const [isLoading, setIsLoading] = useState(true);
  const [justDecremented, setJustDecremented] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiClient
      .getDependencyScore()
      .then(({ score: s }) => setScore(s))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const decrement = useCallback(async (delta: number) => {
    try {
      const { score: newScore } =
        await apiClient.decrementDependencyScore(delta);
      setScore(newScore);

      // シェイクアニメーション用フラグ
      setJustDecremented(true);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => setJustDecremented(false), 800);
    } catch {
      // スコア更新失敗は非致命的（楽観的UIを使わず無視）
    }
  }, []);

  return { score, isLoading, justDecremented, decrement };
}
