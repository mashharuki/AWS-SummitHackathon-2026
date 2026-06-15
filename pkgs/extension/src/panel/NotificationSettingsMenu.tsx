import { cn } from "@/lib/utils";
import type { NotificationSettings } from "@/messages";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
} from "@/notifications/settings";
import { Bell, BellOff, Settings } from "lucide-react";
import { useEffect, useState } from "react";

type SettingKey = keyof NotificationSettings;

export function NotificationSettingsMenu() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [permission, setPermission] =
    useState<chrome.notifications.PermissionLevel>("granted");

  useEffect(() => {
    loadNotificationSettings().then(setSettings);
    chrome.notifications.getPermissionLevel().then(setPermission);
  }, []);

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
