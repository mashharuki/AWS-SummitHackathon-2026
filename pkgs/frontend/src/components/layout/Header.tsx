import { Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function Header() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-[#E5E7EB] px-4 h-14 flex items-center justify-between">
      {/* ロゴ */}
      <Link
        to="/tasks"
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="SABOROU ホーム"
      >
        <div
          className="w-7 h-7 rounded-lg bg-[#FF6B2B] flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="font-bold text-[#1A1A1A] text-sm tracking-wide">
          SABOROU
        </span>
      </Link>

      {/* 右側ナビ */}
      <nav
        className="flex items-center gap-1"
        aria-label="メインナビゲーション"
      >
        <Link
          to="/settings"
          className={cn(
            "p-2 rounded-xl transition-colors",
            location.pathname === "/settings"
              ? "bg-[#F5F4F0] text-[#FF6B2B]"
              : "text-[#6B7280] hover:bg-[#F5F4F0]",
          )}
          aria-label="設定"
          aria-current={location.pathname === "/settings" ? "page" : undefined}
        >
          <Settings size={18} />
        </Link>

        {/* ユーザーアバター */}
        {user && (
          <div
            className="w-8 h-8 rounded-full bg-[#FF6B2B] flex items-center justify-center ml-1"
            aria-label={`${user.name} のアカウント`}
          >
            <span className="text-white text-xs font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </nav>
    </header>
  );
}
