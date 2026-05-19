/**
 * サボローチャット SSE ストリーミングフック
 * Vercel AI SDK useChat ラッパー
 * NFR-DESIGN-5: SSE 自動リトライパターン
 */
import { useChat } from "ai/react";
import { useCallback, useRef, useState } from "react";
import type { Proposal, Verdict } from "@saboru/shared";
import apiClient from "@/lib/apiClient";
import { getAccessToken } from "@/lib/cognito";
import { useToast } from "./useToast";

interface UseProposalStreamOptions {
  taskId: string;
  onProposalReady?: (proposal: Proposal) => void;
}

export function useProposalStream({
  taskId,
  onProposalReady,
}: UseProposalStreamOptions) {
  const { showToast } = useToast();
  const retryCount = useRef(0);
  const [fallbackProposal, setFallbackProposal] = useState<Proposal | null>(
    null,
  );
  const [currentVerdict, setCurrentVerdict] = useState<Verdict | null>(null);

  const { messages, append, isLoading, error, setMessages } = useChat({
    api: apiClient.buildProposalStreamUrl(taskId),
    fetch: async (input, init) => {
      const token = getAccessToken();
      return fetch(input, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token ?? ""}`,
        },
      });
    },
    streamProtocol: "text",
    onFinish: (_message) => {
      // 完了時にProposalをフェッチして verdict を取得
      void apiClient.getProposal(taskId).then((proposal) => {
        if (proposal) {
          setCurrentVerdict(proposal.verdict);
          setFallbackProposal(proposal);
          onProposalReady?.(proposal);
        }
      });
    },
    onError: async (_err) => {
      if (retryCount.current < 1) {
        retryCount.current += 1;
        // 自動リトライ
        return;
      }
      // フォールバック: 非ストリーミングで取得
      try {
        const proposal = await apiClient.getProposal(taskId);
        if (proposal) {
          setFallbackProposal(proposal);
          setCurrentVerdict(proposal.verdict);
          onProposalReady?.(proposal);
        }
      } catch {
        showToast("サボローとの通信に失敗しました", "error");
      }
    },
  });

  /** チャットを開始（最初のSSEリクエスト） */
  const startProposal = useCallback(async () => {
    retryCount.current = 0;
    setMessages([]);
    await append({
      role: "user",
      content: "このタスクを評価してください",
    });
  }, [append, setMessages]);

  /** クイックリプライ送信 */
  const sendQuickReply = useCallback(
    async (content: string) => {
      await append({
        role: "user",
        content,
      });
    },
    [append],
  );

  /** 本音フィードバック送信 */
  const sendFreeText = useCallback(
    async (text: string) => {
      await append({
        role: "user",
        content: text,
      });
      // honne API にも記録
      try {
        await apiClient.submitHonne(taskId, {
          type: "free_text",
          content: text,
        });
      } catch {
        // honne記録失敗は非致命的
      }
    },
    [append, taskId],
  );

  return {
    messages,
    isStreaming: isLoading,
    error,
    fallbackProposal,
    currentVerdict,
    startProposal,
    sendQuickReply,
    sendFreeText,
  };
}
