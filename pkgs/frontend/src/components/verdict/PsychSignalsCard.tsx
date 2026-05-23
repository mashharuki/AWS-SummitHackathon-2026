import { VERDICT_META } from "@/lib/verdictMeta";
/**
 * PsychSignalsCard — 心理学シグナル可視化カード
 *
 * U-06-ui-redesign Phase 5 / api-html-gap-analysis.md GAP-04 準拠
 *
 * psychSignals が渡された場合は AI が実際に計算したシグナル値を表示する。
 * 渡されない場合は verdict ベースのフォールバックプリセットを使用する。
 */
import type { PsychSignals, SignalLevel, Verdict } from "@saboru/shared";
import { useTranslation } from "react-i18next";

interface PsychTheory {
  key: keyof PsychSignals;
  label: string;
  jp: string;
  cite: string;
  desc: string;
  /** true: 低いほど can_saboru 方向 */
  inverted: boolean;
  /** サボれる根拠のナチュラル説明（signal=low かつ inverted=true、または signal=high かつ inverted=false のとき） */
  saboruExplanation: string;
  /** やるべき根拠のナチュラル説明 */
  doExplanation: string;
}

const PSYCH_THEORIES: PsychTheory[] = [
  {
    key: "taskIdentifiability",
    label: "Identifiability",
    jp: "識別可能性",
    cite: "Williams et al. (1981)",
    desc: "依頼者から貢献が見えるか",
    inverted: true,
    saboruExplanation:
      "あなたの貢献は依頼者から見えていません — 動いても評価されない状況です",
    doExplanation: "あなたの貢献は依頼者からはっきり見えています",
  },
  {
    key: "effortOutcomeExpectancy",
    label: "Expectancy",
    jp: "期待値（締切余裕）",
    cite: "Vroom (1964)",
    desc: "今努力する報酬期待",
    inverted: false,
    saboruExplanation: "この努力が成果につながる期待値が低い状態です",
    doExplanation: "今動けば確実に成果につながる高期待値の状況です",
  },
  {
    key: "perceivedPeerEffort",
    label: "Sucker Effect",
    jp: "ピア努力知覚",
    cite: "Kerr (1983)",
    desc: "他者も動いていないか",
    inverted: true,
    saboruExplanation:
      "周囲のメンバーも動いていません — あなただけが損をする状況です",
    doExplanation: "周囲が動いている中、あなたも動く必要があります",
  },
  {
    key: "externalPressureLevel",
    label: "SDT",
    jp: "外発的プレッシャー",
    cite: "Ryan & Deci (2000)",
    desc: "リマインドの強さ",
    inverted: true,
    saboruExplanation:
      "外発的なプレッシャーが弱く、今は自律的に休んでいい状態です",
    doExplanation: "強い外発的プレッシャーがかかっています",
  },
];

/** verdict ベースのフォールバック（psychSignals が未保存の古い提案用） */
const PSYCH_SIGNAL_FALLBACKS: Record<Verdict, PsychSignals> = {
  can_saboru: {
    taskIdentifiability: "low",
    effortOutcomeExpectancy: "high",
    perceivedPeerEffort: "low",
    externalPressureLevel: "low",
  },
  borderline: {
    taskIdentifiability: "low",
    effortOutcomeExpectancy: "unknown",
    perceivedPeerEffort: "high",
    externalPressureLevel: "high",
  },
  must_do: {
    taskIdentifiability: "high",
    effortOutcomeExpectancy: "low",
    perceivedPeerEffort: "high",
    externalPressureLevel: "high",
  },
};

const scoreOf = (sig: SignalLevel): number =>
  sig === "low" ? 0.2 : sig === "high" ? 0.8 : 0.5;

export interface PsychSignalsCardProps {
  verdict: Verdict;
  /** Real psychological signals from AI judgment. Falls back to verdict presets if absent. */
  psychSignals?: PsychSignals;
}

export function PsychSignalsCard({
  verdict,
  psychSignals,
}: PsychSignalsCardProps) {
  const { t } = useTranslation();
  const signals = psychSignals ?? PSYCH_SIGNAL_FALLBACKS[verdict];
  const meta = VERDICT_META[verdict];
  const isRealData = psychSignals != null;

  const totalScore =
    PSYCH_THEORIES.reduce((acc, t) => {
      const s = scoreOf(signals[t.key]);
      return acc + (t.inverted ? 1 - s : s);
    }, 0) / PSYCH_THEORIES.length;

  return (
    <div className="card-brutal p-3.5">
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-saboru-ink font-bold" style={{ fontSize: 11 }}>
              {t("verdict.psychTitle")}
            </h3>
            {isRealData && (
              <span
                style={{
                  fontSize: 7,
                  fontWeight: 800,
                  color: "#10B981",
                  background: "#D1FAE5",
                  padding: "1px 5px",
                  borderRadius: 4,
                  letterSpacing: "0.03em",
                }}
              >
                LIVE
              </span>
            )}
          </div>
          <p className="text-saboru-ink-muted mt-0.5" style={{ fontSize: 9 }}>
            {t("verdict.psychSubtitle")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-saboru-ink-muted" style={{ fontSize: 9 }}>
            {t("verdict.validity")}
          </p>
          <p
            className="font-extrabold leading-none"
            style={{
              fontFamily: "Space Grotesk, system-ui, sans-serif",
              fontSize: 16,
              color: meta.color,
            }}
          >
            {Math.round(totalScore * 100)}
            <span style={{ fontSize: 10, fontWeight: 600 }}>/100</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {PSYCH_THEORIES.map((theory) => {
          const s = signals[theory.key];
          const score = scoreOf(s);
          const supports = theory.inverted ? s === "low" : s === "high";
          const barColor = supports
            ? "#10B981"
            : s === "unknown"
              ? "#9CA3AF"
              : "#EF4444";
          return (
            <div key={String(theory.key)}>
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                  <span
                    className="font-bold"
                    style={{
                      fontFamily: "Space Grotesk, system-ui, sans-serif",
                      fontSize: 10,
                    }}
                  >
                    {theory.label}
                  </span>
                  <span
                    className="text-saboru-ink-soft truncate"
                    style={{ fontSize: 9 }}
                  >
                    {theory.jp}
                  </span>
                </div>
                <span
                  className="font-bold tracking-wider"
                  style={{
                    fontSize: 9,
                    color: barColor,
                    background: `${barColor}15`,
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  {s === "low" ? "LOW" : s === "high" ? "HIGH" : "—"}
                </span>
              </div>
              <div
                className="rounded-sm"
                style={{
                  background: "#F3F4F6",
                  height: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${score * 100}%`,
                    height: "100%",
                    background: barColor,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <p
                className="mt-0.5"
                style={{
                  fontSize: 9,
                  color: barColor,
                  lineHeight: 1.4,
                  fontStyle: "italic",
                }}
              >
                {supports
                  ? theory.saboruExplanation
                  : s === "unknown"
                    ? `${theory.cite} · ${theory.desc}`
                    : theory.doExplanation}
              </p>
              <p
                className="text-saboru-ink-muted mt-0.5"
                style={{ fontSize: 8 }}
              >
                {theory.cite}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
