/**
 * BottomNav — ボトムナビゲーション（タスク / 取説 / 設定）
 *
 * U-06-ui-redesign Phase 4 / 共有 HTML BottomNav 準拠
 * 現在のルートに応じてアクティブ表示を切り替える。
 */
import { BookOpen, ListChecks, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: React.ReactNode;
}

export function BottomNav() {
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
    <nav
      aria-label={t("nav.bottomNav")}
      className="bg-saboru-paper flex justify-around"
      style={{
        borderTop: "3px solid #2B1E16",
        padding: "8px 0 max(22px, env(safe-area-inset-bottom))",
      }}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-1 transition-opacity ${
              isActive ? "opacity-100" : "opacity-55"
            }`
          }
          aria-label={item.label}
        >
          {({ isActive }) => (
            <>
              <span
                style={{
                  color: isActive ? "#F97316" : "#6B7280",
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
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
  );
}
