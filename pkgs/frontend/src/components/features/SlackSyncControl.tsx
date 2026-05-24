import { useToast } from "@/hooks/useToast";
import {
  type SlackChannelOption,
  getSlackChannels,
  syncSlackMessages,
} from "@/lib/apiClient";
import { toUserMessage } from "@/lib/utils";
/**
 * SlackSyncControl — Slack 履歴の遡及取り込み UI（C-1）
 *
 * 連携済みユーザーが、Bot 参加チャンネルを選んで過去メッセージを
 * まとめてタスク候補化する。設定画面の Slack 連携欄に表示する。
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function SlackSyncControl() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [channels, setChannels] = useState<SlackChannelOption[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // 参加チャンネル一覧を取得
  useEffect(() => {
    getSlackChannels()
      .then((list) => {
        setChannels(list);
        if (list.length > 0) setSelected(list[0].id);
      })
      .catch((err) => showToast(toUserMessage(err), "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleSync = () => {
    if (!selected || syncing) return;
    setSyncing(true);
    syncSlackMessages(selected)
      .then((res) => {
        showToast(t("settings.syncResult", { queued: res.queued }), "success");
      })
      .catch((err) => showToast(toUserMessage(err), "error"))
      .finally(() => setSyncing(false));
  };

  if (loading) return null;
  if (channels.length === 0) {
    return (
      <p className="text-saboru-ink-muted px-3 pb-3" style={{ fontSize: 10 }}>
        {t("settings.noChannels")}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 pb-3">
      <select
        className="input-brutal flex-1"
        style={{ fontSize: 12 }}
        aria-label={t("settings.syncChannel")}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {channels.map((ch) => (
          <option key={ch.id} value={ch.id}>
            #{ch.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="font-bold hover:opacity-80 disabled:opacity-50"
        style={{
          fontSize: 11,
          color: "#FFFFFF",
          background: "#4A154B",
          padding: "6px 12px",
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}
      >
        {syncing ? t("settings.syncing") : t("settings.syncMessages")}
      </button>
    </div>
  );
}
