import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const STORAGE_KEY = "saboru_locale";

type Locale = "ja" | "en";

function detectInitialLanguage(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ja" || stored === "en") {
    return stored;
  }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

const resources = {
  ja: {
    translation: {
      nav: {
        tasks: "タスク",
        manual: "取説",
        settings: "設定",
        bottomNav: "ボトムナビゲーション",
      },
      common: {
        back: "戻る",
        loading: "読み込み中",
        close: "閉じる",
        cancel: "キャンセル",
        save: "保存",
        language: "Language / 言語",
      },
      app: {
        pageLoading: "ページを読み込み中",
        errorUnexpected: "予期しないエラーが発生しました",
        errorReload: "ページを再読み込みしてください",
        reload: "再読み込み",
      },
      login: {
        tagline: "サボりの最適解を、AIと。",
        startTitle: "ログインして始める",
        startDescription: "Amazon Cognito で安全にサインイン",
        securedBy: "提供",
        loginOrSignup: "ログイン / 新規登録",
        authenticating: "認証中...",
        loginAria: "ログインまたは新規登録",
        featuresAria: "SABOROU の特徴",
        features: [
          "Slack 自動連携で文脈を読解",
          "AI が「サボっていい根拠」を提示",
          "安心してサボれる",
        ],
      },
      authCallback: {
        cancelled: "ログインがキャンセルされました",
        invalidParams: "無効なコールバックパラメータです",
        securityError: "セキュリティエラー: ログインを再試行してください",
        failed: "ログイン処理に失敗しました。再試行してください",
        processingAria: "ログイン処理中",
        spinnerAria: "処理中",
        loggingIn: "ログイン中...",
      },
      settings: {
        title: "設定",
        connections: "サービス連携",
        slackDescription: "タスクを自動検出",
        checking: "確認中",
        connected: "連携済",
        disconnect: "解除",
        disconnected: "未連携",
        comingSoon: "近日公開",
        persona: "AI ペルソナ",
        personaCurrent: "おっとりサボロー",
        personaDescription: "やさしくサボりを支援するキャラ · 全4種",
        product: "プロダクト",
        roadmap: "プロダクトロードマップ",
        roadmapDescription: "v1.0 → v3.0 の将来ビジョン",
        logout: "ログアウト",
      },
      tasks: {
        todaySaborou: "今日のサボロー",
        noTaskBanner: "今日はサボり放題！何もないのが一番の贅沢だよぉ ☁️",
        hasTaskBanner: "{{count}}件あるけど、今日も無理しなくていいんだよぉ ☁️",
        pendingTasks: "承認待ちタスク",
        aiExtractedWithCount: "AI抽出 · {{count}}件",
        approvedTasks: "承認済みタスク",
        refreshTasks: "タスクを更新",
        noTasks: "タスクがありません",
        noTasksHint: "今日はサボり放題です！",
        addTask: "タスクを追加",
        addTaskTitle: "タスクを追加",
        detailTitle: "タスク詳細",
        editTask: "タスクを編集",
        deleteTask: "タスクを削除",
        deleteConfirm: "このタスクを削除しますか？",
        duePrefix: "締切",
        candidateDuePrefix: "期限",
        overdue: "期限切れ",
        aiExtracted: "AI抽出",
        manual: "手動",
        approve: "承認する",
        reject: "却下",
        viewDetails: "{{title}} の詳細を見る",
      },
      taskForm: {
        taskName: "タスク名",
        taskNamePlaceholder: "例: クライアント向けレポート作成",
        deadline: "期限",
        description: "内容・メモ",
        descriptionPlaceholder: "タスクの詳細（任意）",
        add: "追加する",
        adding: "追加中...",
        editFormAria: "タスク編集フォーム",
        content: "内容",
        contentPlaceholder: "タスクの内容",
        saving: "保存中...",
      },
      verdict: {
        canSaboru: "サボれます",
        borderline: "要検討",
        mustDo: "やるしかない",
        rationaleTitle: "サボろうの根拠",
        aiSource: "🤖 Claude Sonnet + Tool Use",
        psychTitle: "🧠 心理学的シグナル",
        psychSubtitle: "4 理論からの判定スコア",
        validity: "サボリ妥当性",
      },
      chat: {
        paneAria: "おっとりサボロー チャット",
        title: "おっとりサボロー",
        logAria: "チャットメッセージ",
        startMessage: "サボロー判定を開始します...",
        quickReplies: "クイックリプライ",
        messagePlaceholder: "サボろうについて質問...",
        toSaborou: "サボローへのメッセージ",
        send: "送信",
        assistantMessage: "サボローのメッセージ",
        userMessage: "あなたのメッセージ",
        typing: "サボローが入力中",
      },
      quickReply: {
        truly_tired: "確かに、もう少し寝かせよう",
        actually_important: "でもこのタスク急ぎかも...",
        agree_with_ai: "15分だけやってみる",
        disagree_with_ai: "完全に無視したい",
      },
      status: { current: "現在地", next: "次", planned: "計画中" },
    },
  },
  en: {
    translation: {
      nav: {
        tasks: "Tasks",
        manual: "Manual",
        settings: "Settings",
        bottomNav: "Bottom navigation",
      },
      common: {
        back: "Back",
        loading: "Loading",
        close: "Close",
        cancel: "Cancel",
        save: "Save",
        language: "Language / 言語",
      },
      app: {
        pageLoading: "Loading page",
        errorUnexpected: "An unexpected error occurred",
        errorReload: "Please reload the page",
        reload: "Reload",
      },
      login: {
        tagline: "The optimal way to slack off, with AI.",
        startTitle: "Sign in to get started",
        startDescription: "Secure sign-in with Amazon Cognito",
        securedBy: "Secured by",
        loginOrSignup: "Sign in / Sign up",
        authenticating: "Authenticating...",
        loginAria: "Sign in or create account",
        featuresAria: "SABOROU features",
        features: [
          "Reads context automatically from Slack",
          "AI explains why you can slack off",
          "Slack off with peace of mind",
        ],
      },
      authCallback: {
        cancelled: "Login was cancelled",
        invalidParams: "Invalid callback parameters",
        securityError: "Security error: please try logging in again",
        failed: "Login failed. Please try again",
        processingAria: "Processing login",
        spinnerAria: "Processing",
        loggingIn: "Signing in...",
      },
      settings: {
        title: "Settings",
        connections: "Connected services",
        slackDescription: "Auto-detect tasks",
        checking: "Checking",
        connected: "Connected",
        disconnect: "Disconnect",
        disconnected: "Not connected",
        comingSoon: "Coming soon",
        persona: "AI persona",
        personaCurrent: "Calm Saborou",
        personaDescription: "A gentle assistant persona · 4 total",
        product: "Product",
        roadmap: "Product roadmap",
        roadmapDescription: "Future vision from v1.0 to v3.0",
        logout: "Sign out",
      },
      tasks: {
        todaySaborou: "Today's Saborou",
        noTaskBanner: "No tasks today—perfect day to chill ☁️",
        hasTaskBanner:
          "{{count}} tasks, but you don't have to overdo it today ☁️",
        pendingTasks: "Pending approvals",
        aiExtractedWithCount: "AI extracted · {{count}}",
        approvedTasks: "Approved tasks",
        refreshTasks: "Refresh tasks",
        noTasks: "No tasks yet",
        noTasksHint: "You're free to slack off today!",
        addTask: "Add task",
        addTaskTitle: "Add task",
        detailTitle: "Task details",
        editTask: "Edit task",
        deleteTask: "Delete task",
        deleteConfirm: "Delete this task?",
        duePrefix: "Due",
        candidateDuePrefix: "Due",
        overdue: "Overdue",
        aiExtracted: "AI extracted",
        manual: "Manual",
        approve: "Approve",
        reject: "Reject",
        viewDetails: "View details for {{title}}",
      },
      taskForm: {
        taskName: "Task name",
        taskNamePlaceholder: "e.g. Prepare client report",
        deadline: "Deadline",
        description: "Details / Notes",
        descriptionPlaceholder: "Task details (optional)",
        add: "Add",
        adding: "Adding...",
        editFormAria: "Task edit form",
        content: "Content",
        contentPlaceholder: "Task content",
        saving: "Saving...",
      },
      verdict: {
        canSaboru: "Can slack off",
        borderline: "Needs review",
        mustDo: "Must do now",
        rationaleTitle: "Why you can slack off",
        aiSource: "🤖 Claude Sonnet + Tool Use",
        psychTitle: "🧠 Psychological signals",
        psychSubtitle: "Score across 4 theories",
        validity: "Slack validity",
      },
      chat: {
        paneAria: "Calm Saborou chat",
        title: "Calm Saborou",
        logAria: "Chat messages",
        startMessage: "Starting Saborou evaluation...",
        quickReplies: "Quick replies",
        messagePlaceholder: "Ask about slacking off...",
        toSaborou: "Message to Saborou",
        send: "Send",
        assistantMessage: "Saborou's message",
        userMessage: "Your message",
        typing: "Saborou is typing",
      },
      quickReply: {
        truly_tired: "You're right, let me defer a bit",
        actually_important: "This might actually be urgent...",
        agree_with_ai: "I'll do only 15 minutes",
        disagree_with_ai: "I want to ignore this completely",
      },
      status: { current: "Current", next: "Next", planned: "Planned" },
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: "ja",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  const locale = lng.startsWith("ja") ? "ja" : "en";
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
});

document.documentElement.lang = i18n.language.startsWith("ja") ? "ja" : "en";

export default i18n;
