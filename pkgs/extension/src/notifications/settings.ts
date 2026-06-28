import type { NotificationSettings } from "@/messages";

export const NOTIFICATION_SETTINGS_KEY = "notificationSettings";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  taskDetected: true,
  taskCompleted: true,
};

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  const stored = await chrome.storage.local.get(NOTIFICATION_SETTINGS_KEY);
  const value = stored[NOTIFICATION_SETTINGS_KEY] as
    | Partial<NotificationSettings>
    | undefined;

  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...value,
  };
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  await chrome.storage.local.set({
    [NOTIFICATION_SETTINGS_KEY]: settings,
  });
}
