import apiClient from "@/lib/apiClient";
import type { SaboriSchedule } from "@saboru/shared";
import { useCallback, useEffect, useState } from "react";

/**
 * useGanttSchedule — タスクのスケジュール（3バンドガント）を取得するフック
 *
 * GET /api/tasks/:id/schedule を呼び、ローディング・エラー状態を管理する。
 * 判定（proposal）とは独立して取得するため、ガントの生成が判定表示を妨げない。
 *
 * キャッシュ方針:
 * - スケジュール生成はバックエンドで毎回 Bedrock 推論が走り重い。
 *   スマホではタブ切替で GanttPanel がアンマウントされるため、戻るたびに
 *   再取得 → 再推論で長時間ローディングになっていた。
 * - これを避けるため、taskId 単位のセッション内メモリキャッシュを持つ。
 *   一度取得したスケジュールはキャッシュから即表示し、再推論しない。
 * - 最新化が必要な場合は reload()（手動再計算）でキャッシュを無視して再取得する。
 *   ※ SaboriSchedule は揮発データのためサーバには保存されない。本キャッシュも
 *     ページリロードで消えるメモリ内キャッシュ（永続化しない）。
 */
interface UseGanttScheduleResult {
  schedule: SaboriSchedule | null;
  isLoading: boolean;
  error: boolean;
  /** 再取得（人物文脈変更後の再計画などで使用）。キャッシュを無視して最新化する */
  reload: () => void;
}

/** taskId → スケジュールのセッション内キャッシュ（モジュールスコープで永続） */
const scheduleCache = new Map<string, SaboriSchedule>();

export function useGanttSchedule(taskId: string): UseGanttScheduleResult {
  // 初期値はキャッシュから（あれば即表示・ローディングを挟まない）
  const [schedule, setSchedule] = useState<SaboriSchedule | null>(
    () => scheduleCache.get(taskId) ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    (force = false) => {
      if (!taskId) return;

      // キャッシュヒット時（強制再取得でなければ）は即表示し、再推論しない
      const cached = scheduleCache.get(taskId);
      if (cached && !force) {
        setSchedule(cached);
        setIsLoading(false);
        setError(false);
        return;
      }

      setIsLoading(true);
      setError(false);
      apiClient
        .getSchedule(taskId)
        .then((s) => {
          setSchedule(s);
          if (s) scheduleCache.set(taskId, s);
        })
        .catch(() => {
          setError(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [taskId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    load(true);
  }, [load]);

  return { schedule, isLoading, error, reload };
}

/** テスト用: キャッシュをクリアする（本番コードでは使用しない） */
export function __clearGanttScheduleCache(): void {
  scheduleCache.clear();
}
