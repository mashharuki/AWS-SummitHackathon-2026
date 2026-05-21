import { SaborouAvatar } from "@/components/character/SaborouAvatar";
import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useAuth } from "@/hooks/useAuth";
import { useConnections } from "@/hooks/useConnections";
/**
 * 設定ページ — U-06-ui-redesign Phase 5 改修版
 * 共有 HTML SettingsScreen 準拠（ネオブルータリズム）
 */
import { ChevronRight, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

const FUTURE_SERVICES = [
  { name: "Gmail", color: "#EA4335", description: "メールからタスク検出" },
  {
    name: "Google Calendar",
    color: "#1A73E8",
    description: "カレンダーと同期",
  },
] as const;

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { connections, disconnect, isLoading } = useConnections();

  const slackConnection = connections.find((c) => c.service === "slack");

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageHeader title="設定" />

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 flex flex-col gap-3">
          {/* プロフィール */}
          {user && (
            <div className="card-brutal p-3.5 flex items-center gap-3">
              <SaborouAvatar size={48} />
              <div className="min-w-0">
                <p
                  className="font-bold text-saboru-ink truncate"
                  style={{ fontSize: 14 }}
                >
                  {user.name}
                </p>
                <p
                  className="text-saboru-ink-muted truncate"
                  style={{ fontSize: 11 }}
                >
                  {user.email}
                </p>
              </div>
            </div>
          )}

          {/* サービス連携 */}
          <section aria-labelledby="connections-heading">
            <SectionLabel>
              <span id="connections-heading">サービス連携</span>
            </SectionLabel>
            <div className="card-brutal overflow-hidden">
              {/* Slack */}
              <div
                className="flex items-center gap-3 p-3"
                style={{ borderBottom: "1px solid #F3F4F6" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#4A154B" }}
                  aria-hidden="true"
                >
                  <span className="text-white text-xs font-extrabold">S</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-saboru-ink font-semibold"
                    style={{ fontSize: 13 }}
                  >
                    Slack
                  </p>
                  <p
                    className="text-saboru-ink-muted mt-0.5"
                    style={{ fontSize: 10 }}
                  >
                    タスクを自動検出
                  </p>
                </div>
                {isLoading ? (
                  <div
                    className="w-4 h-4 border border-saboru-line border-t-transparent rounded-full animate-spin"
                    role="status"
                    aria-label="確認中"
                  />
                ) : slackConnection?.status === "connected" ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold"
                      style={{
                        fontSize: 10,
                        color: "#10B981",
                        background: "#ECFDF5",
                        padding: "3px 8px",
                        borderRadius: 4,
                      }}
                    >
                      連携済
                    </span>
                    <button
                      type="button"
                      onClick={() => void disconnect("slack")}
                      aria-label="Slack 連携を解除"
                      className="text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      解除
                    </button>
                  </div>
                ) : (
                  <span
                    className="font-bold"
                    style={{
                      fontSize: 10,
                      color: "#9CA3AF",
                      background: "#F3F4F6",
                      padding: "3px 8px",
                      borderRadius: 4,
                    }}
                  >
                    未連携
                  </span>
                )}
              </div>

              {FUTURE_SERVICES.map((svc, i) => (
                <div
                  key={svc.name}
                  className="flex items-center gap-3 p-3 opacity-50"
                  aria-disabled="true"
                  style={{
                    borderBottom:
                      i < FUTURE_SERVICES.length - 1
                        ? "1px solid #F3F4F6"
                        : undefined,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: svc.color }}
                    aria-hidden="true"
                  >
                    <span className="text-white text-xs font-extrabold">
                      {svc.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-saboru-ink font-semibold"
                      style={{ fontSize: 13 }}
                    >
                      {svc.name}
                    </p>
                    <p
                      className="text-saboru-ink-muted mt-0.5"
                      style={{ fontSize: 10 }}
                    >
                      {svc.description}
                    </p>
                  </div>
                  <span
                    className="text-saboru-ink-muted"
                    style={{ fontSize: 10 }}
                  >
                    近日公開
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* AI ペルソナ */}
          <section aria-labelledby="persona-heading">
            <SectionLabel>
              <span id="persona-heading">AI ペルソナ</span>
            </SectionLabel>
            <Link
              to="/settings/persona"
              aria-label="ペルソナ設定へ"
              className="card-brutal flex items-center gap-3 p-3.5"
              style={{ textDecoration: "none" }}
            >
              <SaborouCharacter2D
                verdict="can_saboru"
                size={44}
                animated={false}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-saboru-ink font-bold"
                  style={{ fontSize: 13 }}
                >
                  おっとりサボロー
                </p>
                <p
                  className="text-saboru-ink-muted mt-0.5"
                  style={{ fontSize: 10 }}
                >
                  やさしくサボりを支援するキャラ · 全4種
                </p>
              </div>
              <ChevronRight
                size={16}
                className="text-saboru-ink-muted"
                aria-hidden="true"
              />
            </Link>
          </section>

          {/* プロダクト */}
          <section aria-labelledby="product-heading">
            <SectionLabel>
              <span id="product-heading">プロダクト</span>
            </SectionLabel>
            <Link
              to="/roadmap"
              aria-label="プロダクトロードマップへ"
              className="card-brutal flex items-center gap-3 p-3.5"
              style={{ textDecoration: "none" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #FED7AA, #FB923C)",
                  fontSize: 16,
                }}
                aria-hidden="true"
              >
                🗺
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-saboru-ink font-bold"
                  style={{ fontSize: 13 }}
                >
                  プロダクトロードマップ
                </p>
                <p
                  className="text-saboru-ink-muted mt-0.5"
                  style={{ fontSize: 10 }}
                >
                  v1.0 → v3.0 の将来ビジョン
                </p>
              </div>
              <ChevronRight
                size={16}
                className="text-saboru-ink-muted"
                aria-hidden="true"
              />
            </Link>
          </section>

          {/* ログアウト */}
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="ログアウト"
            className="card-brutal w-full p-3 mt-2 flex items-center justify-center gap-2 text-saboru-ink-soft hover:text-red-500"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <LogOut size={16} aria-hidden="true" />
            ログアウト
          </button>
        </div>
      </div>
    </AppShell>
  );
}
