/**
 * TabBar.tsx — 4タブナビゲーション
 *
 * ホーム / 依頼整理 / 作業中 / 余白。モック右側パネルのヘッダー直下タブに対応。
 */

import { cn } from "@/lib/utils";
import { Coffee, Home, Inbox, Loader } from "lucide-react";

export type TabId = "home" | "inbox" | "working" | "slack";

export const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "inbox", label: "依頼整理", icon: Inbox },
  { id: "working", label: "作業中", icon: Loader },
  { id: "slack", label: "余白", icon: Coffee },
];

export function TabBar({
  active,
  onChange,
  inboxCount,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  /** 依頼整理タブに付ける未処理件数バッジ */
  inboxCount?: number;
}) {
  return (
    <nav
      className="flex items-stretch border-b-2 border-[#2b1e16] bg-white"
      data-testid="tab-bar"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            data-testid={`tab-${tab.id}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2",
              "text-[11px] font-bold transition-colors",
              isActive
                ? "text-[#f97316]"
                : "text-[#9ca3af] hover:text-[#6b7280]",
            )}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
            {tab.id === "inbox" && inboxCount ? (
              <span
                className="absolute top-1 right-[18%] min-w-4 h-4 px-1 rounded-full bg-[#ef4444] text-white text-[9px] font-bold flex items-center justify-center"
                data-testid="inbox-badge"
              >
                {inboxCount > 9 ? "9+" : inboxCount}
              </span>
            ) : null}
            {isActive && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#f97316] rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
