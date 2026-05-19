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
  title: string;
  body: string;
  count: number;
  color: string;
}

export const MANUAL_TRAITS: ManualTrait[] = [
  {
    title: "依頼者の温度感に敏感",
    body: "「至急」キーワード検出時のみ着手率が3倍。普段は寝かせる傾向。",
    count: 14,
    color: "#F97316",
  },
  {
    title: "リマインドがあると動く",
    body: "1回目のリマインド受信後、平均48分で着手。逆にリマインドなしだと締切24時間前まで動かない。",
    count: 23,
    color: "#EA580C",
  },
  {
    title: "クライアント案件は早め、社内案件は寝かせ",
    body: "社内タスクの平均着手タイミングは締切まで残り18%。外部案件は残り42%。",
    count: 9,
    color: "#10B981",
  },
  {
    title: "金曜午後は動かない",
    body: "金曜15時以降のタスクは99%が月曜朝に持ち越し。",
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
  name: string;
  tag: string;
  desc: string;
  sample: string;
  bg: string;
  color: string;
  available: boolean;
}

export const PERSONAS: Persona[] = [
  {
    id: "saboru_ottori",
    name: "おっとりサボロー",
    tag: "癒し系",
    desc: "やさしく背中を押してくれる現在の人格",
    sample:
      "これは完全放置すると危ないけど、今日中に全部やる必要はなさそうだよぉ。今は構成だけ作って寝かせるのがよさそうかもぉ ☁️",
    bg: "linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)",
    color: "#F97316",
    available: true,
  },
  {
    id: "saboru_strict",
    name: "鬼コーチサボロー",
    tag: "厳しい現実",
    desc: "感情ゼロ。事実だけを冷徹に告げる",
    sample:
      "結論: 今やる必要はない。締切まで18時間。依頼者は不在。構成だけ作って終わり。以上だ。",
    bg: "linear-gradient(135deg, #1F2937 0%, #374151 100%)",
    color: "#9CA3AF",
    available: false,
  },
  {
    id: "saboru_psy",
    name: "心理士サボロー",
    tag: "感情に寄り添う",
    desc: "「今の状態を観察してみましょう」と問いかける",
    sample:
      "今、このタスクに焦りを感じていますか？ 客観的にはまだ余裕があります。その焦りは、過去の経験から来ているのかもしれません。",
    bg: "linear-gradient(135deg, #DBEAFE 0%, #E0E7FF 100%)",
    color: "#6366F1",
    available: false,
  },
  {
    id: "saboru_hacker",
    name: "エンジニアサボロー",
    tag: "論理派",
    desc: "最適解を箇条書きで提示",
    sample:
      "[最適解] 後回し確定\n[根拠] deadline=18h / reminders=0 / requester.status=away\n[next_action] 構成のみ作成 → 一晩寝かす",
    bg: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
    color: "#34D399",
    available: false,
  },
];

/* ─── ロードマップ定義 ───────────────────────────── */

export interface RoadmapFeature {
  ic: string;
  name: string;
  desc: string;
}

export interface RoadmapMilestone {
  version: string;
  date: string;
  label: string;
  status: "current" | "next" | "planned";
  features: RoadmapFeature[];
}

export const ROADMAP_ITEMS: RoadmapMilestone[] = [
  {
    version: "v1.0",
    date: "2026-05-30",
    label: "MVP / 予選",
    status: "current",
    features: [
      { ic: "🤖", name: "サボり提案エンジン", desc: "Bedrock + Tool Use" },
      {
        ic: "💬",
        name: "Slack 文脈読解",
        desc: "リマインド・プレゼンス・キーワード",
      },
      { ic: "📝", name: "本音データ蓄積", desc: "クイック返信 + 自由入力" },
      { ic: "🛋", name: "おっとりサボロー", desc: "1人格固定" },
    ],
  },
  {
    version: "v1.1",
    date: "2026-06-26",
    label: "決勝",
    status: "next",
    features: [
      {
        ic: "📅",
        name: "Gmail / Calendar 連携",
        desc: "3ツール横断文脈読解",
      },
      {
        ic: "🔗",
        name: "タスク依存関係分析",
        desc: "「最もサボれる順序」を提案",
      },
      { ic: "✨", name: "Three.js キャラ演出", desc: "判定変化を3Dで可視化" },
      { ic: "📊", name: "傾向レポート β", desc: "取扱説明書の初期版" },
    ],
  },
  {
    version: "v2.0",
    date: "2026 年内",
    label: "正式リリース",
    status: "planned",
    features: [
      {
        ic: "📖",
        name: "取扱説明書 完全版",
        desc: "本音データの自動分析",
      },
      {
        ic: "🎭",
        name: "AI人格切り替え",
        desc: "おっとり / 鬼コーチ / 心理士 / エンジニア",
      },
      {
        ic: "🌐",
        name: "Notion / Linear 連携",
        desc: "対応外部ツール拡張",
      },
    ],
  },
  {
    version: "v3.0",
    date: "2027 以降",
    label: "プラットフォーム化",
    status: "planned",
    features: [
      { ic: "🏆", name: "サボりランキング", desc: "「美しい逃げ切り」を表彰" },
      {
        ic: "🔌",
        name: "MCP / 外部AI連携",
        desc: "ChatGPT / Claude / Notion AI",
      },
      { ic: "👥", name: "サボり方の流通", desc: "匿名共有プラットフォーム" },
    ],
  },
];
