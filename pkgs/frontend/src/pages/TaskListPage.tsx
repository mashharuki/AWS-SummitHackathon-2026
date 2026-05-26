import { OnboardingModal, useOnboarding } from "@/components/OnboardingModal";
import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { AppShell } from "@/components/layout/AppShell";
import { Logo } from "@/components/layout/Logo";
import { TaskAddModal } from "@/components/task/TaskAddModal";
import { TaskApprovalModal } from "@/components/task/TaskApprovalModal";
import { CandidateCard, TaskCard } from "@/components/task/TaskCard";
import { DependencyScoreDisplay } from "@/components/ui/DependencyScoreDisplay";
import { SeasonBanner } from "@/components/ui/SeasonBanner";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WeeklyChallengeCard } from "@/components/ui/WeeklyChallengeCard";
import {
  VerdictHistory,
  loadVerdictHistory,
} from "@/components/verdict/VerdictHistory";
import { useAuth } from "@/hooks/useAuth";
import { useDependencyScore } from "@/hooks/useDependencyScore";
import { useTasks } from "@/hooks/useTasks";
import { PERSONA_BANNERS } from "@/lib/staticContent";
import { getDisplayName } from "@/lib/utils";
/**
 * タスク一覧ページ — U-06-ui-redesign Phase 5 改修版
 *
 * 共有 HTML TaskListScreen 準拠（ネオブルータリズム + 2D アバター）
 * 今日バナー / 承認済みタスク / 候補タスク / FAB の構成。
 * キャラはすべて 2D SVG（憲法2,6）。
 */
import type { TaskCandidate, Verdict } from "@saboru/shared";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function TaskListPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const locale = i18n.language.startsWith("ja") ? "ja" : "en";
  const {
    tasks,
    candidates,
    isLoading,
    refresh,
    approveCandidate,
    rejectCandidate,
    createTask,
  } = useTasks();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // 承認確認モーダル: 「承認する」押下で対象候補をセットして開く（即承認はしない）
  const [approvalCandidate, setApprovalCandidate] =
    useState<TaskCandidate | null>(null);
  const verdictHistory = loadVerdictHistory();
  const { shouldShow: showOnboarding, markDone: completeOnboarding } =
    useOnboarding();
  const { score, justDecremented } = useDependencyScore();

  const activeTasks = tasks.filter((t) => t.status === "approved");

  // 今日バナーの verdict: タスクが無い or 全部 can_saboru なら "can_saboru"、
  // それ以外は最も重い verdict を採用（MVP では can_saboru 固定でも OK）
  const bannerVerdict: Verdict = "can_saboru";
  // 挨拶文: ペルソナ別文言があればそれを使う（口調を一貫させる）。
  // 無い/おっとりは既存の i18n デフォルト文言。
  const personaBanner = user?.preferredPersonaId
    ? PERSONA_BANNERS[user.preferredPersonaId]
    : undefined;
  const bannerMessage = personaBanner
    ? activeTasks.length === 0
      ? personaBanner.noTask[locale]
      : personaBanner.hasTask[locale].replace(
          "{{count}}",
          String(activeTasks.length),
        )
    : activeTasks.length === 0
      ? t("tasks.noTaskBanner")
      : t("tasks.hasTaskBanner", { count: activeTasks.length });

  return (
    <AppShell>
      <div className="flex flex-col flex-1 min-h-0">
        {/* ヘッダー（Logo + アバター）
            md+: Logo は SideNav に表示されるため非表示 */}
        <header
          className="bg-saboru-paper px-4 md:px-6 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "3px solid #2B1E16" }}
        >
          {/* モバイルのみ Logo を表示 */}
          <span className="md:hidden">
            <Logo size={30} />
          </span>
          {/* md+: ページタイトルを表示 */}
          <span
            className="hidden md:block font-extrabold text-saboru-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              letterSpacing: "-0.03em",
            }}
          >
            タスク一覧
          </span>
          <div className="flex items-center gap-3">
            <DependencyScoreDisplay
              score={score}
              justDecremented={justDecremented}
            />
            {user && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "#FED7AA",
                  color: "#EA580C",
                  fontWeight: 700,
                  fontSize: 12,
                }}
                aria-label={getDisplayName(user)}
              >
                {getDisplayName(user).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {/* ポジショニングタグライン */}
        <div className="px-4 pt-2" style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#D97706",
              letterSpacing: "0.04em",
            }}
          >
            AIに、サボっていいと言わせよう
          </p>
        </div>

        {/* シーズンバナー + 週次チャレンジ */}
        <div className="px-4 pt-2 flex flex-col gap-2">
          <SeasonBanner />
          <WeeklyChallengeCard />
        </div>

        {/* 今日バナー */}
        <div className="px-4 pt-3 pb-2">
          <div
            className="card-brutal flex items-center gap-3 px-3.5 py-3"
            style={{
              background: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
            }}
          >
            <SaborouCharacter2D
              verdict={bannerVerdict}
              size={56}
              personaId={user?.preferredPersonaId}
            />
            <div className="flex-1 min-w-0">
              <p
                className="font-bold tracking-wider"
                style={{
                  fontSize: 11,
                  color: "#EA580C",
                  letterSpacing: "0.05em",
                }}
              >
                {t("tasks.todaySaborou")}
              </p>
              <p
                className="text-saboru-ink font-semibold mt-0.5"
                style={{ fontSize: 13, lineHeight: 1.4 }}
              >
                {bannerMessage}
              </p>
            </div>
          </div>
        </div>

        {/* タスクリスト本体 */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-24 md:pb-8">
          {/* 候補タスク */}
          {candidates.length > 0 && (
            <section aria-labelledby="candidates-heading" className="pt-4">
              <SectionLabel
                hint={t("tasks.aiExtractedWithCount", {
                  count: candidates.length,
                })}
              >
                <span id="candidates-heading">{t("tasks.pendingTasks")}</span>
              </SectionLabel>
              {/* md+: 2カラムグリッド */}
              <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3">
                {candidates.map((c) => (
                  <CandidateCard
                    key={c.candidateId}
                    candidate={c}
                    // 即承認はせず確認モーダルを開く（精度向上のため内容を確認・編集させる）
                    onApprove={(id) => {
                      const target = candidates.find(
                        (x) => x.candidateId === id,
                      );
                      if (target) setApprovalCandidate(target);
                    }}
                    onReject={(id) => void rejectCandidate(id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 承認済みタスク */}
          <section aria-labelledby="tasks-heading" className="pt-5">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <h2
                id="tasks-heading"
                className="text-saboru-ink-soft font-bold"
                style={{ fontSize: 10, letterSpacing: "0.1em" }}
              >
                {t("tasks.approvedTasks")}
                <span
                  className="ml-2 text-saboru-ink-muted"
                  style={{ fontWeight: 500 }}
                >
                  {activeTasks.length}件
                </span>
              </h2>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={isLoading}
                aria-label={t("tasks.refreshTasks")}
                className="text-saboru-ink-soft hover:text-saboru-ink p-1"
              >
                <RefreshCw
                  size={14}
                  className={isLoading ? "animate-spin" : ""}
                  aria-hidden="true"
                />
              </button>
            </div>

            {isLoading ? (
              /* md+: 2カラムスケルトン */
              <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl bg-saboru-paper/60 animate-pulse"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : activeTasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-saboru-ink-muted" style={{ fontSize: 13 }}>
                  {t("tasks.noTasks")}
                </p>
                <p
                  className="text-saboru-ink-muted mt-1"
                  style={{ fontSize: 11 }}
                >
                  {t("tasks.noTasksHint")}
                </p>
              </div>
            ) : (
              /* md+: 2カラムグリッド */
              <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3">
                {activeTasks.map((task) => (
                  <TaskCard key={task.taskId} task={task} />
                ))}
              </div>
            )}
          </section>

          {/* 判定履歴セクション */}
          {verdictHistory.length > 0 && (
            <section className="pt-5 pb-2">
              <VerdictHistory entries={verdictHistory} />
            </section>
          )}
        </div>

        {/* FAB: タスク追加
            Mobile: BottomNav の上（bottom-24）
            md+: BottomNav 非表示なので bottom-8 に変更 */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          aria-label={t("tasks.addTask")}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: "#F97316",
            border: "3px solid #2B1E16",
            color: "#FFFFFF",
            fontSize: 28,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 5px 0 #2B1E16, 0 10px 20px rgba(249,115,22,0.28)",
            lineHeight: 1,
          }}
        >
          <Plus size={26} aria-hidden="true" />
        </button>

        {/* タスク追加モーダル */}
        <TaskAddModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={async (data) => {
            await createTask(data);
          }}
        />

        {/* 承認確認モーダル（候補の内容を確認・編集してから承認） */}
        <TaskApprovalModal
          candidate={approvalCandidate}
          isOpen={approvalCandidate !== null}
          onClose={() => setApprovalCandidate(null)}
          onConfirm={async (candidateId, overrides) => {
            await approveCandidate(candidateId, overrides);
          }}
        />

        {/* 初回オンボーディングモーダル */}
        {showOnboarding && <OnboardingModal onComplete={completeOnboarding} />}
      </div>
    </AppShell>
  );
}
