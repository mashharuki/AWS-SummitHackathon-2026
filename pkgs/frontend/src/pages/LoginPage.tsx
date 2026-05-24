import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { useAuth } from "@/hooks/useAuth";
/**
 * ログインページ — U-06-ui-redesign Phase 5 改修版
 *
 * 共有 HTML LoginScreen 準拠（ネオブルータリズム + 3D ヒーロー）
 * Cognito Hosted UI へのリダイレクト起点。
 * 3D ヒーロー（280px）でブランドのインパクトを提示し、
 * ボタン押下で Cognito（Cognito Hosted UI 経由でメール/PW認証）に遷移する。
 */
import { Suspense, lazy, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

// 3D ヒーローは遅延ロード（憲法: 初期バンドル外）
const SaborouScene3D = lazy(() =>
  import("@/components/three/SaborouScene3D").then((m) => ({
    default: m.SaborouScene3D,
  })),
);

export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate("/tasks", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <main className="min-h-screen bg-saboru-cream flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* 3D ヒーロー（憲法2,3,4,6 準拠） */}
        <div className="brutal-3d-container" style={{ height: 280 }}>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SaborouCharacter2D verdict="can_saboru" size={160} />
              </div>
            }
          >
            <SaborouScene3D verdict="can_saboru" size={280} />
          </Suspense>
        </div>

        {/* ブランド名 + キャッチコピー */}
        <div className="text-center">
          <h1
            className="text-saboru-ink"
            style={{
              fontFamily: "Space Grotesk, system-ui, sans-serif",
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: "-0.04em",
            }}
          >
            SABOROU
          </h1>
          <p className="text-saboru-ink-soft mt-1" style={{ fontSize: 12 }}>
            {t("login.tagline")}
          </p>
        </div>

        {/* 認証カード */}
        <div className="card-brutal-lg p-5">
          <h2
            className="text-center text-saboru-ink font-bold"
            style={{ fontSize: 15 }}
          >
            {t("login.startTitle")}
          </h2>
          <p
            className="text-center text-saboru-ink-muted mt-1 mb-4"
            style={{ fontSize: 11 }}
          >
            {t("login.startDescription")}
          </p>

          <button
            type="button"
            onClick={signIn}
            disabled={isLoading}
            className="btn-brutal-primary w-full"
            aria-label={t("login.loginAria")}
          >
            {isLoading ? t("login.authenticating") : t("login.loginOrSignup")}
          </button>

          {/* Cognito バッジ */}
          <div
            className="mt-4 flex items-center justify-center gap-1.5"
            style={{ fontSize: 10 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#DD344C"
                d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
              />
              <path
                fill="#FFF"
                d="M12 7a3 3 0 100 6 3 3 0 000-6zm0 8c-2 0-6 1-6 3v1h12v-1c0-2-4-3-6-3z"
              />
            </svg>
            <span className="text-saboru-ink-soft">{t("login.securedBy")}</span>
            <span
              className="font-extrabold"
              style={{
                color: "#232F3E",
                fontFamily: "Space Grotesk, system-ui, sans-serif",
              }}
            >
              Amazon Cognito
            </span>
          </div>
        </div>

        {/* 特徴リスト */}
        <ul
          aria-label={t("login.featuresAria")}
          className="flex flex-col gap-2"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {(t("login.features", { returnObjects: true }) as string[]).map(
            (feature) => (
              <li
                key={feature}
                className="text-saboru-ink-soft text-center"
                style={{ fontSize: 12 }}
              >
                {feature}
              </li>
            ),
          )}
        </ul>
      </div>
    </main>
  );
}
