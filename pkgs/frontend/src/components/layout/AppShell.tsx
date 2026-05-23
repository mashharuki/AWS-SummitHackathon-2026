import { useAuth } from "@/hooks/useAuth";
/**
 * AppShell — 認証ガード + レスポンシブレイアウト + ナビゲーション
 *
 * Mobile (< md):  max-w-md センタリング + BottomNav
 * Tablet (md+):   64px SideNav + コンテンツエリア（BottomNav 非表示）
 * Desktop (lg+):  224px SideNav + コンテンツエリア
 */
import type * as React from "react";
import { Navigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

interface AppShellProps {
  children: React.ReactNode;
  /** BottomNav / SideNav を非表示にする（ログイン・コールバック画面用） */
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-saboru-cream flex flex-col md:flex-row">
      {/* SideNav: タブレット/デスクトップのみ表示 */}
      {!hideBottomNav && <SideNav />}

      {/* コンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
        {/*
          Mobile: max-w-md でセンタリング
          md+: 制約なし（SideNav の隣にフル幅で展開）
        */}
        <div className="w-full max-w-md mx-auto md:max-w-none md:mx-0 flex-1 flex flex-col">
          <main className="flex-1 flex flex-col" id="main-content" tabIndex={-1}>
            {children}
          </main>
          {/* BottomNav: モバイルのみ */}
          {!hideBottomNav && (
            <div className="md:hidden">
              <BottomNav />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
