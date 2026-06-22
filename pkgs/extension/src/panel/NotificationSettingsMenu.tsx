import { cn } from "@/lib/utils";
import type { NotificationSettings } from "@/messages";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
} from "@/notifications/settings";
import {
  disconnectService,
  getConnections,
  getSlackOAuthUrl,
} from "@/panel/lib/agentClient";
import { Bell, BellOff, ExternalLink, Link, Settings, Unlink } from "lucide-react";
import { useEffect, useState } from "react";

type SettingKey = keyof NotificationSettings;

export function NotificationSettingsMenu({ jwt }: { jwt: string | null }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [permission, setPermission] =
    useState<chrome.notifications.PermissionLevel>("granted");
  const [slackConnected, setSlackConnected] = useState<boolean | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);

  useEffect(() => {
    loadNotificationSettings().then(setSettings);
    chrome.notifications.getPermissionLevel().then(setPermission);
  }, []);

  // メニューを開いたときにSlack接続状態を取得
  useEffect(() => {
    if (!open || !jwt) return;
    getConnections(jwt).then((conns) => {
      const slack = conns.find((c) => c.service === "slack");
      setSlackConnected(slack?.status === "connected");
    });
  }, [open, jwt]);

  const handleSlackDisconnect = async () => {
    if (!jwt) return;
    setSlackLoading(true);
    try {
      await disconnectService("slack", jwt);
      setSlackConnected(false);
    } catch (e) {
      console.warn("[SABOROU] Slack disconnect failed:", e);
    } finally {
      setSlackLoading(false);
    }
  };

  const handleSlackConnect = async () => {
    if (!jwt) return;
    setSlackLoading(true);
    try {
      const url = await getSlackOAuthUrl(jwt);
      chrome.tabs.create({ url });
    } catch (e) {
      console.warn("[SABOROU] Slack OAuth URL fetch failed:", e);
    } finally {
      setSlackLoading(false);
    }
  };

  const updateSetting = async (key: SettingKey, checked: boolean) => {
    const next = { ...settings, [key]: checked };
    setSettings(next);
    await saveNotificationSettings(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="notification-settings-button"
        aria-label="通知設定"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg",
          "border border-[#2b1e16] bg-white text-[#1f2937]",
          "hover:bg-[#f3f4f6] transition-colors",
        )}
        title="通知設定"
      >
        <Settings size={14} />
      </button>

      {open && (
        <div
          data-testid="notification-settings-menu"
          className="absolute right-0 top-10 z-20 w-64 rounded-xl border-2 border-[#2b1e16] bg-white p-3 shadow-[0_4px_0_#2b1e16]"
        >
          <div className="mb-3 flex items-center gap-2">
            {settings.enabled ? <Bell size={15} /> : <BellOff size={15} />}
            <p className="text-sm font-bold text-[#1f2937]">通知設定</p>
          </div>

          <NotificationToggle
            testId="notification-enabled-toggle"
            label="通知全体"
            checked={settings.enabled}
            onChange={(checked) => updateSetting("enabled", checked)}
          />
          <NotificationToggle
            testId="notification-task-detected-toggle"
            label="タスク検知"
            checked={settings.taskDetected}
            disabled={!settings.enabled}
            onChange={(checked) => updateSetting("taskDetected", checked)}
          />
          <NotificationToggle
            testId="notification-task-completed-toggle"
            label="返信完了"
            checked={settings.taskCompleted}
            disabled={!settings.enabled}
            onChange={(checked) => updateSetting("taskCompleted", checked)}
          />

          {permission === "denied" && (
            <p
              className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800"
              data-testid="notification-permission-guidance"
            >
              OSまたはChrome側で通知が拒否されています。Chromeの設定からSABOROUの通知を許可してください。
            </p>
          )}

          {/* Slack連携セクション */}
          <div className="mt-3 border-t border-[#f3f4f6] pt-3">
            <p className="text-[10px] font-bold text-[#9ca3af] mb-2">Slack連携</p>
            {slackConnected === null ? (
              <p className="text-[11px] text-[#9ca3af]">確認中...</p>
            ) : slackConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  <span className="text-[11px] text-[#374151]">接続済み</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleSlackConnect()}
                    disabled={slackLoading}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#f97316] border border-[#f97316] rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors"
                    title="再接続（スコープ更新）"
                  >
                    <ExternalLink size={10} />
                    再接続
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSlackDisconnect()}
                    disabled={slackLoading}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-lg hover:bg-[#f3f4f6] disabled:opacity-50 transition-colors"
                  >
                    <Unlink size={10} />
                    解除
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleSlackConnect()}
                disabled={slackLoading}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] font-bold text-white bg-[#f97316] rounded-lg hover:bg-orange-500 disabled:opacity-50 transition-colors"
              >
                <Link size={11} />
                Slackと連携する
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationToggle({
  testId,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 text-xs text-[#374151]">
      <span>{label}</span>
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#f97316]"
      />
    </label>
  );
}
