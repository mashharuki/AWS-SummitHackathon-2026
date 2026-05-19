import { useAuth } from "@/hooks/useAuth";
/**
 * AppShell — 認証ガード + コンテナ + BottomNav
 * U-06-ui-redesign Phase 4 改修版
 *
 * 旧 Header（全幅ヘッダー）は廃止し、各ページが PageHeader を独自に持つ構成に変更。
 * モバイル幅（max-w-md = 448px）でセンタリングし、デスクトップでも自然に表示。
 */
import type * as React from "react";
import { Navigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: React.ReactNode;
  /** BottomNav を非表示にする（ログイン・コールバック画面用） */
  hideBottomNav?: boolean;
}

export function AppShell({ children, hideBottomNav = false }: AppShellProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // 認証状態確認中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-saboru-cream flex items-center justify-center">
        <div
          className="w-10 h-10 border-2 border-saboru-orange border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="読み込み中"
        />
      </div>
    );
  }

  // 未認証 → ログインページへ
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-saboru-cream flex flex-col">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <main className="flex-1 flex flex-col" id="main-content" tabIndex={-1}>
          {children}
        </main>
        {!hideBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
