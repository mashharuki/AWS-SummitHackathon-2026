/**
 * AppShell — 認証ガード + ヘッダー + トースト
 */
import * as React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "./Header";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // 認証状態確認中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <div
          className="w-10 h-10 border-2 border-[#FF6B2B] border-t-transparent rounded-full animate-spin"
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
    <div className="min-h-screen bg-[#F5F4F0] flex flex-col">
      <Header />
      <main className="flex-1" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
