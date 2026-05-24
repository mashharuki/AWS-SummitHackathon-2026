import { SaborouAvatar } from "@/components/character/SaborouAvatar";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { updatePersona } from "@/lib/apiClient";
import { PERSONAS } from "@/lib/staticContent";
/**
 * AI ペルソナ選択ページ — 同じ判定を、違う口調で受け取る
 *
 * 選択した personaId をバックエンド（PUT /api/users/me/persona）に永続化する。
 * 以降のサボり提案がそのペルソナの口調で生成される。
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const DEFAULT_PERSONA_ID = "saboru_ottori";

export function PersonaPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ja") ? "ja" : "en";
  const isJa = locale === "ja";
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<string>(DEFAULT_PERSONA_ID);
  const [saving, setSaving] = useState(false);

  // 初期選択をユーザーの保存済みペルソナから復元
  useEffect(() => {
    if (
      user?.preferredPersonaId &&
      PERSONAS.some((p) => p.id === user.preferredPersonaId && p.available)
    ) {
      setSelected(user.preferredPersonaId);
    }
  }, [user?.preferredPersonaId]);

  const handleSelect = (id: string) => {
    const persona = PERSONAS.find((p) => p.id === id);
    if (!persona?.available || saving || id === selected) return;

    const previous = selected;
    setSelected(id); // 楽観更新
    setSaving(true);
    updatePersona(id)
      .then(() => {
        // AuthProvider の user も更新して、再訪時・他画面に即同期させる
        updateUser({ preferredPersonaId: id });
        showToast(isJa ? "ペルソナを変更したよ" : "Persona updated", "success");
      })
      .catch(() => {
        setSelected(previous); // 失敗時はロールバック
        showToast(
          isJa ? "変更に失敗しました" : "Failed to update persona",
          "error",
        );
      })
      .finally(() => setSaving(false));
  };

  const current = PERSONAS.find((p) => p.id === selected) ?? PERSONAS[0];
  const isDark = current.color === "#9CA3AF" || current.color === "#34D399";

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageHeader
          title={isJa ? "AI ペルソナ" : "AI Persona"}
          subtitle={
            isJa
              ? "同じ判定を、違う口調で受け取る"
              : "Same verdict, different tone"
          }
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
              <SaborouAvatar size={32} personaId={current.id} />
              <div>
                <p className="font-extrabold" style={{ fontSize: 13 }}>
                  {current.name[locale]}
                </p>
                <p style={{ fontSize: 10, opacity: 0.7 }}>
                  {current.tag[locale]}
                </p>
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
              {current.sample[locale]}
            </div>
            <p
              className="mt-2 text-right"
              style={{ fontSize: 9, opacity: 0.6 }}
            >
              {isJa
                ? "同じ判定「サボれる」のサンプル"
                : 'Sample text for the same verdict "Can slack off"'}
            </p>
          </div>

          {/* セレクター */}
          <SectionLabel>
            {isJa ? "ペルソナを選択" : "Select a persona"}
          </SectionLabel>
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
                    <SaborouAvatar size={26} personaId={p.id} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-bold text-saboru-ink"
                        style={{ fontSize: 13 }}
                      >
                        {p.name[locale]}
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
                          {isJa ? "v2.0" : "v2.0"}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-saboru-ink-soft mt-0.5"
                      style={{ fontSize: 10 }}
                    >
                      {p.desc[locale]}
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

          {/* 説明 */}
          <div
            className="card-brutal p-3"
            style={{
              background: "linear-gradient(135deg, #FEF3C7, #FFEDD5)",
            }}
          >
            <p style={{ fontSize: 10, color: "#92400E", lineHeight: 1.5 }}>
              {isJa
                ? "選んだ人格は即座に保存され、次のサボり判定からその口調で届くよ。判定（サボれる/微妙/やるべき）は変わらず、伝え方だけが変わる。"
                : "Your choice is saved immediately and applied from the next verdict. The judgment itself stays the same — only the tone changes."}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
