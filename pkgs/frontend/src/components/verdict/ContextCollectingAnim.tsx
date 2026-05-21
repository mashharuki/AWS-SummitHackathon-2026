/**
 * ContextCollectingAnim — 提案生成中の3フェーズアニメーション
 *
 * U-06-ui-redesign Phase 5
 * 共有 HTML ContextCollectingAnimPro 準拠（簡易版）
 *
 * フェーズ:
 *  0 = ContextCollector（外部API収集中）
 *  1 = SaboriProposer（Bedrock + Tool Use）
 *  2 = PersonaRenderer（サボロー口調変換）
 */

export interface ContextCollectingAnimProps {
  phase: 0 | 1 | 2;
}

const PHASES = [
  {
    icon: "🛰",
    title: "外部APIから文脈を収集中",
    sub: "Phase 1 — ContextCollector",
  },
  {
    icon: "🧠",
    title: "Bedrockで文脈読解中",
    sub: "Phase 2 — SaboriProposer (Tool Use)",
  },
  {
    icon: "💬",
    title: "サボロー口調に変換中",
    sub: "Phase 3 — PersonaRenderer",
  },
];

export function ContextCollectingAnim({ phase }: ContextCollectingAnimProps) {
  const current = PHASES[phase];
  return (
    <div className="card-brutal p-3.5">
      <div className="flex items-center gap-3 mb-2.5">
        <div
          key={phase}
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "linear-gradient(135deg, #FED7AA, #FB923C)",
            fontSize: 18,
            animation: "fadeSlide 0.4s ease",
          }}
        >
          {current.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold" style={{ fontSize: 11, color: "#EA580C" }}>
            {current.title}
          </p>
          <p
            className="text-saboru-ink-muted truncate"
            style={{
              fontSize: 9,
              fontFamily: "Space Grotesk, system-ui, sans-serif",
            }}
          >
            {current.sub}
          </p>
        </div>
      </div>

      {/* フェーズ進捗バー */}
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: 3,
              background: i <= phase ? "#F97316" : "#F3F4F6",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
