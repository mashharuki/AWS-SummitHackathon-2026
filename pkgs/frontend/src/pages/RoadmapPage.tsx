import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ROADMAP_ITEMS } from "@/lib/staticContent";
import { useTranslation } from "react-i18next";
/**
 * プロダクトロードマップページ — 「人をダメにする」を、文化に育てる
 *
 * U-06-ui-redesign Phase 6 / 共有 HTML RoadmapScreen 準拠
 */
import { useNavigate } from "react-router-dom";

const STATUS_STYLE = {
  current: {
    dot: "#F97316",
    ring: "#FED7AA",
    badgeBg: "#F97316",
    badgeFg: "#FFFFFF",
    label: "current",
  },
  next: {
    dot: "#6366F1",
    ring: "#C7D2FE",
    badgeBg: "#6366F1",
    badgeFg: "#FFFFFF",
    label: "next",
  },
  planned: {
    dot: "#9CA3AF",
    ring: "#F3F4F6",
    badgeBg: "#F3F4F6",
    badgeFg: "#6B7280",
    label: "planned",
  },
} as const;

export function RoadmapPage() {
  const { i18n, t } = useTranslation();
  const locale = i18n.language.startsWith("ja") ? "ja" : "en";
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageHeader
          title={locale === "ja" ? "プロダクトロードマップ" : "Product Roadmap"}
          subtitle={
            locale === "ja"
              ? "「人をダメにする」を、文化に育てる"
              : 'Turning "human-weakening" into culture'
          }
          onBack={() => navigate("/settings")}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 flex flex-col gap-3">
          {/* ビジョン */}
          <div
            className="card-brutal p-4"
            style={{
              background: "linear-gradient(135deg, #FFEDD5, #FED7AA)",
            }}
          >
            <p
              className="font-bold tracking-wider"
              style={{
                fontSize: 10,
                color: "#EA580C",
                letterSpacing: "0.05em",
              }}
            >
              VISION
            </p>
            <p
              className="font-semibold mt-1"
              style={{
                fontSize: 12,
                color: "#7C2D12",
                lineHeight: 1.6,
              }}
            >
              {locale === "ja" ? (
                <>
                  「早く終わらせる人が偉い」から
                  <br />
                  「必要以上に頑張らずギリギリで生還する人が賢い」へ
                </>
              ) : (
                <>
                  From "finishing fast is best"
                  <br />
                  to "surviving smart without overworking"
                </>
              )}
            </p>
          </div>

          {/* タイムライン */}
          <div className="relative pl-6">
            <div
              className="absolute left-2 top-4 bottom-4"
              style={{
                width: 2,
                background: "#F3F4F6",
              }}
              aria-hidden="true"
            />
            {ROADMAP_ITEMS.map((m) => {
              const style = STATUS_STYLE[m.status];
              return (
                <div key={m.version} className="relative mb-4">
                  {/* マイルストーンドット */}
                  <div
                    className="absolute"
                    aria-hidden="true"
                    style={{
                      left: -22,
                      top: 4,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      background: style.dot,
                      boxShadow: `0 0 0 4px ${style.ring}`,
                    }}
                  />

                  {/* ヘッダー */}
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span
                      className="font-extrabold text-saboru-ink"
                      style={{
                        fontFamily: "Space Grotesk, system-ui, sans-serif",
                        fontSize: 16,
                      }}
                    >
                      {m.version}
                    </span>
                    <span
                      className="text-saboru-ink-muted"
                      style={{ fontSize: 9 }}
                    >
                      {m.date}
                    </span>
                    <span
                      className="font-bold tracking-wider"
                      style={{
                        fontSize: 9,
                        background: style.badgeBg,
                        color: style.badgeFg,
                        padding: "2px 6px",
                        borderRadius: 4,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {t(`status.${style.label}`)}
                    </span>
                  </div>

                  {/* 機能リスト */}
                  <div
                    className="card-brutal p-3"
                    style={{
                      borderColor:
                        m.status === "current" ? "#2B1E16" : "#2B1E16",
                      boxShadow:
                        m.status === "current"
                          ? "0 5px 0 #2B1E16, 0 8px 16px rgba(249,115,22,0.15)"
                          : "0 4px 0 #2B1E16",
                    }}
                  >
                    {m.features.map((f) => (
                      <div
                        key={f.name.ja}
                        className="flex items-start gap-2 py-1.5"
                        style={{
                          borderBottom:
                            fi < m.features.length - 1
                              ? "1px solid #F3F4F6"
                              : undefined,
                        }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1.2 }}>
                          {f.ic}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-bold text-saboru-ink"
                            style={{ fontSize: 11 }}
                          >
                            {f.name[locale]}
                          </p>
                          <p
                            className="text-saboru-ink-muted mt-0.5"
                            style={{ fontSize: 9 }}
                          >
                            {f.desc[locale]}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* クロージング */}
          <div
            className="card-brutal p-4"
            style={{
              background: "#1F2937",
              color: "#F3F4F6",
            }}
          >
            <p
              className="font-bold tracking-wider"
              style={{
                fontSize: 10,
                color: "#FB923C",
                letterSpacing: "0.05em",
              }}
            >
              AWS SUMMIT JAPAN 2026
            </p>
            <p className="mt-1.5" style={{ fontSize: 12, lineHeight: 1.5 }}>
              <strong>1次審査突破 15/117</strong> 🎉
              <br />
              <span style={{ color: "#D1D5DB", fontSize: 11 }}>
                次は最終決勝。サボりの最適解で優勝を。
              </span>
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
