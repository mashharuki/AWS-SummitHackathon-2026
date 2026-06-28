/** chrome.alarms で使う復帰チェックのアラーム名 */
export const RECOVERY_CHECK_ALARM_NAME = "saborou-recovery-check";

/** タスク開始から何分後に自動チェックするか */
export const RECOVERY_CHECK_OFFSET_MINUTES = 5;

/** デモ時刻を過ぎていたら、この秒数後にフォールバック実行する */
export const RECOVERY_CHECK_DEMO_FALLBACK_MS = 15_000;

const PENDING_RECOVERY_CHECK_KEY = "pendingRecoveryCheck";

export interface PendingRecoveryCheck {
  ok: boolean;
  matched: boolean;
  screenshotCaptured: boolean;
  title?: string;
  url?: string;
  error?: string;
  checkedAt: string;
}

/** "19:30" + 5分 → 今日の 19:35（過ぎていれば soon） */
export function computeRecoveryCheckWhen(
  startLabel: string,
  offsetMinutes = RECOVERY_CHECK_OFFSET_MINUTES,
  now = Date.now(),
): number {
  const [hours, minutes] = startLabel.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return now + RECOVERY_CHECK_DEMO_FALLBACK_MS;
  }

  const target = new Date(now);
  target.setHours(hours, minutes + offsetMinutes, 0, 0);

  if (target.getTime() <= now) {
    return now + RECOVERY_CHECK_DEMO_FALLBACK_MS;
  }

  return target.getTime();
}

export function formatRecoveryCheckTime(whenMs: number): string {
  const date = new Date(whenMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export async function storePendingRecoveryCheck(
  result: PendingRecoveryCheck,
): Promise<void> {
  await chrome.storage.session.set({
    [PENDING_RECOVERY_CHECK_KEY]: result,
  });
}

export async function takePendingRecoveryCheck(): Promise<PendingRecoveryCheck | null> {
  const stored = await chrome.storage.session.get(PENDING_RECOVERY_CHECK_KEY);
  const result =
    (stored[PENDING_RECOVERY_CHECK_KEY] as PendingRecoveryCheck | undefined) ??
    null;
  if (result) {
    await chrome.storage.session.remove(PENDING_RECOVERY_CHECK_KEY);
  }
  return result;
}
