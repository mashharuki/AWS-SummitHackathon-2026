import { VERDICT_META } from "@/lib/verdictMeta";
import type { Verdict } from "@saboru/shared";

/** ローカルストレージに保存する判定ログの型 */
export interface VerdictEntry {
  taskId: string;
  taskTitle: string;
  verdict: Verdict;
  summaryText: string;
  evaluatedAt: string;
}

const STORAGE_KEY = "saborou:verdict_history";
const MAX_ENTRIES = 5;

/** 判定をローカルストレージに保存する（最新5件まで） */
export function saveVerdictEntry(entry: VerdictEntry): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const existing: VerdictEntry[] = stored
      ? (JSON.parse(stored) as VerdictEntry[])
      : [];
    const filtered = existing.filter((e) => e.taskId !== entry.taskId);
    const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage 使用不可の場合は無視
  }
}

/** ローカルストレージから判定ログを取得する */
export function loadVerdictHistory(): VerdictEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as VerdictEntry[]) : [];
  } catch {
    return [];
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}

interface VerdictHistoryProps {
  entries: VerdictEntry[];
}

/**
 * VerdictHistory — 判定監査証跡UI
 *
 * 最近5件の判定履歴を表示。「説明可能AI」のアピール材料であり、
 * `verdict`/`summaryText` の構造化出力を可視化する。
 * Bedrock AgentCore の監査証跡としても機能する。
 */
export function VerdictHistory({ entries }: VerdictHistoryProps) {
  if (entries.length === 0) return null;

  const saboruCount = entries.filter((e) => e.verdict === "can_saboru").length;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#9CA3AF",
            letterSpacing: "0.08em",
          }}
        >
          最近の判定履歴
        </p>
        {saboruCount > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#10B981",
              background: "#D1FAE5",
              padding: "2px 8px",
              borderRadius: 12,
            }}
          >
            今日 {saboruCount}回サボれました
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const meta = VERDICT_META[entry.verdict];
          return (
            <div
              key={entry.taskId + entry.evaluatedAt}
              className="card-brutal p-2.5 flex items-center gap-2.5"
              style={{
                background: meta.bg,
                borderLeft: `4px solid ${meta.color}`,
              }}
            >
              <span style={{ fontSize: 14 }}>{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <p
                  className="font-bold truncate"
                  style={{ fontSize: 11, color: "#2B1E16" }}
                >
                  {entry.taskTitle}
                </p>
                <p
                  className="truncate mt-0.5"
                  style={{ fontSize: 9, color: "#6B7280" }}
                >
                  {entry.summaryText}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: meta.color,
                    background: `${meta.color}20`,
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  {meta.short}
                </span>
                <span style={{ fontSize: 8, color: "#9CA3AF" }}>
                  {formatRelativeTime(entry.evaluatedAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
