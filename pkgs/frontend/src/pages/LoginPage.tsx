/**
 * ログインページ
 * モックUI saborou_v2_01-login.png に忠実に実装
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

/** Googleアイコン（SVG） */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
        fill="#4285F4"
      />
      <path
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
        fill="#34A853"
      />
      <path
        d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"
        fill="#FBBC05"
      />
      <path
        d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate("/tasks", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div
      className="min-h-screen bg-[#F5F4F0] flex items-center justify-center px-4"
      role="main"
    >
      <div className="w-full max-w-xs">
        {/* ロゴカード */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-4">
          {/* ロゴ */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl bg-[#FF6B2B] flex items-center justify-center mb-3 shadow-md"
              aria-hidden="true"
            >
              <span className="text-white font-bold text-2xl">S</span>
            </div>
            <h1 className="text-xl font-bold text-[#1A1A1A] tracking-wide">
              SABOROU
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-1">
              AIがあなたのサボりを守ります
            </p>
          </div>

          {/* ログインセクション */}
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A] text-center mb-1">
              ログインして始める
            </h2>
            <p className="text-xs text-[#9CA3AF] text-center mb-4">
              Googleアカウントで安全にサインイン
            </p>

            <Button
              onClick={signIn}
              variant="outline"
              className="w-full flex items-center gap-3 h-11 border-[#E5E7EB] hover:bg-[#F5F4F0]"
              disabled={isLoading}
              aria-label="Googleアカウントでログイン"
            >
              <GoogleIcon />
              <span className="text-sm font-medium text-[#1A1A1A]">
                Googleでログイン
              </span>
            </Button>
          </div>
        </div>

        {/* フィーチャーリスト */}
        <ul className="space-y-2" aria-label="SABOROUの特徴">
          {[
            "タスクを自動で把握",
            "AIが根拠を持って判断",
            "安心してサボれる",
          ].map((text) => (
            <li
              key={text}
              className="flex items-center justify-center gap-2 text-xs text-[#6B7280]"
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#FF6B2B]"
                aria-hidden="true"
              />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
