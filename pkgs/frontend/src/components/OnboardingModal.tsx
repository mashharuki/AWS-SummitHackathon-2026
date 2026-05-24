/**
 * OnboardingModal — 初回ログイン時のみ表示される4スライドモーダル
 *
 * スライド0（新）: サボり適性クイズ（Tier5 施策F）
 * スライド1: AIがタスクを判定する
 * スライド2: 5つの心理学理論で根拠を示す
 * スライド3: 使うほどAIに依存していく（裏設定の示唆）
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "saborou:onboarding_done";

// ===== サボり適性クイズ =====

export interface QuizQuestion {
  question: string;
  options: Array<{ label: string; point: number }>;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "会議中に内職したことは？",
    options: [
      { label: "🙋 よくある", point: 3 },
      { label: "😅 たまに", point: 2 },
      { label: "🙅 ない", point: 1 },
    ],
  },
  {
    question: "締め切り前日にタスクを始めることは？",
    options: [
      { label: "🔥 いつも", point: 3 },
      { label: "😬 たまに", point: 2 },
      { label: "✅ ない", point: 1 },
    ],
  },
  {
    question: "「後でやろう」と思ったタスクを忘れたことは？",
    options: [
      { label: "🫠 あるある", point: 3 },
      { label: "🤔 1回くらい", point: 2 },
      { label: "😤 ない", point: 1 },
    ],
  },
  {
    question: "重要そうで実は不要なタスクに気づく？",
    options: [
      { label: "👀 よく気づく", point: 3 },
      { label: "🙄 たまに", point: 2 },
      { label: "😶 気づかない", point: 1 },
    ],
  },
  {
    question: "AIに任せていいと思うことが多い？",
    options: [
      { label: "🤖 思う", point: 3 },
      { label: "🤷 少し思う", point: 2 },
      { label: "💪 思わない", point: 1 },
    ],
  },
];

/** サボり適性スコアを計算する（0〜100） */
export function calcSaboriAptitude(answers: number[]): number {
  const total = answers.reduce((sum, a) => sum + a, 0);
  const maxPoints = QUIZ_QUESTIONS.length * 3; // 最大 15点
  return Math.round((total / maxPoints) * 100);
}

/** 平均比較テキストを返す */
export function getAptitudeComparisonText(score: number): string {
  if (score >= 80) return "平均（60%）より大幅に高い！";
  if (score >= 65) return "平均（60%）より高い";
  if (score >= 55) return "平均（60%）と同じくらい";
  return "平均（60%）より低め";
}

// ===== 通常スライド =====

interface Slide {
  emoji: string;
  title: { ja: string; en: string };
  body: { ja: string; en: string };
  accent: string;
}

const SLIDES: Slide[] = [
  {
    emoji: "🤖",
    title: {
      ja: "AIがSlackを見て\nサボれるか判定します",
      en: "AI reads your Slack\nand decides if you can skip",
    },
    body: {
      ja: "Slackに届いたメッセージをAIが解析し、「今やらなくていい」タスクを見極めます。あなたが迷う必要はありません。",
      en: "AI analyzes your Slack messages and identifies tasks you can safely defer. No more agonizing over priorities.",
    },
    accent: "#F97316",
  },
  {
    emoji: "🧠",
    title: {
      ja: "サボれる根拠を\n5つの心理学理論で説明",
      en: "Backed by 5 psychology\ntheories to justify the skip",
    },
    body: {
      ja: "「識別可能性効果」「期待理論」「カモのジレンマ」など、学術的に証明された理論に基づいてサボりを許可します。感情ではなく科学で判断します。",
      en: "Based on Identifiability Effect, Expectancy Theory, Sucker Effect and more — science-backed permission, not gut feelings.",
    },
    accent: "#6366F1",
  },
  {
    emoji: "🫠",
    title: {
      ja: "使えば使うほど\nあなたはAIに依存します",
      en: "The more you use it,\nthe more you rely on AI",
    },
    body: {
      ja: "SABOROUは「人をダメにするサービス」です。使い続けると自己判断力が低下していきます。それでも、使いますか？",
      en: "SABOROU is designed to make you dependent. Your self-determination score will drop over time. Still want to continue?",
    },
    accent: "#EF4444",
  },
];

export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setShouldShow(true);
  }, []);

  const markDone = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShouldShow(false);
  };

  return { shouldShow, markDone };
}

interface OnboardingModalProps {
  onComplete: () => void;
}

type Step = "quiz" | "slides";

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ja") ? "ja" : "en";

  const [step, setStep] = useState<Step>("quiz");
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const aptitudeScore =
    quizAnswers.length === QUIZ_QUESTIONS.length
      ? calcSaboriAptitude(quizAnswers)
      : null;

  // クイズ：選択肢を選ぶ
  const handleQuizAnswer = (point: number) => {
    const next = [...quizAnswers, point];
    setQuizAnswers(next);
    if (next.length === QUIZ_QUESTIONS.length) {
      setShowResult(true);
    } else {
      setCurrentQuestion((q) => q + 1);
    }
  };

  // クイズ結果から通常スライドへ
  const handleQuizComplete = () => {
    setStep("slides");
  };

  // 通常スライドの進行
  const slide = SLIDES[slideIndex];
  const isLast = slideIndex === SLIDES.length - 1;
  const handleSlideNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setSlideIndex((i) => i + 1);
    }
  };

  // ===== クイズ画面 =====
  if (step === "quiz") {
    if (showResult && aptitudeScore !== null) {
      return (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(43,30,22,0.75)",
            border: "none",
            maxWidth: "none",
            margin: 0,
            padding: 0,
          }}
          aria-label="サボり適性結果"
        >
          <div
            className="card-brutal w-full max-w-sm flex flex-col"
            style={{
              background: "#FFFAF5",
              padding: "28px 24px 24px",
              minHeight: 300,
            }}
          >
            <div style={{ textAlign: "center", fontSize: 48, marginBottom: 8 }}>
              🦥
            </div>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 900,
                textAlign: "center",
                color: "#1F2937",
                marginBottom: 6,
                fontFamily: "var(--font-display)",
              }}
            >
              あなたのサボり適性は
            </h2>
            <div
              style={{
                textAlign: "center",
                fontSize: 52,
                fontWeight: 900,
                color: "#F97316",
                fontFamily: "Nunito, system-ui, sans-serif",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 4,
              }}
            >
              {aptitudeScore}%
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "#6B7280",
                marginBottom: 16,
              }}
            >
              {getAptitudeComparisonText(aptitudeScore)}
            </div>

            {/* 進捗バー */}
            <div
              style={{
                width: "100%",
                height: 10,
                background: "#E5E7EB",
                borderRadius: 9999,
                border: "2px solid #2B1E16",
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: `${aptitudeScore}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #F97316 0%, #F59E0B 100%)",
                  borderRadius: 9999,
                }}
              />
            </div>

            <p
              style={{
                fontSize: 11,
                color: "#6B7280",
                textAlign: "center",
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              SABOROUがあなたのサボり能力をさらに高めていきます。一緒にダメになりましょう！
            </p>

            <button
              type="button"
              onClick={handleQuizComplete}
              className="w-full font-bold"
              style={{
                background: "#F97316",
                color: "#fff",
                border: "3px solid #2B1E16",
                borderRadius: 8,
                boxShadow: "0 4px 0 #2B1E16",
                padding: "11px 0",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              SABOROUを始める 🦥
            </button>
          </div>
        </dialog>
      );
    }

    const q = QUIZ_QUESTIONS[currentQuestion];
    const totalQ = QUIZ_QUESTIONS.length;

    return (
      <dialog
        open
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: "rgba(43,30,22,0.75)",
          border: "none",
          maxWidth: "none",
          margin: 0,
          padding: 0,
        }}
        aria-label="サボり適性クイズ"
      >
        <div
          className="card-brutal w-full max-w-sm flex flex-col"
          style={{
            background: "#FFFAF5",
            padding: "28px 24px 24px",
            minHeight: 320,
          }}
        >
          {/* クイズ進捗 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {QUIZ_QUESTIONS.map((q, i) => (
              <div
                key={q.question}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 9999,
                  background:
                    i < quizAnswers.length
                      ? "#F97316"
                      : i === currentQuestion
                        ? "#FED7AA"
                        : "#E5E7EB",
                  transition: "background 0.2s ease",
                }}
              />
            ))}
          </div>

          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#9CA3AF",
              textAlign: "center",
              marginBottom: 8,
              letterSpacing: "0.05em",
            }}
          >
            サボり適性クイズ {currentQuestion + 1}/{totalQ}
          </div>

          <div style={{ fontSize: 28, textAlign: "center", marginBottom: 12 }}>
            🦥
          </div>

          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#1F2937",
              textAlign: "center",
              marginBottom: 16,
              lineHeight: 1.4,
              fontFamily: "var(--font-display)",
            }}
          >
            {q.question}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleQuizAnswer(opt.point)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "2.5px solid #2B1E16",
                  boxShadow: "0 3px 0 #2B1E16",
                  background: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1F2937",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "transform 0.1s ease",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onComplete}
            style={{
              marginTop: 12,
              fontSize: 10,
              color: "#9CA3AF",
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "center",
              width: "100%",
            }}
          >
            クイズをスキップ
          </button>
        </div>
      </dialog>
    );
  }

  // ===== 通常スライド画面 =====
  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(43,30,22,0.75)",
        border: "none",
        maxWidth: "none",
        margin: 0,
        padding: 0,
      }}
      aria-label="SABOROU オンボーディング"
    >
      <div
        className="card-brutal w-full max-w-sm flex flex-col"
        style={{
          background: "#FFFAF5",
          padding: "28px 24px 24px",
          minHeight: 320,
        }}
      >
        {/* ドットインジケーター */}
        <div className="flex gap-1.5 justify-center mb-5">
          {SLIDES.map((s, i) => (
            <div
              key={s.emoji}
              style={{
                width: i === slideIndex ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === slideIndex ? slide.accent : "#D1D5DB",
                transition: "all 0.25s ease",
              }}
            />
          ))}
        </div>

        {/* 絵文字 */}
        <div className="text-center mb-4" style={{ fontSize: 52 }}>
          {slide.emoji}
        </div>

        {/* タイトル */}
        <h2
          className="font-extrabold text-saboru-ink text-center"
          style={{
            fontSize: 17,
            lineHeight: 1.35,
            whiteSpace: "pre-line",
            marginBottom: 12,
            fontFamily: "var(--font-display)",
          }}
        >
          {slide.title[locale]}
        </h2>

        {/* 本文 */}
        <p
          className="text-saboru-ink-soft text-center flex-1"
          style={{ fontSize: 12, lineHeight: 1.7 }}
        >
          {slide.body[locale]}
        </p>

        {/* ボタン */}
        <button
          type="button"
          onClick={handleSlideNext}
          className="mt-6 w-full font-bold"
          style={{
            background: slide.accent,
            color: "#fff",
            border: "3px solid #2B1E16",
            borderRadius: 8,
            boxShadow: "0 4px 0 #2B1E16",
            padding: "11px 0",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {isLast
            ? locale === "ja"
              ? "それでも使います 🫠"
              : "Yes, I'll use it anyway 🫠"
            : locale === "ja"
              ? "次へ →"
              : "Next →"}
        </button>

        {/* スキップ */}
        {!isLast && (
          <button
            type="button"
            onClick={onComplete}
            className="mt-2 text-center text-saboru-ink-muted w-full"
            style={{
              fontSize: 11,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {locale === "ja" ? "スキップ" : "Skip"}
          </button>
        )}
      </div>
    </dialog>
  );
}
