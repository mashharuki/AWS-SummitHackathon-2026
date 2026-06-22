/**
 * MiniGantt — Side Panel 400px 向けの簡易3バンドガント
 *
 * 横軸は稼働時間 8:00〜17:00 固定。バンド種別ごとに色分けし、各ステップを
 * 1行 = 1ステップで表示する（frontend の GanttChart は横軸時間レーンだが、
 * 400px では縦リスト + 時間バーの方が読みやすい）。
 *
 * SaboriSchedule.blocks があればそれを描画。無ければデモブロックを生成。
 */

import type {
  BandType,
  SaboriSchedule,
  ScheduleBlock,
  SubTask,
} from "@/panel/lib/types";
import {
  WORK_END_HOUR,
  WORK_START_HOUR,
  formatHm,
} from "@/panel/lib/workHours";

const BAND_COLOR: Record<BandType, string> = {
  saboru: "#10b981",
  work: "#3b82f6",
  decision: "#f59e0b",
  busy: "#9ca3af",
};

const BAND_LABEL: Record<BandType, string> = {
  saboru: "さぼろう",
  work: "作業",
  decision: "意思決定",
  busy: "予定",
};

/** 稼働時間に対するブロックの左位置・幅（%）を求める */
function blockGeometry(block: ScheduleBlock): { left: number; width: number } {
  const dayStart = WORK_START_HOUR * 60;
  const dayEnd = WORK_END_HOUR * 60;
  const span = dayEnd - dayStart;

  const start = new Date(block.startAt);
  const end = new Date(block.endAt);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();

  const left = ((Math.max(dayStart, startMin) - dayStart) / span) * 100;
  const width =
    ((Math.min(dayEnd, endMin) - Math.max(dayStart, startMin)) / span) * 100;
  return { left: Math.max(0, left), width: Math.max(2, width) };
}

/** デモ用ブロック（schedule API 不在時のフォールバック） */
function demoBlocks(): ScheduleBlock[] {
  const today = new Date();
  const at = (h: number, m: number) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return [
    {
      stepId: "s1",
      stepLabel: "ダミーデータ追加",
      bandType: "work",
      startAt: at(9, 0),
      endAt: at(10, 0),
      durationMinutes: 60,
    },
    {
      stepId: "s2",
      stepLabel: "文章チェック",
      bandType: "work",
      startAt: at(10, 30),
      endAt: at(11, 30),
      durationMinutes: 60,
    },
    {
      stepId: "s3",
      stepLabel: "上司に確認",
      bandType: "decision",
      startAt: at(14, 0),
      endAt: at(14, 30),
      durationMinutes: 30,
    },
    {
      stepId: "s4",
      stepLabel: "休憩 & 祈り",
      bandType: "saboru",
      startAt: at(15, 0),
      endAt: at(16, 30),
      durationMinutes: 90,
    },
  ];
}

/** PM WBSサブタスクをScheduleBlock配列に変換する */
function subtasksToBlocks(subtasks: SubTask[]): ScheduleBlock[] {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const workStartMin = WORK_START_HOUR * 60;
  const workEndMin = WORK_END_HOUR * 60;

  // 勤務時間外（業後・未明）は9:00始まりで配置し、表示範囲内に収める
  const startMin =
    nowMin >= workStartMin && nowMin < workEndMin ? nowMin : workStartMin + 60;
  let currentMin = startMin;

  return subtasks
    .filter((st) => st.status !== "skipped")
    .map((st) => {
      // 稼働終了を超えた場合は勤務開始に折り返す
      if (currentMin >= workEndMin) currentMin = workStartMin + 60;

      const startAt = new Date();
      startAt.setHours(Math.floor(currentMin / 60), currentMin % 60, 0, 0);
      const endMin = Math.min(currentMin + st.estimatedMinutes, workEndMin);
      currentMin += st.estimatedMinutes;
      const endAt = new Date();
      endAt.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

      const bandType: BandType =
        st.saborouType === "decision"
          ? "decision"
          : st.saborouType === "saboru" || st.status === "done"
            ? "saboru"
            : "work";

      return {
        stepId: st.id,
        stepLabel: st.title,
        bandType,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        durationMinutes: st.estimatedMinutes,
      };
    });
}

/** activeTaskから仮ブロックを生成する（decompose失敗・未実施時のフォールバック） */
function taskFallbackBlocks(taskTitle: string): ScheduleBlock[] {
  const at = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const label = taskTitle.slice(0, 20);
  return [
    { stepId: "t1", stepLabel: label, bandType: "work", startAt: at(9, 0), endAt: at(11, 0), durationMinutes: 120 },
    { stepId: "t2", stepLabel: "確認・調整", bandType: "decision", startAt: at(13, 0), endAt: at(14, 0), durationMinutes: 60 },
    { stepId: "t3", stepLabel: "さぼろう", bandType: "saboru", startAt: at(15, 0), endAt: at(17, 0), durationMinutes: 120 },
  ];
}

export function MiniGantt({
  schedule,
  subtasks,
  activeTaskTitle,
}: {
  schedule: SaboriSchedule | null;
  subtasks?: SubTask[];
  activeTaskTitle?: string;
}) {
  const blocks = (() => {
    if (subtasks && subtasks.length > 0) return subtasksToBlocks(subtasks);
    if (schedule && schedule.blocks.length > 0) return schedule.blocks;
    if (activeTaskTitle) return taskFallbackBlocks(activeTaskTitle);
    return [];
  })();

  // データなし状態（タスクなし）
  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-5 gap-1" data-testid="mini-gantt-empty">
        <p className="text-xs text-[#9ca3af]">今日はまだスケジュールがありません</p>
        <p className="text-[10px] text-[#d1d5db]">依頼整理でタスクを承認すると表示されます</p>
      </div>
    );
  }

  // 時間目盛（8,10,12,14,16 と 17）
  const ticks = [8, 10, 12, 14, 16, 17];
  const span = WORK_END_HOUR - WORK_START_HOUR;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowLeft = ((nowMin - WORK_START_HOUR * 60) / (span * 60)) * 100;
  const showNow = nowLeft >= 0 && nowLeft <= 100;

  return (
    <div data-testid="mini-gantt">
      {/* 時間目盛 */}
      <div className="relative h-4 mb-1 ml-[88px]">
        {ticks.map((h) => (
          <span
            key={h}
            className="absolute text-[9px] text-[#9ca3af] -translate-x-1/2"
            style={{ left: `${((h - WORK_START_HOUR) / span) * 100}%` }}
          >
            {h}:00
          </span>
        ))}
      </div>

      {/* 各ステップ行 */}
      <div className="relative flex flex-col gap-1.5">
        {showNow && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[#3b82f6] z-10"
            style={{ left: `calc(88px + ${nowLeft}% * (100% - 88px) / 100)` }}
          />
        )}
        {blocks.map((block) => {
          const geo = blockGeometry(block);
          const color = BAND_COLOR[block.bandType];
          return (
            <div key={block.stepId} className="flex items-center gap-2">
              <span className="w-[80px] flex-shrink-0 text-[10px] text-[#6b7280] truncate text-right">
                {block.stepLabel}
              </span>
              <div className="relative flex-1 h-5 rounded-md bg-[#f3f4f6] overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 rounded-md flex items-center px-1.5"
                  style={{
                    left: `${geo.left}%`,
                    width: `${geo.width}%`,
                    backgroundColor: color,
                  }}
                  title={`${BAND_LABEL[block.bandType]} ${formatHm(new Date(block.startAt))}–${formatHm(new Date(block.endAt))}`}
                >
                  <span className="text-[8px] font-bold text-white truncate">
                    {BAND_LABEL[block.bandType]}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-2 mt-2 ml-[88px] flex-wrap">
        {(["work", "decision", "saboru", "busy"] as BandType[]).map((b) => (
          <span key={b} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: BAND_COLOR[b] }}
            />
            <span className="text-[9px] text-[#9ca3af]">{BAND_LABEL[b]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
