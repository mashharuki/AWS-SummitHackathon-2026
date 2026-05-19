/**
 * App.tsx — ルーティング定義
 * NFR-DESIGN-6: ページを遅延ロード（コード分割）
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/providers/AuthProvider";
import { ToastProvider } from "@/providers/ToastProvider";

// ページの遅延ロード（コード分割）
const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const AuthCallbackPage = lazy(() =>
  import("@/pages/AuthCallbackPage").then((m) => ({
    default: m.AuthCallbackPage,
  })),
);
const TaskListPage = lazy(() =>
  import("@/pages/TaskListPage").then((m) => ({ default: m.TaskListPage })),
);
const TaskDetailPage = lazy(() =>
  import("@/pages/TaskDetailPage").then((m) => ({ default: m.TaskDetailPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

/** ページロード中のスピナー */
function PageLoader() {
  return (
    <div
      className="min-h-screen bg-[#F5F4F0] flex items-center justify-center"
      role="status"
      aria-label="ページを読み込み中"
    >
      <div className="w-8 h-8 border-2 border-[#FF6B2B] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* 公開ルート */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* 認証必須ルート（AppShell内でガード） */}
              <Route path="/tasks" element={<TaskListPage />} />
              <Route path="/tasks/:id" element={<TaskDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* デフォルトリダイレクト */}
              <Route path="/" element={<Navigate to="/tasks" replace />} />
              <Route path="*" element={<Navigate to="/tasks" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
