import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isApprovalPhrase,
  isCancellationPhrase,
  normalizeTranscript,
  useVoiceApproval,
} from "./useVoiceApproval";

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe("normalizeTranscript", () => {
  it("trims and lowercases", () => {
    expect(normalizeTranscript("  OK  ")).toBe("ok");
  });

  it("strips spaces", () => {
    expect(normalizeTranscript("い い よ")).toBe("いいよ");
  });

  it("converts full-width ASCII to half-width", () => {
    expect(normalizeTranscript("ＯＫ")).toBe("ok");
  });
});

describe("isApprovalPhrase", () => {
  it.each([
    ["いいよ"],
    ["いいね"],
    ["うん"],
    ["はい"],
    ["よし"],
    ["ok"],
    ["おke"],
    ["okay"],
  ])('recognizes "%s" as approval', (phrase) => {
    expect(isApprovalPhrase(phrase)).toBe(true);
  });

  it("returns false for unrelated phrases", () => {
    expect(isApprovalPhrase("わからない")).toBe(false);
  });
});

describe("isCancellationPhrase", () => {
  it.each([
    ["やめて"],
    ["やめ"],
    ["だめ"],
    ["キャンセル"],
    ["いや"],
    ["いいえ"],
    ["no"],
  ])('recognizes "%s" as cancellation', (phrase) => {
    expect(isCancellationPhrase(phrase)).toBe(true);
  });

  it("returns false for approval phrases", () => {
    expect(isCancellationPhrase("いいよ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hook state machine tests (with fake timers)
// ---------------------------------------------------------------------------

describe("useVoiceApproval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useVoiceApproval());
    expect(result.current.state).toBe("idle");
  });

  it("transitions to awaiting_approval on startListening", () => {
    const { result } = renderHook(() => useVoiceApproval());
    act(() => {
      result.current.startListening();
    });
    expect(result.current.state).toBe("awaiting_approval");
  });

  it("transitions to approved on approval phrase", () => {
    const onApproved = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onApproved }));

    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.processTranscript("いいよ");
    });

    expect(result.current.state).toBe("approved");
    expect(onApproved).toHaveBeenCalledOnce();
  });

  it("transitions to cancelled on cancellation phrase", () => {
    const onRejected = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onRejected }));

    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.processTranscript("やめて");
    });

    expect(result.current.state).toBe("cancelled");
    expect(onRejected).toHaveBeenCalledWith("cancelled");
  });

  it("ignores unrelated transcript while awaiting", () => {
    const { result } = renderHook(() => useVoiceApproval());
    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.processTranscript("わかった");
    });
    // Should still be awaiting, not cancelled/approved
    expect(result.current.state).toBe("awaiting_approval");
  });

  it("ignores transcripts when not awaiting", () => {
    const onApproved = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onApproved }));
    // Don't call startListening — state is idle
    act(() => {
      result.current.processTranscript("いいよ");
    });
    expect(result.current.state).toBe("idle");
    expect(onApproved).not.toHaveBeenCalled();
  });

  it("times out after timeoutMs and calls onRejected", () => {
    const onRejected = vi.fn();
    const { result } = renderHook(() =>
      useVoiceApproval({ timeoutMs: 3000, onRejected }),
    );

    act(() => {
      result.current.startListening();
    });
    expect(result.current.state).toBe("awaiting_approval");

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.state).toBe("timeout");
    expect(onRejected).toHaveBeenCalledWith("timeout");
  });

  it("auto-resets to idle after timeout display period", () => {
    const { result } = renderHook(() => useVoiceApproval({ timeoutMs: 3000 }));

    act(() => {
      result.current.startListening();
    });
    act(() => {
      vi.advanceTimersByTime(3000 + 1500);
    });

    expect(result.current.state).toBe("idle");
  });

  it("auto-resets to idle after approved display period", () => {
    const { result } = renderHook(() => useVoiceApproval());
    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.processTranscript("いいよ");
    });
    expect(result.current.state).toBe("approved");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.state).toBe("idle");
  });

  it("approve() works as button fallback", () => {
    const onApproved = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onApproved }));

    act(() => {
      result.current.approve();
    });

    expect(result.current.state).toBe("approved");
    expect(onApproved).toHaveBeenCalledOnce();
  });

  it("cancel() resets to cancelled then idle", () => {
    const onRejected = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onRejected }));

    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.cancel();
    });

    expect(result.current.state).toBe("cancelled");
    expect(onRejected).toHaveBeenCalledWith("cancelled");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.state).toBe("idle");
  });

  it("reset() returns to idle without callbacks", () => {
    const onRejected = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onRejected }));

    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(onRejected).not.toHaveBeenCalled();
  });

  it("recognizes full-width OK", () => {
    const onApproved = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onApproved }));
    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.processTranscript("ＯＫです");
    });
    expect(result.current.state).toBe("approved");
  });

  it("recognizes partial match inside longer sentence", () => {
    const onApproved = vi.fn();
    const { result } = renderHook(() => useVoiceApproval({ onApproved }));
    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.processTranscript("それでいいよ、お願い");
    });
    expect(result.current.state).toBe("approved");
  });
});
