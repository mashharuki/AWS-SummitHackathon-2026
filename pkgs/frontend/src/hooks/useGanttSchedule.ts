import apiClient from "@/lib/apiClient";
import type { SaboriSchedule } from "@saboru/shared";
import { useCallback, useEffect, useState } from "react";

/**
 * useGanttSchedule — タスクのスケジュール（3バンドガント）を取得するフック
 *
 * GET /api/tasks/:id/schedule を呼び、ローディング・エラー状態を管理する。
 * 判定（proposal）とは独立して取得するため、ガントの生成が判定表示を妨げない。
 */
interface UseGanttScheduleResult {
  schedule: SaboriSchedule | null;
  isLoading: boolean;
  error: boolean;
  /** 再取得（人物文脈変更後の再計画などで使用） */
  reload: () => void;
}

export function useGanttSchedule(taskId: string): UseGanttScheduleResult {
  const [schedule, setSchedule] = useState<SaboriSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!taskId) return;
    setIsLoading(true);
    setError(false);
    apiClient
      .getSchedule(taskId)
      .then((s) => {
        setSchedule(s);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  return { schedule, isLoading, error, reload: load };
}
