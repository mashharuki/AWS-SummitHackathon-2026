import { SaborouAvatar } from "@/components/character/SaborouAvatar";
import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { SlackSyncControl } from "@/components/features/SlackSyncControl";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useAuth } from "@/hooks/useAuth";
import { useConnections } from "@/hooks/useConnections";
import { useToast } from "@/hooks/useToast";
/**
 * 設定ページ — U-06-ui-redesign Phase 5 改修版
 * 共有 HTML SettingsScreen 準拠（ネオブルータリズム）
 */
import apiClient from "@/lib/apiClient";
import type {
  CalendarFetchResponse,
  GmailFetchResponse,
} from "@/lib/apiClient";
import { getDisplayName, toUserMessage } from "@/lib/utils";
import { ChevronRight, LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

export function SettingsPage() {
  const { i18n, t } = useTranslation();
  const { user, signOut } = useAuth();
  const {
    connections,
    connectSlack,
    connectGoogle,
    disconnect,
    isLoading,
    refresh,
  } = useConnections();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Google OAuth コールバック後のクエリパラメータを処理
  useEffect(() => {
    const googleStatus = searchParams.get("google");
    if (googleStatus === "connected") {
      showToast("Google連携が完了しました", "success");
      void refresh();
      setSearchParams((prev) => {
        prev.delete("google");
        return prev;
      });
    } else if (googleStatus === "error") {
      showToast("Google連携に失敗しました。もう一度お試しください", "error");
      setSearchParams((prev) => {
        prev.delete("google");
        return prev;
      });
    }
  }, [searchParams, setSearchParams, showToast, refresh]);

  const slackConnection = connections.find((c) => c.service === "slack");
  const googleConnection = connections.find((c) => c.service === "google");

  // Google Calendar / Gmail 手動取り込み
  const [calendarFetchResult, setCalendarFetchResult] =
    useState<CalendarFetchResponse | null>(null);
  const [gmailFetchResult, setGmailFetchResult] =
    useState<GmailFetchResponse | null>(null);
  const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
  const [isFetchingGmail, setIsFetchingGmail] = useState(false);

  const handleFetchCalendar = useCallback(() => {
    if (isFetchingCalendar) return;
    setIsFetchingCalendar(true);
    apiClient
      .fetchGoogleCalendar()
      .then((res) => {
        setCalendarFetchResult(res);
        showToast(
          `カレンダーを取り込みました（${res.upcomingEventCount}件）`,
          "success",
        );
      })
      .catch((err) => showToast(toUserMessage(err), "error"))
      .finally(() => setIsFetchingCalendar(false));
  }, [isFetchingCalendar, showToast]);

  const handleFetchGmail = useCallback(() => {
    if (isFetchingGmail) return;
    setIsFetchingGmail(true);
    apiClient
      .fetchGmail()
      .then((res) => {
        setGmailFetchResult(res);
        showToast(
          `Gmailを取り込みました（タスク候補: ${res.extracted}件）`,
          "success",
        );
      })
      .catch((err) => showToast(toUserMessage(err), "error"))
      .finally(() => setIsFetchingGmail(false));
  }, [isFetchingGmail, showToast]);

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <PageHeader title={t("settings.title")} />

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 flex flex-col gap-3">
          {/* プロフィール */}
          {user && (
            <div className="card-brutal p-3.5 flex items-center gap-3">
              <SaborouAvatar size={48} personaId={user.preferredPersonaId} />
              <div className="min-w-0">
                <p
                  className="font-bold text-saboru-ink truncate"
                  style={{ fontSize: 14 }}
                >
                  {getDisplayName(user)}
                </p>
                <p
                  className="text-saboru-ink-muted truncate"
                  style={{ fontSize: 11 }}
                >
                  {user.email}
                </p>
              </div>
            </div>
          )}

          {/* サービス連携 */}
          <section aria-labelledby="connections-heading">
            <SectionLabel>
              <span id="connections-heading">{t("settings.connections")}</span>
            </SectionLabel>
            <div className="card-brutal overflow-hidden">
              {/* Slack */}
              <div
                className="flex items-center gap-3 p-3"
                style={{ borderBottom: "1px solid #F3F4F6" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#4A154B" }}
                  aria-hidden="true"
                >
                  <span className="text-white text-xs font-extrabold">S</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-saboru-ink font-semibold"
                    style={{ fontSize: 13 }}
                  >
                    Slack
                  </p>
                  <p
                    className="text-saboru-ink-muted mt-0.5"
                    style={{ fontSize: 10 }}
                  >
                    {t("settings.slackDescription")}
                  </p>
                </div>
                {isLoading ? (
                  <div
                    className="w-4 h-4 border border-saboru-line border-t-transparent rounded-full animate-spin"
                    role="status"
                    aria-label={t("settings.checking")}
                  />
                ) : slackConnection?.status === "connected" ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold"
                      style={{
                        fontSize: 10,
                        color: "#10B981",
                        background: "#ECFDF5",
                        padding: "3px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {t("settings.connected")}
                    </span>
                    <button
                      type="button"
                      onClick={() => void disconnect("slack")}
                      aria-label={t("settings.disconnect")}
                      className="text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      {t("settings.disconnect")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void connectSlack()}
                    aria-label={t("settings.connect")}
                    className="font-bold hover:opacity-80"
                    style={{
                      fontSize: 10,
                      color: "#FFFFFF",
                      background: "#4A154B",
                      padding: "4px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {t("settings.connect")}
                  </button>
                )}
              </div>

              {/* C-1: 連携済みなら過去メッセージの遡及取り込み UI を表示 */}
              {slackConnection?.status === "connected" && <SlackSyncControl />}

              {/* Google */}
              <div
                className="flex items-center gap-3 p-3"
                style={{ borderTop: "1px solid #F3F4F6" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#EA4335" }}
                  aria-hidden="true"
                >
                  <span className="text-white text-xs font-extrabold">G</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-saboru-ink font-semibold"
                    style={{ fontSize: 13 }}
                  >
                    Google
                  </p>
                  <p
                    className="text-saboru-ink-muted mt-0.5"
                    style={{ fontSize: 10 }}
                  >
                    Gmail・カレンダーと連携してサボり判定を強化
                  </p>
                </div>
                {isLoading ? (
                  <div
                    className="w-4 h-4 border border-saboru-line border-t-transparent rounded-full animate-spin"
                    role="status"
                    aria-label={t("settings.checking")}
                  />
                ) : googleConnection?.status === "connected" ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold"
                      style={{
                        fontSize: 10,
                        color: "#10B981",
                        background: "#ECFDF5",
                        padding: "3px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {t("settings.connected")}
                    </span>
                    <button
                      type="button"
                      onClick={() => void disconnect("google")}
                      aria-label="Google連携を解除"
                      className="text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      {t("settings.disconnect")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void connectGoogle()}
                    aria-label="Googleアカウントを連携する"
                    className="font-bold hover:opacity-80"
                    style={{
                      fontSize: 10,
                      color: "#FFFFFF",
                      background: "#EA4335",
                      padding: "4px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {t("settings.connect")}
                  </button>
                )}
              </div>

              {/* Google 連携済みなら Calendar / Gmail 手動取り込みボタンを表示 */}
              {googleConnection?.status === "connected" && (
                <div
                  className="flex flex-col gap-2 px-3 pb-3"
                  style={{ borderTop: "1px solid #F3F4F6" }}
                >
                  {/* Calendar 取り込み */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleFetchCalendar}
                      disabled={isFetchingCalendar}
                      className="font-bold hover:opacity-80 disabled:opacity-50"
                      style={{
                        fontSize: 11,
                        color: "#FFFFFF",
                        background: "#1A73E8",
                        padding: "6px 12px",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isFetchingCalendar
                        ? "取り込み中..."
                        : "カレンダーを取り込む"}
                    </button>
                    {calendarFetchResult && (
                      <span
                        className="text-saboru-ink-muted"
                        style={{ fontSize: 10 }}
                      >
                        {calendarFetchResult.upcomingEventCount}件・
                        {new Date(
                          calendarFetchResult.fetchedAt,
                        ).toLocaleTimeString("ja-JP", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        取得
                      </span>
                    )}
                  </div>
                  {/* Gmail 取り込み */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFetchGmail}
                      disabled={isFetchingGmail}
                      className="font-bold hover:opacity-80 disabled:opacity-50"
                      style={{
                        fontSize: 11,
                        color: "#FFFFFF",
                        background: "#EA4335",
                        padding: "6px 12px",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isFetchingGmail ? "取り込み中..." : "Gmailを取り込む"}
                    </button>
                    {gmailFetchResult && (
                      <span
                        className="text-saboru-ink-muted"
                        style={{ fontSize: 10 }}
                      >
                        候補{gmailFetchResult.extracted}件を追加
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="language-heading">
            <SectionLabel>
              <span id="language-heading">{t("common.language")}</span>
            </SectionLabel>
            <div className="card-brutal p-3.5">
              <select
                className="input-brutal w-full"
                aria-label={t("common.language")}
                value={i18n.language.startsWith("ja") ? "ja" : "en"}
                onChange={(e) => {
                  void i18n.changeLanguage(e.target.value);
                }}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
          </section>

          {/* AI ペルソナ */}
          <section aria-labelledby="persona-heading">
            <SectionLabel>
              <span id="persona-heading">{t("settings.persona")}</span>
            </SectionLabel>
            <Link
              to="/settings/persona"
              aria-label={t("settings.persona")}
              className="card-brutal flex items-center gap-3 p-3.5"
              style={{ textDecoration: "none" }}
            >
              <SaborouCharacter2D
                verdict="can_saboru"
                size={44}
                animated={false}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-saboru-ink font-bold"
                  style={{ fontSize: 13 }}
                >
                  {t("settings.personaCurrent")}
                </p>
                <p
                  className="text-saboru-ink-muted mt-0.5"
                  style={{ fontSize: 10 }}
                >
                  {t("settings.personaDescription")}
                </p>
              </div>
              <ChevronRight
                size={16}
                className="text-saboru-ink-muted"
                aria-hidden="true"
              />
            </Link>
          </section>

          {/* ログアウト */}
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label={t("settings.logout")}
            className="card-brutal w-full p-3 mt-2 flex items-center justify-center gap-2 text-saboru-ink-soft hover:text-red-500"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <LogOut size={16} aria-hidden="true" />
            {t("settings.logout")}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
