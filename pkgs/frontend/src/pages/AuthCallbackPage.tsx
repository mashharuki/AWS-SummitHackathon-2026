/**
 * Cognito OAuth コールバックページ
 * NFR-DESIGN-2: OAuth CSRF state 検証
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { exchangeCodeForTokens, validateOAuthState } from "@/lib/cognito";

export function AuthCallbackPage() {
  const { handleCallback } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      showToast("ログインがキャンセルされました", "warning");
      void navigate("/login", { replace: true });
      return;
    }

    if (!code || !state) {
      showToast("無効なコールバックパラメータです", "error");
      void navigate("/login", { replace: true });
      return;
    }

    // NFR-DESIGN-2: CSRF state 検証
    if (!validateOAuthState(state)) {
      showToast("セキュリティエラー: ログインを再試行してください", "error");
      void navigate("/login", { replace: true });
      return;
    }

    exchangeCodeForTokens(code)
      .then(async ({ accessToken, refreshToken, expiresIn }) => {
        await handleCallback(accessToken, refreshToken, expiresIn);
        void navigate("/tasks", { replace: true });
      })
      .catch(() => {
        showToast("ログイン処理に失敗しました。再試行してください", "error");
        void navigate("/login", { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen bg-[#F5F4F0] flex items-center justify-center"
      role="main"
      aria-label="ログイン処理中"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 border-2 border-[#FF6B2B] border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="処理中"
        />
        <p className="text-sm text-[#6B7280]">ログイン中...</p>
      </div>
    </div>
  );
}
