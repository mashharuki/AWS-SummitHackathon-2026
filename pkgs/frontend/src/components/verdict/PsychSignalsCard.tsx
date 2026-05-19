import { VERDICT_META } from "@/lib/verdictMeta";
/**
 * PsychSignalsCard — 心理学シグナル可視化カード
 *
 * U-06-ui-redesign Phase 5 / api-html-gap-analysis.md GAP-04 準拠
 *
 * API は心理学シグナルを返さないため、verdict 値から静的プリセットを引いて表示する。
 * ハッカソンの説得力を高める "見せ場" 要素。
 */
import type { Verdict } from "@saboru/shared";

interface PsychTheory {
  key: keyof typeof PSYCH_SIGNAL_PRESETS.can_saboru;
  label: string;
  jp: string;
  cite: string;
  desc: string;
  /** true: 低いほど can_saboru 方向 */
  inverted: boolean;
}

const PSYCH_THEORIES: PsychTheory[] = [
  {
    key: "taskIdentifiability",
    label: "Identifiability",
    jp: "識別可能性",
    cite: "Williams et al. (1981)",
    desc: "依頼者から貢献が見えるか",
    inverted: true,
  },
  {
    key: "effortOutcomeExpectancy",
    label: "Expectancy",
    jp: "期待値（締切余裕）",
    cite: "Vroom (1964)",
    desc: "今努力する報酬期待",
    inverted: false,
  },
  {
    key: "perceivedPeerEffort",
    label: "Sucker Effect",
    jp: "ピア努力知覚",
    cite: "Kerr (1983)",
    desc: "他者も動いていないか",
    inverted: true,
  },
  {
    key: "externalPressureLevel",
    label: "SDT",
    jp: "外発的プレッシャー",
    cite: "Ryan & Deci (2000)",
    desc: "リマインドの強さ",
    inverted: true,
  },
];

type SignalLevel = "low" | "high" | "unknown";

const PSYCH_SIGNAL_PRESETS: Record<
  Verdict,
  {
    taskIdentifiability: SignalLevel;
    effortOutcomeExpectancy: SignalLevel;
    perceivedPeerEffort: SignalLevel;
    externalPressureLevel: SignalLevel;
  }
> = {
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
}

export function PsychSignalsCard({ verdict }: PsychSignalsCardProps) {
  const signals = PSYCH_SIGNAL_PRESETS[verdict];
  const meta = VERDICT_META[verdict];

  const totalScore =
    PSYCH_THEORIES.reduce((acc, t) => {
      const s = scoreOf(signals[t.key]);
      return acc + (t.inverted ? 1 - s : s);
    }, 0) / PSYCH_THEORIES.length;

  return (
    <div className="card-brutal p-3.5">
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <h3 className="text-saboru-ink font-bold" style={{ fontSize: 11 }}>
            🧠 心理学的シグナル
          </h3>
          <p className="text-saboru-ink-muted mt-0.5" style={{ fontSize: 9 }}>
            4 理論からの判定スコア
          </p>
        </div>
        <div className="text-right">
          <p className="text-saboru-ink-muted" style={{ fontSize: 9 }}>
            サボリ妥当性
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
            <div key={theory.key}>
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
                className="text-saboru-ink-muted italic mt-0.5"
                style={{ fontSize: 8 }}
              >
                {theory.cite} · {theory.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
