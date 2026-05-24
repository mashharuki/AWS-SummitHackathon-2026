/**
 * 取扱説明書ページ — あなたの「サボり癖」を可視化
 *
 * U-06-ui-redesign Phase 6 / 共有 HTML ManualScreen 準拠
 * 本音データを API から取得して傾向を表示する。
 */
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import apiClient, { type HonneSummary } from "@/lib/apiClient";
import type { ManualTrait } from "@/lib/staticContent";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const TOTAL_GOAL = 100;

function deriveTraits(summary: HonneSummary): ManualTrait[] {
  const traits: ManualTrait[] = [];
  const { quickReplyBreakdown: b } = summary;

  if (b.agree_with_ai >= 2) {
    traits.push({
      title: { ja: "AIに判断を委ねる傾向", en: "Tendency to defer to AI" },
      body: {
        ja: "サボり提案に素直に同意することが多い。AIへの信頼度が高く、自己判断を省力化している。",
        en: "You often agree with AI proposals. High AI trust, reducing the cognitive load of self-judgment.",
      },
      count: b.agree_with_ai,
      color: "#6366F1",
    });
  }
  if (b.truly_tired >= 2) {
    traits.push({
      title: {
        ja: "疲労感が高い時にサボりやすい",
        en: "Slacks off when fatigued",
      },
      body: {
        ja: "「本当に疲れているのでサボる」を選ぶ頻度が高い。疲れがサボり判断の主なトリガーになっている。",
        en: "Frequently selects 'truly tired'. Fatigue is the primary trigger for your slack-off decisions.",
      },
      count: b.truly_tired,
      color: "#F59E0B",
    });
  }
  if (b.disagree_with_ai >= 2) {
    traits.push({
      title: { ja: "AIに反論する主体性", en: "Proactive AI challenger" },
      body: {
        ja: "AIの判断に反論し、自ら決断するケースが多い。自己判断力が高く保たれている。",
        en: "You frequently challenge AI judgments and decide for yourself. Strong self-determination.",
      },
      count: b.disagree_with_ai,
      color: "#10B981",
    });
  }
  if (b.actually_important >= 2) {
    traits.push({
      title: {
        ja: "重要性を自ら見極める",
        en: "Self-assesses task importance",
      },
      body: {
        ja: "AIが「サボれる」と言っても「これは重要」と判断するケースが多い。責任感が強い。",
        en: "Even when AI says skip, you often decide it matters. Strong sense of responsibility.",
      },
      count: b.actually_important,
      color: "#EF4444",
    });
  }
  return traits;
}

export function ManualPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ja") ? "ja" : "en";
  const isJa = locale === "ja";
  const [summary, setSummary] = useState<HonneSummary | null>(null);

  useEffect(() => {
    apiClient
      .getHonneSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  const collected = summary?.count ?? 0;
  const percent = Math.round((collected / TOTAL_GOAL) * 100);
  const traits = summary ? deriveTraits(summary) : [];

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageHeader
          title={isJa ? "あなたの取扱説明書" : "Your Personal Manual"}
          subtitle={
            isJa
              ? collected > 0
                ? `本音データから生成 · ${collected}件のサンプル`
                : "本音データを蓄積してあなたの傾向を発見"
              : collected > 0
                ? `Generated from honne data · ${collected} samples`
                : "Collect honne data to discover your tendencies"
          }
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
                {isJa ? (
                  <>
                    本音を蓄積するほど、あなただけの
                    <br />
                    「サボり方の癖」がわかる
                  </>
                ) : (
                  <>
                    The more honest data you collect,
                    <br />
                    the better we understand your personal slack patterns
                  </>
                )}
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
                {isJa ? "取扱説明書の完成度" : "Manual completion"}
              </span>
              <span
                className="font-extrabold"
                style={{
                  fontSize: 12,
                  color: "#F97316",
                  fontFamily: "Space Grotesk, system-ui, sans-serif",
                }}
              >
                {collected} / {TOTAL_GOAL}
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
              {isJa
                ? collected === 0
                  ? "タスク詳細でサボりに「本音リアクション」を送ると、あなたの傾向が蓄積されます"
                  : collected < 10
                    ? `データが溜まり始めました。あと ${TOTAL_GOAL - collected} 件で傾向が見えてきます`
                    : collected < 50
                      ? `傾向が見えてきました！あと ${TOTAL_GOAL - collected} 件でさらに精度が上がります`
                      : `あと ${TOTAL_GOAL - collected} 件の本音データで、外部 AI に渡せる完全版が完成します`
                : collected === 0
                  ? "Send honne reactions on task detail pages to start building your profile"
                  : `${TOTAL_GOAL - collected} more samples to complete the full manual`}
            </p>
          </div>

          {/* 傾向リスト */}
          <SectionLabel>
            {isJa ? "発見されたあなたの傾向" : "Detected tendencies"}
          </SectionLabel>
          {traits.length === 0 ? (
            <div
              className="card-brutal p-4 flex flex-col items-center gap-2"
              style={{ background: "#FFFAF5" }}
            >
              <p style={{ fontSize: 28 }}>🌱</p>
              <p
                className="font-bold text-saboru-ink text-center"
                style={{ fontSize: 13 }}
              >
                {isJa ? "まだデータがありません" : "No data yet"}
              </p>
              <p
                className="text-saboru-ink-muted text-center"
                style={{ fontSize: 11, lineHeight: 1.5 }}
              >
                {isJa
                  ? "タスク詳細でサボり提案に本音リアクションを送ると、あなたの傾向が蓄積されていきます。"
                  : "Send honne reactions to slack-off proposals on the task detail page to build up your personal tendencies."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {traits.map((t, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static traits array
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
                      {t.title[locale]}
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
                    {t.body[locale]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
