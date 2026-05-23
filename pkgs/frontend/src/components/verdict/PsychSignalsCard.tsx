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

interface PsychTheoryConfig {
  key: keyof PsychSignals;
  /** true: 低いほど can_saboru 方向 */
  inverted: boolean;
}

interface PsychTheoryI18n {
  label: string;
  jp: string;
  saboruExplanation: string;
  doExplanation: string;
}

const PSYCH_THEORY_CONFIGS: PsychTheoryConfig[] = [
  { key: "taskIdentifiability", inverted: true },
  { key: "effortOutcomeExpectancy", inverted: false },
  { key: "perceivedPeerEffort", inverted: true },
  { key: "externalPressureLevel", inverted: true },
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

  const theoriesI18n = t("verdict.psychTheories", {
    returnObjects: true,
  }) as PsychTheoryI18n[];
  const scoreLabels = t("verdict.scoreLabels", {
    returnObjects: true,
  }) as { canSaboru: string; borderline: string; mustDo: string };

  const totalScore =
    PSYCH_THEORY_CONFIGS.reduce((acc, cfg) => {
      const s = scoreOf(signals[cfg.key]);
      return acc + (cfg.inverted ? 1 - s : s);
    }, 0) / PSYCH_THEORY_CONFIGS.length;

  const scoreLabel =
    totalScore >= 0.67
      ? scoreLabels.mustDo
      : totalScore >= 0.34
        ? scoreLabels.borderline
        : scoreLabels.canSaboru;

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
          <p
            className="font-bold mt-0.5"
            style={{ fontSize: 9, color: meta.color }}
          >
            {scoreLabel}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {PSYCH_THEORY_CONFIGS.map((cfg, i) => {
          const labels = theoriesI18n[i] ?? {
            label: "",
            jp: "",
            saboruExplanation: "",
            doExplanation: "",
          };
          const s = signals[cfg.key];
          const score = scoreOf(s);
          const supports = cfg.inverted ? s === "low" : s === "high";
          const barColor = supports
            ? "#10B981"
            : s === "unknown"
              ? "#9CA3AF"
              : "#EF4444";
          const levelLabel =
            s === "low"
              ? t("verdict.levelLow")
              : s === "high"
                ? t("verdict.levelHigh")
                : t("verdict.levelUnknown");
          return (
            <div key={String(cfg.key)}>
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                  <span
                    className="font-bold"
                    style={{
                      fontFamily: "Space Grotesk, system-ui, sans-serif",
                      fontSize: 10,
                    }}
                  >
                    {labels.label}
                  </span>
                  <span
                    className="text-saboru-ink-soft truncate"
                    style={{ fontSize: 9 }}
                  >
                    {labels.jp}
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
                  {levelLabel}
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
                  ? labels.saboruExplanation
                  : s === "unknown"
                    ? t("verdict.levelUnknownDesc")
                    : labels.doExplanation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
