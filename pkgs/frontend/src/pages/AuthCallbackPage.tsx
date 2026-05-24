import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { exchangeCodeForTokens, validateOAuthState } from "@/lib/cognito";
/**
 * Cognito OAuth コールバックページ
 * NFR-DESIGN-2: OAuth CSRF state 検証
 */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export function AuthCallbackPage() {
  const { t } = useTranslation();
  const { handleCallback } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const processingRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional run-once mount effect
  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      showToast(t("authCallback.cancelled"), "warning");
      void navigate("/login", { replace: true });
      return;
    }

    if (!code || !state) {
      showToast(t("authCallback.invalidParams"), "error");
      void navigate("/login", { replace: true });
      return;
    }

    // NFR-DESIGN-2: CSRF state 検証
    if (!validateOAuthState(state)) {
      showToast(t("authCallback.securityError"), "error");
      void navigate("/login", { replace: true });
      return;
    }

    const codeVerifier = sessionStorage.getItem("pkce_verifier") ?? undefined;
    sessionStorage.removeItem("pkce_verifier");

    exchangeCodeForTokens(code, codeVerifier)
      .then(async ({ accessToken, idToken, refreshToken, expiresIn }) => {
        await handleCallback(accessToken, idToken, refreshToken, expiresIn);
        void navigate("/tasks", { replace: true });
      })
      .catch(() => {
        showToast(t("authCallback.failed"), "error");
        void navigate("/login", { replace: true });
      });
  }, []);

  return (
    <main
      className="min-h-screen bg-[#F5F4F0] flex items-center justify-center"
      aria-label={t("authCallback.processingAria")}
    >
      <div className="flex flex-col items-center gap-4">
        <output
          className="w-12 h-12 border-2 border-[#FF6B2B] border-t-transparent rounded-full animate-spin"
          aria-label={t("authCallback.spinnerAria")}
        />
        <p className="text-sm text-[#6B7280]">{t("authCallback.loggingIn")}</p>
      </div>
    </main>
  );
}
