import type { NewSlackMessagePayload } from "@/messages";
import { describe, expect, it } from "vitest";
import { mergeCandidates } from "./SaborouContext";
import type { TaskCandidate } from "./lib/types";

function live(text: string, threadTs: string): NewSlackMessagePayload {
  return {
    text,
    sender: "送信者",
    channelId: "C1",
    threadTs,
    detectedAt: new Date().toISOString(),
  };
}

function apiCand(
  id: string,
  description: string,
  threadTs?: string,
): TaskCandidate {
  return {
    candidateId: id,
    title: description.slice(0, 60),
    deadline: null,
    requester: "依頼者",
    description,
    sourceType: "slack",
    threadTs,
  };
}

describe("mergeCandidates", () => {
  it("live を先頭、API 候補を後ろに並べる", () => {
    const merged = mergeCandidates(
      [apiCand("c1", "API候補A", "10.1")],
      [live("ライブB", "20.2")],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].description).toBe("ライブB");
    expect(merged[1].description).toBe("API候補A");
  });

  it("threadTs が同じ live と API は重複排除される（live 優先）", () => {
    const merged = mergeCandidates(
      [apiCand("c1", "同じスレッド(API)", "30.3")],
      [live("同じスレッド(live)", "30.3")],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].description).toBe("同じスレッド(live)");
  });

  it("空入力で空配列を返す", () => {
    expect(mergeCandidates([], [])).toEqual([]);
  });
});
