import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/providers/AuthProvider";
import { ToastProvider } from "@/providers/ToastProvider";
/**
 * App.tsx — ルーティング定義
 * NFR-DESIGN-6: ページを遅延ロード（コード分割）
 */
import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

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
const ManualPage = lazy(() =>
  import("@/pages/ManualPage").then((m) => ({ default: m.ManualPage })),
);
const PersonaPage = lazy(() =>
  import("@/pages/PersonaPage").then((m) => ({ default: m.PersonaPage })),
);
const RoadmapPage = lazy(() =>
  import("@/pages/RoadmapPage").then((m) => ({ default: m.RoadmapPage })),
);

/** ページロード中のスピナー */
function PageLoader() {
  return (
    <div
      className="min-h-screen bg-saboru-cream flex items-center justify-center"
      role="status"
      aria-label="ページを読み込み中"
    >
      <div className="w-8 h-8 border-2 border-saboru-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
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
                <Route path="/settings/persona" element={<PersonaPage />} />
                <Route path="/manual" element={<ManualPage />} />
                <Route path="/roadmap" element={<RoadmapPage />} />

                {/* デフォルトリダイレクト */}
                <Route path="/" element={<Navigate to="/tasks" replace />} />
                <Route path="*" element={<Navigate to="/tasks" replace />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
