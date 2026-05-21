/**
 * 取扱説明書ページ — あなたの「サボり癖」を可視化
 *
 * U-06-ui-redesign Phase 6 / 共有 HTML ManualScreen 準拠
 * API なし（MANUAL_TRAITS 静的定数）。
 */
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { MANUAL_PROGRESS, MANUAL_TRAITS } from "@/lib/staticContent";

export function ManualPage() {
  const percent = Math.round(
    (MANUAL_PROGRESS.collected / MANUAL_PROGRESS.total) * 100,
  );

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageHeader
          title="あなたの取扱説明書"
          subtitle={`本音データから生成 · ${MANUAL_PROGRESS.collected}件のサンプル`}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 flex flex-col gap-3">
          {/* Hero */}
          <div
            className="card-brutal flex items-center gap-3 p-4"
            style={{
              background: "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)",
            }}
          >
            <div style={{ fontSize: 36 }}>📖</div>
            <div>
              <p
                className="font-bold tracking-wider"
                style={{
                  fontSize: 11,
                  color: "#92400E",
                  letterSpacing: "0.05em",
                }}
              >
                YOUR PERSONAL MANUAL
              </p>
              <p
                className="font-semibold mt-1"
                style={{
                  fontSize: 13,
                  color: "#7C2D12",
                  lineHeight: 1.5,
                }}
              >
                本音を蓄積するほど、あなただけの
                <br />
                「サボり方の癖」がわかる
              </p>
            </div>
          </div>

          {/* 進捗 */}
          <div className="card-brutal p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-saboru-ink-soft font-semibold"
                style={{ fontSize: 11 }}
              >
                取扱説明書の完成度
              </span>
              <span
                className="font-extrabold"
                style={{
                  fontSize: 12,
                  color: "#F97316",
                  fontFamily: "Space Grotesk, system-ui, sans-serif",
                }}
              >
                {MANUAL_PROGRESS.collected} / {MANUAL_PROGRESS.total}
              </span>
            </div>
            <div
              className="rounded-sm overflow-hidden"
              style={{ background: "#F3F4F6", height: 8 }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #FB923C, #F97316)",
                }}
              />
            </div>
            <p className="text-saboru-ink-muted mt-2" style={{ fontSize: 10 }}>
              あと {MANUAL_PROGRESS.total - MANUAL_PROGRESS.collected}{" "}
              件の本音データで、外部 AI に渡せる完全版が完成します
            </p>
          </div>

          {/* 傾向リスト */}
          <SectionLabel>発見されたあなたの傾向</SectionLabel>
          <div className="flex flex-col gap-2">
            {MANUAL_TRAITS.map((t, i) => (
              <div
                key={i}
                className="card-brutal p-3"
                style={{ borderLeft: `6px solid ${t.color}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="font-bold text-saboru-ink flex-1"
                    style={{ fontSize: 13, lineHeight: 1.3 }}
                  >
                    {t.title}
                  </p>
                  <span
                    className="font-bold flex-shrink-0"
                    style={{
                      fontSize: 9,
                      color: t.color,
                      background: `${t.color}15`,
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    n={t.count}
                  </span>
                </div>
                <p
                  className="text-saboru-ink-soft mt-1.5"
                  style={{ fontSize: 11, lineHeight: 1.5 }}
                >
                  {t.body}
                </p>
              </div>
            ))}
          </div>

          {/* Future vision */}
          <div
            className="card-brutal p-3.5"
            style={{
              background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
            }}
          >
            <p
              className="font-bold tracking-wider"
              style={{
                fontSize: 10,
                color: "#5B21B6",
                letterSpacing: "0.05em",
              }}
            >
              COMING SOON
            </p>
            <p
              className="font-semibold mt-1"
              style={{
                fontSize: 12,
                color: "#312E81",
                lineHeight: 1.5,
              }}
            >
              ChatGPT / Claude / Notion AI と MCP
              連携。あなたの「サボり癖」を他の AI
              にも共有して、より自然なタスク管理を。
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
