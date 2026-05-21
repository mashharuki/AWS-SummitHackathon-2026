import { SaborouAvatar } from "@/components/character/SaborouAvatar";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PERSONAS } from "@/lib/staticContent";
/**
 * AI ペルソナ選択ページ — 同じ判定を、違う口調で受け取る
 *
 * U-06-ui-redesign Phase 6 / 共有 HTML PersonaScreen 準拠
 * MVP では選択状態を localStorage に保存（API 未対応のため）
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "saboru_persona_selected";
const DEFAULT_PERSONA_ID = "saboru_ottori";

export function PersonaPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>(DEFAULT_PERSONA_ID);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && PERSONAS.some((p) => p.id === stored && p.available)) {
      setSelected(stored);
    }
  }, []);

  const handleSelect = (id: string) => {
    const persona = PERSONAS.find((p) => p.id === id);
    if (!persona?.available) return;
    setSelected(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const current = PERSONAS.find((p) => p.id === selected) ?? PERSONAS[0];
  const isDark = current.color === "#9CA3AF" || current.color === "#34D399";

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageHeader
          title="AI ペルソナ"
          subtitle="同じ判定を、違う口調で受け取る"
          onBack={() => navigate("/settings")}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 flex flex-col gap-3">
          {/* Live プレビュー */}
          <div
            className="card-brutal-lg p-4"
            style={{
              background: current.bg,
              color: isDark ? "#FFFFFF" : "#1F2937",
            }}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <SaborouAvatar size={32} />
              <div>
                <p className="font-extrabold" style={{ fontSize: 13 }}>
                  {current.name}
                </p>
                <p style={{ fontSize: 10, opacity: 0.7 }}>{current.tag}</p>
              </div>
            </div>
            <div
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.5)",
                backdropFilter: "blur(8px)",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: "pre-line",
                fontFamily:
                  current.id === "saboru_hacker"
                    ? "Space Grotesk, monospace"
                    : "inherit",
              }}
            >
              {current.sample}
            </div>
            <p
              className="mt-2 text-right"
              style={{ fontSize: 9, opacity: 0.6 }}
            >
              同じ判定「サボれる」のサンプル
            </p>
          </div>

          {/* セレクター */}
          <SectionLabel>ペルソナを選択</SectionLabel>
          <div className="flex flex-col gap-2">
            {PERSONAS.map((p) => {
              const isSelected = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  disabled={!p.available}
                  aria-pressed={isSelected}
                  className="card-brutal flex items-center gap-3 p-3 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isSelected ? p.color : "#2B1E16",
                    boxShadow: isSelected
                      ? `0 5px 0 #2B1E16, 0 0 0 3px ${p.color}33`
                      : "0 5px 0 #2B1E16",
                  }}
                >
                  <div
                    className="rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      background: p.bg,
                    }}
                  >
                    <SaborouAvatar size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-bold text-saboru-ink"
                        style={{ fontSize: 13 }}
                      >
                        {p.name}
                      </span>
                      {!p.available && (
                        <span
                          className="font-bold"
                          style={{
                            fontSize: 8,
                            color: "#9CA3AF",
                            background: "#F3F4F6",
                            padding: "1px 5px",
                            borderRadius: 3,
                          }}
                        >
                          v2.0
                        </span>
                      )}
                    </div>
                    <p
                      className="text-saboru-ink-soft mt-0.5"
                      style={{ fontSize: 10 }}
                    >
                      {p.desc}
                    </p>
                  </div>
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 18,
                      height: 18,
                      border: `2px solid ${isSelected ? p.color : "#F3F4F6"}`,
                      background: isSelected ? p.color : "transparent",
                      color: "#FFFFFF",
                      fontSize: 10,
                    }}
                  >
                    {isSelected ? "✓" : ""}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Future hint */}
          <div
            className="card-brutal p-3"
            style={{
              background: "linear-gradient(135deg, #FEF3C7, #FFEDD5)",
            }}
          >
            <p style={{ fontSize: 10, color: "#92400E", lineHeight: 1.5 }}>
              <strong>v2.0 で実装予定:</strong>{" "}
              気分や案件に応じて人格を切り替え。
              <br />
              現在は{" "}
              <code
                style={{
                  background: "#FFF7ED",
                  padding: "1px 4px",
                  borderRadius: 3,
                  fontFamily: "Space Grotesk, monospace",
                }}
              >
                saboru_ottori
              </code>{" "}
              固定。
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
