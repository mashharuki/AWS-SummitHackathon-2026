/**
 * fetchWithTimeout — タイムアウト付き fetch ユーティリティ
 *
 * AbortController を使用して、指定時間内に完了しない fetch をキャンセルする。
 * Google API / トークンエンドポイントなど外部 HTTP 呼び出し全般で使用する。
 */

/** デフォルトタイムアウト: 10秒 */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * タイムアウト付き fetch を実行する。
 *
 * @param input - fetch の第1引数（URL または Request）
 * @param init - fetch の第2引数（RequestInit）
 * @param timeoutMs - タイムアウトミリ秒数（デフォルト: 10000ms）
 * @throws DOMException（name: "AbortError"）タイムアウト時
 */
export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
