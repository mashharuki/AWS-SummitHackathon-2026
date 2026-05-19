/**
 * サービス連携状態管理フック
 */
import { useCallback, useEffect, useState } from "react";
import type { ServiceConnection } from "@saboru/shared";
import apiClient from "@/lib/apiClient";
import { toUserMessage } from "@/lib/utils";
import { useToast } from "./useToast";

export function useConnections() {
  const [connections, setConnections] = useState<ServiceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const fetchConnections = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getConnections();
      setConnections(data);
    } catch (err) {
      showToast(toUserMessage(err), "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const disconnect = useCallback(
    async (service: string) => {
      const rollback = [...connections];
      setConnections((prev) =>
        prev.map((c) =>
          c.service === service ? { ...c, status: "disconnected" as const } : c,
        ),
      );

      try {
        await apiClient.disconnectService(service);
        showToast(`${service} の連携を解除しました`, "info");
      } catch (err) {
        setConnections(rollback);
        showToast(toUserMessage(err), "error");
      }
    },
    [connections, showToast],
  );

  const getConnection = useCallback(
    (service: string) => connections.find((c) => c.service === service) ?? null,
    [connections],
  );

  return {
    connections,
    isLoading,
    disconnect,
    getConnection,
    refresh: fetchConnections,
  };
}
