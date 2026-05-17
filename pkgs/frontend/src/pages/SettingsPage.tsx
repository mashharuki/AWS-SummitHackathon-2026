/**
 * 設定ページ
 * モックUI saborou_v2_04-settings.png に忠実に実装
 */
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useConnections } from "@/hooks/useConnections";

const SERVICE_CONFIG = {
  slack: {
    name: "Slack",
    color: "bg-[#4A154B]",
    description: "タスクを自動検出",
  },
} as const;

// Gmail / Google Calendar は将来実装
const FUTURE_SERVICES = [
  { name: "Gmail", color: "bg-[#EA4335]", description: "メールからタスク検出" },
  {
    name: "Google Calendar",
    color: "bg-[#4285F4]",
    description: "カレンダーと同期",
  },
] as const;

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { connections, disconnect, isLoading } = useConnections();

  const slackConnection = connections.find((c) => c.service === "slack");

  return (
    <AppShell>
      <div className="max-w-sm mx-auto px-4 py-4 space-y-4">
        <h1 className="text-lg font-bold text-[#1A1A1A]">設定</h1>

        {/* ユーザー情報 */}
        {user && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full bg-[#FF6B2B] flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <span className="text-white text-lg font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#1A1A1A] truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-[#6B7280] truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* サービス連携 */}
        <section aria-labelledby="service-connections-heading">
          <h2
            id="service-connections-heading"
            className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2"
          >
            サービス連携
          </h2>

          <Card>
            <CardContent className="p-0 divide-y divide-[#E5E7EB]">
              {/* Slack */}
              <div className="flex items-center gap-3 p-4">
                <div
                  className={`w-8 h-8 rounded-lg ${SERVICE_CONFIG.slack.color} flex items-center justify-center shrink-0`}
                  aria-hidden="true"
                >
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A]">Slack</p>
                  <p className="text-xs text-[#6B7280]">
                    {SERVICE_CONFIG.slack.description}
                  </p>
                </div>
                {isLoading ? (
                  <div
                    className="w-4 h-4 border border-[#E5E7EB] border-t-transparent rounded-full animate-spin"
                    role="status"
                    aria-label="確認中"
                  />
                ) : slackConnection?.status === "connected" ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="connected">連携済</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void disconnect("slack")}
                      className="text-xs text-[#F44336] hover:bg-red-50 h-7 px-2"
                      aria-label="Slack 連携を解除"
                    >
                      解除
                    </Button>
                  </div>
                ) : (
                  <Badge variant="disconnected">未連携</Badge>
                )}
              </div>

              {/* 将来実装のサービス（グレーアウト） */}
              {FUTURE_SERVICES.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center gap-3 p-4 opacity-50"
                  aria-disabled="true"
                >
                  <div
                    className={`w-8 h-8 rounded-lg ${svc.color} flex items-center justify-center shrink-0`}
                    aria-hidden="true"
                  >
                    <span className="text-white text-xs font-bold">
                      {svc.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {svc.name}
                    </p>
                    <p className="text-xs text-[#6B7280]">{svc.description}</p>
                  </div>
                  <span className="text-xs text-[#9CA3AF]">近日公開</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* AIパーソナ */}
        <section aria-labelledby="persona-heading">
          <h2
            id="persona-heading"
            className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2"
          >
            AIパーソナ
          </h2>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full bg-[#FF6B2B] flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <span className="text-white text-sm font-bold">S</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">
                    おっとりサボロー
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    やさしくサボりを支援するふたまず
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ログアウト */}
        <Button
          variant="outline"
          className="w-full text-[#F44336] border-[#F44336]/30 hover:bg-red-50"
          onClick={() => void signOut()}
          aria-label="ログアウト"
        >
          <LogOut size={16} className="mr-2" aria-hidden="true" />
          ログアウト
        </Button>
      </div>
    </AppShell>
  );
}
