/**
 * 静的コンテンツ定義 — API 未対応ページのデータソース
 *
 * U-06-ui-redesign Phase 6 / ui-redesign-spec.md 5 章準拠
 *
 * 取説・ペルソナ・ロードマップは API が無いため、フロント側のベタ書きで対応する。
 * 将来 API 化する場合はこのファイルを差し替える。
 */

/* ─── 取扱説明書（取説）コンテンツ ────────────────── */

export interface ManualTrait {
  title: { ja: string; en: string };
  body: { ja: string; en: string };
  count: number;
  color: string;
}

export const MANUAL_TRAITS: ManualTrait[] = [
  {
    title: {
      ja: "依頼者の温度感に敏感",
      en: "Sensitive to requester urgency",
    },
    body: {
      ja: "「至急」キーワード検出時のみ着手率が3倍。普段は寝かせる傾向。",
      en: "Start rate is 3x only when urgent keywords are detected; otherwise tends to defer.",
    },
    count: 14,
    color: "#F97316",
  },
  {
    title: {
      ja: "リマインドがあると動く",
      en: "Moves after reminders",
    },
    body: {
      ja: "1回目のリマインド受信後、平均48分で着手。逆にリマインドなしだと締切24時間前まで動かない。",
      en: "Starts on average 48 minutes after the first reminder; without reminders, waits until 24h before deadline.",
    },
    count: 23,
    color: "#EA580C",
  },
  {
    title: {
      ja: "クライアント案件は早め、社内案件は寝かせ",
      en: "Client tasks start earlier, internal tasks are deferred",
    },
    body: {
      ja: "社内タスクの平均着手タイミングは締切まで残り18%。外部案件は残り42%。",
      en: "Average start timing: internal tasks at 18% remaining time, external tasks at 42%.",
    },
    count: 9,
    color: "#10B981",
  },
  {
    title: {
      ja: "金曜午後は動かない",
      en: "Rarely moves on Friday afternoon",
    },
    body: {
      ja: "金曜15時以降のタスクは99%が月曜朝に持ち越し。",
      en: "99% of tasks arriving after 3pm on Friday are postponed to Monday morning.",
    },
    count: 7,
    color: "#6366F1",
  },
];

export const MANUAL_PROGRESS = {
  collected: 53,
  total: 100,
};

/* ─── ペルソナ定義 ──────────────────────────────── */

export interface Persona {
  id: string;
  name: { ja: string; en: string };
  tag: { ja: string; en: string };
  desc: { ja: string; en: string };
  sample: { ja: string; en: string };
  bg: string;
  color: string;
  available: boolean;
}

export const PERSONAS: Persona[] = [
  {
    id: "saboru_ottori",
    name: { ja: "おっとりサボロー", en: "Calm Saborou" },
    tag: { ja: "癒し系", en: "Gentle" },
    desc: {
      ja: "やさしく背中を押してくれる現在の人格",
      en: "Current persona that gently nudges you forward",
    },
    sample: {
      ja: "これは完全放置すると危ないけど、今日中に全部やる必要はなさそうだよぉ。今は構成だけ作って寝かせるのがよさそうかもぉ ☁️",
      en: "Ignoring this entirely is risky, but you probably don't need to finish everything today. Maybe draft just the outline and let it rest ☁️",
    },
    bg: "linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)",
    color: "#F97316",
    available: true,
  },
  {
    id: "saboru_strict",
    name: { ja: "鬼コーチサボロー", en: "Coach Saborou" },
    tag: { ja: "厳しい現実", en: "Strict reality" },
    desc: {
      ja: "感情ゼロ。事実だけを冷徹に告げる",
      en: "No emotions. Coldly states only facts.",
    },
    sample: {
      ja: "結論: 今やる必要はない。締切まで18時間。依頼者は不在。構成だけ作って終わり。以上だ。",
      en: "Conclusion: You do not need to do this now. 18h to deadline. Requester is away. Draft only structure and stop.",
    },
    bg: "linear-gradient(135deg, #1F2937 0%, #374151 100%)",
    color: "#9CA3AF",
    available: false,
  },
  {
    id: "saboru_psy",
    name: { ja: "心理士サボロー", en: "Therapist Saborou" },
    tag: { ja: "感情に寄り添う", en: "Emotion-aware" },
    desc: {
      ja: "「今の状態を観察してみましょう」と問いかける",
      en: "Asks you to observe your current state.",
    },
    sample: {
      ja: "今、このタスクに焦りを感じていますか？ 客観的にはまだ余裕があります。その焦りは、過去の経験から来ているのかもしれません。",
      en: "Do you feel anxious about this task now? Objectively, you still have room. That anxiety may come from past experience.",
    },
    bg: "linear-gradient(135deg, #DBEAFE 0%, #E0E7FF 100%)",
    color: "#6366F1",
    available: false,
  },
  {
    id: "saboru_hacker",
    name: { ja: "エンジニアサボロー", en: "Engineer Saborou" },
    tag: { ja: "論理派", en: "Logical" },
    desc: {
      ja: "最適解を箇条書きで提示",
      en: "Shows optimal action in bullet form",
    },
    sample: {
      ja: "[最適解] 後回し確定\n[根拠] deadline=18h / reminders=0 / requester.status=away\n[next_action] 構成のみ作成 → 一晩寝かす",
      en: "[Optimal] Defer task\n[Reason] deadline=18h / reminders=0 / requester.status=away\n[next_action] draft structure only -> let rest overnight",
    },
    bg: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
    color: "#34D399",
    available: false,
  },
];

/* ─── ロードマップ定義 ───────────────────────────── */

export interface RoadmapFeature {
  ic: string;
  name: { ja: string; en: string };
  desc: { ja: string; en: string };
}

export interface RoadmapMilestone {
  version: string;
  date: string;
  label: { ja: string; en: string };
  status: "current" | "next" | "planned";
  features: RoadmapFeature[];
}

export const ROADMAP_ITEMS: RoadmapMilestone[] = [
  {
    version: "v1.0",
    date: "2026-05-30",
    label: { ja: "MVP / 予選", en: "MVP / Preliminary" },
    status: "current",
    features: [
      {
        ic: "🤖",
        name: { ja: "サボり提案エンジン", en: "Slack-off proposal engine" },
        desc: { ja: "Bedrock + Tool Use", en: "Bedrock + Tool Use" },
      },
      {
        ic: "💬",
        name: { ja: "Slack 文脈読解", en: "Slack context understanding" },
        desc: {
          ja: "リマインド・プレゼンス・キーワード",
          en: "Reminders, presence, keywords",
        },
      },
      {
        ic: "📝",
        name: { ja: "本音データ蓄積", en: "Honne data collection" },
        desc: {
          ja: "クイック返信 + 自由入力",
          en: "Quick replies + free text",
        },
      },
      {
        ic: "🛋",
        name: { ja: "おっとりサボロー", en: "Calm Saborou" },
        desc: { ja: "1人格固定", en: "Single fixed persona" },
      },
    ],
  },
  {
    version: "v1.1",
    date: "2026-06-26",
    label: { ja: "決勝", en: "Final round" },
    status: "next",
    features: [
      {
        ic: "📅",
        name: {
          ja: "Gmail / Calendar 連携",
          en: "Gmail / Calendar integration",
        },
        desc: { ja: "3ツール横断文脈読解", en: "Cross-tool context analysis" },
      },
      {
        ic: "🔗",
        name: { ja: "タスク依存関係分析", en: "Task dependency analysis" },
        desc: {
          ja: "「最もサボれる順序」を提案",
          en: "Suggests the most skippable order",
        },
      },
      {
        ic: "✨",
        name: { ja: "Three.js キャラ演出", en: "Three.js character effects" },
        desc: {
          ja: "判定変化を3Dで可視化",
          en: "Visualize verdict changes in 3D",
        },
      },
      {
        ic: "📊",
        name: { ja: "傾向レポート β", en: "Trend report beta" },
        desc: { ja: "取扱説明書の初期版", en: "Initial personal manual" },
      },
    ],
  },
  {
    version: "v2.0",
    date: "2026 年内",
    label: { ja: "正式リリース", en: "General release" },
    status: "planned",
    features: [
      {
        ic: "📖",
        name: { ja: "取扱説明書 完全版", en: "Personal manual full version" },
        desc: {
          ja: "本音データの自動分析",
          en: "Automatic honne data analysis",
        },
      },
      {
        ic: "🎭",
        name: { ja: "AI人格切り替え", en: "AI persona switching" },
        desc: {
          ja: "おっとり / 鬼コーチ / 心理士 / エンジニア",
          en: "Calm / Coach / Therapist / Engineer",
        },
      },
      {
        ic: "🌐",
        name: { ja: "Notion / Linear 連携", en: "Notion / Linear integration" },
        desc: { ja: "対応外部ツール拡張", en: "Expand external tools" },
      },
    ],
  },
  {
    version: "v3.0",
    date: "2027 以降",
    label: { ja: "プラットフォーム化", en: "Platform phase" },
    status: "planned",
    features: [
      {
        ic: "🏆",
        name: { ja: "サボりランキング", en: "Slack-off ranking" },
        desc: { ja: "「美しい逃げ切り」を表彰", en: "Reward elegant escapes" },
      },
      {
        ic: "🔌",
        name: { ja: "MCP / 外部AI連携", en: "MCP / external AI integration" },
        desc: {
          ja: "ChatGPT / Claude / Notion AI",
          en: "ChatGPT / Claude / Notion AI",
        },
      },
      {
        ic: "👥",
        name: { ja: "サボり方の流通", en: "Slack-off pattern sharing" },
        desc: {
          ja: "匿名共有プラットフォーム",
          en: "Anonymous sharing platform",
        },
      },
    ],
  },
];
