/**
 * useSaboriGamification — ゲーミフィケーション状態管理フック
 *
 * AI依存度スコア、コンボ状態、サボりグレード、称号解除イベントを一元管理する。
 * localStorage を使い、セッション間で状態を永続化する。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  incrementManualProgress,
  loadManualProgress,
} from "@/components/ui/ManualProgressCard";
import {
  type StreakState,
  loadStreakState,
  updateStreak,
} from "@/components/ui/SaboriStreakBadge";
import apiClient from "@/lib/apiClient";
import {
  type ComboState,
  type DependencyPhase,
  type SaboriGrade,
  type TitleInfo,
  calcSaboriGrade,
  getComboMultiplier,
  getTitleInfo,
  isTitleChanged,
} from "@/lib/gamificationUtils";

const STORAGE_KEY_COMBO = "saborou_combo";
const STORAGE_KEY_SCORE = "saborou_dependency_score";

interface GamificationState {
  /** AI依存度スコア（0〜100）*/
  dependencyScore: number;
  /** スコアローディング中か */
  isLoading: boolean;
  /** スコアが増加した直後か（アニメーション用） */
  justIncremented: boolean;
  /** 現在の称号情報 */
  titleInfo: TitleInfo;
  /** 現在のフェーズ（1〜4） */
  phase: DependencyPhase;
  /** コンボ状態 */
  combo: ComboState;
  /** 最新のサボりグレード */
  currentGrade: SaboriGrade | null;
  /** 称号解除イベント（null でなければ演出を表示する） */
  titleUnlockEvent: TitleInfo | null;
  /** A+ ジャックポットイベントが発生したか */
  isJackpot: boolean;
  /** ストリーク状態 */
  streak: StreakState;
  /** 本音取扱説明書の完成度（0〜100） */
  manualProgress: number;
}

interface GamificationActions {
  /**
   * サボり判定を記録してスコア・コンボ・ストリークを更新する
   */
  recordSaboriResult: (params: {
    verdict: "can_saboru" | "borderline" | "must_do";
    signalCount?: number;
  }) => Promise<void>;
  /** 称号解除演出の完了を通知する */
  clearTitleUnlockEvent: () => void;
  /** ジャックポット演出の完了を通知する */
  clearJackpot: () => void;
  /** 本音送信時に取扱説明書の完成度を更新する */
  recordHonneSubmit: () => void;
}

const SCORE_INCREMENT_PER_SABORI = 5; // サボるたびにスコアアップ
const COMBO_RESET_VERDICTS: Array<"can_saboru" | "borderline" | "must_do"> = [
  "must_do",
];

export function useSaboriGamification(): GamificationState &
  GamificationActions {
  const [dependencyScore, setDependencyScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [justIncremented, setJustIncremented] = useState(false);
  const [combo, setCombo] = useState<ComboState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMBO);
      if (stored) return JSON.parse(stored) as ComboState;
    } catch {
      // ignore
    }
    return { count: 0, isActive: false, multiplier: 1.0 };
  });
  const [currentGrade, setCurrentGrade] = useState<SaboriGrade | null>(null);
  const [titleUnlockEvent, setTitleUnlockEvent] = useState<TitleInfo | null>(
    null,
  );
  const [isJackpot, setIsJackpot] = useState(false);

  const [streak, setStreak] = useState<StreakState>(() => loadStreakState());
  const [manualProgress, setManualProgress] = useState<number>(() =>
    loadManualProgress(),
  );

  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScoreRef = useRef<number>(0);

  // 初回ロード: API または localStorage からスコアを復元
  useEffect(() => {
    const localScore = Number.parseInt(
      localStorage.getItem(STORAGE_KEY_SCORE) ?? "0",
      10,
    );
    setDependencyScore(localScore);
    prevScoreRef.current = localScore;

    apiClient
      .getDependencyScore()
      .then(({ score: s }) => {
        // API スコアは「自己判断力（100から下がる）」として設計されているため
        // ゲーミフィケーション表示用に「AI依存度（0から上がる）」に変換する
        const aiDependency = Math.max(0, Math.min(100, 100 - s));
        setDependencyScore(aiDependency);
        prevScoreRef.current = aiDependency;
        localStorage.setItem(STORAGE_KEY_SCORE, String(aiDependency));
      })
      .catch(() => {
        // API 失敗時は localStorage の値を使用
      })
      .finally(() => setIsLoading(false));
  }, []);

  // コンボ状態を localStorage に永続化
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMBO, JSON.stringify(combo));
    } catch {
      // ignore
    }
  }, [combo]);

  const recordSaboriResult = useCallback(
    async (params: {
      verdict: "can_saboru" | "borderline" | "must_do";
      signalCount?: number;
    }) => {
      const { verdict, signalCount } = params;

      // コンボ更新
      let newCombo: ComboState;
      if (COMBO_RESET_VERDICTS.includes(verdict)) {
        newCombo = { count: 0, isActive: false, multiplier: 1.0 };
      } else {
        const newCount = combo.count + 1;
        const multiplier = getComboMultiplier(newCount);
        newCombo = { count: newCount, isActive: true, multiplier };
      }
      setCombo(newCombo);

      // グレード算出
      const grade = calcSaboriGrade({
        verdict,
        signalCount,
        dependencyScore,
        isComboActive: newCombo.isActive,
      });
      setCurrentGrade(grade);

      // A+ ジャックポット
      if (grade === "A+") {
        setIsJackpot(true);
      }

      // ストリーク更新（サボり判定のみ）
      if (verdict === "can_saboru") {
        const newStreak = updateStreak(streak);
        setStreak(newStreak);
      }

      // スコア増加（サボり判定のみ）
      if (verdict === "can_saboru") {
        const delta = Math.round(
          SCORE_INCREMENT_PER_SABORI * newCombo.multiplier,
        );
        const newScore = Math.min(100, dependencyScore + delta);
        const prevScore = prevScoreRef.current;
        prevScoreRef.current = newScore;

        setDependencyScore(newScore);
        localStorage.setItem(STORAGE_KEY_SCORE, String(newScore));

        // シェイクアニメーション用フラグ
        setJustIncremented(true);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(
          () => setJustIncremented(false),
          800,
        );

        // 称号解除イベント検出
        if (isTitleChanged(prevScore, newScore)) {
          setTitleUnlockEvent(getTitleInfo(newScore));
        }

        // API にスコア変化を送信（fire-and-forget）
        try {
          await apiClient.decrementDependencyScore(-delta); // 負のdeltaで逆方向更新
        } catch {
          // 非致命的
        }
      }
    },
    [combo, dependencyScore, streak],
  );

  const clearTitleUnlockEvent = useCallback(() => {
    setTitleUnlockEvent(null);
  }, []);

  const clearJackpot = useCallback(() => {
    setIsJackpot(false);
  }, []);

  const recordHonneSubmit = useCallback(() => {
    setManualProgress((prev) => incrementManualProgress(prev));
  }, []);

  const titleInfo = getTitleInfo(dependencyScore);

  return {
    dependencyScore,
    isLoading,
    justIncremented,
    titleInfo,
    phase: titleInfo.phase,
    combo,
    currentGrade,
    titleUnlockEvent,
    isJackpot,
    streak,
    manualProgress,
    recordSaboriResult,
    clearTitleUnlockEvent,
    clearJackpot,
    recordHonneSubmit,
  };
}
