import apiClient, { type ApproveOverridesPayload } from "@/lib/apiClient";
import { toUserMessage } from "@/lib/utils";
import type { Task, TaskCandidate } from "@saboru/shared";
/**
 * タスク管理フック
 * NFR-DESIGN-3: 楽観的更新パターン
 */
import { useCallback, useEffect, useState } from "react";
import { useToast } from "./useToast";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [candidates, setCandidates] = useState<TaskCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [t, c] = await Promise.all([
        apiClient.getTasks(),
        apiClient.getCandidates(),
      ]);
      setTasks(t);
      setCandidates(c);
    } catch (err) {
      showToast(toUserMessage(err), "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  /**
   * NFR-DESIGN-3: 楽観的承認
   *
   * 承認確認モーダルで「確定して承認」されたタイミングで呼ばれる。
   * overrides にはモーダルで編集された内容（title/deadline/description/plannedSteps）が入る。
   * 楽観的削除はこの呼び出し時点（＝確定時点）で行う。モーダルを開いただけでは消さない。
   */
  const approveCandidate = useCallback(
    async (candidateId: string, overrides?: ApproveOverridesPayload) => {
      // スナップショット
      const rollbackCandidates = [...candidates];
      const rollbackTasks = [...tasks];

      // 楽観的削除
      setCandidates((prev) =>
        prev.filter((c) => c.candidateId !== candidateId),
      );

      try {
        const approved = await apiClient.approveCandidate(
          candidateId,
          overrides,
        );
        setTasks((prev) => [...prev, approved]);
        showToast("タスクを承認しました", "success");
      } catch (err) {
        // ロールバック
        setCandidates(rollbackCandidates);
        setTasks(rollbackTasks);
        showToast(toUserMessage(err), "error");
      }
    },
    [candidates, tasks, showToast],
  );

  const rejectCandidate = useCallback(
    async (candidateId: string) => {
      const rollback = [...candidates];
      setCandidates((prev) =>
        prev.filter((c) => c.candidateId !== candidateId),
      );

      try {
        await apiClient.rejectCandidate(candidateId);
        showToast("タスクを却下しました", "info");
      } catch (err) {
        setCandidates(rollback);
        showToast(toUserMessage(err), "error");
      }
    },
    [candidates, showToast],
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      data: { title?: string; deadline?: string | null; description?: string },
    ) => {
      try {
        const updated = await apiClient.updateTask(taskId, data);
        setTasks((prev) =>
          prev.map((t) => (t.taskId === taskId ? updated : t)),
        );
        showToast("タスクを更新しました", "success");
        return updated;
      } catch (err) {
        showToast(toUserMessage(err), "error");
        throw err;
      }
    },
    [showToast],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const rollback = [...tasks];
      setTasks((prev) => prev.filter((t) => t.taskId !== taskId));

      try {
        await apiClient.deleteTask(taskId);
        showToast("タスクを削除しました", "info");
      } catch (err) {
        setTasks(rollback);
        showToast(toUserMessage(err), "error");
      }
    },
    [tasks, showToast],
  );

  const createTask = useCallback(
    async (data: {
      title: string;
      deadline?: string | null;
      description?: string;
    }) => {
      try {
        const created = await apiClient.createTask(data);
        setTasks((prev) => [created, ...prev]);
        showToast("タスクを追加しました", "success");
        return created;
      } catch (err) {
        showToast(toUserMessage(err), "error");
        throw err;
      }
    },
    [showToast],
  );

  return {
    tasks,
    candidates,
    isLoading,
    refresh: fetchAll,
    approveCandidate,
    rejectCandidate,
    updateTask,
    deleteTask,
    createTask,
  };
}
