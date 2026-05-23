/**
 * SideNav — タブレット/デスクトップ用サイドバーナビゲーション
 *
 * md (768px+): 64px アイコンのみ
 * lg (1024px+): 224px アイコン + テキスト
 * モバイル: 非表示（BottomNav を使用）
 */
import { SaborouAvatar } from "@/components/character/SaborouAvatar";
import { BookOpen, ListChecks, Settings } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";

interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: React.ReactNode;
}

export function SideNav() {
  const { t } = useTranslation();

  const NAV_ITEMS: NavItem[] = [
    {
      id: "tasks",
      label: t("nav.tasks"),
      to: "/tasks",
      icon: <ListChecks size={20} aria-hidden="true" />,
    },
    {
      id: "manual",
      label: t("nav.manual"),
      to: "/manual",
      icon: <BookOpen size={20} aria-hidden="true" />,
    },
    {
      id: "settings",
      label: t("nav.settings"),
      to: "/settings",
      icon: <Settings size={20} aria-hidden="true" />,
    },
  ];

  return (
    <aside
      className="hidden md:flex md:flex-col md:w-16 lg:w-56 shrink-0 bg-saboru-paper"
      style={{ borderRight: "3px solid #2B1E16" }}
    >
      {/* ロゴ */}
      <div
        className="flex items-center justify-center lg:justify-start px-3 lg:px-4 py-4"
        style={{ borderBottom: "3px solid #2B1E16" }}
      >
        {/* md: アバターのみ / lg: フルロゴ */}
        <span className="lg:hidden">
          <SaborouAvatar size={28} />
        </span>
        <span className="hidden lg:block">
          <Logo size={26} />
        </span>
      </div>

      {/* ナビゲーションリンク */}
      <nav
        className="flex-1 flex flex-col py-3 gap-1 px-2"
        aria-label="メインナビゲーション"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex items-center justify-center lg:justify-start gap-3 rounded-xl px-2 py-2.5 transition-colors ${
                isActive
                  ? "bg-saboru-orange-light"
                  : "hover:bg-saboru-cream"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    color: isActive ? "#F97316" : "#6B7280",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className="hidden lg:block font-bold truncate"
                  style={{
                    fontSize: 13,
                    color: isActive ? "#F97316" : "#6B7280",
                  }}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* フッター（バージョン等 lg のみ） */}
      <div
        className="hidden lg:block px-4 py-3"
        style={{ borderTop: "1px solid #F3F4F6" }}
      >
        <p style={{ fontSize: 10, color: "#9CA3AF" }}>SABOROU v1.0</p>
      </div>
    </aside>
  );
}
