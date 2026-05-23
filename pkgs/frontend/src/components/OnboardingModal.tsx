/**
 * OnboardingModal — 初回ログイン時のみ表示される3スライドモーダル
 *
 * スライド1: AIがタスクを判定する
 * スライド2: 5つの心理学理論で根拠を示す
 * スライド3: 使うほどAIに依存していく（裏設定の示唆）
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "saborou:onboarding_done";

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

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ja") ? "ja" : "en";
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];

  const isLast = current === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(43,30,22,0.75)" }}
      role="dialog"
      aria-modal="true"
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
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === current ? slide.accent : "#D1D5DB",
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
          onClick={handleNext}
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
    </div>
  );
}
