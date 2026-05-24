import { useConnections } from "@/hooks/useConnections";
import { useToast } from "@/hooks/useToast";
import {
  type SlackChannelOption,
  getSlackChannels,
  notifyTaskToSlack,
} from "@/lib/apiClient";
import { toUserMessage } from "@/lib/utils";
/**
 * SlackShareControl — タスクの判定を Slack に共有する UI（C-2）
 *
 * 連携済みユーザーが、タスク詳細でチャンネルを選び判定を Slack に投稿する。
 * Slack 未連携時は何も表示しない。
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface SlackShareControlProps {
  taskId: string;
}

export function SlackShareControl({ taskId }: SlackShareControlProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { connections } = useConnections();
  const [channels, setChannels] = useState<SlackChannelOption[]>([]);
  const [selected, setSelected] = useState("");
  const [sharing, setSharing] = useState(false);

  const connected =
    connections.find((c) => c.service === "slack")?.status === "connected";

  // 連携済みのときだけチャンネル一覧を取得
  useEffect(() => {
    if (!connected) return;
    getSlackChannels()
      .then((list) => {
        setChannels(list);
        if (list.length > 0) setSelected(list[0].id);
      })
      .catch(() => {
        /* 連携直後などで取得失敗しても UI は致命的でないため握りつぶす */
      });
  }, [connected]);

  if (!connected || channels.length === 0) return null;

  const handleShare = () => {
    if (!selected || sharing) return;
    setSharing(true);
    notifyTaskToSlack(taskId, selected)
      .then(() => showToast(t("settings.shareResult"), "success"))
      .catch((err) => showToast(toUserMessage(err), "error"))
      .finally(() => setSharing(false));
  };

  return (
    <div className="card-brutal p-3 flex items-center gap-2">
      <select
        className="input-brutal flex-1"
        style={{ fontSize: 12 }}
        aria-label={t("settings.shareChannel")}
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
        onClick={handleShare}
        disabled={sharing}
        className="font-bold hover:opacity-80 disabled:opacity-50"
        style={{
          fontSize: 11,
          color: "#FFFFFF",
          background: "#4A154B",
          padding: "6px 14px",
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}
      >
        {sharing ? t("settings.sharing") : t("settings.shareToSlack")}
      </button>
    </div>
  );
}
