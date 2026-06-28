/**
 * useVoiceApproval — EXT-03 VoiceApprovalHandler
 *
 * Deterministic state machine for voice-based approval:
 *   idle → awaiting_approval → approved | cancelled | timeout
 *
 * Approval phrases  : 「いいよ」「OK」「うん」「いいね」「はい」「おｋ」「よし」
 * Cancellation phrases: 「やめて」「だめ」「キャンセル」「いや」「いいえ」「やめ」
 * Timeout           : 3 seconds of no match → "timeout" then back to "idle"
 *
 * Pure logic hook — no DOM / audio access. Testable with fake timers.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalState =
  | "idle"
  | "awaiting_approval"
  | "approved"
  | "cancelled"
  | "timeout";

export interface UseVoiceApprovalOptions {
  /** Milliseconds to wait for a phrase before timing out. Default: 3000 */
  timeoutMs?: number;
  /** Called when the state transitions to "approved" */
  onApproved?: () => void;
  /** Called when the state transitions to "cancelled" or "timeout" */
  onRejected?: (reason: "cancelled" | "timeout") => void;
}

export interface UseVoiceApprovalReturn {
  state: ApprovalState;
  /** Begin listening for an approval phrase */
  startListening: () => void;
  /** Manually inject a transcript string (used by STT callbacks and tests) */
  processTranscript: (transcript: string) => void;
  /** Force cancel and return to idle */
  cancel: () => void;
  /** Force approve (used by the "いいよ" button fallback) */
  approve: () => void;
  /** Reset to idle without triggering callbacks */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Phrase lists
// ---------------------------------------------------------------------------

/** Normalized approval phrases (hiragana / ASCII lower) */
const APPROVAL_PHRASES = [
  "いいよ",
  "いいね",
  "うん",
  "はい",
  "よし",
  "ok",
  "おk",
  "おけ",
  "ｏｋ",
  "okay",
];

/** Normalized cancellation phrases */
const CANCELLATION_PHRASES = [
  "やめて",
  "やめ",
  "だめ",
  "キャンセル",
  "きゃんせる",
  "いや",
  "いいえ",
  "no",
  "ノー",
  "のー",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a transcript for phrase matching.
 * Strips spaces, converts full-width ASCII to half-width, lowercases.
 */
export function normalizeTranscript(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );
}

/** Returns true if the normalized transcript contains an approval phrase */
export function isApprovalPhrase(normalized: string): boolean {
  return APPROVAL_PHRASES.some((phrase) => normalized.includes(phrase));
}

/** Returns true if the normalized transcript contains a cancellation phrase */
export function isCancellationPhrase(normalized: string): boolean {
  return CANCELLATION_PHRASES.some((phrase) => normalized.includes(phrase));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 3000;

export function useVoiceApproval(
  options: UseVoiceApprovalOptions = {},
): UseVoiceApprovalReturn {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onApproved, onRejected } = options;

  const [state, setState] = useState<ApprovalState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs for callbacks so the timer closure doesn't hold stale refs
  const onApprovedRef = useRef(onApproved);
  const onRejectedRef = useRef(onRejected);
  useEffect(() => {
    onApprovedRef.current = onApproved;
    onRejectedRef.current = onRejected;
  });

  // ---------------------------------------------------------------------------
  // Timer management
  // ---------------------------------------------------------------------------

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setState("timeout");
      onRejectedRef.current?.("timeout");
      // Auto-reset to idle after brief display period
      timerRef.current = setTimeout(() => {
        setState("idle");
      }, 1500);
    }, timeoutMs);
  }, [clearTimer, timeoutMs]);

  // ---------------------------------------------------------------------------
  // Public actions
  // ---------------------------------------------------------------------------

  const startListening = useCallback(() => {
    clearTimer();
    setState("awaiting_approval");
    startTimer();
  }, [clearTimer, startTimer]);

  const approve = useCallback(() => {
    clearTimer();
    setState("approved");
    onApprovedRef.current?.();
    // Auto-reset to idle
    timerRef.current = setTimeout(() => {
      setState("idle");
    }, 2000);
  }, [clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    setState("cancelled");
    onRejectedRef.current?.("cancelled");
    timerRef.current = setTimeout(() => {
      setState("idle");
    }, 1500);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setState("idle");
  }, [clearTimer]);

  const processTranscript = useCallback(
    (transcript: string) => {
      // Only act when awaiting
      if (state !== "awaiting_approval") return;

      const normalized = normalizeTranscript(transcript);

      if (isApprovalPhrase(normalized)) {
        approve();
      } else if (isCancellationPhrase(normalized)) {
        cancel();
      }
      // Unknown phrase → keep waiting until timeout
    },
    [state, approve, cancel],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    state,
    startListening,
    processTranscript,
    cancel,
    approve,
    reset,
  };
}
